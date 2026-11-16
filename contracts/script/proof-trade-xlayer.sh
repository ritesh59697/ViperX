#!/usr/bin/env bash
# Places two real trades on the deployed X Layer stack so judges can see the circuits on-chain:
# one at <pass leverage>, which the four circuits let through, and one at <reject leverage>, sent
# with an explicit gas limit so the revert is mined and shows up on the explorer.
# Addresses come from deployments/xlayer-<chain>.env; the market is the first in xlayer-markets.json;
# the wait between trades is the cooldown circuit's own minimum.
#
# Usage: script/proof-trade-xlayer.sh <pass leverage> <reject leverage> <collateral usd> --rpc-url <url> -- <cast signer args>
#   e.g. script/proof-trade-xlayer.sh 5 25 1000 --rpc-url xlayer_mainnet -- --account viperx-deployer
# Env: DEPLOYER_ADDRESS
set -euo pipefail
cd "$(dirname "$0")/.."

PASS_X="${1:?pass leverage, e.g. 5}"; REJECT_X="${2:?reject leverage, e.g. 25}"; COLL="${3:?collateral in USD, e.g. 1000}"; shift 3
[[ "${1:-}" == "--rpc-url" ]] || { echo "--rpc-url <url> required" >&2; exit 2; }
RPC="$2"; shift 2; [[ "${1:-}" == "--" ]] && shift
SIGNER=("$@"); [[ ${#SIGNER[@]} -gt 0 ]] || { echo "signer args required after --" >&2; exit 2; }
: "${DEPLOYER_ADDRESS:?DEPLOYER_ADDRESS is not set}"

CHAIN=$(cast chain-id --rpc-url "$RPC")
OUT="deployments/xlayer-$CHAIN.env"
[[ -f "$OUT" ]] || { echo "$OUT not found; deploy first" >&2; exit 2; }
set -a; source "$OUT"; set +a
VAULT="$NEXT_PUBLIC_XLAYER_VIPER_VAULT"; USDC="$XLAYER_USDC"
GAS_PRICE=$(cast gas-price --rpc-url "$RPC")
TX_TYPE=(); [[ "${XLAYER_LEGACY_TX:-}" == 1 || "$(cast block latest --rpc-url "$RPC" --json | jq -r .baseFeePerGas)" == "null" ]] && TX_TYPE=(--legacy)
send() { cast send "$@" --rpc-url "$RPC" --gas-price "$GAS_PRICE" ${TX_TYPE[@]+"${TX_TYPE[@]}"} "${SIGNER[@]}" --json; }

SYMBOL=$(jq -r '.markets[0].symbol' config/xlayer-markets.json)
MARKET=$(cast keccak "$SYMBOL")
WAIT=$(( $(jq -r .min tapeout/circuits/cooldown_ge.json) + 2 ))
USD=$(cast to-wei "$COLL" ether)
PASS_SIZE=$(cast to-wei "$((PASS_X * COLL))" ether); REJECT_SIZE=$(cast to-wei "$((REJECT_X * COLL))" ether)
DEC=$(cast call "$USDC" 'decimals()(uint8)' --rpc-url "$RPC")
NEED=$(python3 -c "print($COLL * 2 * 10**$DEC)")
BAL=$(cast call "$USDC" 'balanceOf(address)(uint256)' "$DEPLOYER_ADDRESS" --rpc-url "$RPC" | cut -d' ' -f1)
ALLOW=$(cast call "$USDC" 'allowance(address,address)(uint256)' "$DEPLOYER_ADDRESS" "$VAULT" --rpc-url "$RPC" | cut -d' ' -f1)

echo "chain $CHAIN  vault $VAULT  market $SYMBOL  collateral \$$COLL"
echo "will send: $([[ $(python3 -c "print(int($BAL < $NEED))") == 1 ]] && echo 'faucet, ')$([[ $(python3 -c "print(int($ALLOW < $NEED))") == 1 ]] && echo 'approve, ')${PASS_X}x long (expected to pass), ${REJECT_X}x long (expected to revert)"

# Dry-run both trades first, from the deployer, so nothing is sent if they would not behave as expected.
dry() { cast call "$VAULT" 'openPosition(bytes32,uint8,uint256,uint256)' "$MARKET" 0 "$1" "$USD" --from "$DEPLOYER_ADDRESS" --rpc-url "$RPC" 2>&1 || true; }
if [[ $(python3 -c "print(int($BAL >= $NEED and $ALLOW >= $NEED))") == 1 ]]; then
  R=$(dry "$REJECT_SIZE"); echo "dry run ${REJECT_X}x: $(echo "$R" | grep -oE 'CircuitRiskRejected\([0-9]+\)|0x953f1686[0-9a-f]*|MaxLeverageExceeded|revert.*' | head -1)"
fi
read -r -p "Send these on chain $CHAIN? [y/N] " ok; [[ "$ok" == y || "$ok" == Y ]] || exit 1

[[ $(python3 -c "print(int($BAL < $NEED))") == 1 ]] && { echo "faucet:  $(send "$USDC" 'faucet()' | jq -r .transactionHash)"; }
[[ $(python3 -c "print(int($ALLOW < $NEED))") == 1 ]] && { echo "approve: $(send "$USDC" 'approve(address,uint256)' "$VAULT" "$NEED" | jq -r .transactionHash)"; }

PASS=$(send "$VAULT" 'openPosition(bytes32,uint8,uint256,uint256)' "$MARKET" 0 "$PASS_SIZE" "$USD")
PASS_GAS=$(cast to-dec "$(echo "$PASS" | jq -r .gasUsed)")
echo "PROOF_PASS_TX=$(echo "$PASS" | jq -r .transactionHash)  status $(echo "$PASS" | jq -r .status)  gas $PASS_GAS"

echo "waiting ${WAIT}s so only the leverage circuit can fail"; sleep "$WAIT"
R=$(dry "$REJECT_SIZE"); echo "dry run ${REJECT_X}x: $(echo "$R" | grep -oE 'CircuitRiskRejected\([0-9]+\)|0x953f1686[0-9a-f]*|MaxLeverageExceeded|revert.*' | head -1)"
REJ=$(send "$VAULT" 'openPosition(bytes32,uint8,uint256,uint256)' "$MARKET" 0 "$REJECT_SIZE" "$USD" --gas-limit "$((PASS_GAS * 3 / 2))" 2>&1 || true)
echo "PROOF_REJECT_TX=$(echo "$REJ" | jq -r .transactionHash 2>/dev/null || echo "$REJ")  status $(echo "$REJ" | jq -r .status 2>/dev/null)"
