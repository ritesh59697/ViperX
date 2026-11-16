#!/usr/bin/env bash
# Dry run of the whole mainnet deploy on a local anvil fork of X Layer, funded with exactly the
# amounts you plan to send. Runs script/deploy-xlayer-stack.sh unchanged, then one gated trade that
# must pass and one that the leverage circuit must reject, and prints what the real run will cost:
# gas used x the live gas price, plus the OKB and BEM fees the contracts charged.
#
# Nothing leaves this machine: the fork is local, no key is used (anvil impersonates the deployer),
# and broadcast/cache records go to a temp dir so they can't be mistaken for mainnet deploys.
#
# Usage: script/simulate-xlayer-stack.sh <okb to fund> <bem to fund>     e.g. 0.02 0.12
# Env: same as deploy-xlayer-stack.sh, plus optional FORK_RPC (default xlayer_mainnet), ANVIL_PORT.
set -euo pipefail
cd "$(dirname "$0")/.."

FUND_OKB="${1:?okb amount to fund, e.g. 0.02}"
FUND_BEM="${2:?bem amount to fund, e.g. 0.12}"
: "${DEPLOYER_ADDRESS:?set DEPLOYER_ADDRESS}"
: "${TAPEOUT_FACTORY_XLAYER:?set TAPEOUT_FACTORY_XLAYER}"
LIVE=$(forge config --json | jq -r --arg a "${FORK_RPC:-xlayer_mainnet}" '.rpc_endpoints[$a] // $a')
PORT="${ANVIL_PORT:-8546}"
FORK="http://127.0.0.1:$PORT"
TMP=$(mktemp -d)
LIVE_GAS=$(cast gas-price --rpc-url "$LIVE")

anvil --fork-url "$LIVE" --port "$PORT" --auto-impersonate --gas-price "$LIVE_GAS" --base-fee "$LIVE_GAS" --silent &
ANVIL=$!
trap 'kill $ANVIL 2>/dev/null; rm -rf "$TMP"' EXIT
for _ in $(seq 1 60); do cast chain-id --rpc-url "$FORK" >/dev/null 2>&1 && break; sleep 0.5; done

# Fund the deployer with the planned amounts only.
BEM=$(cast call "$TAPEOUT_FACTORY_XLAYER" 'bem()(address)' --rpc-url "$FORK")
BEM_DEC=$(cast call "$BEM" 'decimals()(uint8)' --rpc-url "$FORK")
BEM_UNITS=$(python3 -c "from decimal import Decimal as D; print(int(D('$FUND_BEM') * 10**$BEM_DEC))")
cast rpc anvil_setBalance "$DEPLOYER_ADDRESS" "$(cast to-hex "$(cast to-wei "$FUND_OKB" ether)")" --rpc-url "$FORK" >/dev/null
# Find BEM's balance mapping slot instead of assuming it.
SLOT=""
for s in $(seq 0 50); do
  key=$(cast index address "$DEPLOYER_ADDRESS" "$s")
  old=$(cast storage "$BEM" "$key" --rpc-url "$FORK")
  cast rpc anvil_setStorageAt "$BEM" "$key" "$(cast to-uint256 "$BEM_UNITS")" --rpc-url "$FORK" >/dev/null
  if [[ "$(cast call "$BEM" 'balanceOf(address)(uint256)' "$DEPLOYER_ADDRESS" --rpc-url "$FORK" | cut -d' ' -f1)" == "$BEM_UNITS" ]]; then SLOT=$s; break; fi
  cast rpc anvil_setStorageAt "$BEM" "$key" "$old" --rpc-url "$FORK" >/dev/null
done
[[ -n "$SLOT" ]] || { echo "could not find BEM's balance slot" >&2; exit 1; }
echo "fork funded: $FUND_OKB OKB, $FUND_BEM BEM (balance slot $SLOT) at live gas price $(cast from-wei "$LIVE_GAS" gwei) gwei"

export FOUNDRY_BROADCAST="$TMP/broadcast" FOUNDRY_CACHE_PATH="$TMP/cache" XLAYER_GAS_PRICE="$LIVE_GAS"
[[ "$(cast block latest --rpc-url "$LIVE" --json | jq -r .baseFeePerGas)" == "null" ]] && export XLAYER_LEGACY_TX=1
./script/deploy-xlayer-stack.sh --rpc-url "$FORK" --yes --out "$TMP/xlayer.env" -- --unlocked
set -a; source "$TMP/xlayer.env"; set +a

