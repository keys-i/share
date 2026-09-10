import { createHash } from "node:crypto";
import { copyFileSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { robotsTxt, sitemapXml } from "@keys-i/seer";
import { loadEnv } from "vite";
import { domains } from "../config/domains.config.ts";
import { localeMetadata, seerProject } from "../config/seer.config.ts";

const env = loadEnv("production", fileURLToPath(new URL("../config", import.meta.url)), "VITE_");
const api = new URL(process.env.VITE_SHARE_API_ORIGIN || env.VITE_SHARE_API_ORIGIN || `https://${domains.api}`);
if (!["https:", "http:"].includes(api.protocol)) throw new Error("The share API must use HTTP or HTTPS");

for (const [input, output] of [
  ...localeMetadata.map(({ path }) => [`${path.slice(1)}index.html`, `${path.slice(1)}index.html`]),
  ["_shell.html", "404.html"],
]) {
  // Escape serialized route separators before HTML parsing can replace null bytes
  let html = readFileSync(`dist/client/${input}`, "utf8").replaceAll("\0", "\\u0000");
  if (output === "404.html") {
    // Keep share and shortcut URLs out of search indexes before JavaScript runs
    const robots = /<meta name="robots" content="[^"]*"\/?>/g;
    if (!robots.test(html)) throw new Error("The app shell is missing its robots policy");
    html = html.replace(robots, '<meta name="robots" content="noindex, nofollow"/>');
    html = html.replace(/<link rel="canonical"[^>]*>/g, "");
  }
  const hashes = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(
    ([, source]) => `'sha256-${createHash("sha256").update(source).digest("base64")}'`,
  );
  const policy = [
    "default-src 'self'",
    `script-src 'self' ${[...new Set(hashes)].join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' https://api.github.com ${api.origin}`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `media-src 'self' blob: data: https://raw.githubusercontent.com ${api.origin}`,
    `frame-src blob: ${api.origin}`,
    "object-src 'none'",
    "base-uri 'none'",
    `form-action 'self' ${api.origin}`,
  ].join("; ");
  html = html.replace(
    /<meta charset="utf-8"\/?\s*>/i,
    `$&<meta http-equiv="Content-Security-Policy" content="${policy}">`,
  );
  writeFileSync(`dist/client/${output}`, html);
}
unlinkSync("dist/client/_shell.html");
writeFileSync("dist/client/CNAME", `${domains.app}\n`);
writeFileSync("dist/client/.nojekyll", "");
writeFileSync(
  "dist/client/robots.txt",
  robotsTxt(seerProject).replace(
    "Disallow: /",
    `Disallow: /\n${localeMetadata.map(({ path }) => `Allow: ${path}$`).join("\n")}\nAllow: /assets/\nAllow: /favicon.svg`,
  ),
);
writeFileSync("dist/client/sitemap.xml", sitemapXml(seerProject));
copyFileSync("docs/SELF_HOSTING.md", "dist/client/self-hosting.md");
copyFileSync("LICENSE", "dist/client/LICENSE");
