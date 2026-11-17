-- X Layer indexer and on-chain fill check (2026-11-17). Additive only: new nullable columns,
-- new tables and a partial unique index. Nothing existing is altered or dropped.

-- Whether a trade's tx_signature was found on its chain. NULL = not checked yet. Only fills with
-- tx_found = TRUE count as verified for ranking, so rows whose hash does not exist on chain
-- stay in the table but stop counting.
ALTER TABLE trades ADD COLUMN IF NOT EXISTS tx_found BOOLEAN;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS tx_checked_at TIMESTAMPTZ;

-- "<txHash>:<logIndex>" for fills written by the X Layer indexer; makes re-indexing idempotent.
ALTER TABLE trades ADD COLUMN IF NOT EXISTS chain_event_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS trades_chain_event_id_key
  ON trades (chain_event_id) WHERE chain_event_id IS NOT NULL;

-- Set only for agents read from an on-chain registry event. The X Layer indexer attributes fills
-- only to these, never to rows inserted any other way.
ALTER TABLE agents ADD COLUMN IF NOT EXISTS registry_tx TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS registry_block BIGINT;

-- Cursor and one-off values for the indexer (last indexed block, contract deploy blocks).
CREATE TABLE IF NOT EXISTS indexer_state (
  key        TEXT PRIMARY KEY,
  value      BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Open vault positions, so a close can be paired with its (size-weighted) entry.
CREATE TABLE IF NOT EXISTS xlayer_open_positions (
  position_key   TEXT PRIMARY KEY,
  trader         TEXT NOT NULL,
  market_id      TEXT NOT NULL,
  side           TEXT NOT NULL,
  size_usd       NUMERIC NOT NULL,
  collateral_usd NUMERIC NOT NULL,
  entry_price    NUMERIC NOT NULL,
  opened_at      TIMESTAMPTZ NOT NULL,
  open_tx        TEXT NOT NULL
);
