import { describe, expect, it } from "vitest";
import { languageHref, loadLocale, localeForPath, locales } from "./localization";

describe("localized public pages", () => {
  it("keeps invalid URLs inside their route boundary during shell hydration", async () => {
    const { Route: localeRoute } = await import("../routes/$locale");
    const { Route: repositoryRoute } = await import("../routes/$");
    for (const [route, params, routeId] of [
      [localeRoute, { locale: "unknown" }, "/$locale"],
      [repositoryRoute, { _splat: "__invalid/path" }, "/$"],
    ] as const) {
      const loader = route.options.loader;
      if (typeof loader !== "function") throw new Error("Expected a route loader");
      await expect(Promise.resolve().then(() => loader({ params } as never))).rejects.toMatchObject({
        isNotFound: true,
        routeId,
      });
    }
  });

  it("loads the ten complete catalogs and distinguishes languages from repository paths", async () => {
    expect(locales.map(({ locale }) => locale).sort()).toEqual([
      "ar",
      "de",
      "en",
      "es",
      "fr",
      "hi",
      "ja",
      "ko",
      "pt",
      "zh-Hans",
    ]);
    for (const entry of locales) {
      const content = await loadLocale(entry.locale);
      expect(content.locale).toBe(entry.locale);
      expect(content.text.heading).toBeTruthy();
      expect(localeForPath(entry.path)?.locale).toBe(entry.locale);
      expect(entry.dir).toBe(entry.locale === "ar" ? "rtl" : "ltr");
    }
    expect(localeForPath("/es")?.locale).toBe("es");
    for (const path of ["/octocat/repo", "/ar/repo", "/keys/7m4k-p9rx-2w6c-8h3n", "/unknown/"])
      expect(localeForPath(path)).toBeUndefined();
    expect(() => loadLocale("constructor")).toThrow("Unknown locale");
  });

  it("keeps prefilled repositories and share codes in fragments when switching languages", () => {
    const repository = new URL(languageHref("/es/", "octocat/Hello-World", ""), "https://share.example");
    expect(repository.pathname).toBe("/es/");
    expect(repository.search).toBe("");
    expect(new URLSearchParams(repository.hash.slice(1)).get("repo")).toBe("octocat/Hello-World");
    const share = new URL(
      languageHref("/ar/", "octocat/repo", "https://share.example/octocat/7m4k-p9rx-2w6c-8h3n"),
      repository,
    );
    expect(share.search).toBe("");
    expect(new URLSearchParams(share.hash.slice(1)).get("share")).toBe("/octocat/7m4k-p9rx-2w6c-8h3n");
    expect(languageHref("/", "", "")).toBe("/");
  });
});