# Smoke test: a trader claims faucet USDC and trades through the gated vault.
TRADER=0x000000000000000000000000000000000000dEaD
cast rpc anvil_setBalance "$TRADER" "$(cast to-hex "$(cast to-wei 1 ether)")" --rpc-url "$FORK" >/dev/null
cast send "$XLAYER_USDC" 'faucet()' --from "$TRADER" --unlocked --rpc-url "$FORK" >/dev/null
cast send "$XLAYER_USDC" 'approve(address,uint256)' "$NEXT_PUBLIC_XLAYER_VIPER_VAULT" "$(cast max-uint)" --from "$TRADER" --unlocked --rpc-url "$FORK" >/dev/null
MARKET=$(cast keccak "$(jq -r '.markets[0].symbol' config/xlayer-markets.json)")
OK_TX=$(cast send "$NEXT_PUBLIC_XLAYER_VIPER_VAULT" 'openPosition(bytes32,uint8,uint256,uint256)' "$MARKET" 0 5000000000000000000000 1000000000000000000000 \
  --from "$TRADER" --unlocked --rpc-url "$FORK" --json)
[[ "$(echo "$OK_TX" | jq -r .status)" == "0x1" ]] || { echo "smoke test: 5x trade failed" >&2; exit 1; }
TRADE_GAS=$(cast to-dec "$(echo "$OK_TX" | jq -r .gasUsed)")
CEILING=$(jq -r .max tapeout/circuits/leverage_le.json)
OVER=$(( (CEILING / 100 + 2) * 1000 ))  # ceiling + 2x on $1000 collateral
cast rpc evm_increaseTime 60 --rpc-url "$FORK" >/dev/null; cast rpc evm_mine --rpc-url "$FORK" >/dev/null
if cast send "$NEXT_PUBLIC_XLAYER_VIPER_VAULT" 'openPosition(bytes32,uint8,uint256,uint256)' "$MARKET" 0 "${OVER}000000000000000000" 1000000000000000000000 \
  --from "$TRADER" --unlocked --rpc-url "$FORK" >/dev/null 2>&1; then
  echo "smoke test: a trade above the circuit's leverage ceiling went through" >&2; exit 1
fi
echo "smoke test: 5x trade passed the four circuits ($TRADE_GAS gas); $((CEILING / 100 + 2))x trade rejected"

# What the real run costs.
GAS_USED=$(jq -s '[.[].receipts[] | (.gasUsed | ltrimstr("0x") | ascii_downcase)] ' "$TMP"/broadcast/*/*/run-latest.json \
  | python3 -c "import json,sys; print(sum(int(h,16) for h in json.load(sys.stdin)))")
VALUE=$(jq -s '[.[].transactions[] | (.transaction.value // "0x0")]' "$TMP"/broadcast/*/*/run-latest.json \
  | python3 -c "import json,sys; print(sum(int(h,16) for h in json.load(sys.stdin)))")
BEM_LEFT=$(cast call "$BEM" 'balanceOf(address)(uint256)' "$DEPLOYER_ADDRESS" --rpc-url "$FORK" | cut -d' ' -f1)
OKB_LEFT=$(cast balance "$DEPLOYER_ADDRESS" --rpc-url "$FORK" --ether)
python3 - "$GAS_USED" "$LIVE_GAS" "$VALUE" "$BEM_UNITS" "$BEM_LEFT" "$BEM_DEC" "$OKB_LEFT" "$TRADE_GAS" <<'PY'
import sys
gas, price, value, bem_in, bem_left, dec, okb_left, trade_gas = sys.argv[1:]
gas, price, value = int(gas), int(price), int(value)
print(f"\n== cost of the real deploy at today's gas price")
print(f"gas used        {gas:,}")
print(f"gas cost        {gas*price/1e18:.6f} OKB")
print(f"protocol fees   {value/1e18:.6f} OKB (TapeOut tape-out fees)")
print(f"total OKB       {(gas*price+value)/1e18:.6f}")
print(f"BEM spent       {(int(bem_in)-int(bem_left))/10**int(dec):.4f}")
print(f"left on fork    {okb_left} OKB, {int(bem_left)/10**int(dec):.4f} BEM")
print(f"one gated trade {int(trade_gas)*price/1e18:.8f} OKB ({int(trade_gas):,} gas)")
PY
