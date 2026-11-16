import { openapi } from "./openapi.ts";

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Interactive OpenAPI reference for the share.git API">
    <meta name="robots" content="index, follow">
    <title>share.git API</title>
    <link rel="canonical" href="https://share.keysi.dev/api/">
  </head>
  <body>
    <main id="app"><noscript>JavaScript is required to view the interactive API reference</noscript></main>
    <script type="module" src="/api/reference.js"></script>
  </body>
</html>`;

const theme = `
.scalar-app {
  --scalar-font: 'Noto Sans Variable', ui-sans-serif, system-ui, sans-serif;
  --scalar-font-code: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  --scalar-radius: 0.625rem;
  --scalar-radius-lg: 0.875rem;
}
.light-mode {
  --scalar-color-1: #172d3b;
  --scalar-color-2: #435b6b;
  --scalar-color-3: #61798a;
  --scalar-color-accent: #315fba;
  --scalar-background-1: #f6fbff;
  --scalar-background-2: #ffffff;
  --scalar-background-3: #e9f2f8;
  --scalar-background-accent: rgb(182 221 255 / 0.34);
  --scalar-border-color: #d1e1ec;
  --scalar-sidebar-background-1: #b6ddff;
  --scalar-sidebar-color-1: #172d3b;
  --scalar-sidebar-color-2: #435b6b;
  --scalar-sidebar-color-active: #172d3b;
  --scalar-sidebar-item-active-background: #ffe47a;
  --scalar-sidebar-item-hover-background: #d8c4ff;
  --scalar-sidebar-border-color: #172d3b;
}
.dark-mode {
  --scalar-color-1: #eef5ff;
  --scalar-color-2: #b8ccdc;
  --scalar-color-3: #8ca4b5;
  --scalar-color-accent: #b6ddff;
  --scalar-background-1: #142535;
  --scalar-background-2: #203649;
  --scalar-background-3: #294358;
  --scalar-background-accent: rgb(182 221 255 / 0.12);
  --scalar-border-color: #496475;
  --scalar-sidebar-background-1: #203649;
  --scalar-sidebar-color-1: #eef5ff;
  --scalar-sidebar-color-2: #b8ccdc;
  --scalar-sidebar-color-active: #172d3b;
  --scalar-sidebar-item-active-background: #ffe47a;
  --scalar-sidebar-item-hover-background: #355269;
  --scalar-sidebar-border-color: #496475;
}
.scalar-app :is(a, button, input, select, textarea):focus-visible {
  outline: 3px solid #377cdb;
  outline-offset: 3px;
}
`;

const script = `import { createApiReference } from 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.78.0/esm.js'

createApiReference('#app', {
  url: '/api/openapi.json',
  theme: 'none',
  layout: 'modern',
  hideClientButton: true,
  mcp: { disabled: true },
  withDefaultFonts: false,
  customCss: ${JSON.stringify(theme)},
})
`;

const policy =
  "default-src 'none'; script-src 'self' https://cdn.jsdelivr.net; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

export function apiDocsResponse(request: Request): Response | null {
  const path = new URL(request.url).pathname;
  let body: string;
  let contentType: string;
  let indexable = false;
  if (path === "/api" || path === "/api/" || path === "/api/docs") {
    body = page;
    contentType = "text/html; charset=utf-8";
    indexable = true;
  } else if (path === "/api/reference.js") {
    body = script;
    contentType = "text/javascript; charset=utf-8";
  } else if (path === "/api/openapi.json") {
    body = JSON.stringify(openapi);
    contentType = "application/vnd.oai.openapi+json;version=3.1; charset=utf-8";
  } else return null;

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(JSON.stringify({ message: "Use GET or HEAD for API reference assets" }), {
      status: 405,
      headers: { Allow: "GET, HEAD", "Content-Type": "application/json; charset=utf-8" },
    });
  }
  return new Response(request.method === "HEAD" ? null : body, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Security-Policy": policy,
      "Content-Type": contentType,
      "Cross-Origin-Resource-Policy": "same-origin",
      "Referrer-Policy": "no-referrer",
      "Strict-Transport-Security": "max-age=31536000",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-Robots-Tag": indexable ? "index, follow" : "noindex",
    },
  });
}
