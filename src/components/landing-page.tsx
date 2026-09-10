import { SiGithub as Github } from "@icons-pack/react-simple-icons";
import { ClientOnly, useNavigate } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  CheckCheck,
  Code2,
  Copy,
  FolderCode,
  Heart,
  Languages,
  Link2,
  LockKeyhole,
  MessageCircle,
  Server,
  ShieldCheck,
} from "lucide-react";
import { type SubmitEvent, useEffect, useId, useRef, useState } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_DOMAIN } from "@/lib/constants";
import { type LocaleContent, languageHref, locales } from "@/lib/localization";
import { normalizeShareId, parseGitHubUrl, shareAuthorizationUrl } from "@/lib/shares";

export function LandingPage({
  initialRepository = "",
  content,
}: {
  initialRepository?: string;
  content: LocaleContent;
}) {
  const { locale, text } = content;
  const navigate = useNavigate();
  const language = locales.find((entry) => entry.locale === locale);
  const homePath = language?.path ?? "/";
  const id = useId();
  const page = useRef<HTMLDivElement>(null);
  const [repoUrl, setRepoUrl] = useState(initialRepository);
  const [error, setError] = useState<"" | "invalidRepository" | "clipboardUnavailable">("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const repo = parseGitHubUrl(repoUrl);
  const sourceCodeUrl = import.meta.env.VITE_SOURCE_CODE_URL;
  const selfHostingUrl = sourceCodeUrl
    ? `${sourceCodeUrl.replace(/\/$/, "")}/blob/main/docs/SELF_HOSTING.md`
    : "/self-hosting.md";

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          (entry.target as HTMLElement).dataset.visible = String(entry.isIntersecting);
        }
      },
      { threshold: 0.2 },
    );
    for (const element of page.current?.querySelectorAll("[data-motion]") ?? []) observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const path = fragment.get("share");
    const prefilled = parseGitHubUrl(fragment.get("repo") ?? "");
    if (prefilled && !initialRepository) {
      setRepoUrl(`${prefilled.owner}/${prefilled.repo}`);
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    }
    const parts = path?.match(/^\/([a-z\d-]+)\/([^/]+)$/i);
    const shareId = normalizeShareId(parts?.[2] ?? "");
    if (parts && shareId) {
      setLink(`${window.location.origin}/${parts[1].toLowerCase()}/${shareId}`);
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    }
  }, [initialRepository]);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!repo) {
      setError("invalidRepository");
      return;
    }
    window.location.assign(shareAuthorizationUrl(repo.owner, repo.repo));
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setError("");
    } catch {
      setError("clipboardUnavailable");
    }
  }

  return (
    <div className="share-landing" lang={locale} dir={language?.dir} ref={page}>
      <a className="share-skip" href={`#${id}-main-content`}>
        {text.skip}
      </a>
      <header className="share-header">
        <div className="share-container share-nav">
          <a href={homePath} className="share-brand" aria-label={text.homeLabel}>
            <span className="share-brand-icon">
              <Link2 aria-hidden="true" />
            </span>
            share.git
          </a>
          <nav aria-label={text.mainNavigation} className="share-nav-links">
            <a href={`#${id}-features`}>{text.features}</a>
            <a href={`#${id}-how-it-works`}>{text.howItWorks}</a>
            <a href={`#${id}-use-cases`}>{text.useCases}</a>
          </nav>
          <div className="share-nav-actions">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="mode-toggle share-language-toggle"
                aria-label={text.language}
                title={text.language}
              >
                <Languages aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="share-language-menu" aria-label={text.language}>
                <DropdownMenuRadioGroup
                  value={locale}
                  onValueChange={(value) => {
                    const next = locales.find((entry) => entry.locale === value);
                    if (next && next.locale !== locale)
                      void navigate({
                        href: languageHref(next.path, repo ? `${repo.owner}/${repo.repo}` : "", link),
                        resetScroll: false,
                        viewTransition: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
                      });
                  }}
                >
                  {locales.map((entry) => (
                    <DropdownMenuRadioItem
                      key={entry.locale}
                      value={entry.locale}
                      lang={entry.lang}
                      dir={entry.dir}
                      className="share-language-option"
                    >
                      {entry.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <ClientOnly>
              <ModeToggle labels={{ light: text.themeLight, dark: text.themeDark }} />
            </ClientOnly>
            <a className="share-button share-button-small" href={`#${id}-create-link`}>
              {text.createLink}
              <ArrowUpRight aria-hidden="true" />
            </a>
          </div>
        </div>
      </header>

      <main id={`${id}-main-content`}>
        <section className="share-container share-hero" aria-labelledby={`${id}-hero-title`}>
          <div className="share-hero-copy">
            <h1 id={`${id}-hero-title`}>{text.heading}</h1>
            <p className="share-intro">{text.intro}</p>
            <ul className="share-promises" aria-label={text.essentials}>
              <li>
                <Check aria-hidden="true" />
                {text.readOnly}
              </li>
              <li>
                <Check aria-hidden="true" />
                {text.expiry}
              </li>
              <li>
                <Check aria-hidden="true" />
                {text.staysPrivate}
              </li>
            </ul>
            <a href={`#${id}-how-it-works`} className="share-text-link">
              {text.howItWorks}
              <ArrowDown aria-hidden="true" />
            </a>
          </div>

          <div className="share-hero-tool" data-shared={Boolean(link)}>
            <div className="share-mascot" data-motion="mascot" aria-hidden="true">
              <span className="share-folder-file">
                <Code2 />
              </span>
              <svg className="share-folder-body" viewBox="0 0 124 112" aria-hidden="true">
                <path d="M3 99V14A11 11 0 0 1 14 3h26a10 10 0 0 1 8 4l12 15h49a12 12 0 0 1 12 12v65a10 10 0 0 1-10 10H13A10 10 0 0 1 3 99Z" />
              </svg>
              <div className="share-folder-face">
                <i />
                <i />
                <span />
              </div>
            </div>
            <section id={`${id}-create-link`} className="share-form-panel" aria-labelledby={`${id}-create-title`}>
              <div className="share-panel-bar">
                <span />
                <span />
                <span />
                <span className="share-panel-label">{text.panelLabel}</span>
              </div>
              <div className="share-form-content">
                <div className="share-form-heading">
                  <Link2 aria-hidden="true" />
                  <h2 id={`${id}-create-title`}>{link ? text.createdTitle : text.createTitle}</h2>
                </div>
                {initialRepository && !link && (
                  <p className="share-prefill">
                    <CheckCheck aria-hidden="true" />
                    {text.prefilled}
                  </p>
                )}
                {link ? (
                  <section aria-label={text.createdLabel} className="share-result">
                    <Label htmlFor={`${id}-share`}>{text.linkLabel}</Label>
                    <div className="share-copy-row">
                      <Input
                        id={`${id}-share`}
                        value={link}
                        dir="ltr"
                        readOnly
                        onFocus={(event) => event.target.select()}
                      />
                      <Button
                        type="button"
                        onClick={copyLink}
                        aria-label={copied ? text.copied : text.copyLink}
                        className="share-copy-button"
                        data-copied={copied}
                      >
                        {copied ? <Check /> : <Copy />}
                      </Button>
                    </div>
                    <p aria-live="polite">
                      {copied ? `${text.copied}. ` : ""}
                      <a className="share-text-link" href={link}>
                        {text.openRepository}
                        <ArrowUpRight aria-hidden="true" />
                      </a>
                    </p>
                    <p className="share-fine-print">{text.accessWarning}</p>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => {
                        setLink("");
                        setCopied(false);
                        setError("");
                      }}
                    >
                      {text.createAnother}
                    </Button>
                  </section>
                ) : (
                  <form onSubmit={handleSubmit} className="share-form">
                    <div className="share-field">
                      <Label htmlFor={`${id}-repo`}>{text.repository}</Label>
                      <Input
                        id={`${id}-repo`}
                        value={repoUrl}
                        onChange={(event) => {
                          setRepoUrl(event.target.value);
                          setError("");
                        }}
                        placeholder={text.placeholder}
                        dir="ltr"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        required
                        aria-invalid={Boolean(error)}
                        aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
                      />
                    </div>
                    <p id={`${id}-help`} className="share-fine-print">
                      {text.help}
                    </p>
                    {import.meta.env.VITE_GITHUB_APP_SLUG && (
                      <a
                        className="share-text-link"
                        href={`https://github.com/apps/${encodeURIComponent(import.meta.env.VITE_GITHUB_APP_SLUG)}/installations/new`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {text.installApp}
                        <ArrowUpRight aria-hidden="true" />
                      </a>
                    )}
                    <Button type="submit" className="share-button share-submit">
                      <Github aria-hidden="true" />
                      {text.signInCreate}
                      <ArrowUpRight aria-hidden="true" />
                    </Button>
                    <p className="share-form-note">
                      <LockKeyhole aria-hidden="true" />
                      {text.noPat}
                    </p>
                    <a
                      className="share-public-link"
                      href={repo ? `/${repo.owner}/${repo.repo}/tree` : "/facebook/react/tree"}
                    >
                      {repo ? text.browseThis : text.browsePublic} <ArrowUpRight aria-hidden="true" />
                    </a>
                  </form>
                )}
                {error && (
                  <p id={`${id}-error`} role="alert" className="share-error">
                    {text[error]}
                  </p>
                )}
              </div>
            </section>
          </div>
        </section>

        <section
          id={`${id}-features`}
          className="share-section share-features"
          aria-labelledby={`${id}-features-title`}
        >
          <div className="share-container">
            <div className="share-section-heading">
              <h2 id={`${id}-features-title`}>{text.features}</h2>
            </div>
            <div className="share-feature-grid">
              <article className="share-feature share-feature-blue" data-motion="shield">
                <div className="share-feature-art share-shield-scene" aria-hidden="true">
                  <span className="share-protected-file">
                    <Code2 />
                  </span>
                  <ShieldCheck />
                </div>
                <h3>{text.readOnly}</h3>
                <p>{text.readOnlyDescription}</p>
              </article>
              <article className="share-feature share-feature-yellow" data-motion="github">
                <div className="share-feature-art share-permission-scene" aria-hidden="true">
                  <span className="share-permission-ticket">
                    <Check />
                  </span>
                  <span className="share-permission-ticket">
                    <Check />
                  </span>
                  <Github />
                </div>
                <h3>{text.appSignIn}</h3>
                <p>{text.appDescription}</p>
              </article>
              <article className="share-feature share-feature-lilac" data-motion="clock">
                <div className="share-feature-art share-clock-scene" aria-hidden="true">
                  <svg viewBox="0 0 64 64" stroke="currentColor" strokeLinecap="round" aria-hidden="true">
                    <circle cx="32" cy="32" r="27" fill="#fffef8" />
                    <line className="share-clock-hand share-clock-hour" x1="32" y1="32" x2="32" y2="19" />
                    <line className="share-clock-hand share-clock-minute" x1="32" y1="32" x2="32" y2="12" />
                    <circle cx="32" cy="32" r="2.3" fill="currentColor" stroke="none" />
                  </svg>
                  <span className="share-expiry-dots">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
                <h3>{text.sevenDays}</h3>
                <p>{text.expiryDescription}</p>
              </article>
            </div>
          </div>
        </section>

        <section
          id={`${id}-how-it-works`}
          className="share-container share-section share-how"
          aria-labelledby={`${id}-how-title`}
        >
          <div className="share-section-heading">
            <h2 id={`${id}-how-title`}>{text.howItWorks}</h2>
          </div>
          <ol className="share-steps" data-motion="steps">
            <li>
              <span className="share-step-number">1</span>
              <div>
                <h3>{text.stepOne}</h3>
                <p>{text.stepOneDescription}</p>
              </div>
            </li>
            <li>
              <span className="share-step-number">2</span>
              <div>
                <h3>{text.stepTwo}</h3>
                <p>{text.stepTwoDescription}</p>
              </div>
            </li>
            <li>
              <span className="share-step-number">3</span>
              <div>
                <h3>{text.stepThree}</h3>
                <p>{text.stepThreeDescription}</p>
              </div>
            </li>
          </ol>
        </section>

        <section className="share-container share-shortcut" aria-labelledby={`${id}-shortcut-title`}>
          <div>
            <h2 id={`${id}-shortcut-title`}>{text.shortcutTitle}</h2>
            <p>{text.shortcutDescription.replace("{domain}", APP_DOMAIN)}</p>
            <p className="share-fine-print">{text.shortcutWarning}</p>
          </div>
          <div className="share-shortcut-demo" data-motion="shortcut">
            <span>{text.from}</span>
            <code dir="ltr">github.com/octocat/Hello-World</code>
            <ArrowDown aria-hidden="true" />
            <span>{text.to}</span>
            <a href={locale === "en" ? "/octocat/Hello-World" : languageHref(homePath, "octocat/Hello-World", "")}>
              <code dir="ltr">{APP_DOMAIN}/octocat/Hello-World</code>
              <ArrowUpRight aria-hidden="true" />
            </a>
            <p>{text.shortcutNote}</p>
          </div>
        </section>

        <section
          id={`${id}-use-cases`}
          className="share-container share-section"
          aria-labelledby={`${id}-use-cases-title`}
        >
          <div className="share-section-heading">
            <h2 id={`${id}-use-cases-title`}>{text.useCases}</h2>
          </div>
          <div className="share-use-cases">
            <article data-motion="reviews">
              <div className="share-use-art share-review-scene" aria-hidden="true">
                <MessageCircle />
                <span className="share-typing-dots">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
              <h3>{text.reviews}</h3>
              <p>{text.reviewsDescription}</p>
            </article>
            <article data-motion="handoff">
              <div className="share-use-art share-handoff-scene" aria-hidden="true">
                <FolderCode />
                <span className="share-handoff-link">
                  <Link2 />
                </span>
              </div>
              <h3>{text.handoffs}</h3>
              <p>{text.handoffsDescription}</p>
            </article>
            <article data-motion="learning">
              <div className="share-use-art share-learning-scene" aria-hidden="true">
                <svg
                  viewBox="0 0 64 58"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path className="share-book-cover" d="M4 12Q17 9 31 17Q46 10 60 13L59 47Q44 43 31 51Q17 44 5 47Z" />
                  <path className="share-book-paper" d="M6 8Q19 7 31 14Q44 6 58 9L57 41Q44 39 31 46Q18 40 6 43Z" />
                  <path d="M31 14v32M7 44Q19 42 31 49Q44 42 57 45" fill="none" />
                  <path className="share-book-ink" d="M11 17q8 0 14 4M11 24q6 0 11 3M38 18q7-3 14-2M38 25q6-2 12-2" />
                  <g className="share-book-page">
                    <path className="share-book-paper" d="M31 14Q44 6 58 9L57 41Q44 39 31 46Z" />
                    <path className="share-book-ink" d="M38 18q7-3 14-2M38 25q6-2 12-2" />
                  </g>
                  <g className="share-book-page">
                    <path className="share-book-paper" d="M31 14Q44 6 58 9L57 41Q44 39 31 46Z" />
                    <path className="share-book-ink" d="M38 18q7-3 14-2M38 25q6-2 12-2" />
                  </g>
                  <g className="share-book-page">
                    <path className="share-book-paper" d="M31 14Q44 6 58 9L57 41Q44 39 31 46Z" />
                    <path className="share-book-ink" d="M38 18q7-3 14-2M38 25q6-2 12-2" />
                  </g>
                  <g className="share-book-page">
                    <path className="share-book-paper" d="M31 14Q44 6 58 9L57 41Q44 39 31 46Z" />
                    <path className="share-book-ink" d="M38 18q7-3 14-2M38 25q6-2 12-2" />
                  </g>
                </svg>
              </div>
              <h3>{text.learning}</h3>
              <p>{text.learningDescription}</p>
            </article>
          </div>
          <p className="share-access-note">
            <LockKeyhole aria-hidden="true" />
            {text.trustWarning}
          </p>
        </section>

        <section id={`${id}-self-host`} className="share-open-source" aria-labelledby={`${id}-open-source-title`}>
          <div className="share-container share-open-source-inner">
            <div className="share-open-icon" data-motion="source">
              <Server aria-hidden="true" />
            </div>
            <div>
              <h2 id={`${id}-open-source-title`}>{text.openSource}</h2>
              <p>{text.openSourceDescription}</p>
              <div className="share-open-actions">
                {sourceCodeUrl && (
                  <a className="share-button" href={sourceCodeUrl} target="_blank" rel="noreferrer">
                    <Github aria-hidden="true" />
                    {text.viewSource}
                    <ArrowUpRight aria-hidden="true" />
                  </a>
                )}
                <a className="share-text-link" href={selfHostingUrl} target="_blank" rel="noreferrer">
                  {text.selfHosting} <ArrowUpRight aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="share-footer">
        <div className="share-container">
          <div className="share-footer-main">
            <a href={homePath} className="share-brand">
              <span className="share-brand-icon">
                <Link2 aria-hidden="true" />
              </span>
              share.git
            </a>
            <p>{text.footerDescription}</p>
            <div className="share-footer-links">
              {sourceCodeUrl && (
                <a href={sourceCodeUrl} target="_blank" rel="noreferrer">
                  {text.sourceCode}
                  <ArrowUpRight aria-hidden="true" />
                </a>
              )}
              <a href="/LICENSE" download>
                {text.license}
              </a>
              <span>
                {text.madeBy}{" "}
                <a href="https://keysi.dev" target="_blank" rel="noreferrer">
                  Keysi <Heart aria-hidden="true" />
                </a>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
