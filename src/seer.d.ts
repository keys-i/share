declare module "virtual:share-locales" {
  export type LocaleContent = {
    locale: string;
    text: typeof import("../tools/config/locales/en.json").ui;
  };
  export type LocaleMetadata = Omit<import("@keys-i/seer").HeadData, "jsonLd"> & {
    locale: string;
    path: string;
    label: string;
    jsonLd: string;
  };
  export const locales: LocaleMetadata[];
  export const defaultLocale: string;
  export const loaders: Record<string, () => Promise<LocaleContent>>;
}
