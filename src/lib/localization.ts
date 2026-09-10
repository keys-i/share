import { defaultLocale, loaders, locales } from "virtual:share-locales";
export { defaultLocale, locales };
export type { LocaleContent } from "virtual:share-locales";

export function localeForPath(path: string) {
  return locales.find((locale) => locale.path.replace(/\/$/, "") === path.replace(/\/$/, ""));
}

export function loadLocale(locale: string) {
  if (!locales.some((entry) => entry.locale === locale)) throw new Error(`Unknown locale: ${locale}`);
  return loaders[locale]();
}

export function languageHref(path: string, repository: string, shareLink: string) {
  const fragment = new URLSearchParams();
  if (shareLink) fragment.set("share", new URL(shareLink).pathname);
  else if (repository) fragment.set("repo", repository);
  return `${path}${fragment.size ? `#${fragment}` : ""}`;
}
