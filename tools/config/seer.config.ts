import { headData, readProject, serializeJsonLd } from "@keys-i/seer";
import type { Plugin } from "vite";
import { domains } from "./domains.config.ts";

export const seerProject = await readProject({
  dir: new URL("./locales/", import.meta.url),
  validate(content, locale) {
    const ui = content.ui as Record<string, unknown>;
    if (!ui || Object.values(ui).some((value) => typeof value !== "string" || !value.trim()))
      throw new Error(`${locale}: UI messages must be non-empty strings`);
    if (typeof ui.shortcutDescription !== "string" || ui.shortcutDescription.split("{domain}").length !== 2)
      throw new Error(`${locale}: shortcutDescription must contain {domain} exactly once`);
  },
});
if (seerProject.config.site.url !== `https://${domains.app}/`)
  throw new Error("Seer site.url must match the frontend domain in domains.config.ts");

export const localeMetadata = seerProject.locales.map((locale) => {
  const { jsonLd, ...head } = headData(seerProject, locale, "home");
  const path = new URL(head.canonical).pathname;
  if (path !== (locale === seerProject.config.defaultLocale ? "/" : `/${locale.toLowerCase()}/`))
    throw new Error(`${locale}: homepage path must be / or /<locale>/`);
  return {
    ...head,
    locale,
    path,
    label: new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale,
    jsonLd: serializeJsonLd(jsonLd),
  };
});

export function seerPlugin(): Plugin {
  const entry = "virtual:share-locales";
  const prefix = "virtual:share-locale/";
  return {
    name: "share-seer",
    resolveId(id) {
      if (id === entry || id.startsWith(prefix)) return `\0${id}`;
    },
    load(id) {
      if (id === `\0${entry}`) {
        const loaders = seerProject.locales.map(
          (locale) =>
            `${JSON.stringify(locale)}:()=>import(${JSON.stringify(prefix + locale)}).then(module=>module.default)`,
        );
        return `export const locales=${JSON.stringify(localeMetadata)};export const defaultLocale=${JSON.stringify(seerProject.config.defaultLocale)};export const loaders={${loaders.join(",")}};`;
      }
      if (id.startsWith(`\0${prefix}`)) {
        const locale = id.slice(prefix.length + 1);
        if (!seerProject.locales.includes(locale)) throw new Error(`Unknown locale: ${locale}`);
        return `export default ${JSON.stringify({ locale, text: seerProject.content[locale].ui })};`;
      }
    },
  };
}
