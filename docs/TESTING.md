# Testing

Run from the repository root with Node.js 24.18 or newer:

```sh
npm ci --ignore-scripts --allow-git=none
npm run build
npm run validate
```

The npm commands select the configurations in `tools/config/` and scripts in `tools/script/`. The build generates the route tree and static Pages HTML. Validation checks Biome, TypeScript, component/API tests, the Worker security flow, and the generated Pages artifact. `private-github-link/` is a study reference and is not a test or build input.

```sh
npm test
npm run test:watch
node --test tests/share.test.ts
npm run test:pages
```

Vitest uses MSW with unhandled requests rejected. Node signals are used for Node's fetch implementation; jsdom owns browser storage. All GitHub calls are mocked.

Vitest 4 uses the same Vite 8 installation as the build. Its worker `execArgv` disables Node's experimental web storage so jsdom remains the storage implementation. `npm run test:coverage` includes application source under `src/`, including files not reached by tests, with the exclusions in `tools/config/vitest.config.ts`.

The Worker test uses a generated RSA key, the real SQLite migration, OAuth state and PKCE verification, a replay attempt, an unauthorized creator, temporary-token revocation, hashed link IDs, concurrent installation-token requests, CORS, raw bytes, download headers, denied routes, expiry and rate limiting. It checks that no credential column exists in share records.

The directory regression checks that 20 files require two requests. Public browsing tests cover opening nested files before the sidebar loads their folder, rate-limit messages without sign-in requirements, and browsing files while retrying a failed branch list. The file tests cover metadata-only requests for large media and downloads through the separate API origin. The code viewer tests cover grammar loading, escaped markup and the large-file fallback.

The landing-page tests cover repository prefill, invalid input, translated navigation and errors, the removed footer attribution, and returned share links. Shortcut tests distinguish two-segment repository URLs from reserved share codes and explicit browsing paths. Theme tests check the symbol toggle against both saved and system preferences; the loading screen renders without a query client or repository requests. Localization tests load all ten catalogs and check route boundaries and fragment-based language switching without document reloads. The Pages test verifies all ten prerendered pages, translated content and metadata, reciprocal language alternatives, Arabic direction, the separate `noindex` fallback, each document's CSP hashes after HTML parsing, the custom domain, public-homepage sitemap, and bundled license and self-hosting guide. It requires a preceding build.

For a local API smoke check, run `npm run db:migrate`, then `npm run dev:api`. A nonexistent `/api/shares/keys/7m4k-p9rx-2w6c-8h3n` should return 404 with `Cache-Control: no-store`. Use a static server against `dist/client` to inspect the Pages artifact.

Actual GitHub authorization, App installation, Actions execution, DNS and production deployment require separately configured accounts. Unit tests and local HTTP checks do not prove those live integrations.

## Build timing

Before the cartoon landing page and homepage prerendering were added, three consecutive `npm run build` executions per toolchain produced these wall-clock times on macOS arm64 with Node.js 26.8.1. The command included the client/server build, SPA prerendering and `pages.mts`; dependencies were already installed, and no other project checks ran during the measurements.

| Toolchain | Run 1 | Run 2 | Run 3 | Median |
| --- | --- | --- | --- | --- |
| Vite 7.3.6 / React plugin 5.2.0 | 4.531 s | 4.497 s | 4.534 s | 4.531 s |
| Vite 8.2.2 / React plugin 6.1.1 | 4.104 s | 2.420 s | 2.573 s | 2.573 s |

The median build time decreased by 43.2% on this machine. These are local repeated-build measurements, not clean-machine CI or browser-performance measurements.
