import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { RepoPending } from "./repo-pending";

it("renders route loading without a query client or repository requests", () => {
  render(<RepoPending />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading repository");
  expect(screen.getByRole("link", { name: "share.git home" })).toHaveAttribute("href", "/");
});
