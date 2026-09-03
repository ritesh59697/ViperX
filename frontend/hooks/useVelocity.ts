"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
  BASE_DECIMALS,
  DEFAULT_MARKET_INDEX,
  QUOTE_DECIMALS,
} from "@/lib/velocity";
import type { VelocityPositionView, VelocityTransactionState } from "@/types/velocity";

/**
 * `@velocity-exchange/sdk`'s browser build hard-blocks `VelocityClient` —
 * its `AnchorProvider`/`Program` throw "...not supported in the browser
 * build. Use `VelocityCore` instead." at construction time (confirmed
 * 2026-07-23, see CLAUDE.md's Gotchas). `VelocityCore` only wraps a subset
 * of instructions (deposit, orders, liquidation, etc.) — no `initialize_user`
 * or `update_user_delegate` builder exists yet ("progressively moved here
 * from VelocityClient", per the SDK's own doc comment).
 *
 * So this hook builds its own real Anchor `Program<Velocity>` — using the
 * actual `@coral-xyz/anchor` package (same one `lib/registry.ts` already
 * uses for the registry program, proven to work client-side) plus the SDK's
 * bundled IDL (`VelocityCore.defaultIdl()`) — and calls instructions
 * directly via `program.methods`, falling back to `VelocityCore`'s builders
 * only where they exist (deposit, place-and-take perp order) since those
 * already handle `remainingAccounts` encoding correctly.
 */
type VelocitySdkModule = typeof import("@velocity-exchange/sdk");
type UserAccount = import("@velocity-exchange/sdk").UserAccount;
type BN = import("@velocity-exchange/sdk").BN;

const SUB_ACCOUNT_ID = 0;
const SOL_SPOT_MARKET_INDEX = 1; // wrapped SOL — same index on devnet and mainnet-beta

function encodeName(name: string): number[] {
  const bytes = new Array(32).fill(0);
  Array.from(new TextEncoder().encode(name).slice(0, 32)).forEach((b, i) => (bytes[i] = b));
  return bytes;
}

