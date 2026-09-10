import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing-page";
import { defaultLocale, loadLocale } from "@/lib/localization";

export const Route = createFileRoute("/")({
  pendingMs: Infinity,
  loader: () => loadLocale(defaultLocale),
  component: () => <LandingPage content={Route.useLoaderData()} />,
});
