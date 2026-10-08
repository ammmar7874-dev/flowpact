/**
 * FlowPact - Demo USD (DUSD) Devnet Token Mint Generator
 * 
 * IMPORTANT SAFETY RULES:
 * - This script is for Solana Devnet ONLY.
 * - DUSD is a valueless demo token for testing and hackathon evaluation.
 * - DO NOT run on mainnet.
 * - DO NOT expose or commit private keys.
 */

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("=================================================");
  console.log("  FlowPact: Demo USD (DUSD) Mint Creation Script");
  console.log("  Network: Solana Devnet");
  console.log("=================================================\n");

  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  // Generate or load authority keypair (saved locally, ignored by git)
  const keypairPath = path.join(__dirname, "demo-authority-keypair.json");
  let payer: Keypair;

  if (fs.existsSync(keypairPath)) {
    const raw = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
    payer = Keypair.fromSecretKey(new Uint8Array(raw));
    console.log(`[+] Loaded existing authority keypair: ${payer.publicKey.toBase58()}`);
  } else {
    payer = Keypair.generate();
    fs.writeFileSync(keypairPath, JSON.stringify(Array.from(payer.secretKey)));
    console.log(`[+] Generated fresh authority keypair: ${payer.publicKey.toBase58()}`);
    console.log(`[i] Keypair saved locally to demo-authority-keypair.json (git-ignored).`);
  }

  // Check balance
  const balance = await connection.getBalance(payer.publicKey);
  console.log(`[i] Current Devnet SOL balance: ${balance / LAMPORTS_PER_SOL} SOL`);

  if (balance < LAMPORTS_PER_SOL * 0.5) {
    console.log("[*] Requesting 1 Devnet SOL airdrop...");
    try {
      const sig = await connection.requestAirdrop(payer.publicKey, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig);
      console.log("[+] Airdrop confirmed.");
    } catch (err) {
      console.error("[!] Airdrop request failed. Please fund this address manually using https://faucet.solana.com");
      console.log(`    Address: ${payer.publicKey.toBase58()}`);
      return;
    }
  }

  console.log("\n[*] Creating Demo USD (DUSD) mint (Decimals: 6)...");
  const mint = await createMint(
    connection,
    payer,
    payer.publicKey,
    payer.publicKey,
    6 // 6 decimals (standard USD representation)
  );

  console.log(`[+] SUCCESS! Demo USD Mint Created: ${mint.toBase58()}`);

  console.log("[*] Creating Associated Token Account for authority...");
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey
  );

  console.log(`[+] Authority ATA: ${ata.address.toBase58()}`);

  console.log("[*] Minting 50,000 DUSD test balance...");
  const mintAmount = 50_000 * 10 ** 6; // 50,000 DUSD
  await mintTo(connection, payer, mint, ata.address, payer.publicKey, mintAmount);
  console.log("[+] Minted 50,000 DUSD to authority ATA.");

  console.log("\n=================================================");
  console.log("  INSTRUCTIONS FOR CONFIGURING flowpact_web");
  console.log("=================================================");
  console.log("Add the following line to your flowpact_web/.env.local file:");
  console.log(`NEXT_PUBLIC_DUSD_MINT="${mint.toBase58()}"`);
  console.log('NEXT_PUBLIC_SOLANA_NETWORK="devnet"');
  console.log("=================================================\n");
}

main().catch((err) => {
  console.error("Execution failed:", err);
  process.exit(1);
});
