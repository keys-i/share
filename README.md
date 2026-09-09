# share.git

Share private GitHub repositories with a read-only link. An open-source, self-hostable app with a cartoon-themed frontend, built with Node.js and npm.

Our app lives at the repository root. `private-github-link/` is the original study reference and is excluded from our build, tests and CodeQL analysis.

Tool settings and environment files live in `tools/config/`; build and deployment scripts live in `tools/script/`. Root `tsconfig.json` and `biome.json` delegate to the shared configurations for tool and editor discovery. `components.json` and `.node-version` link to their configurations for tools that require those filenames. GitHub workflows remain in `.github/workflows/`, and npm manifests remain at the root.

Create read-only private repository links such as `https://share.keysi.dev/keys/7m4k-p9rx-2w6c-8h3n`. Codes use four lowercase groups, accept uppercase input, and exclude `0`, `1`, `i` and `l`. Recipients need no GitHub account. Creators sign in through a GitHub App; **the app never asks for or stores a PAT**.

Paths matching the grouped-code format are reserved for shares. Missing or expired share codes never fall back to public GitHub repository requests.

Open `https://share.keysi.dev/<username>/<repo>` to prefill the sharing form. For example, replace `github.com` with `share.keysi.dev` in a repository URL. This shortcut does not grant access or create a share; the owner still authorizes it through the GitHub App. Public browsing remains available at `/<username>/<repo>/tree`.

The homepage includes Features, How it works, Use cases, and a self-hosting guide. Its content is prerendered for search engines; repository and private-share routes use a separate `noindex` fallback. See [SELF_HOSTING.md](docs/SELF_HOSTING.md) to run your own instance.

