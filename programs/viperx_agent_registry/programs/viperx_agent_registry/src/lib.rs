use anchor_lang::prelude::*;

declare_id!("321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm");

#[program]
pub mod viperx_agent_registry {
    use super::*;

    /// Registers a new agent. Called once by the agent's owner (the user
    /// deploying the agent). Creates a PDA that becomes the on-chain
    /// identity for this agent — everything downstream (execution runtime,
    /// PNL indexer, leaderboard) references this account.
    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        agent_id: String,
        name: String,
        strategy_uri: String,
        vault_pubkey: Pubkey,
    ) -> Result<()> {
        require!(agent_id.len() <= MAX_AGENT_ID_LEN, RegistryError::AgentIdTooLong);
        require!(name.len() <= MAX_NAME_LEN, RegistryError::NameTooLong);
        require!(strategy_uri.len() <= MAX_URI_LEN, RegistryError::UriTooLong);

        let agent = &mut ctx.accounts.agent;
        let clock = Clock::get()?;

        agent.owner = ctx.accounts.owner.key();
        agent.agent_id = agent_id;
        agent.name = name;
        agent.strategy_uri = strategy_uri;
        agent.vault_pubkey = vault_pubkey;
        agent.status = AgentStatus::Active;
        agent.created_at = clock.unix_timestamp;
        agent.updated_at = clock.unix_timestamp;
        agent.trade_count = 0;
        agent.leaderboard_eligible = false; // flips true once min track record is met
        // Defaults to the owner; the owner delegates this to the execution
        // runtime with set_authority. It can only bump trade_count.
        agent.authority = ctx.accounts.owner.key();
        agent.bump = ctx.bumps.agent;

        emit!(AgentRegistered {
            agent: agent.key(),
            owner: agent.owner,
            agent_id: agent.agent_id.clone(),
        });

        Ok(())
    }

    /// Owner-only: pause an agent (e.g. anomalous behavior, manual stop).
    /// The execution runtime should check this flag before submitting trades.
    pub fn set_status(ctx: Context<UpdateAgent>, status: AgentStatus) -> Result<()> {
        let agent = &mut ctx.accounts.agent;
        agent.status = status;
        agent.updated_at = Clock::get()?.unix_timestamp;

        emit!(AgentStatusChanged {
            agent: agent.key(),
            status,
        });

        Ok(())
    }

    /// Owner-only: set the key allowed to call `record_trade` — normally the
    /// execution runtime's backend key. That key can *only* bump the trade
    /// counter; it cannot pause, retire, edit metadata, or touch funds, so
    /// delegating it does not compromise the non-custodial model. Set back to
    /// the owner's own key to revoke.
    pub fn set_authority(ctx: Context<UpdateAgent>, new_authority: Pubkey) -> Result<()> {
        let agent = &mut ctx.accounts.agent;
        agent.authority = new_authority;
        agent.updated_at = Clock::get()?.unix_timestamp;

        emit!(AgentAuthorityChanged {
            agent: agent.key(),
            authority: new_authority,
        });

        Ok(())
    }

    /// Called by the execution runtime after each closed trade to bump the
    /// on-chain trade count. Signed by `authority` (see `set_authority`), not
    /// by the owner — a backend service cannot hold owner keys without
    /// breaking the non-custodial story.
    ///
    /// Keeping this minimal on-chain and doing full PNL calc off-chain against
    /// Drift account data keeps compute costs low — this counter exists only to
    /// support the "minimum track record" anti-gaming rule for leaderboard
    /// eligibility.
    pub fn record_trade(ctx: Context<RecordTrade>) -> Result<()> {
        let agent = &mut ctx.accounts.agent;
        agent.trade_count = agent.trade_count.saturating_add(1);
        agent.updated_at = Clock::get()?.unix_timestamp;

        if !agent.leaderboard_eligible && agent.trade_count >= MIN_TRADES_FOR_ELIGIBILITY {
            agent.leaderboard_eligible = true;
            emit!(AgentBecameEligible { agent: agent.key() });
        }

        Ok(())
    }

    /// Delegated-authority circuit breaker: lets the execution runtime pause
    /// an agent on-chain when it gives up trading it (repeated failures,
    /// anomalous behavior), instead of only stopping in-process while the
    /// public status keeps reading `Active`. Deliberately one-directional and
    /// narrowly scoped — same trust boundary as `record_trade`
    /// (`has_one = authority`), not `set_status`'s owner-only boundary:
    /// the authority key can only move Active -> Paused. It can never
    /// reactivate, retire, or otherwise touch the agent; only the owner's own
    /// `set_status` can do that. See CLAUDE.md's circuit-breaker gotcha.
    pub fn authority_pause(ctx: Context<RecordTrade>) -> Result<()> {
        let agent = &mut ctx.accounts.agent;
        require!(agent.status == AgentStatus::Active, RegistryError::NotActive);

        agent.status = AgentStatus::Paused;
        agent.updated_at = Clock::get()?.unix_timestamp;

        emit!(AgentStatusChanged {
            agent: agent.key(),
            status: AgentStatus::Paused,
        });

        Ok(())
    }

    /// Owner-only: update mutable metadata (name/strategy description).
    /// agent_id and vault_pubkey are immutable by design — they're the
    /// stable identifiers everything else references.
    pub fn update_metadata(
        ctx: Context<UpdateAgent>,
        name: Option<String>,
        strategy_uri: Option<String>,
    ) -> Result<()> {
        let agent = &mut ctx.accounts.agent;

        if let Some(n) = name {
            require!(n.len() <= MAX_NAME_LEN, RegistryError::NameTooLong);
            agent.name = n;
        }
        if let Some(uri) = strategy_uri {
            require!(uri.len() <= MAX_URI_LEN, RegistryError::UriTooLong);
            agent.strategy_uri = uri;
        }
        agent.updated_at = Clock::get()?.unix_timestamp;

        Ok(())
    }
}

