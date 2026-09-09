import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FileContent } from "@/lib/types/github";
import { CodeViewer } from "./code-viewer";

const createMockFile = (overrides: Partial<FileContent> = {}): FileContent => ({
  name: "test.js",
  path: "src/test.js",
  sha: "abc123",
  size: 100,
  content: Buffer.from("const x = 1;").toString("base64"),
  encoding: "base64",
  html_url: "https://github.com/owner/repo/blob/main/src/test.js",
  download_url: "https://raw.githubusercontent.com/owner/repo/main/src/test.js",
  ...overrides,
});

describe("CodeViewer", () => {
  it("renders large files as plain text without a table or syntax highlighting", () => {
    const content = "x".repeat(210_000);
    render(<CodeViewer file={createMockFile({ content, encoding: "none" })} />);
    expect(document.querySelector("pre")?.textContent).toBe(content);
    expect(document.querySelector("table")).toBeNull();
  });
  it("should render code content", () => {
    const file = createMockFile({
      content: Buffer.from("const hello = 'world';").toString("base64"),
    });

    render(<CodeViewer file={file} />);

    expect(screen.getByText(/hello/)).toBeInTheDocument();
    expect(screen.getByText(/world/)).toBeInTheDocument();
  });

  it("should display line numbers", () => {
    const file = createMockFile({
      content: Buffer.from("line1\nline2\nline3").toString("base64"),
    });

    render(<CodeViewer file={file} />);

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("should render table structure for code lines", () => {
    const file = createMockFile({
      content: Buffer.from("const x = 1;").toString("base64"),
    });

    render(<CodeViewer file={file} />);

    const table = document.querySelector("table");
    expect(table).toBeInTheDocument();

    const rows = document.querySelectorAll("tr");
    expect(rows.length).toBe(1);
  });

  it("should handle multi-line code", () => {
    const file = createMockFile({
      content: Buffer.from("function foo() {\n  return 42;\n}").toString("base64"),
    });

    render(<CodeViewer file={file} />);

    const rows = document.querySelectorAll("tr");
    expect(rows.length).toBe(3);
  });

  it("should apply syntax highlighting for JavaScript files", async () => {
    const file = createMockFile({
      name: "app.js",
      content: Buffer.from("const x = 1;").toString("base64"),
    });

    render(<CodeViewer file={file} />);

    // highlight.js adds spans with classes for syntax highlighting
    await waitFor(() =>
      expect(
        document.querySelectorAll(
          ".hljs-keyword, .hljs-number, .hljs-string, .hljs-variable, .hljs-built_in, .hljs-attr",
        ).length,
      ).toBeGreaterThan(0),
    );
  });

  it("should apply syntax highlighting for TypeScript files", async () => {
    const file = createMockFile({
      name: "app.ts",
      content: Buffer.from("const x: number = 1;").toString("base64"),
    });

    render(<CodeViewer file={file} />);

    await waitFor(() => expect(document.querySelector(".hljs-keyword")).not.toBeNull());
  });

  it("should handle Python files", () => {
    const file = createMockFile({
      name: "script.py",
      content: Buffer.from("def hello():\n    print('world')").toString("base64"),
    });

    render(<CodeViewer file={file} />);

    expect(screen.getByText(/hello/)).toBeInTheDocument();
  });

  it("should handle JSON files", () => {
    const file = createMockFile({
      name: "config.json",
      content: Buffer.from('{"key": "value"}').toString("base64"),
    });

    render(<CodeViewer file={file} />);

    expect(screen.getByText(/key/)).toBeInTheDocument();
    expect(screen.getByText(/value/)).toBeInTheDocument();
  });

  it("should apply text wrapping when wrapText is true", () => {
    const file = createMockFile();

    render(<CodeViewer file={file} wrapText={true} />);

    const codeCell = document.querySelector("td:last-child");
    expect(codeCell).toHaveClass("whitespace-pre-wrap");
  });

  it("should not wrap text by default", () => {
    const file = createMockFile();

    render(<CodeViewer file={file} />);

    const codeCell = document.querySelector("td:last-child");
    expect(codeCell).toHaveClass("whitespace-pre");
  });

  it("should handle empty content", () => {
    const file = createMockFile({
      content: Buffer.from("").toString("base64"),
    });

    render(<CodeViewer file={file} />);

    const rows = document.querySelectorAll("tr");
    expect(rows.length).toBe(1); // One empty line
  });

  it("should render unknown file extensions as plain text", () => {
    const file = createMockFile({
      name: "unknownfile.xyz",
      content: Buffer.from("some content here").toString("base64"),
    });

    render(<CodeViewer file={file} />);

    // The content should be rendered in a table cell
    const cell = document.querySelector("td:last-child");
    expect(cell?.textContent).toContain("some content here");
  });

  it("should escape HTML characters", () => {
    const file = createMockFile({
      name: "file.js",
      content: Buffer.from("const html = '<div>test</div>';").toString("base64"),
    });

    render(<CodeViewer file={file} />);

    // The content should be rendered (HTML should be escaped properly in the viewer)
    const cell = document.querySelector("td:last-child");
    expect(cell?.textContent).toContain("div");
  });
});
