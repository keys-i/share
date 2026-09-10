import { createFileRoute, notFound } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing-page";
import { loadLocale, localeForPath } from "@/lib/localization";

export const Route = createFileRoute("/$locale")({
  wrapInSuspense: true,
  pendingMs: Infinity,
  loader: ({ params }) => {
    const locale = localeForPath(`/${params.locale}/`);
    if (!locale) throw notFound({ routeId: "/$locale" });
    return loadLocale(locale.locale);
  },
  component: () => {
    const content = Route.useLoaderData();
    return <LandingPage key={content.locale} content={content} />;
  },
});
