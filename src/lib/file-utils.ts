import type { FileContent } from "@/lib/types/github";

// File type classification
export type FileType = "text" | "markdown" | "image" | "pdf" | "video" | "audio" | "binary";

// Extension arrays for file type detection
export const MARKDOWN_EXTENSIONS = ["md", "markdown", "mdx"];

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"];

export const VIDEO_EXTENSIONS = ["mp4", "webm", "ogg", "mov", "avi"];

export const AUDIO_EXTENSIONS = ["mp3", "wav", "ogg", "flac", "aac", "m4a"];

export const BINARY_EXTENSIONS = [
  "zip",
  "tar",
  "gz",
  "rar",
  "7z",
  "exe",
  "dll",
  "so",
  "dylib",
  "bin",
  "dmg",
  "iso",
  "jar",
  "war",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "eot",
];

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

/**
 * Determine the file type based on filename extension
 */
export function getFileType(filename: string): FileType {
  const ext = getFileExtension(filename);

  if (ext === "pdf") return "pdf";
  if (MARKDOWN_EXTENSIONS.includes(ext)) return "markdown";
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  if (AUDIO_EXTENSIONS.includes(ext)) return "audio";
  if (BINARY_EXTENSIONS.includes(ext)) return "binary";

  return "text";
}

/**
 * Get MIME type for a file
 */
export function getMimeType(filename: string): string {
  const ext = getFileExtension(filename);

  const mimeTypes: Record<string, string> = {
    // Images
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    bmp: "image/bmp",
    ico: "image/x-icon",
    // Videos
    mp4: "video/mp4",
    webm: "video/webm",
    ogg: "video/ogg",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    // Audio
    mp3: "audio/mpeg",
    wav: "audio/wav",
    flac: "audio/flac",
    aac: "audio/aac",
    m4a: "audio/mp4",
    // Documents
    pdf: "application/pdf",
  };

  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Decode base64 content from GitHub API
 */
export function decodeContent(content: string, encoding: string): string {
  if (encoding === "base64") {
    try {
      return atob(content);
    } catch {
      return content;
    }
  }
  return content;
}

/**
 * Count lines in a string
 */
export function countLines(content: string): number {
  return content.split("\n").length;
}

/**
 * Download file content or stream it through the authenticated share URL
 */
export function downloadFile(file: FileContent): void {
  const a = document.createElement("a");
  if (file.encoding !== "base64" && file.download_url) {
    const target = new URL(file.download_url, window.location.href);
    if (target.pathname.startsWith("/api/github/")) target.searchParams.set("download", "1");
    a.href = target.href;
    a.download = file.name;
    a.rel = "noreferrer";
    a.click();
    return;
  }
  let blob: Blob;

  if (file.encoding === "base64") {
    // Decode base64 to binary
    const binaryString = atob(file.content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    blob = new Blob([bytes]);
  } else {
    // Plain text content
    blob = new Blob([file.content], { type: "text/plain" });
  }

  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Resolve Markdown assets through a share proxy or raw GitHub URL
 */
export function resolveRelativeUrl(
  src: string,
  filePath: string,
  owner: string,
  repo: string,
  branch: string,
  downloadUrl?: string,
): string {
  // If it's already an absolute URL, return as-is
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
    return src;
  }

  const proxyPrefix = downloadUrl?.match(
    /^(?:https?:\/\/[^/]+)?(\/api\/github\/[^/]+\/[^/]+\/repos\/[^/]+\/[^/]+\/contents\/)/,
  )?.[1];
  if (proxyPrefix && downloadUrl) {
    const source = new URL(src, `https://share.invalid/${filePath.split("/").map(encodeURIComponent).join("/")}`);
    const target = new URL(downloadUrl, "https://share.invalid");
    target.pathname = proxyPrefix + source.pathname.slice(1);
    target.hash = source.hash;
    return downloadUrl.startsWith("http") ? target.href : target.pathname + target.search + target.hash;
  }

  // Get the directory of the current file
  const fileDir = filePath.includes("/") ? filePath.substring(0, filePath.lastIndexOf("/")) : "";

  // Handle relative paths
  let resolvedPath: string;
  if (src.startsWith("./")) {
    // Relative to current directory: ./media/image.png
    resolvedPath = fileDir ? `${fileDir}/${src.slice(2)}` : src.slice(2);
  } else if (src.startsWith("../")) {
    // Parent directory reference
    const parts = fileDir.split("/");
    let srcParts = src.split("/");
    while (srcParts[0] === "..") {
      parts.pop();
      srcParts = srcParts.slice(1);
    }
    resolvedPath = [...parts, ...srcParts].filter(Boolean).join("/");
  } else if (src.startsWith("/")) {
    // Absolute path from repo root
    resolvedPath = src.slice(1);
  } else {
    // Relative path without prefix: media/image.png
    resolvedPath = fileDir ? `${fileDir}/${src}` : src;
  }

  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${resolvedPath}`;
}
