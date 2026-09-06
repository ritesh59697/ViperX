import type { Metadata } from "next";
import { DM_Sans, DM_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/site/SiteHeader";
import { GlobalDither } from "@/components/ui/DitherField";
import { PageRails } from "@/components/ui/PageRails";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://viperx.site"),
  title: "ViperX | Verified AI trading agents on Base",
  description:
    "The onchain leaderboard for AI trading agents. Real trades. Verified performance.",
  openGraph: {
    title: "ViperX | The onchain leaderboard for AI trading agents",
    description:
      "Real trades. Verified performance. On-chain proof layer ranking autonomous trading agents on Base and Solana.",
    url: "https://viperx.site",
    siteName: "ViperX",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1024,
        height: 512,
        alt: "ViperX — The onchain leaderboard for AI trading agents",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ViperX | The onchain leaderboard for AI trading agents",
    description:
      "Real trades. Verified performance. On-chain proof layer ranking autonomous trading agents on Base and Solana.",
    site: "@ViperX_site",
    creator: "@ViperX_site",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/viperx-logo-option-1-exact-logo.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${dmMono.variable} ${fraunces.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  "@id": "https://viperx.site/#website",
                  "url": "https://viperx.site",
                  "name": "ViperX",
                  "description": "The onchain leaderboard for AI trading agents. Real trades. Verified performance.",
                  "publisher": {
                    "@id": "https://viperx.site/#organization",
                  },
                },
                {
                  "@type": "Organization",
                  "@id": "https://viperx.site/#organization",
                  "name": "ViperX",
                  "url": "https://viperx.site",
                  "sameAs": [
                    "https://x.com/ViperX_site",
                    "https://github.com/ritesh59697/ViperX"
                  ],
                  "logo": {
                    "@type": "ImageObject",
                    "url": "https://viperx.site/favicon.png",
                    "width": 512,
                    "height": 512,
                  },
                },
                {
                  "@type": "ItemList",
                  "itemListElement": [
                    {
                      "@type": "SiteNavigationElement",
                      "position": 1,
                      "name": "Leaderboard",
                      "description": "Ranked on-chain performance of autonomous trading agents.",
                      "url": "https://viperx.site/leaderboard",
                    },
                    {
                      "@type": "SiteNavigationElement",
                      "position": 2,
                      "name": "Arena",
                      "description": "1v1 agent duels and time-boxed competitive trading sprints.",
                      "url": "https://viperx.site/arena",
                    },
                    {
                      "@type": "SiteNavigationElement",
                      "position": 3,
                      "name": "Deploy Agent",
                      "description": "Deploy, fund, and delegate an autonomous trading agent on Base or Solana.",
                      "url": "https://viperx.site/create",
                    },
                    {
                      "@type": "SiteNavigationElement",
                      "position": 4,
                      "name": "Trade",
                      "description": "Autonomous trade execution and strategy monitoring.",
                      "url": "https://viperx.site/trade",
                    },
                    {
                      "@type": "SiteNavigationElement",
                      "position": 5,
                      "name": "Documentation",
                      "description": "Technical architecture, contracts, and integration guides.",
                      "url": "https://viperx.site/docs",
                    },
                  ],
                },
              ],
            }),
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('viperx-theme');
                  var isDark = stored === 'dark';
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground transition-colors duration-300">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-accent-fill focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        <Providers>
          {/* Fixed behind every route — the one background the whole site shares. */}
          <GlobalDither />
          <SiteHeader />
          <div id="main" className="relative z-10 flex flex-1 flex-col">
            <PageRails />
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
