import {
  createPublicClient,
  decodeEventLog,
  fallback,
  formatUnits,
  toEventSelector,
  http,
  keccak256,
  parseAbi,
  toBytes,
  type Log,
} from "viem";
import { baseAgentKey } from "@/lib/baseAgentKey";
import { XLAYER_MARKET_SYMBOLS } from "@/lib/trade/marketSymbols";
import { XLAYER_AGENT_REGISTRY, XLAYER_CONTRACTS, XLAYER_NETWORK } from "@/lib/xlayer";
import type { QueryResult } from "pg";
import { pool } from "./db";
import { MIN_TRADES_FOR_ELIGIBILITY } from "./leaderboardService";
import { refreshAgentMetrics } from "./metrics";

/**
 * Indexes ViperX on X Layer into the leaderboard database:
 * - AgentRegistered / AgentStatusChanged / AgentMetadataUpdated from the agent registry
 * - PositionOpened / PositionClosed / PositionLiquidated from ViperVault
 *
 * Every fill it writes comes from a vault event, so it is marked tx_found = TRUE. Fills are
 * attributed only to agents read from the registry (registry_tx set) whose vault address is the
 * trader. Positions opened from signed agent intents go through PositionRouter.openPositionFor
 * and are recorded under the agent, so they are attributed the same way as direct trades.
 */

const VAULT_ABI = parseAbi([
  "event PositionOpened(bytes32 indexed positionKey, address indexed trader, bytes32 indexed marketId, uint8 side, uint256 sizeUsd, uint256 collateralUsd, uint256 entryPrice)",
  "event PositionClosed(bytes32 indexed positionKey, address indexed trader, bytes32 indexed marketId, uint8 side, uint256 sizeUsd, uint256 exitPrice, int256 realizedPnlUsd, uint256 netPayoutUsd)",
  "event PositionLiquidated(bytes32 indexed positionKey, address indexed trader, address indexed liquidator, uint256 sizeUsd, uint256 liquidationPrice, uint256 rewardUsd)",
]);
const REGISTRY_ABI = parseAbi([
  "event AgentRegistered(address indexed owner, string agentId, string name, string strategyUri, address indexed vaultAddress)",
  "event AgentStatusChanged(address indexed owner, string agentId, string status)",
  "event AgentMetadataUpdated(address indexed owner, string agentId, string name, string strategyUri)",
]);
/** The vault stores USD amounts and prices with 18 decimals (ViperVault._fromUsd18). */
const USD_DECIMALS = 18;
/** Only these events are applied; the contracts emit others (ownership, liquidity, markets). */
const HANDLED_TOPICS = new Set(
  [...VAULT_ABI, ...REGISTRY_ABI].map((item) => toEventSelector(item).toLowerCase()),
);
const LOCK_KEY = "viperx-xlayer-indexer";
const CURSOR_KEY = `xlayer:${XLAYER_NETWORK.chainId}:cursor`;

/**
 * RPC endpoints for the indexer: XLAYER_INDEXER_RPC_URLS (comma-separated, server-only), else the
 * app's NEXT_PUBLIC_XLAYER_RPC_URL. With several, viem's fallback transport moves to the next one
 * when a node errors or rate-limits.
 */
const RPC_URLS = (process.env.XLAYER_INDEXER_RPC_URLS ?? "")
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);
const client = createPublicClient({
  transport: RPC_URLS.length > 1 ? fallback(RPC_URLS.map((u) => http(u))) : http(RPC_URLS[0] ?? XLAYER_NETWORK.rpcUrl),
});
const isRateLimited = (err: unknown) => /rate limit|too many requests|429/i.test(String((err as Error)?.message ?? err));
const marketSymbolById = new Map<string, string>(
  XLAYER_MARKET_SYMBOLS.map((s) => [keccak256(toBytes(s)).toLowerCase(), s]),
);

function requirePositiveInt(name: string): number {
  const n = Number(process.env[name]);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${name} must be set to a positive integer`);
  return n;
}

async function readState(key: string): Promise<bigint | null> {
  const { rows } = await pool.query("SELECT value FROM indexer_state WHERE key = $1", [key]);
  return rows[0] ? BigInt(rows[0].value) : null;
}

type Queryable = { query: (text: string, params?: unknown[]) => Promise<QueryResult> };

async function writeState(key: string, value: bigint, q: Queryable = pool): Promise<void> {
  await q.query(
    `INSERT INTO indexer_state (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, value.toString()],
  );
}

