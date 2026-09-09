import { createHash, randomBytes, sign } from "node:crypto";
import { getMimeType } from "../lib/file-utils.ts";
import { normalizeShareId } from "../lib/shares.ts";

export type ShareEnv = {
  DB: {
    prepare(sql: string): {
      bind(...values: (string | number)[]): {
        first<T>(): Promise<T | null>;
        run(): Promise<unknown>;
      };
    };
  };
  SITE_ORIGIN: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_APP_PRIVATE_KEY: string;
  SHARE_LIMITER: { limit(input: { key: string }): Promise<{ success: boolean }> };
  READ_LIMITER: { limit(input: { key: string }): Promise<{ success: boolean }> };
};

type Share = { owner: string; repo: string; repository_id: number; installation_id: number };
type Repository = { id: number; owner: { login: string }; name: string; permissions?: { admin?: boolean } };
const ownerPattern = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;
const repoPattern = /^(?!\.{1,2}$)[\w.-]{1,100}$/;
const headers = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Frame-Options": "DENY",
};
const tokens = new Map<string, { expires: number; token: Promise<string> }>();

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers });
}
function fail(status: number, message: string): never {
  throw json({ message }, status);
}
function random(size = 16) {
  return randomBytes(size).toString("base64url");
}

async function github(path: string, authorization: string, init: RequestInit = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "private-share-link",
      "X-GitHub-Api-Version": "2026-03-10",
      "Content-Type": "application/json",
      ...init.headers,
      Authorization: authorization,
    },
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
}

function appAuthorization(env: ShareEnv) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_APP_PRIVATE_KEY) fail(503, "Configure the GitHub App before sharing");
  const now = Math.floor(Date.now() / 1000);
  const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const payload = `${encoded({ alg: "RS256", typ: "JWT" })}.${encoded({ iat: now - 60, exp: now + 540, iss: env.GITHUB_CLIENT_ID })}`;
  return `Bearer ${payload}.${sign("RSA-SHA256", Buffer.from(payload), env.GITHUB_APP_PRIVATE_KEY).toString("base64url")}`;
}

function installationToken(share: Share, env: ShareEnv) {
  const cacheKey = `${env.GITHUB_CLIENT_ID}/${share.installation_id}/${share.repository_id}`;
  const cached = tokens.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.token;
  tokens.delete(cacheKey);
  const oldest = tokens.keys().next().value;
  if (tokens.size >= 100 && oldest) tokens.delete(oldest);
  const entry = { expires: Date.now() + 50 * 60_000, token: Promise.resolve("") };
  entry.token = (async () => {
    const response = await github(`/app/installations/${share.installation_id}/access_tokens`, appAuthorization(env), {
      method: "POST",
      body: JSON.stringify({ repository_ids: [share.repository_id], permissions: { contents: "read" } }),
    });
    if (!response.ok) fail(502, "App access is unavailable; check its repository installation");
    const data = (await response.json()) as { token?: string; expires_at?: string };
    const expires = Date.parse(data.expires_at ?? "");
    if (!data.token || !Number.isFinite(expires) || expires <= Date.now())
      fail(502, "GitHub returned an invalid installation token");
    entry.expires = Math.min(entry.expires, expires - 60_000);
    return data.token;
  })().catch((error) => {
    tokens.delete(cacheKey);
    throw error;
  });
  tokens.set(cacheKey, entry);
  return entry.token;
}

async function startAuthorization(request: Request, url: URL, env: ShareEnv) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.GITHUB_APP_PRIVATE_KEY)
    fail(503, "Configure the GitHub App before sharing");
  const limit = await env.SHARE_LIMITER.limit({ key: request.headers.get("CF-Connecting-IP") ?? "local" });
  if (!limit.success) fail(429, "Too many requests; try again in a minute");
  const owner = url.searchParams.get("owner") ?? "";
  const repo = url.searchParams.get("repo") ?? "";
  if (!ownerPattern.test(owner) || !repoPattern.test(repo)) fail(400, "Enter a valid repository");
  const state = random(32),
    verifier = random(32);
  await env.DB.prepare("INSERT INTO authorizations (state, owner, repo, expires_at) VALUES (?, ?, ?, ?)")
    .bind(state, owner, repo, Date.now() + 600_000)
    .run();
  const authorization = new URL("https://github.com/login/oauth/authorize");
  authorization.search = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: `${url.origin}/api/auth/callback`,
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  return new Response(null, {
    status: 302,
    headers: {
      ...headers,
      Location: authorization.href,
      "Set-Cookie": `__Host-share-auth=${state}.${verifier}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`,
    },
  });
}

