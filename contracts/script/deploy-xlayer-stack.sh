#!/usr/bin/env bash
# Deploys the full ViperX stack to X Layer in order, and records every address it prints:
#   1. TapeOutRiskCircuits      processor + the four risk circuits (BEM + OKB fees)
#   2. DeployMockOracleXLayer   MockUSDC, MockPyth at live prices, PythPriceAdapter
#   3. DeployVaultWithCircuitXLayer  vault, router, guardian wired to the circuits, markets, LP seed
#
# Each step is simulated first (no signing), its estimated cost printed, and broadcast only after
# you confirm (or with --yes). Steps whose outputs are already in the deployments file are skipped,
# so a failed run resumes without paying the tape-out fees twice.
#
# Usage: script/deploy-xlayer-stack.sh --rpc-url <url> [--yes] [--out <file>] -- <forge signer args>
#   mainnet: script/deploy-xlayer-stack.sh --rpc-url xlayer_mainnet -- --account viperx-deployer
#   fork:    script/simulate-xlayer-stack.sh (runs this against a local anvil fork)
#
# Env: DEPLOYER_ADDRESS, TAPEOUT_FACTORY_XLAYER, TAPEOUT_CPU_NAME, TAPEOUT_CPU_SYMBOL,
#      TAPEOUT_CPU_STORY, OKX_TICKER_API_URL, YAHOO_CHART_API_URL; optional TAPEOUT_MINT_PRICE.
set -euo pipefail
cd "$(dirname "$0")/.."

RPC="" YES=0 OUT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --rpc-url) RPC="$2"; shift 2 ;;
    --yes) YES=1; shift ;;
    --out) OUT="$2"; shift 2 ;;
    --) shift; break ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
