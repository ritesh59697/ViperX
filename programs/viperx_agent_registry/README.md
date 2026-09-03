# ViperX Agent Registry

On-chain agent identity program — the first building block of ViperX. Every
agent gets a PDA (`Agent` account) that the execution runtime, PNL indexer,
and leaderboard all reference.

## What this program does

- `register_agent` — creates the on-chain identity for a new agent (owner,
  name, strategy metadata URI, and the Drift vault pubkey it trades through).
- `record_trade` — bumps a trade counter; auto-flips `leaderboard_eligible`
  once an agent hits the minimum track record (50 trades) — this is the
  anti-gaming rule from the roadmap, enforced on-chain instead of trusted to
  the frontend. **Signed by the agent's `authority`, not its owner** — the
  backend has to be able to call this without holding owner keys.
- `set_authority` — owner-only; sets the key allowed to call `record_trade`
  and `authority_pause` (the execution runtime's backend key). Defaults to
  the owner at registration. That key can only bump the counter or pause the
  agent — it cannot retire, edit metadata, move funds, or reactivate — so
  delegating it keeps the non-custodial model intact. Point it back at the
  owner to revoke.
- `authority_pause` — the delegated `authority`'s circuit breaker: moves
  `status` from `Active` to `Paused`, one-directionally (rejects with
  `NotActive` if the agent isn't currently `Active`). This is the one status
  change a non-owner key can make — deliberately narrower than `set_status`,
  since a delegate should be able to silence a malfunctioning agent without
  gaining any power to reactivate, retire, or repurpose it.
- `set_status` — owner-only; can pause, reactivate, or retire an agent —
  the only way to move status *out* of `Paused`. Your execution runtime
  should check this before submitting any trade.
- `update_metadata` — owner can update name/strategy description.
  `agent_id` and `vault_pubkey` are immutable — they're the stable
  identifiers everything else keys off.

PNL itself is **not** stored on-chain — that's computed off-chain by your
indexer from Drift account data (cheaper, and Drift already has the position
history). This program only tracks identity, status, and trade count.

## Setup

Run the full suite against a local validator (no devnet SOL, no deploy):

```bash
PATH="$PWD/node_modules/.bin:$PATH" anchor test --provider.cluster localnet
```

The `yarn` on PATH matters — `Anchor.toml`'s test script calls it, and it is a
devDependency here rather than a global install.

## First-time toolchain setup

```bash
# 1. Install the toolchain (skip any you already have)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest && avm use latest

# 2. Point the CLI at devnet and fund a wallet
solana config set --url devnet
solana-keygen new -o ~/.config/solana/id.json   # if you don't already have one
solana airdrop 2

# 3. Build — this generates the real program ID
anchor build
anchor keys list
```

After `anchor keys list`, copy the printed program ID into **both**:
- `declare_id!(...)` in `programs/viperx_agent_registry/src/lib.rs`
- `[programs.devnet]` in `Anchor.toml`

Then rebuild and deploy:

```bash
anchor build
anchor deploy --provider.cluster devnet
anchor test --provider.cluster devnet   # runs tests/viperx_agent_registry.ts
```

## Next pieces this plugs into

1. **Agent wallet + delegation** — the `vault_pubkey` stored here should be a
   real Drift delegated vault, set up via the Drift SDK before you call
   `register_agent`.
2. **Execution runtime** — your backend calls `record_trade` (via a trusted
   authority you control) after each closed Drift position, keeping the
   on-chain trade count in sync.
3. **PNL indexer** — listens for `AgentRegistered` / `AgentBecameEligible`
   events plus Drift account changes to build the leaderboard dataset.
