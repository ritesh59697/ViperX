import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { assert } from "chai";
import { ViperxAgentRegistry } from "../target/types/viperx_agent_registry";

describe("viperx_agent_registry", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .ViperxAgentRegistry as Program<ViperxAgentRegistry>;

  const owner = provider.wallet as anchor.Wallet;
  const agentId = "agent-" + Math.floor(Math.random() * 1000000);
  const vaultPubkey = Keypair.generate().publicKey; // stand-in for a real Drift vault pubkey

  // Stands in for the execution runtime's key: signs record_trade, owns nothing.
  const backend = Keypair.generate();

  const [agentPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), owner.publicKey.toBuffer(), Buffer.from(agentId)],
    program.programId
  );

  // Funds a keypair by transferring from the already-funded provider wallet,
  // rather than requestAirdrop — devnet's faucet throttles/errors hard enough
  // to make tests flaky (see CLAUDE.md). This works identically against the
  // local validator and real devnet.
  const fund = async (pk: PublicKey, lamports = 0.02e9) => {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: owner.publicKey,
        toPubkey: pk,
        lamports,
      })
    );
    await provider.sendAndConfirm(tx);
  };

  before(async () => {
    await fund(backend.publicKey);
  });

  it("registers a new agent", async () => {
    await program.methods
      .registerAgent(agentId, "Momentum Bot", "ipfs://strategy-metadata", vaultPubkey)
      .accounts({
        owner: owner.publicKey,
        agent: agentPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const agent = await program.account.agent.fetch(agentPda);
    assert.equal(agent.name, "Momentum Bot");
    assert.equal(agent.tradeCount.toNumber(), 0);
    assert.equal(agent.leaderboardEligible, false);
    assert.deepEqual(agent.status, { active: {} });
    // authority defaults to the owner until delegated
    assert.equal(agent.authority.toBase58(), owner.publicKey.toBase58());
  });

  it("lets the owner delegate record_trade authority to a backend key", async () => {
    await program.methods
      .setAuthority(backend.publicKey)
      .accounts({ owner: owner.publicKey, agent: agentPda })
      .rpc();

    const agent = await program.account.agent.fetch(agentPda);
    assert.equal(agent.authority.toBase58(), backend.publicKey.toBase58());
  });

  it("records trades from the backend authority, without the owner signing", async () => {
    // The whole point: this key is not the owner and holds no owner rights.
    for (let i = 0; i < 50; i++) {
      await program.methods
        .recordTrade()
        .accounts({ authority: backend.publicKey, agent: agentPda })
        .signers([backend])
        .rpc();
    }

    const agent = await program.account.agent.fetch(agentPda);
    assert.equal(agent.tradeCount.toNumber(), 50);
    assert.equal(agent.leaderboardEligible, true);
  });

  it("rejects record_trade from a key that is not the authority", async () => {
    const intruder = Keypair.generate();
    await fund(intruder.publicKey);

    try {
      await program.methods
        .recordTrade()
        .accounts({ authority: intruder.publicKey, agent: agentPda })
        .signers([intruder])
        .rpc();
      assert.fail("expected a rejection error");
    } catch (err) {
      assert.include(err.toString(), "Unauthorized");
    }
  });

  it("does not let the record_trade authority pause the agent", async () => {
    // The delegated backend key must not gain owner powers.
    try {
      await program.methods
        .setStatus({ retired: {} })
        .accounts({ owner: backend.publicKey, agent: agentPda })
        .signers([backend])
        .rpc();
      assert.fail("expected a rejection error");
    } catch (err) {
      const e = err.toString();
      assert.isTrue(
        e.includes("Unauthorized") ||
          e.includes("ConstraintSeeds") ||
          e.includes("AccountNotInitialized"),
        `expected rejection, got: ${e}`
      );
    }
  });

  it("lets the record_trade authority pause the agent via authority_pause, one-directionally", async () => {
    // The delegated backend key gets exactly one extra power: Active -> Paused.
    await program.methods
      .authorityPause()
      .accounts({ authority: backend.publicKey, agent: agentPda })
      .signers([backend])
      .rpc();

    const agent = await program.account.agent.fetch(agentPda);
    assert.deepEqual(agent.status, { paused: {} });
  });

  it("rejects authority_pause on an agent that isn't Active", async () => {
    try {
      await program.methods
        .authorityPause()
        .accounts({ authority: backend.publicKey, agent: agentPda })
        .signers([backend])
        .rpc();
      assert.fail("expected a rejection error");
    } catch (err) {
      assert.include(err.toString(), "NotActive");
    }
  });

  it("rejects authority_pause from a key that is not the authority", async () => {
    const intruder = Keypair.generate();
    await fund(intruder.publicKey);

    try {
      await program.methods
        .authorityPause()
        .accounts({ authority: intruder.publicKey, agent: agentPda })
        .signers([intruder])
        .rpc();
      assert.fail("expected a rejection error");
    } catch (err) {
      assert.include(err.toString(), "Unauthorized");
    }
  });

  it("lets the owner reactivate the agent after an authority_pause — the authority can't do this itself", async () => {
    await program.methods
      .setStatus({ active: {} })
      .accounts({ owner: owner.publicKey, agent: agentPda })
      .rpc();

    const agent = await program.account.agent.fetch(agentPda);
    assert.deepEqual(agent.status, { active: {} });
  });

  it("lets the owner pause the agent", async () => {
    await program.methods
      .setStatus({ paused: {} })
      .accounts({ owner: owner.publicKey, agent: agentPda })
      .rpc();

    const agent = await program.account.agent.fetch(agentPda);
    assert.deepEqual(agent.status, { paused: {} });
  });

  it("rejects updates from a non-owner", async () => {
    const intruder = Keypair.generate();

    try {
      await program.methods
        .setStatus({ retired: {} })
        .accounts({ owner: intruder.publicKey, agent: agentPda })
        .signers([intruder])
        .rpc();
      assert.fail("expected a rejection error");
    } catch (err) {
      const errStr = err.toString();
      const isRejected =
        errStr.includes("Unauthorized") ||
        errStr.includes("AccountNotInitialized") ||
        errStr.includes("ConstraintSeeds");
      assert.isTrue(
        isRejected,
        `Expected rejection error (Unauthorized, AccountNotInitialized, or ConstraintSeeds), got: ${errStr}`
      );
    }
  });
});
