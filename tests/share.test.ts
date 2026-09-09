import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { normalizeShareId, parseGitHubUrl } from "../src/lib/shares.ts";
import { handleShareRequest, type ShareEnv } from "../src/server/shares.ts";

test("App shares authorize admins without storing credentials and isolate repository access", async () => {
  const db = new DatabaseSync(":memory:");
  for (const file of ["0001_shares.sql"]) {
    db.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  }
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const env = {
    DB: {
      prepare(sql: string) {
        return {
          bind: (...values: (string | number)[]) => ({
            async run() {
              return db.prepare(sql).run(...values);
            },
            async first() {
              return db.prepare(sql).get(...values) ?? null;
            },
          }),
        };
      },
    },
    SITE_ORIGIN: "https://share.keysi.dev",
    GITHUB_CLIENT_ID: "test-client",
    GITHUB_CLIENT_SECRET: "client-secret",
    GITHUB_APP_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    SHARE_LIMITER: { limit: async () => ({ success: true }) },
    READ_LIMITER: { limit: async () => ({ success: true }) },
  } as unknown as ShareEnv;
  const originalFetch = globalThis.fetch;
  let admin = true,
    calls = 0,
    issued = 0,
    revoked = 0,
    challenge = "";
  globalThis.fetch = async (input, init) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(init?.redirect, "manual");
    const auth = new Headers(init?.headers).get("authorization");
    if (url.href === "https://github.com/login/oauth/access_token") {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.client_secret, "client-secret");
      assert.equal(createHash("sha256").update(body.code_verifier).digest("base64url"), challenge);
      return Response.json({ access_token: "temporary-user-token" });
    }
    assert.equal(url.origin, "https://api.github.com");
    if (url.pathname === "/applications/test-client/token") {
      assert.equal(init?.method, "DELETE");
      assert.equal(auth, `Basic ${Buffer.from("test-client:client-secret").toString("base64")}`);
      revoked++;
      return new Response(null, { status: 204 });
    }
    if (url.pathname.endsWith("/installation") || url.pathname.endsWith("/access_tokens")) {
      const [header, payload, signature] = (auth?.replace("Bearer ", "") ?? "").split(".");
      assert.ok(
        verify("RSA-SHA256", Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, "base64url")),
      );
      if (url.pathname.endsWith("/installation")) return Response.json({ id: 42 });
      assert.deepEqual(JSON.parse(String(init?.body)), { repository_ids: [123], permissions: { contents: "read" } });
      issued++;
      return Response.json({ token: "installation-token", expires_at: new Date(Date.now() + 3600000).toISOString() });
    }
    if (auth === "Bearer temporary-user-token")
      return Response.json({ id: 123, owner: { login: "Keys" }, name: "demo", permissions: { admin } });
    assert.equal(auth, "Bearer installation-token");
    if (new Headers(init?.headers).get("accept")?.includes("raw")) {
      assert.equal(url.searchParams.get("raw"), null);
      assert.equal(url.searchParams.get("download"), null);
      return new Response(new Uint8Array([0, 128, 255]), { headers: { "Content-Type": "text/html" } });
    }
    if (url.pathname.endsWith("/contents/large.png")) {
      assert.equal(new Headers(init?.headers).get("accept"), "application/vnd.github.object+json");
      return Response.json({ type: "file", encoding: "none", content: "" });
    }
    return Response.json({ name: "demo" });
  };
  const request = async (path: string, init?: RequestInit) => {
    const response = await handleShareRequest(new Request(`https://api.share.keysi.dev${path}`, init), env);
    assert.ok(response);
    return response;
  };
  const authorize = async () => {
    const start = await request("/api/auth/start?owner=keys&repo=demo");
    assert.equal(start.status, 302);
    const url = new URL(start.headers.get("location") ?? "");
    assert.equal(url.origin, "https://github.com");
    challenge = url.searchParams.get("code_challenge") ?? "";
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    const cookie = start.headers.get("set-cookie");
    assert.ok(cookie);
    for (const flag of ["HttpOnly", "SameSite=Lax", "Secure"]) assert.ok(cookie.includes(flag));
    return { state: url.searchParams.get("state") ?? "", cookie: cookie.split(";")[0] };
  };
  try {
    assert.equal((await request("/api/shares", { method: "POST", body: '{"token":"PAT"}' })).status, 410);
    assert.equal(calls, 0);
    const { state, cookie } = await authorize();
    assert.equal((await request(`/api/auth/callback?code=code&state=${state}`)).status, 400);
    const created = await request(`/api/auth/callback?code=code&state=${state}`, { headers: { Cookie: cookie } });
    assert.equal(created.status, 302);
    const link = new URL(created.headers.get("location") ?? "");
    assert.equal(link.origin, env.SITE_ORIGIN);
    const path = new URLSearchParams(link.hash.slice(1)).get("share");
    assert.ok(path);
    assert.match(path, /^\/keys\/[2-9a-hj-km-z]{4}(?:-[2-9a-hj-km-z]{4}){3}$/);
    const stored = db.prepare("SELECT * FROM shares").get();
    assert.ok(stored);
    assert.equal(stored.repository_id, 123);
    assert.equal(stored.installation_id, 42);
    assert.ok(!("token" in stored));
    assert.notEqual(stored.id, path.split("/").pop());
    assert.match(String(stored.id), /^[a-f0-9]{64}$/);
    assert.equal(revoked, 1);
    assert.equal(
      (await request(`/api/auth/callback?code=code&state=${state}`, { headers: { Cookie: cookie } })).status,
      400,
    );
    assert.deepEqual(await (await request(`/api/shares${path}`)).json(), { owner: "keys", repo: "demo" });
    assert.deepEqual(await (await request(`/api/shares${path.toUpperCase()}`)).json(), { owner: "keys", repo: "demo" });
    const proxy = `/api/github${path}`;
    const responses = await Promise.all([request(`${proxy}/repos/keys/demo`), request(`${proxy}/repos/keys/demo`)]);
    assert.ok(responses.every((response) => response.status === 200));
    assert.equal(issued, 1);
    const image = await request(`${proxy}/repos/keys/demo/contents/image.png?raw=1&ref=main`);
    assert.equal(image.headers.get("content-type"), "image/png");
    assert.equal(image.headers.get("cache-control"), "no-store");
    assert.equal(image.headers.get("content-disposition"), null);
    assert.match(image.headers.get("content-security-policy") ?? "", /sandbox/);
    assert.deepEqual(new Uint8Array(await image.arrayBuffer()), new Uint8Array([0, 128, 255]));
    assert.equal(
      (await request(`${proxy}/repos/keys/demo/contents/image.png?raw=1&download=1`)).headers.get(
        "content-disposition",
      ),
      "attachment",
    );
    assert.equal(
      (
        await request(`${proxy}/repos/keys/demo/contents/large.png`, {
          headers: { Accept: "application/vnd.github.object+json" },
        })
      ).status,
      200,
    );
    assert.equal(
      (await request(`${proxy}/repos/keys/demo/contents/index.html?raw=1`)).headers.get("content-type"),
      "text/plain; charset=utf-8",
    );
    const beforeDenied = calls;
    for (const suffix of [
      "/user",
      "/repos/keys/other",
      "/repos/keys/demo/issues",
      "/repos/keys/demo/contents/%252e%252e%252fother",
    ])
      assert.equal((await request(proxy + suffix)).status, 403);
    assert.equal((await request(`${proxy}/repos/keys/demo`, { method: "POST" })).status, 405);
    assert.equal(
      (await request(`${proxy}/repos/keys/demo`, { headers: { Origin: "https://evil.example" } })).status,
      403,
    );
    assert.equal(calls, beforeDenied);
    const cors = await request(`${proxy}/repos/keys/demo`, { method: "OPTIONS", headers: { Origin: env.SITE_ORIGIN } });
    assert.equal(cors.status, 204);
    assert.equal(cors.headers.get("access-control-allow-origin"), env.SITE_ORIGIN);
    assert.match(cors.headers.get("access-control-allow-headers") ?? "", /user-agent/i);
    const limitKeys: string[] = [];
    env.READ_LIMITER.limit = async ({ key }) => {
      limitKeys.push(key);
      return { success: false };
    };
    assert.equal((await request(`/api/shares${path}`)).status, 429);
    assert.equal((await request("/api/shares/keys/2222-3333-4444-5555")).status, 429);
    assert.equal((await request(`${proxy}/repos/keys/demo`)).status, 429);
    assert.equal(new Set(limitKeys).size, 1);
    env.READ_LIMITER.limit = async () => ({ success: true });
    db.prepare("UPDATE shares SET expires_at = 0").run();
    assert.equal((await request(`${proxy}/repos/keys/demo`)).status, 404);
    admin = false;
    const denied = await authorize();
    assert.equal(
      (await request(`/api/auth/callback?code=code&state=${denied.state}`, { headers: { Cookie: denied.cookie } }))
        .status,
      403,
    );
    assert.equal(revoked, 2);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM shares").get()?.count, 1);
    env.SHARE_LIMITER.limit = async () => ({ success: false });
    assert.equal((await request("/api/auth/start?owner=keys&repo=demo")).status, 429);
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});

test("repository input rejects lookalike hosts and traversal", () => {
  assert.deepEqual(parseGitHubUrl("https://github.com/keys/demo.git"), { owner: "keys", repo: "demo" });
  for (const input of [
    "https://github.com@evil.example/keys/demo",
    "keys/..",
    "keys/demo/other",
    "javascript:alert(1)",
  ])
    assert.equal(parseGitHubUrl(input), null);
});

test("share codes normalize uppercase and reject malformed inputs", () => {
  assert.equal(normalizeShareId("7M4K-P9RX-2W6C-8H3N"), "7m4k-p9rx-2w6c-8h3n");
  for (const id of ["repo", "mygithubprojectx", "7m4k-p9rx-2w6c", "7m4k-p9rx-2w6c-8h3n/other", "iiii-0000-1111-llll"])
    assert.equal(normalizeShareId(id), null);
});
