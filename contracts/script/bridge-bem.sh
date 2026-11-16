#!/usr/bin/env bash
# Bridges BEM from BNB Chain to the deployer on X Layer through BEM's LayerZero OFT adapter.
# The adapter keeps a fee in BEM, so the amount sent is sized from a live quote to make at least
# <bem to receive> arrive. Without --send it only quotes; with --send it approves exactly the amount
# sent and bridges it after you confirm.
#
# Usage: script/bridge-bem.sh <bem to receive on X Layer> [--send -- <cast signer args>]
#   quote: script/bridge-bem.sh 0.111
#   send:  script/bridge-bem.sh 0.111 --send -- --account viperx-deployer
# Env: DEPLOYER_ADDRESS (recipient and sender), BSC_RPC_URL, BEM_BSC_ADAPTER, BEM_XLAYER_EID
set -euo pipefail
cd "$(dirname "$0")/.."

WANT="${1:?BEM to receive on X Layer, e.g. 0.111}"; shift
SEND=0
if [[ "${1:-}" == "--send" ]]; then SEND=1; shift; [[ "${1:-}" == "--" ]] && shift; fi
SIGNER=("$@")
for v in DEPLOYER_ADDRESS BSC_RPC_URL BEM_BSC_ADAPTER BEM_XLAYER_EID; do
  [[ -n "${!v:-}" ]] || { echo "$v is not set (see .env.example)" >&2; exit 2; }
done
[[ $SEND -eq 0 || ${#SIGNER[@]} -gt 0 ]] || { echo "--send needs signer args after -- (e.g. --account <name>)" >&2; exit 2; }

TOKEN=$(cast call "$BEM_BSC_ADAPTER" 'token()(address)' --rpc-url "$BSC_RPC_URL")
DEC=$(cast call "$TOKEN" 'decimals()(uint8)' --rpc-url "$BSC_RPC_URL")
SHARED=$(cast call "$BEM_BSC_ADAPTER" 'sharedDecimals()(uint8)' --rpc-url "$BSC_RPC_URL")
STEP=$(python3 -c "print(10**($DEC-$SHARED))")          # smallest amount the OFT moves
NEED=$(python3 -c "from decimal import Decimal as D; print(int(D('$WANT') * 10**$DEC))")
TO=0x000000000000000000000000$(echo "${DEPLOYER_ADDRESS:2}" | tr 'A-F' 'a-f')

received() { # received <amount sent>
  cast call "$BEM_BSC_ADAPTER" 'quoteOFT((uint32,bytes32,uint256,uint256,bytes,bytes,bytes))((uint256,uint256),(int256,string)[],(uint256,uint256))' \
    "($BEM_XLAYER_EID,$TO,$1,0,0x,0x,0x)" --rpc-url "$BSC_RPC_URL" | tail -1 | tr -d '()' | sed -E 's/\[[^]]*\]//g' | tr -d ',' | awk '{print $2}'
}

# Scale up by the quoted fee, round up to the OFT step, then add steps until the quote clears.
GOT=$(received "$NEED")
AMOUNT=$(python3 -c "import math; a=math.ceil($NEED*$NEED/$GOT); print(math.ceil(a/$STEP)*$STEP)")
while [[ $(received "$AMOUNT") -lt $NEED ]]; do AMOUNT=$((AMOUNT + STEP)); done
ARRIVES=$(received "$AMOUNT")
PARAM="($BEM_XLAYER_EID,$TO,$AMOUNT,$NEED,0x,0x,0x)"
FEE=$(cast call "$BEM_BSC_ADAPTER" 'quoteSend((uint32,bytes32,uint256,uint256,bytes,bytes,bytes),bool)((uint256,uint256))' "$PARAM" false \
  --rpc-url "$BSC_RPC_URL" | tr -d '()' | cut -d' ' -f1)
fmt() { python3 -c "print(f'{$1/10**$2:.8f}'.rstrip('0').rstrip('.'))"; }

echo "send       $(fmt "$AMOUNT" "$DEC") BEM from BNB Chain"
echo "arrives    $(fmt "$ARRIVES" "$DEC") BEM on X Layer (adapter fee $(fmt $((AMOUNT - ARRIVES)) "$DEC") BEM; reverts if under $WANT)"
echo "bridge fee $(cast from-wei "$FEE") BNB, plus approve/send gas at $(cast from-wei "$(cast gas-price --rpc-url "$BSC_RPC_URL")" gwei) gwei"
echo "wallet     $(fmt "$(cast call "$TOKEN" 'balanceOf(address)(uint256)' "$DEPLOYER_ADDRESS" --rpc-url "$BSC_RPC_URL" | cut -d' ' -f1)" "$DEC") BEM, $(cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BSC_RPC_URL" --ether) BNB on BNB Chain"
[[ $SEND -eq 1 ]] || exit 0

read -r -p "Approve and bridge? [y/N] " a; [[ "$a" == "y" || "$a" == "Y" ]] || { echo "stopped"; exit 1; }
cast send "$TOKEN" 'approve(address,uint256)' "$BEM_BSC_ADAPTER" "$AMOUNT" --rpc-url "$BSC_RPC_URL" "${SIGNER[@]}"
cast send "$BEM_BSC_ADAPTER" 'send((uint32,bytes32,uint256,uint256,bytes,bytes,bytes),(uint256,uint256),address)' \
  "$PARAM" "($FEE,0)" "$DEPLOYER_ADDRESS" --value "$FEE" --rpc-url "$BSC_RPC_URL" "${SIGNER[@]}"
echo "sent; track it on layerzeroscan.com. It lands as BEM at the TapeOut factory's bem() on X Layer."
