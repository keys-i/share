import type { LanguageFn } from "highlight.js";
import hljs from "highlight.js/lib/core";
import * as React from "react";
import { decodeContent, getFileExtension } from "@/lib/file-utils";
import type { FileContent } from "@/lib/types/github";
import { cn } from "@/lib/utils";

const languages = import.meta.glob<{ default: LanguageFn }>("/node_modules/highlight.js/es/languages/*.js");

interface CodeViewerProps {
  file: FileContent;
  wrapText?: boolean;
}

/**
 * Map file extensions to highlight.js language identifiers
 */
function getLanguageFromFilename(filename: string): string | undefined {
  const ext = getFileExtension(filename) || filename.toLowerCase();

  const languageMap: Record<string, string> = {
    // JavaScript/TypeScript
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    mjs: "javascript",
    cjs: "javascript",
    // Web
    html: "xml",
    htm: "xml",
    css: "css",
    scss: "scss",
    sass: "scss",
    less: "less",
    // Data formats
    json: "json",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    toml: "ini",
    // Programming languages
    py: "python",
    rb: "ruby",
    java: "java",
    kt: "kotlin",
    scala: "scala",
    go: "go",
    rs: "rust",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    php: "php",
    swift: "swift",
    m: "objectivec",
    // Shell/Scripts
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    fish: "bash",
    ps1: "powershell",
    bat: "dos",
    cmd: "dos",
    // Config files
    dockerfile: "dockerfile",
    makefile: "makefile",
    cmake: "cmake",
    gradle: "gradle",
    // Markup/Docs
    md: "markdown",
    markdown: "markdown",
    tex: "latex",
    rst: "plaintext",
    // SQL
    sql: "sql",
    // Other
    graphql: "graphql",
    gql: "graphql",
    prisma: "prisma",
    vue: "xml",
    svelte: "xml",
  };

  return languageMap[ext];
}

export function CodeViewer({ file, wrapText = false }: CodeViewerProps) {
  const decodedContent = decodeContent(file.content, file.encoding);

  const language = getLanguageFromFilename(file.name);
  const largeFile = decodedContent.length > 200_000;
  const [loadedLanguage, setLoadedLanguage] = React.useState<string>();
  React.useEffect(() => {
    if (!language || largeFile) return;
    let active = true;
    const load = languages[`/node_modules/highlight.js/es/languages/${language}.js`];
    if (!load) return;
    load()
      .then(({ default: grammar }) => {
        hljs.registerLanguage(language, grammar);
        if (active) setLoadedLanguage(language);
      })
      .catch((error) => console.error("Could not load syntax highlighting", error));
    return () => {
      active = false;
    };
  }, [language, largeFile]);

  // Highlighted HTML for each line
  const highlightedLines = React.useMemo(() => {
    if (largeFile) return [];
    const highlighted =
      language && loadedLanguage === language && hljs.getLanguage(language)
        ? hljs.highlight(decodedContent, { language, ignoreIllegals: true }).value
        : decodedContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return highlighted.split("\n");
  }, [decodedContent, language, loadedLanguage, largeFile]);

  if (largeFile)
    return (
      <div className="p-4">
        <p className="mb-4 text-sm text-muted-foreground">
          Large file: syntax highlighting and line numbers are disabled.
        </p>
        <pre className={cn("font-mono text-sm", wrapText ? "whitespace-pre-wrap break-all" : "overflow-x-auto")}>
          {decodedContent}
        </pre>
      </div>
    );

  return (
    <div className={cn("font-mono text-sm hljs", !wrapText && "overflow-x-auto")}>
      <table className="w-full border-collapse">
        <tbody>
          {highlightedLines.map((lineHtml, index) => {
            const lineNumber = index + 1;
            return (
              <tr key={`line-${lineNumber}`} className="hover:bg-accent/30 group">
                <td className="sticky left-0 z-10 px-4 py-0 text-right text-muted-foreground select-none bg-background group-hover:bg-accent/30 w-12 align-top">
                  {lineNumber}
                </td>
                <td
                  className={cn("px-4 py-0", wrapText ? "whitespace-pre-wrap break-all" : "whitespace-pre")}
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for syntax highlighting
                  dangerouslySetInnerHTML={{ __html: lineHtml || " " }}
                />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
