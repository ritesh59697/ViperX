use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, MintTo, Burn};
use pyth_sdk_solana::load_price_feed_from_account_info;

declare_id!("6Deo4a3kxfhykzK82ghBrwMY4nHE613Nz9ejb46WFcED");

pub const BPS_DENOMINATOR: u64 = 10000;
pub const PRECISION: u128 = 1_000_000_000_000_000_000; // 1e18
pub const TRADING_FEE_BPS: u64 = 10; // 0.10% (10 bps)
pub const LIQUIDATION_FEE_BPS: u64 = 250; // 2.5% liquidation bounty
pub const BASE_BORROW_RATE_PER_HOUR_BPS: u64 = 1; // 0.01% / hr

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PositionSide {
    Long,
    Short,
}

#[program]
pub mod viperx_perpetuals {
    use super::*;

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.authority = ctx.accounts.authority.key();
        pool.usdc_mint = ctx.accounts.usdc_mint.key();
        pool.usdc_vault = ctx.accounts.usdc_vault.key();
        pool.lp_mint = ctx.accounts.lp_mint.key();
        pool.pool_collateral_usd = 0;
        pool.reserved_pool_usd = 0;
        pool.cumulative_borrow_index = PRECISION;
        pool.last_borrow_update_time = Clock::get()?.unix_timestamp;
        pool.bump = ctx.bumps.pool;
        pool.vault_bump = ctx.bumps.usdc_vault;
        Ok(())
    }

    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        market_id: String,
        max_oi_long_usd: u64,
        max_oi_short_usd: u64,
        min_position_size_usd: u64,
        max_leverage_bps: u64,
        maintenance_margin_bps: u64,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        market.pool = ctx.accounts.pool.key();
        market.market_id = market_id;
        market.pyth_feed = ctx.accounts.pyth_feed.key();
        market.max_oi_long_usd = max_oi_long_usd;
        market.max_oi_short_usd = max_oi_short_usd;
        market.oi_long_usd = 0;
        market.oi_short_usd = 0;
        market.min_position_size_usd = min_position_size_usd;
        market.max_leverage_bps = max_leverage_bps;
        market.maintenance_margin_bps = maintenance_margin_bps;
        market.is_active = true;
        market.bump = ctx.bumps.market;
        Ok(())
    }

    pub fn deposit_liquidity(
        ctx: Context<DepositLiquidity>,
        usdc_amount: u64,
    ) -> Result<()> {
        require!(usdc_amount > 0, PerpError::InvalidZeroAmount);

        let pool = &mut ctx.accounts.pool;
        update_borrow_index(pool)?;

        // Transfer USDC from user to pool vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_usdc.to_account_info(),
            to: ctx.accounts.usdc_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(CpiContext::new(cpi_program, cpi_accounts), usdc_amount)?;

        // Convert USDC amount (6 dec) to 1e18 USD
        let asset_usd18 = (usdc_amount as u128) * 1_000_000_000_000;
        let total_shares = ctx.accounts.lp_mint.supply as u128;

        let shares_to_mint = if total_shares == 0 || pool.pool_collateral_usd == 0 {
            usdc_amount
        } else {
            ((asset_usd18 * total_shares) / pool.pool_collateral_usd) as u64
        };

        pool.pool_collateral_usd += asset_usd18;

        // Mint LP share tokens to user
        let pool_seeds = &[
            b"pool".as_ref(),
            &[pool.bump],
        ];
        let signer = &[&pool_seeds[..]];

        let mint_cpi_accounts = MintTo {
            mint: ctx.accounts.lp_mint.to_account_info(),
            to: ctx.accounts.user_lp.to_account_info(),
            authority: pool.to_account_info(),
        };
        token::mint_to(
            CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), mint_cpi_accounts, signer),
            shares_to_mint,
        )?;

        Ok(())
    }

    pub fn open_position(
        ctx: Context<OpenPosition>,
        side: PositionSide,
        size_usd: u64,       // 18 decimals
        collateral_usd: u64, // 18 decimals
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        let market = &mut ctx.accounts.market;
        require!(market.is_active, PerpError::MarketNotActive);
        require!(size_usd >= market.min_position_size_usd, PerpError::PositionTooSmall);

        let leverage_bps = ((size_usd as u128 * BPS_DENOMINATOR as u128) / (collateral_usd as u128)) as u64;
        require!(leverage_bps <= market.max_leverage_bps, PerpError::MaxLeverageExceeded);

        // Fetch mark price from Pyth oracle account
        let pyth_feed = load_price_feed_from_account_info(&ctx.accounts.pyth_feed)
            .map_err(|_| PerpError::InvalidPythOracle)?;
        let current_price = pyth_feed.get_price_no_older_than(Clock::get()?.unix_timestamp, 60)
            .ok_or(PerpError::StalePythPrice)?;
        
        let mark_price = (current_price.price as u128) * 1_000_000_000_000 / (10u128.pow((-current_price.expo) as u32));

        // Deduct open fee
        let open_fee_usd = ((size_usd as u128 * TRADING_FEE_BPS as u128) / BPS_DENOMINATOR as u128) as u64;
        require!(collateral_usd > open_fee_usd, PerpError::InsufficientCollateral);
        let net_collateral_usd = collateral_usd - open_fee_usd;

        // Pull raw USDC collateral from trader (1e18 -> 1e6)
        let raw_usdc_collateral = (collateral_usd / 1_000_000_000_000) as u64;
        let cpi_accounts = Transfer {
            from: ctx.accounts.trader_usdc.to_account_info(),
            to: ctx.accounts.usdc_vault.to_account_info(),
            authority: ctx.accounts.trader.to_account_info(),
        };
        token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts), raw_usdc_collateral)?;

        pool.pool_collateral_usd += (open_fee_usd as u128) * 1_000_000_000_000;

        let position = &mut ctx.accounts.position;
        position.trader = ctx.accounts.trader.key();
        position.market = market.key();
        position.side = side;
        position.size_usd = size_usd;
        position.collateral_usd = net_collateral_usd;
        position.entry_price = mark_price as u64;
        position.entry_borrow_index = pool.cumulative_borrow_index;
        position.opened_at = Clock::get()?.unix_timestamp;
        position.bump = ctx.bumps.position;

        if side == PositionSide::Long {
            market.oi_long_usd += size_usd;
        } else {
            market.oi_short_usd += size_usd;
        }

        Ok(())
    }

    pub fn close_position(
        ctx: Context<ClosePosition>,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        let market = &mut ctx.accounts.market;
        let position = &ctx.accounts.position;

        require!(position.trader == ctx.accounts.trader.key(), PerpError::Unauthorized);

        let pyth_feed = load_price_feed_from_account_info(&ctx.accounts.pyth_feed)
            .map_err(|_| PerpError::InvalidPythOracle)?;
        let current_price = pyth_feed.get_price_no_older_than(Clock::get()?.unix_timestamp, 60)
            .ok_or(PerpError::StalePythPrice)?;
        
        let exit_price = (current_price.price as u128) * 1_000_000_000_000 / (10u128.pow((-current_price.expo) as u32)) as u128;

        let pnl_usd = if position.side == PositionSide::Long {
            ((position.size_usd as i128) * (exit_price as i128 - position.entry_price as i128)) / (position.entry_price as i128)
        } else {
            ((position.size_usd as i128) * (position.entry_price as i128 - exit_price as i128)) / (position.entry_price as i128)
        };

        let close_fee_usd = ((position.size_usd as u128 * TRADING_FEE_BPS as u128) / BPS_DENOMINATOR as u128) as i128;
        let net_payout_usd = (position.collateral_usd as i128) + pnl_usd - close_fee_usd;

        if net_payout_usd > 0 {
            let raw_payout_usdc = (net_payout_usd as u128 / 1_000_000_000_000) as u64;
            
            let pool_seeds = &[
                b"pool".as_ref(),
                &[pool.bump],
            ];
            let signer = &[&pool_seeds[..]];

            let cpi_accounts = Transfer {
                from: ctx.accounts.usdc_vault.to_account_info(),
                to: ctx.accounts.trader_usdc.to_account_info(),
                authority: pool.to_account_info(),
            };
            token::transfer(
                CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_accounts, signer),
                raw_payout_usdc,
            )?;
        }

        if position.side == PositionSide::Long {
            market.oi_long_usd = market.oi_long_usd.saturating_sub(position.size_usd);
        } else {
            market.oi_short_usd = market.oi_short_usd.saturating_sub(position.size_usd);
        }

        Ok(())
    }
}

