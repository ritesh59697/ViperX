-- ViperX — starting schema. Extend as PNL/risk metrics evolve.

CREATE TABLE IF NOT EXISTS agents (
    agent_pda       TEXT PRIMARY KEY,       -- on-chain PDA address
    owner           TEXT NOT NULL,
    agent_id        TEXT NOT NULL,
    name            TEXT NOT NULL,
    strategy_uri    TEXT,
    vault_pubkey    TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'Active',
    trade_count     BIGINT NOT NULL DEFAULT 0,
    leaderboard_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    vault_balance   NUMERIC NOT NULL DEFAULT 0,
    chain           TEXT NOT NULL DEFAULT 'solana',
    is_paper        BOOLEAN NOT NULL DEFAULT FALSE,
    simulated_balance NUMERIC NOT NULL DEFAULT 1000,
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS trades (
    id              BIGSERIAL PRIMARY KEY,
    agent_pda       TEXT NOT NULL REFERENCES agents(agent_pda),
    market_symbol   TEXT NOT NULL,          -- e.g. 'SOL-PERP'
    side            TEXT NOT NULL,          -- 'long' | 'short'
    size_usd        NUMERIC NOT NULL,
    entry_price     NUMERIC NOT NULL,
    exit_price      NUMERIC,
    opened_at       TIMESTAMPTZ NOT NULL,
    closed_at       TIMESTAMPTZ,
    realized_pnl    NUMERIC,
    tx_signature    TEXT,
    -- Independently observed by src/velocityWatcher.ts from on-chain
    -- PerpPosition.settledPnl deltas — NULL until the watcher catches up to
    -- this trade. Deliberately separate from realized_pnl (execution-runtime's
    -- self-report): the leaderboard trusts the self-report for speed, these
    -- three columns are what let it flag/rank down a divergent one.
    onchain_verified_pnl  NUMERIC,
    verified_at           TIMESTAMPTZ,
    pnl_divergence_flagged BOOLEAN NOT NULL DEFAULT FALSE,
    reason                TEXT,
    is_paper              BOOLEAN NOT NULL DEFAULT FALSE
);

-- Idempotent for existing local databases created before verification
-- columns existed — CREATE TABLE IF NOT EXISTS above won't add columns to
-- an already-existing trades table.
ALTER TABLE trades ADD COLUMN IF NOT EXISTS onchain_verified_pnl NUMERIC;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS pnl_divergence_flagged BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS vault_balance NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS chain TEXT NOT NULL DEFAULT 'solana';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_paper BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS simulated_balance NUMERIC NOT NULL DEFAULT 1000;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS is_paper BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pnl_snapshots ADD COLUMN IF NOT EXISTS is_paper BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS pnl_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    agent_pda       TEXT NOT NULL REFERENCES agents(agent_pda),
    snapshot_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    realized_pnl    NUMERIC NOT NULL,
    unrealized_pnl  NUMERIC NOT NULL,
    roi_pct         NUMERIC NOT NULL,
    max_drawdown_pct NUMERIC,
    sharpe_like     NUMERIC,
    is_paper        BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_trades_agent ON trades(agent_pda);
CREATE INDEX IF NOT EXISTS idx_snapshots_agent_time ON pnl_snapshots(agent_pda, snapshot_at DESC);

-- Milestone badges unlocked from src/skillEngine.ts, checked against
-- src/skillDefinitions.ts. Purely informational in v1 — see agent_strategy_params
-- below for the mechanic that actually changes strategy behavior.
CREATE TABLE IF NOT EXISTS agent_skills (
    id                  SERIAL PRIMARY KEY,
    agent_pda           TEXT NOT NULL REFERENCES agents(agent_pda),
    skill_key           TEXT NOT NULL,
    unlocked_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_trade_count  BIGINT NOT NULL,
    UNIQUE (agent_pda, skill_key)
);

-- Tuned per-agent strategy knobs, written by src/skillEngine.ts's whipsaw
-- heuristic and read by execution-runtime (via leaderboard-api) at strategy
-- construction time. `caution` is a single scalar every strategy factors into
-- its own thresholds — see CLAUDE.md/NEXT_STEPS.md for why this stays a
-- generic knob instead of per-strategy-id param names.
CREATE TABLE IF NOT EXISTS agent_strategy_params (
    agent_pda   TEXT PRIMARY KEY REFERENCES agents(agent_pda),
    params      JSONB NOT NULL DEFAULT '{"caution": 0}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit trail of every agent_strategy_params change — the "learned from a
-- mistake" log line shown on the agent-profile page.
CREATE TABLE IF NOT EXISTS agent_tuning_history (
    id          BIGSERIAL PRIMARY KEY,
    agent_pda   TEXT NOT NULL REFERENCES agents(agent_pda),
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    param       TEXT NOT NULL,
    old_value   NUMERIC NOT NULL,
    new_value   NUMERIC NOT NULL,
    reason      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tuning_history_agent ON agent_tuning_history(agent_pda, changed_at DESC);

-- Arena mode: off-chain, time-boxed competitions over a fixed entrant list.
-- No `status` column — upcoming/active/ended is always derived from now()
-- vs starts_at/ends_at at read time, so there's no background job that can
-- drift out of sync. Created by an operator script
-- (backend/pnl-indexer/scripts/create-arena-season.ts), not a public
-- endpoint — no admin-auth system exists in this codebase.
CREATE TABLE IF NOT EXISTS arena_seasons (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    starts_at   TIMESTAMPTZ NOT NULL,
    ends_at     TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Entry is public (any agent owner may join) but signature-verified — see
-- leaderboard-api's src/verifyOwnership.ts.
CREATE TABLE IF NOT EXISTS arena_entries (
    id              SERIAL PRIMARY KEY,
    arena_season_id INTEGER NOT NULL REFERENCES arena_seasons(id),
    agent_pda       TEXT NOT NULL REFERENCES agents(agent_pda),
    entered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (arena_season_id, agent_pda)
);
CREATE INDEX IF NOT EXISTS idx_arena_entries_season ON arena_entries(arena_season_id);

-- Copy-trading: a follower agent (itself a normal registered/funded/delegated
-- agent) mirrors a source agent's trades into its own vault at its own size,
-- instead of running its own price-based strategy. No money changes hands in
-- v1 — see CLAUDE.md/NEXT_STEPS.md for the marketplace/fee phase this is
-- meant to precede. First table with two agent_pda FKs; closest existing
-- precedent is arena_entries (junction table, composite UNIQUE).
CREATE TABLE IF NOT EXISTS copy_subscriptions (
    id                  SERIAL PRIMARY KEY,
    follower_agent_pda  TEXT NOT NULL REFERENCES agents(agent_pda),
    source_agent_pda    TEXT NOT NULL REFERENCES agents(agent_pda),
    size_usd            NUMERIC NOT NULL,
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (follower_agent_pda <> source_agent_pda),
    UNIQUE (follower_agent_pda, source_agent_pda)
);
CREATE INDEX IF NOT EXISTS idx_copy_subs_follower ON copy_subscriptions(follower_agent_pda);
CREATE INDEX IF NOT EXISTS idx_copy_subs_source ON copy_subscriptions(source_agent_pda);
