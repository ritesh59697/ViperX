// ViperX reference agent: trades on X Layer through PositionRouter with EIP-712 signed intents, so
// every open passes the four TapeOut risk circuits and lands on the leaderboard as a verified fill.
//
// Strategy (deliberately simple and public): sample the live OKX price; at each cycle go long if the
// price rose over the lookback window, short if it fell; hold for --hold-seconds, then close.
// Before each open and close the agent pushes the live price to the demo oracle (MockPyth), which
// only its owner can do, so trades settle at real prices instead of the deploy-time snapshot.
//
// The private key is read from stdin (never argv or env); see run-reference-agent.sh.
// Every address comes from the deployments file; every tunable is a flag. Usage:
//   node tools/reference-agent.mjs --deployments <xlayer-196.env> --markets-config <xlayer-markets.json>
//     --rpc <url[,url]> --okx-ticker-url <url> --market ETH-PERP --collateral-usd 100 --leverage 3
//     --cycle-seconds 300 --hold-seconds 180 --sample-seconds 30 --lookback-samples 6 --slippage-bps 50
//     --intent-ttl-seconds 120 --fills 55 --min-okb 0.0015 --max-failures 5 --gas-multiplier 2
//     --agent-id viperx-momentum-1 --agent-name "..." --strategy-uri <url> --log <file.jsonl>
import fs from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  defineChain,
  fallback,
  formatEther,
  formatUnits,
  http,
  keccak256,
  maxUint256,
  parseAbi,
  parseEther,
  parseUnits,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ---------- flags ----------
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.lastIndexOf(`--${name}`); // last occurrence wins, so appended flags override
  if (i < 0 || i + 1 >= argv.length) throw new Error(`--${name} is required`);
  return argv[i + 1];
};
const num = (name) => {
  const n = Number(flag(name));
  if (!Number.isFinite(n) || n <= 0) throw new Error(`--${name} must be a positive number`);
  return n;
};
const cfg = {
  deployments: flag("deployments"),
  marketsConfig: flag("markets-config"),
  rpc: flag("rpc").split(",").map((s) => s.trim()).filter(Boolean),
  okxTickerUrl: flag("okx-ticker-url"),
  market: flag("market"),
  collateralUsd: num("collateral-usd"),
  leverage: num("leverage"),
  cycleSeconds: num("cycle-seconds"),
  holdSeconds: num("hold-seconds"),
  sampleSeconds: num("sample-seconds"),
  lookbackSamples: num("lookback-samples"),
  slippageBps: num("slippage-bps"),
  intentTtlSeconds: num("intent-ttl-seconds"),
  fills: num("fills"),
  minOkb: flag("min-okb"),
  maxFailures: num("max-failures"),
  gasMultiplier: num("gas-multiplier"),
  agentId: flag("agent-id"),
  agentName: flag("agent-name"),
  strategyUri: flag("strategy-uri"),
  log: flag("log"),
};
if (cfg.holdSeconds >= cfg.cycleSeconds) throw new Error("--hold-seconds must be shorter than --cycle-seconds");

