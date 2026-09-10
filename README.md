# share.git

Share private GitHub repositories with a read-only link. Recipients need no GitHub account; creators sign in through a GitHub App. No personal access tokens are collected or stored.

[Try share.git](https://share.keysi.dev) · [Self-hosting](docs/SELF_HOSTING.md) · [Testing](docs/TESTING.md)

## Usage

1. Install the GitHub App on the repositories you want to share.
2. Sign in as a repository administrator and create a link.
3. Send the link. It expires after seven days.

Replace `github.com` with `share.keysi.dev` in a repository URL to prefill the form. This does not create a share or grant access. Public repositories can be browsed at `/<owner>/<repo>/tree`.

Anyone holding a share link can read all branches and history. Removing the repository from the App installation stops further access; downloaded content cannot be recalled. Private clone and ZIP downloads still require the recipient's own GitHub access.

## Local development

Requires Node.js 24.18+ and npm. Run from the repository root:

```sh
npm ci --ignore-scripts --allow-git=none
cp tools/config/.env.example tools/config/.env
cp tools/config/.dev.vars.example tools/config/.dev.vars
npm run db:migrate
```

For private sharing, create a development GitHub App with **Contents: read-only** and callback `http://localhost:8787/api/auth/callback`. Put its client ID, client secret and PEM private key in `tools/config/.dev.vars`, and its slug in `tools/config/.env`. Keep credentials private and install the App on the selected repository.

Run in separate terminals:

```sh
npm run dev:api
```

```sh
npm run dev
```

Open the URL printed by `npm run dev` (normally `http://localhost:3000`); the API uses `http://localhost:8787`. The landing page, repository prefill and public browsing work without App credentials.

## Hosting and checks

The React/TanStack frontend runs on GitHub Pages; a Cloudflare Worker handles authorization and repository access, with D1 storing share metadata. See the [self-hosting guide](docs/SELF_HOSTING.md) for production setup and deployment.

```sh
npm run build
npm run validate
```

Tests mock GitHub requests and need no credentials. See [testing details](docs/TESTING.md).
