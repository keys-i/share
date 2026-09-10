import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Scripts, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { ErrorFallback } from "@/components/error-fallback";
import { ThemeProvider } from "@/components/theme-provider";
import { defaultLocale, localeForPath } from "@/lib/localization";

import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";

interface MyRouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  errorComponent: ErrorFallback,
  head: ({ params }) => {
    const { _splat, locale } = params as { _splat?: string; locale?: string };
    const [owner, repo] = (_splat || "").split("/").filter(Boolean);
    const home = !_splat ? localeForPath(locale ? `/${locale}/` : "/") : undefined;
    const title = home?.title ?? (owner && repo ? `${owner} · share.git` : "share.git");

    return {
      meta: [
        { name: "referrer", content: "no-referrer" },
        { name: "robots", content: home ? "index, follow" : "noindex, nofollow" },
        {
          charSet: "utf-8",
        },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        },
        {
          title,
        },
        ...(home
          ? [
              { name: "description", content: home.description },
              { property: "og:title", content: title },
              { property: "og:description", content: home.description },
              { property: "og:type", content: "website" },
              { property: "og:url", content: home.canonical },
              { property: "og:site_name", content: "share.git" },
              { name: "twitter:card", content: "summary" },
              { name: "twitter:title", content: title },
              { name: "twitter:description", content: home.description },
            ]
          : []),
      ],
      links: [
        {
          rel: "stylesheet",
          href: appCss,
        },
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        ...(home
          ? [
              { rel: "canonical", href: home.canonical },
              ...Object.entries(home.alternates).map(([hrefLang, href]) => ({ rel: "alternate", hrefLang, href })),
            ]
          : []),
      ],
      scripts: home ? [{ type: "application/ld+json", children: home.jsonLd }] : [],
    };
  },

  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const home = localeForPath(pathname);
  const content = <ThemeProvider>{children}</ThemeProvider>;

  return (
    <html lang={home?.lang ?? defaultLocale} dir={home?.dir ?? "ltr"}>
      <head>
        <HeadContent />
      </head>
      <body>
        {content}
        {import.meta.env.DEV && (
          <TanStackDevtools
            config={{
              position: "bottom-right",
            }}
            plugins={[
              {
                name: "Tanstack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
              TanStackQueryDevtools,
            ]}
          />
        )}

        <Scripts />
      </body>
    </html>
  );
}