fn update_borrow_index(pool: &mut Account<Pool>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    if now <= pool.last_borrow_update_time {
        return Ok(());
    }
    let hours_elapsed = (now - pool.last_borrow_update_time) / 3600;
    if hours_elapsed > 0 {
        let rate_bps = BASE_BORROW_RATE_PER_HOUR_BPS * (hours_elapsed as u64);
        pool.cumulative_borrow_index += (pool.cumulative_borrow_index * (rate_bps as u128)) / (BPS_DENOMINATOR as u128);
        pool.last_borrow_update_time = now;
    }
    Ok(())
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 32 + 32 + 16 + 16 + 16 + 8 + 1 + 1,
        seeds = [b"pool"],
        bump
    )]
    pub pool: Account<'info, Pool>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = authority,
        seeds = [b"usdc_vault", pool.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = pool,
    )]
    pub usdc_vault: Account<'info, TokenAccount>,
    pub lp_mint: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(market_id: String)]
pub struct InitializeMarket<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 1,
        seeds = [b"market", pool.key().as_ref(), market_id.as_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    /// CHECK: Pyth price feed account
    pub pyth_feed: AccountInfo<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositLiquidity<'info> {
    #[account(mut, seeds = [b"pool"], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub lp_mint: Account<'info, Mint>,
    #[account(mut)]
    pub usdc_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_usdc: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_lp: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(side: PositionSide)]
