import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

// next.config.ts is compiled as ESM under Next 16; __dirname isn't defined.
const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Dev-only overlay. It defaults to bottom-left, where it sits on top of the
  // hero's "Deploy AI agent" bar and hides the first word. It has never shipped
  // to users (no nextjs-portal exists in a production build), so this is purely
  // so local screenshots and visual QA aren't obstructed.
  devIndicators: {
    position: "top-right",
  },
  turbopack: {
    // Pin the filesystem root to this package. Without this, a stray
    // package-lock.json one level up (or a misplaced pnpm-workspace.yaml)
    // makes Turbopack treat the monorepo parent as the project root, so
    // client module IDs become "[project]/frontend/app/..." and the React
    // Client Manifest fails to resolve Providers (and hydration dies —
    // header links look fine but aren't clickable).
    root: configDir,
    resolveAlias: {
      // @velocity-exchange/sdk's browser build still pulls in a Node-only
      // `loadKeypair` helper that `require("fs")` at module scope — this
      // app never calls it, so stub `fs` for the *client* bundle only (the
      // `browser` condition). Scoping to "browser" instead of aliasing `fs`
      // unconditionally matters: several unrelated server-side dependencies
      // (qrcode, @coral-xyz/anchor's nodewallet, the mobile wallet adapter)
      // legitimately need real `fs` during SSR, and a blanket alias broke
      // those. See lib/shims/fs-browser-shim.js.
      fs: { browser: "./lib/shims/fs-browser-shim.js" },
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        fs: path.resolve(configDir, "lib/shims/fs-browser-shim.js"),
      };
    }
    return config;
  },
};

export default nextConfig;
