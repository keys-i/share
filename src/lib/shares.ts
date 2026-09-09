export function parseGitHubUrl(input: string): { owner: string; repo: string } | null {
  let path = input.trim();
  if (path.includes("://") || /^(?:www\.)?github\.com\//i.test(path)) {
    try {
      const url = new URL(path.includes("://") ? path : `https://${path}`);
      if (
        !["https:", "http:"].includes(url.protocol) ||
        !["github.com", "www.github.com"].includes(url.hostname) ||
        url.username ||
        url.password ||
        url.port
      )
        return null;
      path = url.pathname.replace(/^\//, "").replace(/\/$/, "");
    } catch {
      return null;
    }
  }
  const match = path.match(/^([a-z\d](?:[a-z\d-]{0,37}[a-z\d])?)\/([\w.-]{1,100})$/i);
  if (!match) return null;
  const repo = match[2].replace(/\.git$/, "");
  return repo && repo !== "." && repo !== ".." ? { owner: match[1], repo } : null;
}

export const SHARE_API_ORIGIN = (import.meta.env?.VITE_SHARE_API_ORIGIN || `https://${domains.api}`).replace(/\/$/, "");

export function shareAuthorizationUrl(owner: string, repo: string): string {
  return `${SHARE_API_ORIGIN}/api/auth/start?${new URLSearchParams({ owner, repo })}`;
}

export function normalizeShareId(id: string): string | null {
  return /^[2-9a-hj-km-z]{4}(?:-[2-9a-hj-km-z]{4}){3}$/i.test(id) ? id.toLowerCase() : null;
}

export function repositoryShortcut(path: string): string | null {
  const value = path.replace(/^\//, "").replace(/\/$/, "");
  if (value.split("/").length !== 2) return null;
  const repo = parseGitHubUrl(value);
  return repo && !normalizeShareId(repo.repo) ? `${repo.owner}/${repo.repo}` : null;
}

export async function resolveSharedRepo(owner: string, id: string): Promise<{ owner: string; repo: string } | null> {
  const shareId = normalizeShareId(id);
  if (!shareId) return null;
  const response = await fetch(`${SHARE_API_ORIGIN}/api/shares/${encodeURIComponent(owner)}/${shareId}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(response.status === 404 ? "Link expired or not found" : "Sharing service unavailable");
  return response.json();
}

import { domains } from "../../tools/config/domains.config.ts";