pub struct OpenPosition<'info> {
    #[account(mut, seeds = [b"pool"], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(
        init,
        payer = trader,
        space = 8 + 32 + 32 + 1 + 8 + 8 + 8 + 16 + 8 + 1,
        seeds = [b"position", trader.key().as_ref(), market.key().as_ref(), &[match side { PositionSide::Long => 0, PositionSide::Short => 1 }]],
        bump
    )]
    pub position: Account<'info, Position>,
    #[account(mut)]
    pub usdc_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub trader_usdc: Account<'info, TokenAccount>,
    /// CHECK: Pyth price feed account
    pub pyth_feed: AccountInfo<'info>,
    #[account(mut)]
    pub trader: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClosePosition<'info> {
    #[account(mut, seeds = [b"pool"], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        close = trader,
        seeds = [b"position", trader.key().as_ref(), market.key().as_ref(), &[match position.side { PositionSide::Long => 0, PositionSide::Short => 1 }]],
        bump = position.bump
    )]
    pub position: Account<'info, Position>,
    #[account(mut)]
    pub usdc_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub trader_usdc: Account<'info, TokenAccount>,
    /// CHECK: Pyth price feed account
    pub pyth_feed: AccountInfo<'info>,
    #[account(mut)]
    pub trader: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct Pool {
    pub authority: Pubkey,
    pub usdc_mint: Pubkey,
    pub usdc_vault: Pubkey,
    pub lp_mint: Pubkey,
    pub pool_collateral_usd: u128,
    pub reserved_pool_usd: u128,
    pub cumulative_borrow_index: u128,
    pub last_borrow_update_time: i64,
    pub bump: u8,
    pub vault_bump: u8,
}

#[account]
pub struct Market {
    pub pool: Pubkey,
    pub market_id: String,
    pub pyth_feed: Pubkey,
    pub max_oi_long_usd: u64,
    pub max_oi_short_usd: u64,
    pub oi_long_usd: u64,
    pub oi_short_usd: u64,
    pub min_position_size_usd: u64,
    pub max_leverage_bps: u64,
    pub maintenance_margin_bps: u64,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
pub struct Position {
    pub trader: Pubkey,
    pub market: Pubkey,
    pub side: PositionSide,
    pub size_usd: u64,
    pub collateral_usd: u64,
    pub entry_price: u64,
    pub entry_borrow_index: u128,
    pub opened_at: i64,
    pub bump: u8,
}

#[error_code]
pub enum PerpError {
    #[msg("Amount must be greater than zero")]
    InvalidZeroAmount,
    #[msg("Market is not currently active")]
    MarketNotActive,
    #[msg("Position size is below minimum required")]
    PositionTooSmall,
    #[msg("Requested leverage exceeds maximum allowed for this market")]
    MaxLeverageExceeded,
    #[msg("Insufficient collateral provided")]
    InsufficientCollateral,
    #[msg("Invalid Pyth oracle feed account")]
    InvalidPythOracle,
    #[msg("Pyth price feed is stale")]
    StalePythPrice,
    #[msg("Unauthorized position action")]
    Unauthorized,
}
