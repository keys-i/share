import { lazy } from "react";

export { AudioViewer } from "./audio-viewer";
export { BinaryFileViewer } from "./binary-file-viewer";
export const CodeViewer = lazy(() => import("./code-viewer").then((module) => ({ default: module.CodeViewer })));
export { ImageViewer } from "./image-viewer";
export const MarkdownViewer = lazy(() =>
  import("./markdown-viewer").then((module) => ({ default: module.MarkdownViewer })),
);
export { PdfViewer } from "./pdf-viewer";
export { VideoViewer } from "./video-viewer";
