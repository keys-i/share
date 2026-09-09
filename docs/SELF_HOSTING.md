# Self-host share.git

share.git is MIT licensed. Host its static frontend on GitHub Pages and its API on Cloudflare Workers with D1. You need Node.js 24.18 or newer, npm, a GitHub App, a Cloudflare account, and domains for the site and API.

## 1. Configure the domains

Choose a frontend hostname, for example `share.example.com`, and an API hostname, for example `api.share.example.com`.

1. In `tools/config/domains.config.ts`, set `app` and `landing` to the frontend hostname and `api` to the API hostname.
2. In `tools/config/locales/config.toml`, set `[site].url` to `https://share.example.com/`. It must match `domains.app`; the build rejects a mismatch.
3. In `tools/config/wrangler.jsonc`, set the Worker `name`, `routes[0].pattern`, and `vars.SITE_ORIGIN` (`https://share.example.com`).
4. Point the frontend domain to GitHub Pages, enable HTTPS, and configure the API hostname in the Cloudflare zone used by the Worker.

## 2. Create the GitHub App

Create a GitHub App with **Contents: read-only** and the default Metadata read permission. Use the frontend origin as its homepage and `https://YOUR_API_HOST/api/auth/callback` as its callback URL. Leave webhooks disabled and enable expiring user access tokens.

Install the App on **selected repositories** only. A repository administrator must sign in to create a link.

share.git never collects or stores a personal access token. It revokes the temporary user token before creating a link and uses short-lived installation tokens only in Worker memory. Store the App client secret and private key as Worker secrets; D1 stores share metadata, hashed codes, expiry, and temporary authorization state, never repository contents or access tokens.

## 3. Create D1 and set Worker secrets

From the project root:

```sh
npm ci --ignore-scripts --allow-git=none
npx --no-install wrangler d1 create shares --config tools/config/wrangler.jsonc
```

Put the returned ID in `d1_databases[0].database_id`, set its name in `d1_databases[0].database_name`, and set `vars.GITHUB_CLIENT_ID` to the App's public client ID (not its numeric App ID). Then add the App secrets:

```sh
npx --no-install wrangler secret put GITHUB_CLIENT_SECRET --config tools/config/wrangler.jsonc
npx --no-install wrangler secret put GITHUB_APP_PRIVATE_KEY --config tools/config/wrangler.jsonc
```

Never commit private keys, secrets, or environment files.

## 4. Configure the deployment environment

Set GitHub Pages to publish with GitHub Actions and configure the frontend custom domain. In the `github-pages` environment, add:

| Setting | Type |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Secret |
| `CLOUDFLARE_ACCOUNT_ID` | Variable |
| `CLOUDFLARE_D1_DATABASE_ID` | Variable |
| `APP_CLIENT_ID` | Variable |
| `APP_SLUG` | Variable |

The included release workflow installs dependencies, builds and validates the frontend, applies D1 migrations, deploys the Worker, and publishes `dist/client` to Pages. The release's Source code URL is set automatically from the repository running the workflow, so the homepage links to that GitHub source repository. For a local preview or a different static host, set `VITE_SOURCE_CODE_URL` and `VITE_GITHUB_APP_SLUG` in `tools/config/.env.production`.

Enable Actions to create release pull requests. Run the Release workflow from `main` for the first deployment; later releases deploy after a release is created.

## Access limits

A private share link gives read-only browser access to the entire repository, including all branches and history, for seven days. Removing the repository from the App installation stops further access, but downloaded content cannot be recalled. Links never grant write access; private clone and ZIP downloads still require the recipient's own GitHub access.

GitHub Pages initially serves direct shortcut and share URLs through `404.html`, so they return HTTP 404 while the app loads. A host with rewrites may serve that file with HTTP 200; keep the routes `noindex, nofollow`.

Repository browsing and this guide remain in English. See `README.md` for development setup and `docs/TESTING.md` for local checks.
