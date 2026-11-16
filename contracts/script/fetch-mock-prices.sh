#!/usr/bin/env bash
# Fetches a live price for every market in the X Layer market config and writes the values the
# MockPyth scripts set on chain. Crypto prices come from the OKX ticker API, equities from Yahoo's
# chart API (the same sources the /trade UI shows), so the mock oracle starts at real prices.
#
# Env: OKX_TICKER_API_URL, YAHOO_CHART_API_URL (see .env.example)
#      XLAYER_MARKETS_CONFIG  (default config/xlayer-markets.json)
#      MOCK_PRICES_FILE       (default config/generated/mock-prices.json)
set -euo pipefail
cd "$(dirname "$0")/.."

CONFIG="${XLAYER_MARKETS_CONFIG:-config/xlayer-markets.json}"
OUT="${MOCK_PRICES_FILE:-config/generated/mock-prices.json}"
: "${OKX_TICKER_API_URL:?set OKX_TICKER_API_URL (see .env.example)}"
: "${YAHOO_CHART_API_URL:?set YAHOO_CHART_API_URL (see .env.example)}"

expo=$(jq -r '.oracle.priceExpo' "$CONFIG")
conf_bps=$(jq -r '.oracle.confidenceBps' "$CONFIG")
count=$(jq '.markets | length' "$CONFIG")
mkdir -p "$(dirname "$OUT")"

entries=()
for ((i = 0; i < count; i++)); do
  symbol=$(jq -r ".markets[$i].symbol" "$CONFIG")
  source=$(jq -r ".markets[$i].price.source" "$CONFIG")
  id=$(jq -r ".markets[$i].price.id" "$CONFIG")
  case "$source" in
    okx)   usd=$(curl -fsS -m 15 "$OKX_TICKER_API_URL?instId=$id" | jq -r '.data[0].last') ;;
    yahoo) usd=$(curl -fsS -m 15 -A "Mozilla/5.0" "$YAHOO_CHART_API_URL/$id?interval=1d&range=1d" | jq -r '.chart.result[0].meta.regularMarketPrice') ;;
    *) echo "unknown price source '$source' for $symbol" >&2; exit 1 ;;
  esac
  if ! [[ "$usd" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
    echo "no usable price for $symbol from $source ($id): '$usd'" >&2; exit 1
  fi
  entries+=("$(jq -nc --arg s "$symbol" --arg usd "$usd" --argjson e "$expo" --argjson c "$conf_bps" \
    '($usd|tonumber) as $p | (($p * pow(10; -$e)) | round) as $raw
     | {symbol: $s, usd: $usd, price: $raw, conf: (($raw * $c / 10000) | round)}')")
  printf '%-10s %12s  (%s %s)\n' "$symbol" "$usd" "$source" "$id"
done

printf '%s\n' "${entries[@]}" | jq -s --argjson e "$expo" --arg at "$(date -u +%FT%TZ)" \
  '{fetchedAt: $at, expo: $e, prices: .}' > "$OUT"
echo "wrote $OUT"
