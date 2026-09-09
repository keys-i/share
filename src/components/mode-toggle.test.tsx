import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ModeToggle } from "./mode-toggle";
import { useThemes } from "./theme-provider";

vi.mock("./theme-provider", () => ({ useThemes: vi.fn() }));

it.each([
  ["system", "light", "dark"],
  ["system", "dark", "light"],
  ["light", "dark", "dark"],
  ["dark", "light", "light"],
] as const)("toggles %s with system %s to %s using an accessible symbol", (theme, systemTheme, nextTheme) => {
  const setTheme = vi.fn();
  vi.mocked(useThemes).mockReturnValue({ theme, systemTheme, setTheme });
  render(<ModeToggle />);
  const button = screen.getByRole("button", { name: `Switch to ${nextTheme} mode` });
  expect(button).toHaveTextContent("");
  expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  fireEvent.click(button);
  expect(setTheme).toHaveBeenCalledWith(nextTheme);
});
