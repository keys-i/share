import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import arabic from "../../tools/config/locales/ar.json";
import english from "../../tools/config/locales/en.json";
import { LandingPage } from "./landing-page";

const content = { locale: "en", text: english.ui };

const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
}));
vi.mock("@/components/mode-toggle", () => ({ ModeToggle: () => null }));

afterEach(() => {
  window.history.replaceState(null, "", "/");
  navigate.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("landing page", () => {
  it("prefills repository shortcuts and preserves an explicit public browser link", () => {
    render(<LandingPage content={content} initialRepository="octocat/Hello-World" />);
    expect(screen.getByRole("textbox", { name: "GitHub repository" })).toHaveValue("octocat/Hello-World");
    expect(screen.getByRole("link", { name: "Browse this repository if it's public" })).toHaveAttribute(
      "href",
      "/octocat/Hello-World/tree",
    );
    expect(screen.getByRole("button", { name: "Sign in and create link" })).toBeEnabled();
  });

  it("explains sharing and links to the configured project source and self-hosting guide", async () => {
    vi.stubEnv("VITE_SOURCE_CODE_URL", "https://github.com/example/share");
    render(<LandingPage content={content} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Share a private GitHub repository");
    expect(screen.getByRole("link", { name: "share.git home" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "How it works" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Features" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Use cases" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Source code" })).toHaveAttribute(
      "href",
      "https://github.com/example/share",
    );
    expect(screen.getByRole("link", { name: "Self-hosting guide (English)" })).toHaveAttribute(
      "href",
      "https://github.com/example/share/blob/main/docs/SELF_HOSTING.md",
    );
    expect(screen.queryByText(/Built on Jason Xie/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Language" }));
    await waitFor(() => expect(screen.getAllByRole("menuitemradio")).toHaveLength(10));
    expect(screen.getByRole("menuitemradio", { name: "English" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("link", { name: "Keysi" })).toHaveAttribute("href", "https://keysi.dev");
  });

  it("changes language in place with a transition and preserves the repository", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    render(<LandingPage content={content} initialRepository="octocat/Hello-World" />);
    fireEvent.click(screen.getByRole("button", { name: "Language" }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "español" }));
    expect(navigate).toHaveBeenCalledWith({
      href: "/es/#repo=octocat%2FHello-World",
      resetScroll: false,
      viewTransition: true,
    });
  });

  it("runs each scene only while visible and disconnects on unmount", () => {
    let notify: (entries: Partial<IntersectionObserverEntry>[]) => void = () => {};
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: typeof notify) {
          notify = callback;
        }
        observe = observe;
        disconnect = disconnect;
      },
    );
    const { container, unmount } = render(<LandingPage content={content} />);
    const target = container.querySelector('[data-motion="shield"]') as HTMLElement;
    const clock = container.querySelector('[data-motion="clock"]') as HTMLElement;
    expect(observe).toHaveBeenCalledWith(target);
    expect(observe).toHaveBeenCalledWith(clock);
    act(() => notify([{ target, isIntersecting: false }]));
    expect(target).toHaveAttribute("data-visible", "false");
    act(() => notify([{ target, isIntersecting: true }]));
    expect(target).toHaveAttribute("data-visible", "true");
    expect(clock).not.toHaveAttribute("data-visible");
    act(() => notify([{ target, isIntersecting: false }]));
    expect(target).toHaveAttribute("data-visible", "false");
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("keeps content visible without starting motion when reduced motion is preferred", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const observer = vi.fn();
    vi.stubGlobal("IntersectionObserver", observer);
    render(<LandingPage content={content} />);
    expect(observer).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Features" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign in and create link" })).toBeVisible();
  });

  it("rejects lookalike GitHub URLs before starting authorization", () => {
    render(<LandingPage content={content} />);
    const input = screen.getByRole("textbox", { name: "GitHub repository" });
    fireEvent.change(input, { target: { value: "https://github.com.example.com/owner/repo" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a GitHub repository URL or owner/repo");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("loads a translated prefill and reports invalid input in the selected language", () => {
    window.history.replaceState(null, "", "/ar/#repo=octocat%2FHello-World");
    render(<LandingPage content={{ locale: "ar", text: arabic.ui }} />);
    const input = screen.getByRole("textbox", { name: arabic.ui.repository });
    expect(input).toHaveValue("octocat/Hello-World");
    expect(input).toHaveAttribute("dir", "ltr");
    expect(window.location.hash).toBe("");
    expect(screen.getByRole("link", { name: arabic.ui.homeLabel })).toHaveAttribute("href", "/ar/");
    fireEvent.change(input, { target: { value: "https://github.com.evil.example/owner/repo" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(screen.getByRole("alert")).toHaveTextContent(arabic.ui.invalidRepository);
  });

  it("shows a returned share link and removes it from the URL fragment", async () => {
    window.history.replaceState(null, "", "/#share=/Octocat/7M4K-P9RX-2W6C-8H3N");
    render(<LandingPage content={content} />);
    expect(await screen.findByRole("textbox", { name: "Your read-only repository link" })).toHaveValue(
      `${window.location.origin}/octocat/7m4k-p9rx-2w6c-8h3n`,
    );
    expect(window.location.hash).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Create another link" }));
    expect(screen.getByRole("textbox", { name: "GitHub repository" })).toHaveValue("");
  });
});
