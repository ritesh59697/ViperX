// Checks every trade whose tx_found is still NULL against its agent's chain and records the
// result in trades.tx_found / tx_checked_at. Only rows with tx_found = TRUE count as verified
// fills (frontend/lib/server/leaderboardService.ts), so a hash that does not exist on chain stops
// counting without the row being deleted.
//
// Usage (DATABASE_URL from .env or the environment):
//   node tools/check-trade-hashes.mjs --solana-rpc <url> --base-rpc <url> --xlayer-rpc <url> [--xlayer-rpc <url> ...]
//     [--max-retries <n>] [--dry-run]
// Several --xlayer-rpc flags check each network in turn (the older X Layer rows predate mainnet).
import "dotenv/config";
import pg from "pg";

const args = process.argv.slice(2);
const flag = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : [])).filter(Boolean);
const rpcs = { solana: flag("--solana-rpc"), base: flag("--base-rpc"), xlayer: flag("--xlayer-rpc") };
const dryRun = args.includes("--dry-run");
for (const [chain, urls] of Object.entries(rpcs)) {
  if (urls.length === 0) throw new Error(`--${chain}-rpc is required`);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const maxRetries = Number(flag("--max-retries")[0] ?? 8);

async function rpc(url, method, params) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (res.status === 429 && attempt < maxRetries) {
      // Public RPCs rate-limit; wait as told, else back off exponentially.
      const wait = Number(res.headers.get("retry-after")) * 1000 || 500 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`${url} ${method}: HTTP ${res.status}`);
    return res.json();
  }
}

/** true = found, false = the node says it does not exist (or the id is malformed). Throws on transport errors. */
async function existsOn(chain, url, sig) {
  if (chain === "solana") {
    const r = await rpc(url, "getSignatureStatuses", [[sig], { searchTransactionHistory: true }]);
    if (r.error) return false; // e.g. "Invalid param: WrongSize" for a signature that is not 64 bytes
    return r.result?.value?.[0] != null;
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(sig)) return false;
  const r = await rpc(url, "eth_getTransactionReceipt", [sig]);
  if (r.error) throw new Error(`${url}: ${r.error.message}`);
  return r.result != null;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await pool.query(
  `SELECT t.id, t.tx_signature, a.chain
     FROM trades t JOIN agents a ON a.agent_pda = t.agent_pda
    WHERE t.tx_found IS NULL AND t.chain_event_id IS NULL`,
);
console.log(`${rows.length} unchecked trades`);

const tally = {};
for (const row of rows) {
  const chain = row.chain ?? "solana";
  const urls = rpcs[chain];
  let found = false;
  if (row.tx_signature && urls) {
    for (const url of urls) {
      if (await existsOn(chain, url, row.tx_signature)) {
        found = true;
        break;
      }
    }
  }
  const k = `${chain}:${found ? "found" : "not-found"}`;
  tally[k] = (tally[k] ?? 0) + 1;
  if (!dryRun) {
    await pool.query("UPDATE trades SET tx_found = $2, tx_checked_at = now() WHERE id = $1", [row.id, found]);
  }
}
console.log(dryRun ? "dry run, nothing written:" : "written:", tally);
await pool.end();
