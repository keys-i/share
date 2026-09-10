import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getRouter } from "@/router";
import { mockFileContent, rateLimitHandler } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";

vi.mock("@tanstack/react-devtools", () => ({ TanStackDevtools: () => null }));

beforeEach(() => {
  vi.stubGlobal("scrollTo", () => {});
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  server.use(
    http.get("https://api.github.com/rate_limit", () =>
      HttpResponse.json({
        resources: { core: { limit: 60, remaining: 59, reset: Math.floor(Date.now() / 1000) + 3600 } },
      }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("opens a directory's file before its folder has loaded in the sidebar", async () => {
  server.use(
    http.get("https://api.github.com/repos/test-owner/test-repo/git/trees/:branch", () =>
      HttpResponse.json({ sha: "root", tree: [{ path: "src", type: "tree", sha: "folder" }], truncated: false }),
    ),
    http.get("https://api.github.com/repos/test-owner/test-repo/contents/:path*", ({ request }) => {
      const path = decodeURIComponent(new URL(request.url).pathname).split("/contents/")[1];
      if (path === "src")
        return HttpResponse.json([{ name: "nested.ts", path: "src/nested.ts", type: "file", sha: "file", size: 40 }]);
      if (path === "src/nested.ts")
        return HttpResponse.json({
          ...mockFileContent,
          name: "nested.ts",
          path: "src/nested.ts",
          content: Buffer.from("export const nestedFileWorks = true;").toString("base64"),
        });
      return HttpResponse.json({ message: "Not Found" }, { status: 404 });
    }),
  );
  const router = getRouter();
  router.update({
    context: router.options.context,
    defaultPendingMinMs: 0,
    history: createMemoryHistory({ initialEntries: ["/test-owner/test-repo/tree/main/src"] }),
  });
  const { unmount } = render(<RouterProvider router={router} />, { container: document });
  try {
    fireEvent.click(await screen.findByText("nested.ts"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/test-owner/test-repo/blob/main/src/nested.ts"));
    await waitFor(() => expect(screen.getByRole("table")).toHaveTextContent("export const nestedFileWorks = true;"));
  } finally {
    unmount();
    router.options.context.queryClient.clear();
  }
});

it("shows a rate-limit message without requiring access for a public repository", async () => {
  server.use(rateLimitHandler);
  const router = getRouter();
  router.update({
    context: router.options.context,
    defaultPendingMinMs: 0,
    history: createMemoryHistory({ initialEntries: ["/test-owner/test-repo/tree/main"] }),
  });
  const { unmount } = render(<RouterProvider router={router} />, { container: document });
  try {
    expect(await screen.findByRole("heading", { name: "GitHub rate limit reached" })).toBeVisible();
    expect(screen.getByText(/Public repositories do not require sign-in or a share link/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Create a private share link" })).not.toBeInTheDocument();
    expect(screen.queryByText("Repository access required")).not.toBeInTheDocument();
  } finally {
    unmount();
    router.options.context.queryClient.clear();
  }
});

it("keeps public files accessible when the branch list fails and allows retry", async () => {
  server.use(
    http.get(
      "https://api.github.com/repos/test-owner/test-repo/branches",
      () => HttpResponse.json({ message: "Not Found" }, { status: 404 }),
      { once: true },
    ),
  );
  const router = getRouter();
  router.update({
    context: router.options.context,
    defaultPendingMinMs: 0,
    history: createMemoryHistory({ initialEntries: ["/test-owner/test-repo/blob/main/example.ts"] }),
  });
  const { unmount } = render(<RouterProvider router={router} />, { container: document });
  try {
    await waitFor(() => expect(screen.getByRole("table")).toHaveTextContent("This is a test."));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry branches" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  } finally {
    unmount();
    router.options.context.queryClient.clear();
  }
});