/** First block where `address` has code, by binary search on eth_getCode. Cached in indexer_state. */
async function deployBlock(address: `0x${string}`, latest: bigint): Promise<bigint> {
  const key = `xlayer:${XLAYER_NETWORK.chainId}:deploy:${address.toLowerCase()}`;
  const cached = await readState(key);
  if (cached !== null) return cached;
  const hasCode = async (b: bigint) => {
    const code = await client.getCode({ address, blockNumber: b });
    return !!code && code !== "0x";
  };
  if (!(await hasCode(latest))) throw new Error(`no contract at ${address} on chain ${XLAYER_NETWORK.chainId}`);
  let lo = BigInt(0);
  let hi = latest;
  while (lo < hi) {
    const mid = (lo + hi) / BigInt(2);
    if (await hasCode(mid)) hi = mid;
    else lo = mid + BigInt(1);
  }
  await writeState(key, lo);
  return lo;
}

/** Deadline for the current run; rate-limit retries never wait past it. */
let runDeadline = 0;

/**
 * Retries `fn` while the node answers "rate limit", backing off exponentially, until the run's
 * deadline. Any other error is thrown at once.
 */
async function withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const limited = isRateLimited(err);
      const wait = 250 * 2 ** attempt;
      if (!limited || Date.now() + wait > runDeadline) throw err;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

/** The node's eth_getLogs block-range cap, read from its own error message. */
let logRangeCap: bigint | null = null;
async function getLogsRange(addresses: `0x${string}`[], from: bigint, to: bigint): Promise<Log[]> {
  try {
    return await withRateLimitRetry(() => client.getLogs({ address: addresses, fromBlock: from, toBlock: to }));
  } catch (err) {
    const m = String((err as Error)?.message ?? err).match(/greater than (\d+)/i);
    if (!m) throw err;
    logRangeCap = BigInt(m[1]);
    const out: Log[] = [];
    for (let s = from; s <= to; s += logRangeCap) {
      const e = s + logRangeCap - BigInt(1) < to ? s + logRangeCap - BigInt(1) : to;
      out.push(...(await withRateLimitRetry(() => client.getLogs({ address: addresses, fromBlock: s, toBlock: e }))));
    }
    return out;
  }
}

/**
 * Blocks per eth_getLogs call. Probes the whole remaining range once; a capped node reports its
 * limit in the error, which is then cached. If the probe succeeds, the remaining range fits.
 */
async function chunkSize(addresses: `0x${string}`[], at: bigint, latest: bigint): Promise<bigint> {
  if (logRangeCap !== null) return logRangeCap;
  try {
    await withRateLimitRetry(() => client.getLogs({ address: addresses, fromBlock: at, toBlock: latest }));
    return latest - at + BigInt(1);
  } catch (err) {
    const m = String((err as Error)?.message ?? err).match(/greater than (\d+)/i);
    if (!m) throw err;
    logRangeCap = BigInt(m[1]);
    return logRangeCap;
  }
}

