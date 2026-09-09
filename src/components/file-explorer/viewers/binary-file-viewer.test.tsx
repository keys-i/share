import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FileContent } from "@/lib/types/github";
import { BinaryFileViewer } from "./binary-file-viewer";

const createMockFile = (overrides: Partial<FileContent> = {}): FileContent => ({
  name: "test-file.bin",
  path: "test-file.bin",
  sha: "abc123",
  size: 10240,
  content: "",
  encoding: "none",
  html_url: "https://github.com/owner/repo/blob/main/test-file.bin",
  download_url: "https://raw.githubusercontent.com/owner/repo/main/test-file.bin",
  ...overrides,
});

describe("BinaryFileViewer", () => {
  it("should display file name", () => {
    const file = createMockFile({ name: "document.bin" });

    render(<BinaryFileViewer file={file} />);

    expect(screen.getByText("document.bin")).toBeInTheDocument();
  });

  it("should display formatted file size and extension", () => {
    const file = createMockFile({
      name: "archive.zip",
      size: 1024 * 1024, // 1MB
    });

    render(<BinaryFileViewer file={file} />);

    expect(screen.getByText(/1\.00 MB/)).toBeInTheDocument();
    expect(screen.getByText(/ZIP file/)).toBeInTheDocument();
  });

  it("should display message about preview not available", () => {
    const file = createMockFile();

    render(<BinaryFileViewer file={file} />);

    expect(screen.getByText("This file type cannot be previewed in the browser")).toBeInTheDocument();
  });

  it("downloads shared binary files as attachments", () => {
    const file = createMockFile({
      download_url:
        "https://api.share.keysi.dev/api/github/keys/7m4k-p9rx-2w6c-8h3n/repos/keys/demo/contents/file.bin?raw=1&ref=main",
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.href).toBe(`${file.download_url}&download=1`);
    });
    try {
      render(<BinaryFileViewer file={file} />);
      fireEvent.click(screen.getByRole("button", { name: /download file/i }));
      expect(click).toHaveBeenCalledOnce();
    } finally {
      click.mockRestore();
    }
  });

  it("should render an icon for archive files", () => {
    const file = createMockFile({ name: "package.tar.gz" });

    render(<BinaryFileViewer file={file} />);

    // An icon should be rendered (SVG element)
    const svgIcons = document.querySelectorAll("svg");
    // Should have at least 2 SVGs - one for file type icon and one for download icon
    expect(svgIcons.length).toBeGreaterThanOrEqual(2);
  });

  it("should render an icon for video files", () => {
    const file = createMockFile({ name: "movie.mov" });

    render(<BinaryFileViewer file={file} />);

    const svgIcons = document.querySelectorAll("svg");
    expect(svgIcons.length).toBeGreaterThanOrEqual(2);
  });

  it("should render an icon for audio files", () => {
    const file = createMockFile({ name: "sound.wav" });

    render(<BinaryFileViewer file={file} />);

    const svgIcons = document.querySelectorAll("svg");
    expect(svgIcons.length).toBeGreaterThanOrEqual(2);
  });

  it("should render an icon for image files", () => {
    const file = createMockFile({ name: "photo.tiff" });

    render(<BinaryFileViewer file={file} />);

    const svgIcons = document.querySelectorAll("svg");
    expect(svgIcons.length).toBeGreaterThanOrEqual(2);
  });

  it("should render an icon for generic binary files", () => {
    const file = createMockFile({ name: "data.dat" });

    render(<BinaryFileViewer file={file} />);

    const svgIcons = document.querySelectorAll("svg");
    expect(svgIcons.length).toBeGreaterThanOrEqual(2);
  });
});