async function finishAuthorization(request: Request, url: URL, env: ShareEnv) {
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code");
  const cookie = request.headers
    .get("cookie")
    ?.split("; ")
    .find((part) => part.startsWith("__Host-share-auth="))
    ?.slice("__Host-share-auth=".length);
  const [cookieState, verifier] = cookie?.split(".") ?? [];
  if (!code || !/^[\w-]{43}$/.test(state) || state !== cookieState || !/^[\w-]{43}$/.test(verifier ?? ""))
    fail(400, "Sign-in expired or could not be verified; start again");
  const pending = await env.DB.prepare(
    "DELETE FROM authorizations WHERE state = ? AND expires_at > ? RETURNING owner, repo",
  )
    .bind(state, Date.now())
    .first<{ owner: string; repo: string }>();
  if (!pending) fail(400, "Sign-in expired or was already used; start again");
  const exchange = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      code_verifier: verifier,
      redirect_uri: `${url.origin}/api/auth/callback`,
    }),
  });
  if (!exchange.ok) fail(502, "GitHub sign-in failed; start again");
  const credentials = (await exchange.json()) as { access_token?: string };
  if (!credentials.access_token) fail(400, "GitHub sign-in was denied or expired");
  let repository: Repository;
  try {
    const response = await github(`/repos/${pending.owner}/${pending.repo}`, `Bearer ${credentials.access_token}`);
    if (!response.ok) fail(403, "Install the GitHub App on this repository and sign in as a repository admin");
    repository = (await response.json()) as Repository;
    if (!repository.permissions?.admin) fail(403, "Only repository admins can create share links");
    if (
      repository.owner?.login?.toLowerCase() !== pending.owner.toLowerCase() ||
      repository.name?.toLowerCase() !== pending.repo.toLowerCase() ||
      !Number.isSafeInteger(repository.id)
    )
      fail(400, "Use the repository's current owner and name");
  } finally {
    const revoked = await github(
      `/applications/${env.GITHUB_CLIENT_ID}/token`,
      `Basic ${Buffer.from(`${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`).toString("base64")}`,
      { method: "DELETE", body: JSON.stringify({ access_token: credentials.access_token }) },
    );
    if (!revoked.ok) fail(502, "Could not end the temporary GitHub sign-in; no link was created");
  }
  const response = await github(
    `/repos/${repository.owner.login}/${repository.name}/installation`,
    appAuthorization(env),
  );
  if (!response.ok) fail(403, "Install the GitHub App on this repository before creating a link");
  const installation = (await response.json()) as { id: number };
  if (!Number.isSafeInteger(installation.id)) fail(502, "GitHub returned an invalid installation");
  const owner = repository.owner.login.toLowerCase(),
    id = Array.from(randomBytes(16), (byte) => "23456789abcdefghjkmnopqrstuvwxyz"[byte & 31])
      .join("")
      .replace(/(.{4})(?=.)/g, "$1-");
  await env.DB.prepare(
    "INSERT INTO shares (id, owner, repo, repository_id, installation_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(
      createHash("sha256").update(id).digest("hex"),
      owner,
      repository.name,
      repository.id,
      installation.id,
      Date.now() + 7 * 86400_000,
    )
    .run();
  const target = new URL(env.SITE_ORIGIN);
  target.hash = new URLSearchParams({ share: `/${owner}/${id}` }).toString();
  return new Response(null, {
    status: 302,
    headers: {
      ...headers,
      Location: target.href,
      "Set-Cookie": "__Host-share-auth=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0",
    },
  });
}

async function resolveShare(owner: string, id: string, env: ShareEnv) {
  const shareId = normalizeShareId(id);
  if (!ownerPattern.test(owner) || !shareId) fail(404, "Link expired or not found");
  const share = await env.DB.prepare(
    "SELECT owner, repo, repository_id, installation_id FROM shares WHERE owner = ? AND id = ? AND expires_at > ?",
  )
    .bind(owner.toLowerCase(), createHash("sha256").update(shareId).digest("hex"), Date.now())
    .first<Share>();
  if (!share) fail(404, "Link expired or not found");
  return share;
}