async function applyLog(tx: Queryable, log: Log, blockTime: Date, touched: Set<string>, router: string): Promise<void> {
  const address = log.address.toLowerCase();
  const eventId = `${log.transactionHash}:${log.logIndex}`;

  if (XLAYER_AGENT_REGISTRY && address === XLAYER_AGENT_REGISTRY.toLowerCase()) {
    const ev = decodeEventLog({ abi: REGISTRY_ABI, data: log.data, topics: log.topics });
    const owner = (ev.args as { owner: string }).owner.toLowerCase();
    const agentId = (ev.args as { agentId: string }).agentId;
    const agentPda = baseAgentKey(owner, agentId);
    if (ev.eventName === "AgentRegistered") {
      const a = ev.args;
      await tx.query(
        `INSERT INTO agents (agent_pda, owner, agent_id, name, strategy_uri, vault_pubkey, status, trade_count,
                             leaderboard_eligible, chain, is_paper, created_at, updated_at, registry_tx, registry_block)
         VALUES ($1, $2, $3, $4, $5, $6, 'Active', 0, false, 'xlayer', false, $7, now(), $8, $9)
         ON CONFLICT (agent_pda) DO UPDATE SET
           owner = EXCLUDED.owner, agent_id = EXCLUDED.agent_id, name = EXCLUDED.name,
           strategy_uri = EXCLUDED.strategy_uri, vault_pubkey = EXCLUDED.vault_pubkey, chain = 'xlayer',
           is_paper = false, created_at = EXCLUDED.created_at, registry_tx = EXCLUDED.registry_tx,
           registry_block = EXCLUDED.registry_block, updated_at = now()`,
        [agentPda, owner, agentId, a.name, a.strategyUri, a.vaultAddress.toLowerCase(), blockTime, log.transactionHash, log.blockNumber!.toString()],
      );
    } else if (ev.eventName === "AgentStatusChanged") {
      await tx.query(`UPDATE agents SET status = $2, updated_at = now() WHERE agent_pda = $1`, [agentPda, ev.args.status]);
    } else if (ev.eventName === "AgentMetadataUpdated") {
      await tx.query(`UPDATE agents SET name = $2, strategy_uri = $3, updated_at = now() WHERE agent_pda = $1`, [agentPda, ev.args.name, ev.args.strategyUri]);
    }
    return;
  }

  if (address !== XLAYER_CONTRACTS.viperVault.toLowerCase()) return;
  const ev = decodeEventLog({ abi: VAULT_ABI, data: log.data, topics: log.topics });
  const trader = ev.args.trader.toLowerCase();
  // A router should never be a trader since openPositionFor; guard against an older router.
  if (trader === router) return;
  // The vault derives keys from (trader, market, side) only, so the same key exists on every
  // vault deployment; prefix it with the vault address.
  const key = `${address}:${ev.args.positionKey.toLowerCase()}`;
  const usd = (v: bigint) => formatUnits(v, USD_DECIMALS);

  if (ev.eventName === "PositionOpened") {
    const a = ev.args;
    await tx.query(
      `INSERT INTO xlayer_open_positions (position_key, trader, market_id, side, size_usd, collateral_usd, entry_price, opened_at, open_tx)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (position_key) DO UPDATE SET
         entry_price = (xlayer_open_positions.entry_price * xlayer_open_positions.size_usd + EXCLUDED.entry_price * EXCLUDED.size_usd)
                       / (xlayer_open_positions.size_usd + EXCLUDED.size_usd),
         size_usd = xlayer_open_positions.size_usd + EXCLUDED.size_usd,
         collateral_usd = xlayer_open_positions.collateral_usd + EXCLUDED.collateral_usd`,
      [key, trader, a.marketId.toLowerCase(), a.side === 0 ? "long" : "short", usd(a.sizeUsd), usd(a.collateralUsd), usd(a.entryPrice), blockTime, log.transactionHash],
    );
    return;
  }

  const open = (await tx.query("SELECT * FROM xlayer_open_positions WHERE position_key = $1", [key])).rows[0];
  await tx.query("DELETE FROM xlayer_open_positions WHERE position_key = $1", [key]);
  if (!open) return;

  const agent = (
    await tx.query(
      `SELECT agent_pda FROM agents
        WHERE chain = 'xlayer' AND registry_tx IS NOT NULL AND lower(vault_pubkey) = $1 AND created_at <= $2
        ORDER BY created_at DESC LIMIT 1`,
      [trader, open.opened_at],
    )
  ).rows[0];
  if (!agent) return; // a wallet trading without a registered agent: not a leaderboard fill

  let exitPrice: string;
  let pnl: string;
  let reason: string;
  if (ev.eventName === "PositionClosed") {
    exitPrice = usd(ev.args.exitPrice);
    pnl = formatUnits(ev.args.realizedPnlUsd, USD_DECIMALS);
    reason = "ViperVault PositionClosed";
  } else {
    exitPrice = usd(ev.args.liquidationPrice);
    pnl = `-${open.collateral_usd}`;
    reason = "ViperVault PositionLiquidated (collateral lost)";
  }
  const symbol = marketSymbolById.get(open.market_id) ?? open.market_id;
  await tx.query(
    `INSERT INTO trades (agent_pda, market_symbol, side, size_usd, entry_price, exit_price, opened_at, closed_at,
                         realized_pnl, tx_signature, onchain_verified_pnl, verified_at, pnl_divergence_flagged,
                         reason, is_paper, tx_found, tx_checked_at, chain_event_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $9, now(), false, $11, false, true, now(), $12)
     ON CONFLICT (chain_event_id) WHERE chain_event_id IS NOT NULL DO NOTHING`,
    [agent.agent_pda, symbol, open.side, open.size_usd, open.entry_price, exitPrice, open.opened_at, blockTime, pnl, log.transactionHash, reason, eventId],
  );
  touched.add(agent.agent_pda);
}

export interface IndexRunResult {
  fromBlock: string;
  toBlock: string;
  latestBlock: string;
  logs: number;
  agentsUpdated: number;
  caughtUp: boolean;
  skipped?: string;
  /** The RPC kept rate-limiting; progress up to toBlock was saved and the next run resumes there. */
  rateLimited?: boolean;
}

/**
 * Indexes from the stored cursor towards the chain head until `budgetMs` runs out. Each batch is
 * applied in one transaction under an advisory lock, and the cursor only moves if the batch
 * commits, so overlapping runs and crashes cannot double-count or skip a fill.
 */
