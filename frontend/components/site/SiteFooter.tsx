import Link from "next/link";
import { ExternalLinkGlyph } from "@/components/ui/StatusGlyphs";

const PROGRAM_ID = "321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm";
const BASE_REGISTRY_ADDRESS =
  process.env.NEXT_PUBLIC_BASE_REGISTRY_ADDRESS || "0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/arena", label: "Arena" },
  { href: "/create", label: "Deploy Agent" },
  { href: "https://docs.viperx.site/quickstart", label: "Guides", external: true },
  { href: "https://docs.viperx.site", label: "Docs", external: true },
  { href: "https://docs.viperx.site/security/smart-contracts", label: "Specs", external: true },
];

/**
 * Premium minimalist footer design inspired by base.org.
 * Features a compact, status-led left block, clean SVG social rows, 
 * and structured vertical link columns including dedicated smart contract lookups.
 */
export function SiteFooter() {
  return (
    <footer className="bp-invert relative z-10 mt-auto border-t border-border bg-background">
      <div className="mx-auto w-full max-w-[76rem] px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

          <div className="lg:col-span-4 flex flex-col gap-5">
            <div>
              <Link href="/" className="inline-flex items-center gap-2.5 transition-opacity hover:opacity-85">
                <img src="/viperx-logo-light.png" alt="ViperX" className="h-7 w-auto object-contain dark:hidden" />
                <img src="/viperx-logo-option-1-exact-logo.png" alt="ViperX" className="h-7 w-auto object-contain hidden dark:block" />
                <span className="font-sans text-[1.18rem] font-bold tracking-tight leading-none select-none">
                  <span className="text-foreground">Viper</span>
                  <span className="text-accent">X</span>
                </span>
              </Link>
              <p className="t-body mt-3 max-w-[24ch] text-foreground-muted text-sm font-medium">
                Prove agent performance on chain instead of screenshotting it.
              </p>
            </div>

            {/* Social Icons Aligned Horizontally */}
            <div className="flex items-center gap-4.5 text-foreground-faint">
              <a
                href="https://x.com/ViperX_site"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
                aria-label="X (formerly Twitter)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
                  <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
                </svg>
              </a>
              <a
                href="https://github.com/ritesh59697/ViperX"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
                aria-label="GitHub"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                </svg>
              </a>
            </div>
          </div>

          {/* Right Columns: 4 link lists */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">

            {/* Column 1: EXPLORE / */}
            <div>
              <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-foreground-faint">
                Explore
              </h3>
              <ul className="mt-4 space-y-2.5 font-mono text-xs">
                <li>
                  <Link href="/leaderboard" className="text-foreground-muted transition-colors hover:text-foreground">
                    Leaderboard
                  </Link>
                </li>
                <li>
                  <Link href="/arena" className="text-foreground-muted transition-colors hover:text-foreground">
                    Arena
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard" className="text-foreground-muted transition-colors hover:text-foreground">
                    Dashboard
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 2: DEVELOP / */}
            <div>
              <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-foreground-faint">
                Develop
              </h3>
              <ul className="mt-4 space-y-2.5 font-mono text-xs">
                <li>
                  <Link href="/create" className="text-foreground-muted transition-colors hover:text-foreground">
                    Deploy Agent
                  </Link>
                </li>
                <li>
                  <Link href="/backtest" className="text-foreground-muted transition-colors hover:text-foreground">
                    Backtest Lab
                  </Link>
                </li>
                <li>
                  <Link href="/paper" className="text-foreground-muted transition-colors hover:text-foreground">
                    Paper Trading
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: RESOURCES / */}
            <div>
              <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-foreground-faint">
                Resources
              </h3>
              <ul className="mt-4 space-y-2.5 font-mono text-xs">
                <li>
                  <a
                    href="https://docs.viperx.site"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group text-foreground-muted transition-colors hover:text-foreground inline-flex items-center gap-1.5"
                  >
                    <span>Documentation</span>
                    <ExternalLinkGlyph className="h-3 w-3 text-foreground-faint transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://docs.viperx.site/quickstart"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group text-foreground-muted transition-colors hover:text-foreground inline-flex items-center gap-1.5"
                  >
                    <span>User Guides</span>
                    <ExternalLinkGlyph className="h-3 w-3 text-foreground-faint transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://docs.viperx.site/security/smart-contracts"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group text-foreground-muted transition-colors hover:text-foreground inline-flex items-center gap-1.5"
                  >
                    <span>System Specs</span>
                    <ExternalLinkGlyph className="h-3 w-3 text-foreground-faint transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 4: CONTRACTS / */}
            <div>
              <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-foreground-faint">
                Contracts
              </h3>
              <ul className="mt-4 space-y-2.5 font-mono text-xs">
                <li>
                  <a
                    href={`https://sepolia.basescan.org/address/${BASE_REGISTRY_ADDRESS}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground-muted transition-colors hover:text-foreground"
                  >
                    Base registry
                  </a>
                </li>
                <li>
                  <a
                    href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground-muted transition-colors hover:text-foreground"
                  >
                    Solana program
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/ritesh59697/ViperX"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground-muted transition-colors hover:text-foreground"
                  >
                    GitHub Source
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer bottom */}
        <div className="mt-16 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border/60 pt-8">
          <div className="flex items-center gap-3">
            <span className="text-xs text-foreground-faint font-mono">
              © {new Date().getFullYear()} ViperX Protocol
            </span>
            <span className="text-border-strong select-none">•</span>
            <span className="text-xs text-foreground-faint font-mono">
              Also live on Solana Devnet.
            </span>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                target={l.external ? "_blank" : undefined}
                rel={l.external ? "noopener noreferrer" : undefined}
                className="group text-xs font-mono text-foreground-faint transition-colors hover:text-foreground-muted inline-flex items-center gap-1"
              >
                <span>{l.label}</span>
                {l.external && (
                  <ExternalLinkGlyph className="h-2.5 w-2.5 opacity-70 transition-transform duration-150 group-hover:opacity-100 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                )}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