SIGNER=("$@")
[[ -n "$RPC" ]] || { echo "--rpc-url is required" >&2; exit 2; }
[[ ${#SIGNER[@]} -gt 0 ]] || { echo "signer args are required after -- (e.g. --account <name>)" >&2; exit 2; }
for v in DEPLOYER_ADDRESS TAPEOUT_FACTORY_XLAYER TAPEOUT_CPU_NAME TAPEOUT_CPU_SYMBOL TAPEOUT_CPU_STORY OKX_TICKER_API_URL YAHOO_CHART_API_URL; do
  [[ -n "${!v:-}" ]] || { echo "$v is not set" >&2; exit 2; }
done

RPC_URL=$(forge config --json | jq -r --arg a "$RPC" '.rpc_endpoints[$a] // $a')
CHAIN=$(cast chain-id --rpc-url "$RPC_URL")
OUT="${OUT:-deployments/xlayer-$CHAIN.env}"
mkdir -p "$(dirname "$OUT")"; touch "$OUT"

# X Layer mainnet blocks carry no base fee; send legacy transactions there. A local fork reports a
# base fee of its own, so the simulation sets XLAYER_LEGACY_TX from the chain it forked.
TX_TYPE=()
if [[ "${XLAYER_LEGACY_TX:-}" == "1" || "$(cast block latest --rpc-url "$RPC_URL" --json | jq -r .baseFeePerGas)" == "null" ]]; then
  TX_TYPE=(--legacy)
fi

# The simulation pins the forked chain's live price; anvil's own price would overstate the cost.
GAS_PRICE="${XLAYER_GAS_PRICE:-$(cast gas-price --rpc-url "$RPC_URL")}"
TX_TYPE+=(--with-gas-price "$GAS_PRICE")
echo "chain $CHAIN  gas price $(cast from-wei "$GAS_PRICE" gwei) gwei  deployer $DEPLOYER_ADDRESS  out $OUT"
echo "balance $(cast balance "$DEPLOYER_ADDRESS" --rpc-url "$RPC_URL" --ether) OKB"

set -a; source "$OUT"; set +a

step() { # step <name> <script> <key that marks it done>
  local name="$1" script="$2" done_key="$3" log
  if grep -q "^$done_key=" "$OUT"; then echo "== $name: already done ($done_key in $OUT), skipping"; return; fi
  echo "== $name: simulating"
  log=$(mktemp)
  forge script "$script" --rpc-url "$RPC_URL" --sender "$DEPLOYER_ADDRESS" ${TX_TYPE[@]+"${TX_TYPE[@]}"} 2>&1 | tee "$log" | grep -E "Estimated|Error|revert" || true
  if ! grep -q "Estimated amount required" "$log"; then
    echo "simulation of $name failed; full output: $log" >&2; exit 1
  fi
  if [[ $YES -eq 0 ]]; then
    read -r -p "Broadcast $name? [y/N] " a; [[ "$a" == "y" || "$a" == "Y" ]] || { echo "stopped before $name"; exit 1; }
  fi
  forge script "$script" --rpc-url "$RPC_URL" --sender "$DEPLOYER_ADDRESS" "${SIGNER[@]}" ${TX_TYPE[@]+"${TX_TYPE[@]}"} --broadcast --slow 2>&1 | tee "$log" | grep -E "^[[:space:]]*[A-Z_]+= |Error|revert|ONCHAIN EXECUTION" || true
  grep -q "ONCHAIN EXECUTION COMPLETE" "$log" || { echo "$name did not complete; full output: $log" >&2; exit 1; }
  grep -E '^[[:space:]]*[A-Z_]+= [^[:space:]]+$' "$log" | sed -E 's/^[[:space:]]*([A-Z_]+)= ([^[:space:]]+)$/\1=\2/' >> "$OUT"
  set -a; source "$OUT"; set +a
}

step "tape-out" script/TapeOutRiskCircuits.s.sol TAPEOUT_COOLDOWN_ID
if ! grep -q "^XLAYER_PRICE_ADAPTER=" "$OUT"; then ./script/fetch-mock-prices.sh; fi
step "mock collateral + oracle" script/DeployMockOracleXLayer.s.sol XLAYER_PRICE_ADAPTER
step "vault + router + guardian" script/DeployVaultWithCircuitXLayer.s.sol NEXT_PUBLIC_XLAYER_CIRCUIT_GUARDIAN

echo "== done. Addresses in $OUT:"
cat "$OUT"
echo "balance $(cast balance "$DEPLOYER_ADDRESS" --rpc-url "$RPC_URL" --ether) OKB"

# The frontend reads the same deployment under its own names (frontend/.env.example, mainnet block).
if [[ -n "${TAPEOUT_LEVERAGE_ID:-}" && -n "${NEXT_PUBLIC_XLAYER_VIPER_VAULT:-}" ]]; then
  echo "== frontend env (paste into frontend/.env.local and the hosting provider):"
  cat <<FRONTEND
NEXT_PUBLIC_XLAYER_CHAIN_ID=$CHAIN
NEXT_PUBLIC_XLAYER_RPC_URL=$RPC_URL
NEXT_PUBLIC_XLAYER_VIPER_VAULT=$NEXT_PUBLIC_XLAYER_VIPER_VAULT
NEXT_PUBLIC_XLAYER_POSITION_ROUTER=$NEXT_PUBLIC_XLAYER_POSITION_ROUTER
NEXT_PUBLIC_XLAYER_CIRCUIT_GUARDIAN=$NEXT_PUBLIC_XLAYER_CIRCUIT_GUARDIAN
NEXT_PUBLIC_XLAYER_TAPEOUT_PROCESSOR=$TAPEOUT_LEVERAGE_CPU
NEXT_PUBLIC_XLAYER_PRICE_ADAPTER=$XLAYER_PRICE_ADAPTER
NEXT_PUBLIC_XLAYER_USDC=$XLAYER_USDC
NEXT_PUBLIC_XLAYER_ORACLE=$XLAYER_ORACLE
NEXT_PUBLIC_XLAYER_CIRCUIT_ID_LEVERAGE=$TAPEOUT_LEVERAGE_ID
NEXT_PUBLIC_XLAYER_CIRCUIT_ID_SLIPPAGE=$TAPEOUT_SLIPPAGE_ID
NEXT_PUBLIC_XLAYER_CIRCUIT_ID_DRAWDOWN=$TAPEOUT_DRAWDOWN_ID
NEXT_PUBLIC_XLAYER_CIRCUIT_ID_COOLDOWN=$TAPEOUT_COOLDOWN_ID
FRONTEND
  for c in SLIPPAGE DRAWDOWN COOLDOWN; do
    v="TAPEOUT_${c}_CPU"; [[ "${!v}" == "$TAPEOUT_LEVERAGE_CPU" ]] || echo "warning: $c circuit is on a different processor than LEVERAGE" >&2
  done
fi
