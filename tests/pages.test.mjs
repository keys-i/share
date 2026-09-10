import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { domains } from "../tools/config/domains.config.ts";
import { localeMetadata, seerProject } from "../tools/config/seer.config.ts";

test("Pages prerenders ten localized homepages and keeps deep links in a noindex app shell", () => {
  const home = readFileSync("dist/client/index.html", "utf8");
  const fallback = readFileSync("dist/client/404.html", "utf8");
  assert.match(home, /<h1\b[^>]*>Share a private GitHub repository/);
  assert.match(home, /"name":"share\.git"/);
  assert.ok(!home.includes("Built on Jason Xie"));
  for (const section of ["features", "how-it-works", "use-cases", "self-host"]) {
    assert.match(home, new RegExp(`id="[^"]+-${section}"`), section);
  }
  assert.match(home, /name="robots" content="index, follow"/);
  assert.ok(home.includes(`rel="canonical" href="https://${domains.app}/"`));
  assert.match(home, /type="application\/ld\+json"/);
  assert.match(fallback, /name="robots" content="noindex, nofollow"/);
  assert.ok(!fallback.includes('rel="canonical"'));
  assert.ok(!fallback.includes('rel="alternate"'));
  assert.ok(!fallback.includes('type="application/ld+json"'));
  assert.ok(!existsSync("dist/client/_shell.html"));
  assert.equal(readFileSync("dist/client/CNAME", "utf8").trim(), domains.app);
  assert.equal(readFileSync("dist/client/LICENSE", "utf8"), readFileSync("LICENSE", "utf8"));
  assert.equal(readFileSync("dist/client/self-hosting.md", "utf8"), readFileSync("docs/SELF_HOSTING.md", "utf8"));
  const robots = readFileSync("dist/client/robots.txt", "utf8");
  assert.match(robots, /Disallow: \/\n/);
  const sitemap = readFileSync("dist/client/sitemap.xml", "utf8");
  assert.equal((sitemap.match(/<loc>/g) ?? []).length, 10);
  assert.ok(sitemap.includes(`<loc>https://${domains.app}/</loc>`));

  const pages = localeMetadata.map((entry) => {
    const html = readFileSync(`dist/client${entry.path}index.html`, "utf8");
    const document = new JSDOM(html).window.document;
    assert.equal(document.documentElement.lang, entry.locale);
    assert.equal(document.documentElement.dir, entry.locale === "ar" ? "rtl" : "ltr");
    assert.equal(document.title, seerProject.content[entry.locale].seo.pages.home.title);
    assert.equal(document.querySelector("h1").textContent, seerProject.content[entry.locale].ui.heading);
    assert.equal(document.querySelector('meta[name="description"]').content, entry.description);
    assert.equal(document.querySelector('meta[name="robots"]').content, "index, follow");
    assert.equal(document.querySelector('link[rel="canonical"]').href, entry.canonical);
    const alternates = [...document.querySelectorAll('link[rel="alternate"]')];
    assert.equal(alternates.length, 11);
    for (const [lang, href] of Object.entries(entry.alternates))
      assert.equal(alternates.find((link) => link.hreflang === lang)?.href, href);
    assert.equal(
      JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)["@context"],
      "https://schema.org",
    );
    assert.equal(
      document.querySelector(".share-language-toggle").getAttribute("aria-label"),
      seerProject.content[entry.locale].ui.language,
    );
    assert.ok(robots.includes(`Allow: ${entry.path}$\n`));
    assert.ok(sitemap.includes(`<loc>${entry.canonical}</loc>`));
    return html;
  });
  assert.equal((robots.match(/^Allow: \/.*\$$/gm) ?? []).length, 10);
  for (const html of [...pages, fallback]) {
    assert.match(html.slice(0, 1024), /<meta charset="utf-8"/i);
    const policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
    assert.ok(policy);
    const scripts = policy.match(/script-src ([^;]+)/)?.[1] ?? "";
    assert.ok(!scripts.includes("unsafe-inline"));
    const document = new JSDOM(html).window.document;
    for (const script of document.scripts) {
      assert.ok(scripts.includes(`'sha256-${createHash("sha256").update(script.textContent).digest("base64")}'`));
    }
    assert.match(html, /name="referrer" content="no-referrer"/);
    assert.match(policy, /object-src 'none'/);
    assert.ok(!html.includes("GITHUB_APP_PRIVATE_KEY"));
  }
});
