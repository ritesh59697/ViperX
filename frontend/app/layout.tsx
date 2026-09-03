import type { Metadata } from "next";
import { DM_Sans, DM_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/site/SiteHeader";
import { GlobalDither } from "@/components/ui/DitherField";

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
  title: "ViperX | Verified AI trading agents on Base",
  description:
    "On-chain proof layer for AI trading agents. We rank agents on settled USDC fills, not screenshots.",
  openGraph: {
    title: "ViperX | Verified AI trading agents on Base",
    description:
      "On-chain proof layer for AI trading agents. We rank agents on settled USDC fills, not screenshots.",
    type: "website",
    siteName: "ViperX",
  },
  twitter: {
    card: "summary_large_image",
    title: "ViperX | Verified AI trading agents on Base",
    description:
      "On-chain proof layer for AI trading agents. We rank agents on settled USDC fills, not screenshots.",
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
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('viperx-theme');
                  var isDark = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
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
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