async function proxy(request: Request, url: URL, owner: string, id: string, rawPath: string, env: ShareEnv) {
  const share = await resolveShare(owner, id, env);
  let path: string;
  try {
    path = decodeURIComponent(rawPath);
  } catch {
    fail(403, "Invalid repository path");
  }
  if (
    /[\\%]/.test(path) ||
    Array.from(path).some((character) => character.charCodeAt(0) < 32) ||
    path.split("/").some((part) => part === "." || part === "..")
  )
    fail(403, "Invalid repository path");
  const prefix = `/repos/${share.owner}/${share.repo}`;
  const suffix = path.slice(prefix.length);
  if (
    path !== "/rate_limit" &&
    (path.slice(0, prefix.length).toLowerCase() !== prefix.toLowerCase() ||
      !/^(?:|\/branches|\/contributors|\/git\/trees\/.+|\/contents(?:\/.*)?|\/commits(?:\/[^/]+)?)$/.test(suffix))
  )
    fail(403, "This link only grants read access to its repository");
  const query = new URLSearchParams();
  for (const [name, value] of url.searchParams)
    if (["ref", "recursive", "page", "per_page", "sha", "path", "since", "until", "anon"].includes(name))
      query.append(name, value);
  const rawFile = url.searchParams.get("raw") === "1";
  if (rawFile && !/^\/contents\/.+/.test(suffix)) fail(403, "Raw access requires a repository file");
  const accept =
    rawFile || request.headers.get("accept")?.includes("application/vnd.github.raw")
      ? "application/vnd.github.raw+json"
      : request.headers.get("accept")?.includes("application/vnd.github.object")
        ? "application/vnd.github.object+json"
        : "application/vnd.github+json";
  const token = await installationToken(share, env);
  const upstream = await github(`${rawPath}${query.size ? `?${query}` : ""}`, `Bearer ${token}`, {
    headers: { Accept: accept },
  });
  if (!upstream.ok) {
    if (upstream.status === 401)
      tokens.delete(`${env.GITHUB_CLIENT_ID}/${share.installation_id}/${share.repository_id}`);
    fail(
      upstream.status >= 400 ? upstream.status : 502,
      "Repository unavailable; App access may have been removed or rate limited",
    );
  }
  const responseHeaders = new Headers(headers);
  const mime = rawFile ? getMimeType(path) : "application/octet-stream";
  responseHeaders.set(
    "Content-Type",
    accept.includes("raw")
      ? mime === "application/octet-stream"
        ? "text/plain; charset=utf-8"
        : mime
      : "application/json",
  );
  if (accept.includes("raw")) {
    if (url.searchParams.get("download") === "1") responseHeaders.set("Content-Disposition", "attachment");
    // Untrusted repository files cannot execute with the API's origin
    responseHeaders.set(
      "Content-Security-Policy",
      `sandbox; default-src 'none'; style-src 'unsafe-inline'; frame-ancestors ${env.SITE_ORIGIN}`,
    );
    responseHeaders.delete("X-Frame-Options");
  }
  for (const name of ["link", "x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset", "x-ratelimit-used"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export async function handleShareRequest(request: Request, env: ShareEnv): Promise<Response> {
  const url = new URL(request.url);
  let response: Response;
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== env.SITE_ORIGIN) fail(403, "Origin not allowed");
    if (request.method === "OPTIONS") response = new Response(null, { status: 204, headers });
    else if (url.pathname === "/api/shares")
      fail(410, "PAT sharing was removed; create a link with GitHub App sign-in");
    else {
      if (request.method !== "GET") fail(405, "Method not allowed");
      if (url.pathname === "/api/auth/start") response = await startAuthorization(request, url, env);
      else if (url.pathname === "/api/auth/callback") response = await finishAuthorization(request, url, env);
      else {
        const match = url.pathname.match(/^\/api\/(shares|github)\/([^/]+)\/([^/]+)(\/.*)?$/);
        if (!match) fail(404, "Not found");
        const [, kind, owner, id, path = ""] = match;
        const limit = await env.READ_LIMITER.limit({ key: request.headers.get("CF-Connecting-IP") ?? "local" });
        if (!limit.success) fail(429, "Too many requests; try again in a minute");
        if (kind === "shares") {
          if (path) fail(404, "Link not found");
          const share = await resolveShare(owner, id, env);
          response = json({ owner: share.owner, repo: share.repo });
        } else response = await proxy(request, url, owner, id, path, env);
      }
    }
  } catch (error) {
    if (error instanceof Response) response = error;
    else {
      console.error("Share request failed", error instanceof Error ? error.name : "Unknown error");
      response = json({ message: "Sharing service unavailable; try again later" }, 500);
    }
  }
  response.headers.set("Access-Control-Allow-Origin", env.SITE_ORIGIN);
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Accept, Content-Type, User-Agent, X-GitHub-Api-Version");
  response.headers.set(
    "Access-Control-Expose-Headers",
    "Link, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-RateLimit-Used",
  );
  response.headers.set("Vary", "Origin");
  return response;
}