// ---------- Constants ----------

pub const MAX_AGENT_ID_LEN: usize = 32;
pub const MAX_NAME_LEN: usize = 64;
pub const MAX_URI_LEN: usize = 200;
pub const MIN_TRADES_FOR_ELIGIBILITY: u64 = 50;

// ---------- Accounts (instruction contexts) ----------

#[derive(Accounts)]
#[instruction(agent_id: String)]
pub struct RegisterAgent<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = Agent::SPACE,
        seeds = [b"agent", owner.key().as_ref(), agent_id.as_bytes()],
        bump
    )]
    pub agent: Account<'info, Agent>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAgent<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"agent", owner.key().as_ref(), agent.agent_id.as_bytes()],
        bump = agent.bump,
        has_one = owner @ RegistryError::Unauthorized,
    )]
    pub agent: Account<'info, Agent>,
}

/// Signed by the agent's `authority`, not its owner — this is what lets the
/// backend keep the trade count in sync. No seeds constraint: the owner isn't
/// a signer here, so the PDA can't be re-derived from the accounts given.
/// `has_one = authority` is what secures it — an authority can only ever bump
/// the counter on the agent it was delegated to.
#[derive(Accounts)]
pub struct RecordTrade<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority @ RegistryError::Unauthorized,
    )]
    pub agent: Account<'info, Agent>,
}

// ---------- State ----------

#[account]
pub struct Agent {
    pub owner: Pubkey,             // 32 - wallet that controls this agent
    pub agent_id: String,          // 4 + MAX_AGENT_ID_LEN - unique per owner, used in PDA seed
    pub name: String,              // 4 + MAX_NAME_LEN - display name
    pub strategy_uri: String,      // 4 + MAX_URI_LEN - off-chain metadata (strategy description, params)
    pub vault_pubkey: Pubkey,      // 32 - the Drift delegated vault this agent trades through
    pub authority: Pubkey,         // 32 - key allowed to call record_trade (see set_authority)
    pub status: AgentStatus,       // 1
    pub trade_count: u64,          // 8
    pub leaderboard_eligible: bool,// 1
    pub created_at: i64,           // 8
    pub updated_at: i64,           // 8
    pub bump: u8,                  // 1
}

impl Agent {
    pub const SPACE: usize = 8 // discriminator
        + 32 // owner
        + (4 + MAX_AGENT_ID_LEN)
        + (4 + MAX_NAME_LEN)
        + (4 + MAX_URI_LEN)
        + 32 // vault_pubkey
        + 32 // authority
        + 1  // status
        + 8  // trade_count
        + 1  // leaderboard_eligible
        + 8  // created_at
        + 8  // updated_at
        + 1; // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum AgentStatus {
    Active,
    Paused,
    Retired,
}

// ---------- Events ----------
// Indexed by the off-chain PNL indexer / backend to stay in sync without polling.

#[event]
pub struct AgentRegistered {
    pub agent: Pubkey,
    pub owner: Pubkey,
    pub agent_id: String,
}

#[event]
pub struct AgentStatusChanged {
    pub agent: Pubkey,
    pub status: AgentStatus,
}

#[event]
pub struct AgentBecameEligible {
    pub agent: Pubkey,
}

#[event]
pub struct AgentAuthorityChanged {
    pub agent: Pubkey,
    pub authority: Pubkey,
}

// ---------- Errors ----------

#[error_code]
pub enum RegistryError {
    #[msg("agent_id exceeds max length")]
    AgentIdTooLong,
    #[msg("name exceeds max length")]
    NameTooLong,
    #[msg("strategy_uri exceeds max length")]
    UriTooLong,
    #[msg("only the agent owner can perform this action")]
    Unauthorized,
    #[msg("agent is not active")]
    NotActive,
}
