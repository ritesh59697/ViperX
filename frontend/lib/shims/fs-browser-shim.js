// @velocity-exchange/sdk's "browser" build still contains a Node-only
// `loadKeypair` CLI helper (lib/browser/keypair.js) that unconditionally
// `require("fs")` at module scope, even though this app never calls
// `loadKeypair` (see hooks/useVelocity.ts — only VelocityClient, Wallet,
// BulkAccountLoader, BN, PositionDirection, initialize are used). Turbopack
// still needs `fs` to resolve to *something* for the client bundle; this
// stub is never actually invoked at runtime.
module.exports = {
  existsSync: () => false,
  readFileSync: () => {
    throw new Error("fs.readFileSync is not available in the browser");
  },
};