// ---------- config files ----------
const env = Object.fromEntries(
  fs
    .readFileSync(cfg.deployments, "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const need = (k) => {
  if (!/^0x[0-9a-fA-F]{40}$/.test(env[k] ?? "")) throw new Error(`${k} missing from ${cfg.deployments}`);
  return env[k];
};
const VAULT = need("NEXT_PUBLIC_XLAYER_VIPER_VAULT");
const ROUTER = need("NEXT_PUBLIC_XLAYER_POSITION_ROUTER");
const USDC = need("XLAYER_USDC");
const ORACLE = need("XLAYER_ORACLE");
const REGISTRY = need("NEXT_PUBLIC_XLAYER_AGENT_REGISTRY");

const markets = JSON.parse(fs.readFileSync(cfg.marketsConfig, "utf8"));
const marketCfg = markets.markets.find((m) => m.symbol === cfg.market);
if (!marketCfg) throw new Error(`${cfg.market} is not in ${cfg.marketsConfig}`);
if (marketCfg.price?.source !== "okx") throw new Error(`${cfg.market} is not priced from OKX in ${cfg.marketsConfig}`);
const PRICE_EXPO = markets.oracle.priceExpo;
const CONF_BPS = BigInt(markets.oracle.confidenceBps);
const MARKET_ID = keccak256(toBytes(cfg.market));

// ---------- key from stdin ----------
const key = fs.readFileSync(0, "utf8").trim();
if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("expected a 0x-prefixed private key on stdin");
const account = privateKeyToAccount(key);

// ---------- clients ----------
const transport = cfg.rpc.length > 1 ? fallback(cfg.rpc.map((u) => http(u))) : http(cfg.rpc[0]);
const probe = createPublicClient({ transport });
const chainId = await probe.getChainId();
const chain = defineChain({
  id: chainId,
  name: `chain-${chainId}`,
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: cfg.rpc } },
});
const pub = createPublicClient({ chain, transport });
const wallet = createWalletClient({ chain, transport, account });

const VAULT_ABI = parseAbi([
  "function markets(bytes32) view returns (bool isActive, bytes32 pythPriceFeedId, uint256 maxOpenInterestLongUsd, uint256 maxOpenInterestShortUsd, uint256 openInterestLongUsd, uint256 openInterestShortUsd, uint256 minPositionSizeUsd, uint256 maxLeverageBps, uint256 maintenanceMarginBps)",
  "function getPositionKey(address,bytes32,uint8) pure returns (bytes32)",
  "function positions(bytes32) view returns (address trader, bytes32 marketId, uint8 side, uint256 sizeUsd, uint256 collateralUsd, uint256 entryPrice, uint256 entryBorrowIndex, uint256 openedAt)",
  "function closePosition(bytes32) returns (int256 realizedPnlUsd, uint256 payoutUsd)",
  "function usdcDecimals() view returns (uint8)",
  "event PositionClosed(bytes32 indexed positionKey, address indexed trader, bytes32 indexed marketId, uint8 side, uint256 sizeUsd, uint256 exitPrice, int256 realizedPnlUsd, uint256 netPayoutUsd)",
]);
const ROUTER_ABI = parseAbi([
  "function agentNonces(address) view returns (uint256)",
  "function executeAgentIntent((address agent, bytes32 marketId, uint8 side, uint256 sizeUsd, uint256 collateralUsd, uint256 maxSlippagePrice, uint256 deadline, uint256 nonce) intent, bytes signature) returns (bytes32)",
]);
const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);
const ORACLE_ABI = parseAbi(["function setPrice(bytes32 id, int64 price, int32 expo, uint64 conf)", "function owner() view returns (address)"]);
const REGISTRY_ABI = parseAbi([
  "function getOwnerAgents(address) view returns (string[])",
  "function registerAgent(string agentId, string name, string strategyUri, address vaultAddress)",
]);

// ---------- helpers ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (rec) => {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...rec });
  console.log(line);
  fs.appendFileSync(cfg.log, line + "\n");
};

async function send(params) {
  const gasPrice = await pub.getGasPrice();
  const est = await pub.estimateContractGas({ ...params, account });
  const gas = BigInt(Math.ceil(Number(est) * cfg.gasMultiplier));
  const hash = await wallet.writeContract({ ...params, gas, gasPrice, type: "legacy" });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  return { hash, receipt };
}

async function livePrice() {
  const res = await fetch(`${cfg.okxTickerUrl}?instId=${encodeURIComponent(marketCfg.price.id)}`);
  if (!res.ok) throw new Error(`OKX ticker HTTP ${res.status}`);
  const last = (await res.json())?.data?.[0]?.last;
  if (!last || !Number.isFinite(Number(last))) throw new Error(`OKX ticker returned no price for ${marketCfg.price.id}`);
  return last; // decimal string
}

