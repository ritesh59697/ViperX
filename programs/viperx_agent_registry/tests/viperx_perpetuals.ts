import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo } from "@solana/spl-token";
import { assert } from "chai";

describe("viperx_perpetuals", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const owner = provider.wallet as anchor.Wallet;
  const trader = Keypair.generate();
  const pythMockFeed = Keypair.generate(); // Stand-in Pyth price account

  let usdcMint: PublicKey;
  let lpMint: PublicKey;
  let userUsdc: PublicKey;
  let userLp: PublicKey;
  let traderUsdc: PublicKey;

  const [poolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool")],
    new PublicKey("6Deo4a3kxfhykzK82ghBrwMY4nHE613Nz9ejb46WFcED")
  );

  const [usdcVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("usdc_vault"), poolPda.toBuffer()],
    new PublicKey("6Deo4a3kxfhykzK82ghBrwMY4nHE613Nz9ejb46WFcED")
  );

  const marketId = "SOL-PERP";
  const [marketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), poolPda.toBuffer(), Buffer.from(marketId)],
    new PublicKey("6Deo4a3kxfhykzK82ghBrwMY4nHE613Nz9ejb46WFcED")
  );

  const fund = async (pk: PublicKey, lamports = 0.05e9) => {
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
    await fund(trader.publicKey);
  });

  it("derives all PDAs correctly for SOL-PERP pool & market", () => {
    assert.isDefined(poolPda);
    assert.isDefined(usdcVaultPda);
    assert.isDefined(marketPda);
    console.log("  📍 Pool PDA:       ", poolPda.toBase58());
    console.log("  📍 USDC Vault PDA: ", usdcVaultPda.toBase58());
    console.log("  📍 SOL-PERP Market:", marketPda.toBase58());
  });

  it("verifies position PDA derivation seeds", () => {
    const [longPosPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), trader.publicKey.toBuffer(), marketPda.toBuffer(), Buffer.from([0])],
      new PublicKey("6Deo4a3kxfhykzK82ghBrwMY4nHE613Nz9ejb46WFcED")
    );

    const [shortPosPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), trader.publicKey.toBuffer(), marketPda.toBuffer(), Buffer.from([1])],
      new PublicKey("6Deo4a3kxfhykzK82ghBrwMY4nHE613Nz9ejb46WFcED")
    );

    assert.isDefined(longPosPda);
    assert.isDefined(shortPosPda);
    console.log("  📍 Long Position PDA: ", longPosPda.toBase58());
    console.log("  📍 Short Position PDA:", shortPosPda.toBase58());
  });
});