[Seer](https://www.npmjs.com/package/@keys-i/seer) validates the landing-page and sharing-form translations and generates their SEO metadata at build time. English is at `/`; Spanish, Hindi, French, Simplified Chinese, Japanese, Korean, German, Portuguese and Arabic are at `/es/`, `/hi/`, `/fr/`, `/zh-hans/`, `/ja/`, `/ko/`, `/de/`, `/pt/` and `/ar/`. Arabic uses right-to-left layout. Each route loads its own translation catalog; the icon menu switches languages in place, preserves a valid repository or created share link through the URL fragment, and uses a short text-warp transition when supported. Reduced-motion preferences disable the animation. Repository browsing and the self-hosting guide remain in English.

## Hosting and access

- **GitHub Pages:** static React/TanStack frontend at `share.keysi.dev`, built with Node.js 24.18+ and npm
- **Cloudflare Worker:** authorization and repository API at `api.share.keysi.dev`
- **D1:** repository and installation IDs, hashed share IDs and expiry; no access tokens or private repository contents

[GitHub Pages serves static sites](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages). The separate API is required to keep GitHub App credentials out of browsers while sharing private repositories with people who lack GitHub access.

The creator must administer the repository. Sign-in uses OAuth state, PKCE and a Secure, HttpOnly cookie; the temporary user token is revoked before a link is created. The API generates [installation tokens scoped to one repository with Contents read access](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app). They expire after an hour and are reused only in bounded Worker memory, never persisted or sent to recipients.

Links use 80 random bits and expire after seven days. This trades some guessing resistance compared with the previous 128-bit format for easier typing. Requests are limited per IP before looking up a link, including nonexistent codes. Removing the repository from the App installation stops further access. Anyone holding a link can read all branches and history; previously downloaded content cannot be recalled. The API operator holds the App's private key, so install it only on repositories you intend to share.

The API permits selected read endpoints, validates repository paths, limits requests, disables caching, and isolates raw files with a sandbox policy. Static pages disable referrers and include a CSP with hashes for their generated scripts. There is no analytics or error-reporting service.

## Local development

Run all commands from the repository root:

```sh
npm ci --ignore-scripts --allow-git=none
cp tools/config/.env.example tools/config/.env
cp tools/config/.dev.vars.example tools/config/.dev.vars
npm run db:migrate
```

Use a development GitHub App with callback `http://localhost:8787/api/auth/callback`. Set its client ID, client secret and PEM private key in `tools/config/.dev.vars`; set its slug in `tools/config/.env`. Keep `.dev.vars` private. The browser uses `http://localhost:8787` for API requests and `http://localhost:3000` for the site.

Run these in separate terminals:

```sh
npm run dev:api
npm run dev
```

Open the local URL printed by `npm run dev` to preview the frontend; it uses port 3000 when available. The landing page and repository prefill shortcuts work without App credentials. Public repository browsing works without an App. Private sharing requires the App to be installed on the selected repository. Tests mock every GitHub request and require no credentials.

## Production setup

1. Register a GitHub App with **Contents: Read-only** and the default Metadata read permission. Set homepage `https://share.keysi.dev` and callback `https://api.share.keysi.dev/api/auth/callback`. Leave webhooks disabled and expiring user tokens enabled. Install it only on selected repositories.
2. In Cloudflare, create the D1 database and set the Worker's secrets using the commands below. Keep the App's PEM private key and client secret in Worker secrets, never in a `VITE_` variable.
3. Enable GitHub Pages with **GitHub Actions** as its publishing source. Set the custom domain to `share.keysi.dev`, configure its DNS for your Pages account, and enable HTTPS. The build writes `CNAME`, `.nojekyll`, the prerendered `index.html`, a separate `404.html` app shell, and a sitemap containing only the ten public language homepages.
4. Configure the `github-pages` environment with the values in the table. Enable Actions to create pull requests for Release Please.
5. Run the Release workflow manually from `main` for the first deployment. Later releases build and validate the released commit, deploy the API, then publish the static Pages artifact.

```sh
npx --no-install wrangler d1 create shares --config tools/config/wrangler.jsonc
npx --no-install wrangler secret put GITHUB_CLIENT_SECRET --config tools/config/wrangler.jsonc
npx --no-install wrangler secret put GITHUB_APP_PRIVATE_KEY --config tools/config/wrangler.jsonc
```

Wrangler may ask to create the Worker before setting its first secret. The `keysi.dev` zone must be available in the target Cloudflare account for the API custom domain.

| Environment setting | Type | Value |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Secret | Limited token for Workers deployment, D1 migrations and the API custom domain |
| `CLOUDFLARE_ACCOUNT_ID` | Variable | Cloudflare account ID |
| `CLOUDFLARE_D1_DATABASE_ID` | Variable | ID of the `shares` database |
| `APP_CLIENT_ID` | Variable | GitHub App client ID, not its numeric App ID |
| `APP_SLUG` | Variable | App name used in its `github.com/apps/<slug>` URL |

`tools/config/wrangler.jsonc` intentionally has no production database ID or App credentials. The release workflow inserts the database ID and public client ID. For manual API deployment, configure those values, apply remote migrations with `--config tools/config/wrangler.jsonc`, and run `npm run deploy`.

The release workflow sets the frontend's Source code link to the repository running it. Set `VITE_SOURCE_CODE_URL` in `tools/config/.env` for local development, or `.env.production` for a manual build. The self-hosting link opens `docs/SELF_HOSTING.md` in that GitHub repository (the bundled Markdown is a fallback when no source URL is configured). The footer credits Keysi. Original project attribution remains in this README and LICENSE.

Direct visits to share paths use GitHub Pages' custom 404 document. The app loads normally, but the initial HTTP response retains status 404. An HTTP 200 for every dynamic path would require a host with rewrite support. Private clone/ZIP links still require the recipient's own GitHub access; individual files use the share API.

## Performance and checks

Development tooling uses Rust-based Biome for linting and formatting, and [Vite 8](https://vite.dev/guide/migration) with Rolldown, Oxc and Lightning CSS for bundling, JavaScript/TypeScript transforms and minification. React Compiler retains its stable Babel implementation. Node/npm commands and TypeScript type checking remain unchanged; Vitest 4 shares the Vite 8 toolchain. The build explicitly preserves Vite 7's browser targets.

Syntax grammars and Markdown rendering load on demand. Files over 200,000 characters use plain text without a line-by-line table. Large media loads metadata before streaming its preview, avoiding a duplicate full-file download. Directory listings use two API requests regardless of file count; per-file commit history loads when requested instead of fetching it for every row.

Before the Vite 8 migration, application optimizations reduced the main JavaScript bundle from 334,797 to about 233,000 gzip bytes, and the code viewer from 312,742 to about 22,000 gzip bytes before its selected grammar loads. These are historical build-size measurements; Vite 8 splits the entry chunks differently. See [TESTING.md](docs/TESTING.md) for the tooling build-time comparison.

```sh
npm run build
npm run validate
```

- `checks.yml`: root build, Biome, TypeScript and regression tests
- `security.yml`: CodeQL and production dependency audit, excluding the study reference
- `release.yml`: Release Please, Cloudflare API deployment and GitHub Pages publication

The workflows follow the existing repository conventions for Node, permissions and timeouts, and reuse the Pages action versions from the local `shell.js` publishing workflow. See [TESTING.md](docs/TESTING.md) for verification details.

## Attribution

The browsing interface adapts Jason Xie's [Private GitHub Link](https://github.com/thejasonxie/private-github-link). The original MIT copyright is retained in [LICENSE](LICENSE); the unmodified study source remains in `private-github-link/`.
