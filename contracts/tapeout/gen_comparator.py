"""Generate a TapeOut (TAP-02) netlist for an unsigned constant comparator.

    --max K   PASS = (x <= K)    ceilings: leverage, slippage, drawdown
    --min K   PASS = (x >= K)    floors: cooldown (seconds since the agent's last trade)

x is an n-bit input, least significant bit first (TAP-02 §5). K is baked into the netlist,
so the circuit has n inputs and 1 output and costs about 2 NAND gates per bit.
Inputs wider than n bits must be saturated (not truncated) to 2^n - 1 before eval; truncation
would let 65537 reach a 16-bit circuit as 1.
x >= K is built as NOT(x <= K-1), taking the opposite polarity of the same scan, so it costs
no more gates than a ceiling.

Usage:
    python3 tapeout/gen_comparator.py --name leverage_le --bits 16 --max 2000 [--samples 512]
    python3 tapeout/gen_comparator.py --name cooldown_ge --bits 32 --min 10

Writes tapeout/circuits/<name>.json: the netlist, its shape, and test vectors checked against
the vendored TAP-02 reference evaluator. The Foundry fork test replays those vectors on chain.
"""
from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "vendor"))
import tap02_reference as ref  # noqa: E402

CONST0, CONST1 = 0, 1


class Builder:
    """Appends NAND elements; signal indices follow TAP-02 §2 numbering."""

    def __init__(self, n_in: int):
        self.n_in = n_in
        self.els: list[ref.Element] = []

    def inp(self, i: int) -> int:
        return 2 + i

    def nand(self, a: int, b: int) -> int:
        idx = 2 + self.n_in + len(self.els)
        self.els.append(ref.Element(ref.NAND, [a, b], first_out=idx))
        return idx

    def inv(self, a: int) -> int:
        return self.nand(a, a)


def build_const_cmp(bits: int, k: int, want_le: bool) -> Builder:
    """Output (x <= K) when want_le, else NOT(x <= K) = (x > K).

    Scanned LSB to MSB, tracking le = (x[0..i] <= K[0..i]) in whichever polarity is cheaper:
    K_i = 1:  le_i = NOT x_i OR le_{i-1}   = NAND(x_i, NOT le_{i-1})
    K_i = 0:  le_i = NOT x_i AND le_{i-1}  -> NOT le_i = NAND(NOT x_i, le_{i-1})
    Base: le_{-1} = 1 (equality passes), available free as the constants.
    """
    if not 1 <= bits <= 64:
        raise SystemExit("--bits must be between 1 and 64")
    if not 0 <= k < (1 << bits):
        raise SystemExit(f"threshold must fit in {bits} bits")
    b = Builder(bits)
    le, nle = CONST1, CONST0  # at most one is a live gate; the other is None once computed
    for i in range(bits):
        x = b.inp(i)
        if (k >> i) & 1:
            if nle is None:
                nle = b.inv(le)
            le, nle = b.nand(x, nle), None
        else:
            if le is None:
                le = b.inv(nle)
            nle, le = b.nand(b.inv(x), le), None
    # bits >= 1, so exactly one of le / nle is now a live element output.
    out = le if want_le else nle
    if out is None:
        out = b.inv(nle if want_le else le)
    # Output must be an element-produced signal and the last one (TAP-02 §3 cond. 3, §4 step 4).
    assert out == 2 + bits + len(b.els) - 1, "output is not the last signal"
    return b


def bits_of(v: int, n: int) -> list[int]:
    return [(v >> i) & 1 for i in range(n)]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--name", required=True)
    ap.add_argument("--bits", type=int, required=True)
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--max", type=int, help="ceiling K: inputs <= K pass")
    mode.add_argument("--min", type=int, help="floor K (>= 1): inputs >= K pass")
    ap.add_argument("--samples", type=int, default=512, help="random vectors when exhaustive is too big")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out-dir", default=str(HERE / "circuits"), help="where <name>.json is written")
    a = ap.parse_args()

    # Callers saturate wider values to the all-ones input before eval (TapeOutSignal.encode).
    # That keeps the answer exact only if the all-ones input itself fails a ceiling: K < 2^bits - 1.
    # A floor needs nothing extra, since saturated values stay >= K whenever the true value was.
    if a.max is not None and a.max >= (1 << a.bits) - 1:
        raise SystemExit(f"--max must be below {(1 << a.bits) - 1} so saturated inputs still fail")
    if a.max is not None:
        kind, k, passes = "le_const", a.max, (lambda x: x <= a.max)
        b = build_const_cmp(a.bits, a.max, want_le=True)
    else:
        if a.min < 1:
            raise SystemExit("--min must be >= 1 (a floor of 0 passes every input)")
        kind, k, passes = "ge_const", a.min, (lambda x: x >= a.min)
        b = build_const_cmp(a.bits, a.min - 1, want_le=False)
    netlist = ref.encode(b.els)
    circuit = ref.load(netlist, a.bits, 1)  # raises IllFormed if TAP-02 §3 rejects it

    # Exhaustive when small; otherwise boundaries + random. Every vector is checked here against the
    # reference evaluator AND against plain integer comparison before it is written.
    high: set[int] = set()
    if a.bits <= 16:
        xs = list(range(1 << a.bits))
    else:
        rng = random.Random(a.seed)
        top = (1 << a.bits) - 1
        edge = {0, 1, top} | {v for v in (k - 1, k, k + 1) if 0 <= v <= top}
        # Every value from 0 up to past the threshold, so the region where the answer flips is
        # covered exhaustively; then each single high bit (and its all-ones-below neighbour),
        # which is how a truncating or mis-wired high bit would show up.
        band = set(range(min(top, 2 * k + 256) + 1))
        high = {v for i in range(a.bits) for v in ((1 << i), (1 << i) - 1, (1 << i) | k) if v <= top}
        xs = sorted(edge | band | high | {rng.randrange(top + 1) for _ in range(a.samples)})

    inputs, outputs = [], []
    for x in xs:
        _, out = ref.beat(circuit, [], bits_of(x, a.bits))
        want = int(passes(x))
        if out != [want]:
            raise SystemExit(f"reference evaluator disagrees at x={x}: got {out}, want {want}")
        inputs.append("0x" + ref.pack(bits_of(x, a.bits)).hex())
        outputs.append("0x" + ref.pack(out).hex())

    # The on-chain test replays a bounded subset: every boundary plus an even spread.
    chain_idx = sorted({0, len(xs) - 1, *[i for i, x in enumerate(xs) if abs(x - k) <= 1 or x in high],
                        *range(0, len(xs), max(1, len(xs) // 64))})
    out = {
        "name": a.name,
        "kind": kind,
        "bits": a.bits,
        ("max" if kind == "le_const" else "min"): k,
        "generatedBy": "python3 tapeout/gen_comparator.py " + " ".join(sys.argv[1:]),
        "nIn": a.bits,
        "nOut": 1,
        "gates": circuit.n_gates,
        "netlist": "0x" + netlist.hex(),
        "vectorsCheckedOffChain": len(xs),
        "inputs": [inputs[i] for i in chain_idx],
        "outputs": [outputs[i] for i in chain_idx],
    }
    path = Path(a.out_dir) / f"{a.name}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, indent=2) + "\n")
    op = "<=" if kind == "le_const" else ">="
    print(f"{a.name}: {a.bits}-bit x {op} {k}, {circuit.n_gates} NAND gates, "
          f"{len(netlist)} bytes, {len(xs)} vectors verified, {len(chain_idx)} kept for chain -> {path}")


if __name__ == "__main__":
    main()
