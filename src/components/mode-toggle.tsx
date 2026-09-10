import { useId } from "react";
import { useThemes } from "@/components/theme-provider";

export function ModeToggle({ labels }: { labels?: { light: string; dark: string } } = {}) {
  const id = useId();
  const { theme, setTheme, systemTheme } = useThemes();
  const resolvedTheme = theme === "system" ? systemTheme : theme;
  const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
  const label = labels?.[nextTheme] ?? `Switch to ${nextTheme} mode`;

  return (
    <button
      type="button"
      className="mode-toggle"
      data-theme={resolvedTheme}
      onClick={() => setTheme(nextTheme)}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <defs>
          <mask id={id}>
            <rect width="32" height="32" fill="white" />
            <circle className="mode-toggle-cutout" cx="24" cy="8" r="8" fill="black" />
          </mask>
        </defs>
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle className="mode-toggle-orb" cx="16" cy="16" r="8" mask={`url(#${id})`} />
          <path className="mode-toggle-rays" d="M16 2v3m0 22v3M2 16h3m22 0h3M6 6l2 2m16 16 2 2M6 26l2-2M24 8l2-2" />
        </g>
      </svg>
    </button>
  );
}