let feedId;
async function pushPrice(priceStr) {
  const scaled = parseUnits(priceStr, -PRICE_EXPO); // price * 10^-expo, exact from the decimal string
  const conf = (scaled * CONF_BPS) / 10_000n;
  const { hash } = await send({ address: ORACLE, abi: ORACLE_ABI, functionName: "setPrice", args: [feedId, scaled, PRICE_EXPO, conf] });
  return hash;
}

const samples = [];
async function sampleFor(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      samples.push(Number(await livePrice()));
      if (samples.length > cfg.lookbackSamples) samples.shift();
    } catch (e) {
      log({ action: "sample-failed", error: String(e.message ?? e) });
    }
    await sleep(Math.min(cfg.sampleSeconds * 1000, Math.max(0, end - Date.now())));
  }
}

const okbFloor = parseEther(cfg.minOkb);
async function okbOk() {
  const bal = await pub.getBalance({ address: account.address });
  if (bal < okbFloor) {
    log({ action: "stop", reason: `OKB balance ${formatEther(bal)} is below --min-okb ${cfg.minOkb}` });
    return false;
  }
  return true;
}

// ---------- preflight ----------
const [mkt, oracleOwner] = await Promise.all([
  pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName: "markets", args: [MARKET_ID] }),
  pub.readContract({ address: ORACLE, abi: ORACLE_ABI, functionName: "owner" }),
]);
if (!mkt[0]) throw new Error(`${cfg.market} is not active on the vault`);
if (oracleOwner.toLowerCase() !== account.address.toLowerCase()) throw new Error(`this key does not own the oracle (${oracleOwner})`);
feedId = mkt[1];
const sizeUsd18 = parseEther(String(cfg.collateralUsd * cfg.leverage));
const collateralUsd18 = parseEther(String(cfg.collateralUsd));
if (sizeUsd18 < mkt[6]) throw new Error(`size below the market minimum of ${formatEther(mkt[6])} USD`); // minPositionSizeUsd
const usdcDecimals = await pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName: "usdcDecimals" });
log({ action: "start", agent: account.address, chainId, market: cfg.market, vault: VAULT, router: ROUTER, okb: formatEther(await pub.getBalance({ address: account.address })) });

// Positions this wallet opened before the agent was registered (e.g. proof trades) would merge with
// the agent's and could not be attributed, so close them first.
const registered = (await pub.readContract({ address: REGISTRY, abi: REGISTRY_ABI, functionName: "getOwnerAgents", args: [account.address] })).includes(cfg.agentId);
if (!registered) {
  for (const side of [0, 1]) {
    const k = await pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName: "getPositionKey", args: [account.address, MARKET_ID, side] });
    const p = await pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName: "positions", args: [k] });
    if (p[3] > 0n) {
      await pushPrice(await livePrice());
      const { hash, receipt } = await send({ address: VAULT, abi: VAULT_ABI, functionName: "closePosition", args: [k] });
      log({ action: "close-pre-registration", side: side ? "short" : "long", tx: hash, status: receipt.status });
    }
  }
  const { hash, receipt } = await send({
    address: REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "registerAgent",
    args: [cfg.agentId, cfg.agentName, cfg.strategyUri, account.address],
  });
  log({ action: "register", agentId: cfg.agentId, tx: hash, status: receipt.status });
  if (receipt.status !== "success") throw new Error("registration reverted");
}

const needUsdc = parseUnits(String(cfg.collateralUsd * cfg.fills), usdcDecimals);
const [usdcBal, allowance] = await Promise.all([
  pub.readContract({ address: USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [account.address] }),
  pub.readContract({ address: USDC, abi: ERC20_ABI, functionName: "allowance", args: [account.address, ROUTER] }),
]);
if (usdcBal < parseUnits(String(cfg.collateralUsd), usdcDecimals)) throw new Error(`USDC balance ${formatUnits(usdcBal, usdcDecimals)} is below one trade's collateral`);
if (allowance < needUsdc) {
  const { hash, receipt } = await send({ address: USDC, abi: ERC20_ABI, functionName: "approve", args: [ROUTER, maxUint256] });
  log({ action: "approve-router", tx: hash, status: receipt.status });
}