export function useVelocity() {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();

  const [sdk, setSdk] = useState<VelocitySdkModule | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [program, setProgram] = useState<any>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [txState, setTxState] = useState<VelocityTransactionState>({
    action: null,
    status: "idle",
  });

  useEffect(() => {
    let active = true;
    import("@velocity-exchange/sdk")
      .then((module) => {
        if (active) setSdk(module);
      })
      .catch((error) => {
        console.error("Failed to load Velocity SDK", error);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!wallet || !sdk) {
      setProgram(null);
      return;
    }
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setProgram(new Program(sdk.VelocityCore.defaultIdl() as any, provider));
  }, [connection, wallet, sdk]);

  const userPda = useMemo(() => {
    if (!sdk || !program || !wallet?.publicKey) return null;
    return sdk.getUserAccountPublicKeySync(program.programId, wallet.publicKey, SUB_ACCOUNT_ID);
  }, [sdk, program, wallet?.publicKey]);

  const refreshUserAccount = useCallback(async () => {
    if (!sdk || !userPda) {
      setUserAccount(null);
      return;
    }
    try {
      const account = await sdk.VelocityCore.fetchUserAccount(connection as any, userPda);
      setUserAccount(account);
    } catch {
      setUserAccount(null);
    }
  }, [sdk, connection, userPda]);

  useEffect(() => {
    if (!sdk || !userPda) {
      setUserAccount(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    refreshUserAccount().finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [sdk, userPda, refreshUserAccount]);

  const initializeUserAccount = useCallback(async () => {
    if (!sdk || !program || !wallet?.publicKey || !userPda) {
      setTxState({
        action: "init",
        status: "error",
        error: "Connect a wallet before initializing a Velocity account.",
      });
      return;
    }

    setTxState({ action: "init", status: "signing" });
    try {
      const authority = wallet.publicKey;
      const userStatsPda = sdk.getUserStatsAccountPublicKey(program.programId, authority);
      const statePda = await sdk.getVelocityStateAccountPublicKey(program.programId);

      const tx = new Transaction();
      const userStatsInfo = await connection.getAccountInfo(userStatsPda);
      if (!userStatsInfo) {
        tx.add(
          await program.methods
            .initializeUserStats()
            .accounts({
              userStats: userStatsPda,
              state: statePda,
              authority,
              payer: authority,
              rent: SYSVAR_RENT_PUBKEY,
              systemProgram: SystemProgram.programId,
            })
            .instruction()
        );
      }
      tx.add(
        await program.methods
          .initializeUser(SUB_ACCOUNT_ID, encodeName("Main Account"))
          .accounts({
            user: userPda,
            userStats: userStatsPda,
            state: statePda,
            authority,
            payer: authority,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
          })
          .instruction()
      );

      const signature = await program.provider.sendAndConfirm(tx);
      setTxState({ action: "init", status: "confirmed", signature });
      await refreshUserAccount();
    } catch (error) {
      setTxState({
        action: "init",
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Failed to initialize Velocity account.",
      });
    }
  }, [sdk, program, wallet?.publicKey, userPda, connection, refreshUserAccount]);

  const depositSolCollateral = useCallback(
    async (amount: string) => {
      if (!sdk || !program || !wallet?.publicKey || !userPda) {
        setTxState({
          action: "deposit",
          status: "error",
          error: "Connect a wallet before depositing collateral.",
        });
        return;
      }

      if (!userAccount) {
        setTxState({
          action: "deposit",
          status: "error",
          error: "Initialize your Velocity account before depositing collateral.",
        });
        return;
      }

      const parsed = Number(amount);
      const lamports = Number.isFinite(parsed) ? Math.round(parsed * 1_000_000_000) : 0;
      if (lamports <= 0) {
        setTxState({
          action: "deposit",
          status: "error",
          error: "Enter a SOL amount greater than 0.",
        });
        return;
      }

      setTxState({ action: "deposit", status: "signing" });
      try {
        const authority = wallet.publicKey;
        const statePda = await sdk.getVelocityStateAccountPublicKey(program.programId);
        const userStatsPda = sdk.getUserStatsAccountPublicKey(program.programId, authority);
        const spotMarketPda = await sdk.getSpotMarketPublicKey(program.programId, SOL_SPOT_MARKET_INDEX);
        const spotMarketVaultPda = await sdk.getSpotMarketVaultPublicKey(
          program.programId,
          SOL_SPOT_MARKET_INDEX
        );
        const spotMarketAccount = await program.account.spotMarket.fetch(spotMarketPda);
        const tokenProgram = sdk.getTokenProgramForSpotMarket(spotMarketAccount);

        // Velocity's spot market 1 is wrapped SOL (WSOL), an ordinary SPL
        // token under the hood — depositing "native SOL" is a client-side
        // convenience VelocityClient used to do automatically. Rebuilt here
        // by hand: wrap lamports into a WSOL ATA before the deposit ix.
        const wsolAta = await getAssociatedTokenAddress(spotMarketAccount.mint, authority);

        const tx = new Transaction();
        tx.add(
          createAssociatedTokenAccountIdempotentInstruction(
            authority,
            wsolAta,
            authority,
            spotMarketAccount.mint
          )
        );
        tx.add(SystemProgram.transfer({ fromPubkey: authority, toPubkey: wsolAta, lamports }));
        tx.add(createSyncNativeInstruction(wsolAta));

        const remainingAccounts = sdk.VelocityCore.remainingAccounts.getRemainingAccounts(
          {
            getPerpMarketAccount: (idx: number) => {
              throw new Error(`unexpected perp market lookup during deposit: ${idx}`);
            },
            getSpotMarketAccount: (idx: number) => {
              if (idx === SOL_SPOT_MARKET_INDEX) return spotMarketAccount;
              throw new Error(`unexpected spot market lookup during deposit: ${idx}`);
            },
            getUserAccountAndSlot: () => undefined,
            activeSubAccountId: SUB_ACCOUNT_ID,
            authority,
            perpMarketLastSlotCache: new Map(),
            spotMarketLastSlotCache: new Map(),
            mustIncludePerpMarketIndexes: new Set(),
            mustIncludeSpotMarketIndexes: new Set(),
          },
          {
            userAccounts: [userAccount],
            writableSpotMarketIndexes: [SOL_SPOT_MARKET_INDEX],
          }
        );

        const depositIx = await sdk.VelocityCore.buildDepositInstruction({
          program,
          marketIndex: SOL_SPOT_MARKET_INDEX,
          amount: new sdk.BN(lamports),
          reduceOnly: false,
          state: statePda,
          spotMarket: spotMarketPda,
          spotMarketVault: spotMarketVaultPda,
          user: userPda,
          userStats: userStatsPda,
          userTokenAccount: wsolAta,
          authority,
          tokenProgram,
          remainingAccounts,
        });
        tx.add(depositIx);

        const signature = await program.provider.sendAndConfirm(tx);
        setTxState({ action: "deposit", status: "confirmed", signature });
        await refreshUserAccount();
      } catch (error) {
        setTxState({
          action: "deposit",
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "Failed to deposit collateral.",
        });
      }
    },
    [sdk, program, wallet?.publicKey, userPda, userAccount, refreshUserAccount]
  );

  const delegateToRuntime = useCallback(
    async (runtimeAuthority: PublicKey) => {
      if (!program || !wallet?.publicKey || !userPda) {
        setTxState({
          action: "delegate",
          status: "error",
          error: "Connect a wallet before delegating trading rights.",
        });
        return;
      }

      if (!userAccount) {
        setTxState({
          action: "delegate",
          status: "error",
          error: "Initialize your Velocity account before delegating it.",
        });
        return;
      }

      setTxState({ action: "delegate", status: "signing" });
      try {
        const signature = await program.methods
          .updateUserDelegate(SUB_ACCOUNT_ID, runtimeAuthority)
          .accounts({ user: userPda, authority: wallet.publicKey })
          .rpc();
        setTxState({ action: "delegate", status: "confirmed", signature });
        await refreshUserAccount();
      } catch (error) {
        setTxState({
          action: "delegate",
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "Failed to delegate trading rights.",
        });
      }
    },
    [program, wallet?.publicKey, userPda, userAccount, refreshUserAccount]
  );

  const openPosition = useCallback(
    async (params: {
      direction: "long" | "short";
      marketIndex: number;
      baseAmount: string;
    }) => {
      if (!sdk || !program || !wallet?.publicKey || !userPda) {
        setTxState({
          action: "open",
          status: "error",
          error: "Connect a wallet before opening a position.",
        });
        return;
      }

      if (!userAccount) {
        setTxState({
          action: "open",
          status: "error",
          error: "Initialize your Velocity account before opening a position.",
        });
        return;
      }

      const basePrecision = sdk.BASE_PRECISION.toNumber();
      const parsed = Number(params.baseAmount);
      const baseAssetAmount = new sdk.BN(
        Number.isFinite(parsed) ? Math.round(parsed * basePrecision) : 0
      );
      if (baseAssetAmount.lte(new sdk.BN(0))) {
        setTxState({
          action: "open",
          status: "error",
          error: "Enter a base size greater than 0.",
        });
        return;
      }

      setTxState({ action: "open", status: "signing" });
      try {
        const authority = wallet.publicKey;
        const statePda = await sdk.getVelocityStateAccountPublicKey(program.programId);
        const userStatsPda = sdk.getUserStatsAccountPublicKey(program.programId, authority);
        const perpMarketPda = await sdk.getPerpMarketPublicKey(program.programId, params.marketIndex);
        const perpMarketAccount = await program.account.perpMarket.fetch(perpMarketPda);
        const quoteSpotMarketPda = await sdk.getSpotMarketPublicKey(program.programId, 0);
        const quoteSpotMarketAccount = await program.account.spotMarket.fetch(quoteSpotMarketPda);

        const remainingAccounts = sdk.VelocityCore.remainingAccounts.getRemainingAccounts(
          {
            getPerpMarketAccount: (idx: number) => {
              if (idx === params.marketIndex) return perpMarketAccount;
              throw new Error(`unexpected perp market lookup during open: ${idx}`);
            },
            getSpotMarketAccount: (idx: number) => {
              if (idx === 0) return quoteSpotMarketAccount;
              throw new Error(`unexpected spot market lookup during open: ${idx}`);
            },
            getUserAccountAndSlot: () => undefined,
            activeSubAccountId: SUB_ACCOUNT_ID,
            authority,
            perpMarketLastSlotCache: new Map(),
            spotMarketLastSlotCache: new Map(),
            mustIncludePerpMarketIndexes: new Set(),
            mustIncludeSpotMarketIndexes: new Set(),
          },
          {
            userAccounts: [userAccount],
            writablePerpMarketIndexes: [params.marketIndex],
          }
        );

        const direction =
          params.direction === "long" ? sdk.PositionDirection.LONG : sdk.PositionDirection.SHORT;
        const orderParams = sdk.getOrderParams(
          sdk.getMarketOrderParams({
            marketIndex: params.marketIndex,
            baseAssetAmount,
            direction,
          })
        );

        const ix = await sdk.VelocityCore.buildPlaceAndTakePerpOrderInstruction({
          program,
          orderParams,
          optionalParams: null,
          state: statePda,
          user: userPda,
          userStats: userStatsPda,
          authority,
          remainingAccounts,
        });

        const tx = new Transaction().add(ix);
        const signature = await program.provider.sendAndConfirm(tx);
        setTxState({ action: "open", status: "confirmed", signature });
        await refreshUserAccount();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to open position.";
        const isCollateralError =
          message.includes("InsufficientCollateral") ||
          message.includes("Insufficient collateral") ||
          message.includes("0x1773");
        setTxState({
          action: "open",
          status: "error",
          error: isCollateralError
            ? "Insufficient collateral. Deposit SOL before trading."
            : message,
        });
      }
    },
    [sdk, program, wallet?.publicKey, userPda, userAccount, refreshUserAccount]
  );

  const positionView = useMemo<VelocityPositionView | null>(() => {
    if (!sdk || !userAccount) return null;

    const position = userAccount.perpPositions.find(
      (perpPosition) => perpPosition.marketIndex === DEFAULT_MARKET_INDEX
    );
    if (!position) return null;

    const baseAssetAmount = (position.baseAssetAmount ?? new sdk.BN(0)) as BN;
    const quoteAssetAmount = (position.quoteAssetAmount ?? new sdk.BN(0)) as BN;
    const direction = baseAssetAmount.gt(new sdk.BN(0))
      ? "long"
      : baseAssetAmount.lt(new sdk.BN(0))
        ? "short"
        : "flat";

    return {
      marketIndex: DEFAULT_MARKET_INDEX,
      baseAssetAmount: (
        Number(baseAssetAmount.toString()) /
        10 ** BASE_DECIMALS
      ).toFixed(6),
      quoteAssetAmount: (
        Number(quoteAssetAmount.abs().toString()) /
        10 ** QUOTE_DECIMALS
      ).toFixed(2),
      direction,
    };
  }, [sdk, userAccount]);

  return {
    wallet,
    userAccount,
    positionView,
    isInitialized: Boolean(userAccount),
    isLoading,
    txState,
    refreshUserAccount,
    initializeUserAccount,
    depositSolCollateral,
    delegateToRuntime,
    openPosition,
  };
}
