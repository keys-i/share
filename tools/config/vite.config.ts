import { fileURLToPath, URL } from "node:url";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { localeMetadata, seerPlugin } from "./seer.config.ts";

export default defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  envDir: fileURLToPath(new URL(".", import.meta.url)),
  resolve: { alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)) } },
  // Keep the browser support provided by Vite 7
  build: { target: ["chrome107", "edge107", "firefox104", "safari16"] },
  plugins: [
    seerPlugin(),
    tailwindcss(),
    tanstackStart({
      spa: { enabled: true, maskPath: "/__shell" },
      prerender: { enabled: true, crawlLinks: false, autoStaticPathsDiscovery: false },
      pages: localeMetadata.map(({ path }) => ({ path })),
    }),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
});
