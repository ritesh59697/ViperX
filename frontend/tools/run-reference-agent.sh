#!/usr/bin/env bash
# Starts the ViperX reference agent on X Layer mainnet with the viperx-deployer keystore.
# You type the keystore password once; the decrypted key goes to the agent over stdin only (never a
# file, argv or the environment) and lives in that process's memory until it exits.
#
# Usage: frontend/tools/run-reference-agent.sh [--rpc <url[,url]>] [--keystore <name>] [extra agent flags]
# Strategy settings below are the reference agent's published configuration; any flag passed here
# is appended and overrides them (the agent reads the last occurrence of each flag).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
KEYSTORE="viperx-deployer"
RPC="https://rpc.xlayer.tech,https://xlayerrpc.okx.com"
EXTRA=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --keystore) KEYSTORE="$2"; shift 2 ;;
    --rpc) RPC="$2"; shift 2 ;;
    *) EXTRA+=("$1"); shift ;;
  esac
done

OKX_TICKER_API_URL="$(grep -E '^OKX_TICKER_API_URL=' "$ROOT/contracts/.env" | cut -d= -f2- | tr -d '"')"
[[ -n "$OKX_TICKER_API_URL" ]] || { echo "OKX_TICKER_API_URL missing from contracts/.env" >&2; exit 1; }
LOG="$ROOT/frontend/tools/reference-agent.log.jsonl"

echo "Decrypting keystore '$KEYSTORE' (you will be asked for its password)..."
KEY="$(cast wallet decrypt-keystore "$KEYSTORE" | grep -oE '0x[0-9a-fA-F]{64}' | head -1)"
[[ -n "$KEY" ]] || { echo "could not decrypt keystore '$KEYSTORE'" >&2; exit 1; }

cd "$ROOT/frontend"
printf '%s' "$KEY" | node tools/reference-agent.mjs \
  --deployments "$ROOT/contracts/deployments/xlayer-196.env" \
  --markets-config "$ROOT/contracts/config/xlayer-markets.json" \
  --rpc "$RPC" \
  --okx-ticker-url "$OKX_TICKER_API_URL" \
  --market ETH-PERP \
  --collateral-usd 100 \
  --leverage 3 \
  --cycle-seconds 300 \
  --hold-seconds 180 \
  --sample-seconds 30 \
  --lookback-samples 6 \
  --slippage-bps 50 \
  --intent-ttl-seconds 120 \
  --fills 55 \
  --min-okb 0.002 \
  --max-failures 5 \
  --gas-multiplier 2 \
  --agent-id viperx-momentum-1 \
  --agent-name "ViperX Momentum (reference agent)" \
  --strategy-uri "https://github.com/ritesh59697/ViperX/blob/main/frontend/tools/reference-agent.mjs" \
  --log "$LOG" \
  ${EXTRA[@]+"${EXTRA[@]}"}
KEY=""