// ---------- trading loop ----------
const domain = { name: "ViperX PositionRouter", version: "1", chainId, verifyingContract: ROUTER };
const types = {
  AgentIntent: [
    { name: "agent", type: "address" },
    { name: "marketId", type: "bytes32" },
    { name: "side", type: "uint8" },
    { name: "sizeUsd", type: "uint256" },
    { name: "collateralUsd", type: "uint256" },
    { name: "maxSlippagePrice", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
};

let fills = 0;
let failures = 0;
await sampleFor(cfg.sampleSeconds * 1000 * cfg.lookbackSamples);

while (fills < cfg.fills && failures < cfg.maxFailures) {
  const cycleStart = Date.now();
  if (!(await okbOk())) break;
  try {
    const first = samples[0];
    const last = samples[samples.length - 1];
    const side = last >= first ? 0 : 1; // 0 long, 1 short
    const price = await livePrice();
    const pushTx = await pushPrice(price);
    const mark = parseEther(price);
    const slip = (mark * BigInt(Math.round(cfg.slippageBps))) / 10_000n;
    const block = await pub.getBlock();
    const intent = {
      agent: account.address,
      marketId: MARKET_ID,
      side,
      sizeUsd: sizeUsd18,
      collateralUsd: collateralUsd18,
      maxSlippagePrice: side === 0 ? mark + slip : mark - slip,
      deadline: block.timestamp + BigInt(Math.round(cfg.intentTtlSeconds)),
      nonce: await pub.readContract({ address: ROUTER, abi: ROUTER_ABI, functionName: "agentNonces", args: [account.address] }),
    };
    const signature = await account.signTypedData({ domain, types, primaryType: "AgentIntent", message: intent });
    const open = await send({ address: ROUTER, abi: ROUTER_ABI, functionName: "executeAgentIntent", args: [intent, signature] });
    log({ action: "open", side: side ? "short" : "long", momentum: ((last / first - 1) * 100).toFixed(4) + "%", price, priceTx: pushTx, tx: open.hash, status: open.receipt.status, gas: open.receipt.gasUsed.toString() });
    if (open.receipt.status !== "success") throw new Error("open reverted");

    await sampleFor(cfg.holdSeconds * 1000);

    const exitPrice = await livePrice();
    const exitPush = await pushPrice(exitPrice);
    const posKey = await pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName: "getPositionKey", args: [account.address, MARKET_ID, side] });
    const close = await send({ address: VAULT, abi: VAULT_ABI, functionName: "closePosition", args: [posKey] });
    let pnl = null;
    for (const l of close.receipt.logs) {
      if (l.address.toLowerCase() !== VAULT.toLowerCase()) continue;
      try {
        const ev = decodeEventLog({ abi: VAULT_ABI, data: l.data, topics: l.topics });
        if (ev.eventName === "PositionClosed") pnl = formatEther(ev.args.realizedPnlUsd);
      } catch {}
    }
    if (close.receipt.status !== "success") throw new Error("close reverted");
    fills += 1;
    failures = 0;
    log({ action: "close", fill: fills, side: side ? "short" : "long", price: exitPrice, priceTx: exitPush, tx: close.hash, pnlUsd: pnl });
  } catch (e) {
    failures += 1;
    log({ action: "cycle-failed", failures, error: String(e.shortMessage ?? e.message ?? e) });
  }
  await sampleFor(Math.max(0, cfg.cycleSeconds * 1000 - (Date.now() - cycleStart)));
}

log({ action: "done", fills, failures, okb: formatEther(await pub.getBalance({ address: account.address })) });