export async function runXLayerIndexer(budgetMs: number): Promise<IndexRunResult> {
  const started = Date.now();
  runDeadline = started + budgetMs;
  const concurrency = requirePositiveInt("XLAYER_INDEXER_CONCURRENCY");
  const latest = await client.getBlockNumber();
  const addresses: `0x${string}`[] = [XLAYER_CONTRACTS.viperVault];
  if (XLAYER_AGENT_REGISTRY) addresses.push(XLAYER_AGENT_REGISTRY);

  let cursor = await readState(CURSOR_KEY);
  if (cursor === null) {
    const starts = await Promise.all(addresses.map((a) => deployBlock(a, latest)));
    cursor = starts.reduce((m, b) => (b < m ? b : m)) - BigInt(1);
    await writeState(CURSOR_KEY, cursor);
  }
  const firstBlock = cursor + BigInt(1);
  const router = XLAYER_CONTRACTS.positionRouter.toLowerCase();
  const touched = new Set<string>();
  let logCount = 0;
  let rateLimited = false;

  while (cursor < latest && Date.now() - started < budgetMs) {
    const step = await chunkSize(addresses, cursor + BigInt(1), latest);
    const ranges: [bigint, bigint][] = [];
    let s = cursor + BigInt(1);
    for (let i = 0; i < concurrency && s <= latest; i++) {
      const e = s + step - BigInt(1) < latest ? s + step - BigInt(1) : latest;
      ranges.push([s, e]);
      s = e + BigInt(1);
    }
    let fetched: Log[];
    try {
      fetched = (await Promise.all(ranges.map(([a, b]) => getLogsRange(addresses, a, b)))).flat();
    } catch (err) {
      if (!isRateLimited(err)) throw err;
      rateLimited = true;
      break;
    }
    const logs = fetched
      .filter((l) => !l.removed && HANDLED_TOPICS.has((l.topics[0] ?? "").toLowerCase()))
      .sort((x, y) => Number(x.blockNumber! - y.blockNumber!) || x.logIndex! - y.logIndex!);
    const batchEnd = ranges[ranges.length - 1][1];

    const blockTimes = new Map<bigint, Date>();
    await Promise.all(
      [...new Set(logs.map((l) => l.blockNumber!))].map(async (b) => {
        const blk = await withRateLimitRetry(() => client.getBlock({ blockNumber: b }));
        blockTimes.set(b, new Date(Number(blk.timestamp) * 1000));
      }),
    );

    const conn = await pool.connect();
    try {
      await conn.query("BEGIN");
      const lock = await conn.query("SELECT pg_try_advisory_xact_lock(hashtext($1)) AS ok", [LOCK_KEY]);
      if (!lock.rows[0].ok) {
        await conn.query("ROLLBACK");
        return { fromBlock: firstBlock.toString(), toBlock: cursor.toString(), latestBlock: latest.toString(), logs: logCount, agentsUpdated: 0, caughtUp: false, skipped: "another indexer run holds the lock" };
      }
      const current = BigInt((await conn.query("SELECT value FROM indexer_state WHERE key = $1 FOR UPDATE", [CURSOR_KEY])).rows[0].value);
      if (current !== cursor) {
        await conn.query("ROLLBACK");
        cursor = current; // another run advanced it; continue from there
        continue;
      }
      for (const log of logs) await applyLog(conn, log, blockTimes.get(log.blockNumber!)!, touched, router);
      await writeState(CURSOR_KEY, batchEnd, conn);
      await conn.query("COMMIT");
    } catch (err) {
      await conn.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
    cursor = batchEnd;
    logCount += logs.length;
  }

  for (const pda of touched) await refreshAgentMetrics(pda, MIN_TRADES_FOR_ELIGIBILITY);

  return {
    fromBlock: firstBlock.toString(),
    toBlock: cursor.toString(),
    latestBlock: latest.toString(),
    logs: logCount,
    agentsUpdated: touched.size,
    caughtUp: cursor >= latest,
    ...(rateLimited ? { rateLimited } : {}),
  };
}

/** Reads one registration from its transaction receipt, so the API never trusts client-sent fields. */
export async function readRegistrationFromTx(txHash: `0x${string}`): Promise<
  { agentPda: string; owner: string; agentId: string; name: string; strategyUri: string; vault: string; block: bigint; time: Date } | null
> {
  if (!XLAYER_AGENT_REGISTRY) return null;
  const receipt = await client.getTransactionReceipt({ hash: txHash }).catch(() => null);
  if (!receipt || receipt.status !== "success") return null;
  const log = receipt.logs.find((l) => l.address.toLowerCase() === XLAYER_AGENT_REGISTRY!.toLowerCase());
  if (!log) return null;
  const ev = decodeEventLog({ abi: REGISTRY_ABI, data: log.data, topics: log.topics });
  if (ev.eventName !== "AgentRegistered") return null;
  const blk = await client.getBlock({ blockNumber: receipt.blockNumber });
  const owner = ev.args.owner.toLowerCase();
  return {
    agentPda: baseAgentKey(owner, ev.args.agentId),
    owner,
    agentId: ev.args.agentId,
    name: ev.args.name,
    strategyUri: ev.args.strategyUri,
    vault: ev.args.vaultAddress.toLowerCase(),
    block: receipt.blockNumber,
    time: new Date(Number(blk.timestamp) * 1000),
  };
}
