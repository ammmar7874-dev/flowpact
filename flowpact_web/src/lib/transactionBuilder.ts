import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import { MEMO_PROGRAM_ID } from "./solana";

export interface BuildPaymentTxParams {
  payerPublicKey: PublicKey;
  freelancerWallet: string;
  tokenMint: string;
  amount: number; // e.g. 250 (DUSD)
  referencePublicKey: string;
  contractId: string;
  contractHash: string;
}

/**
 * Builds a deterministic, atomic FlowPact milestone payment transaction on Solana Devnet:
 * 1. Ensures recipient Associated Token Account exists (idempotent instruction).
 * 2. Transfers exact amount of Demo USD (DUSD) from client ATA to freelancer ATA.
 * 3. Appends the unique reference public key to the transfer instruction for lookup.
 * 4. Appends the SPL Memo: FLOWPACT:<contractId>:<contractHash>.
 */
export async function buildMilestonePaymentTransaction(
  connection: Connection,
  params: BuildPaymentTxParams
): Promise<Transaction> {
  const {
    payerPublicKey,
    freelancerWallet,
    tokenMint,
    amount,
    referencePublicKey,
    contractId,
    contractHash,
  } = params;

  const mintPubkey = new PublicKey(tokenMint);
  const freelancerPubkey = new PublicKey(freelancerWallet);
  const referencePubkey = new PublicKey(referencePublicKey);

  // Compute Associated Token Addresses (ATA)
  const clientAta = getAssociatedTokenAddressSync(mintPubkey, payerPublicKey);
  const freelancerAta = getAssociatedTokenAddressSync(mintPubkey, freelancerPubkey);

  const tx = new Transaction();

  // 1. Idempotent ATA creation for freelancer (safe if already exists)
  const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    payerPublicKey,
    freelancerAta,
    freelancerPubkey,
    mintPubkey
  );
  tx.add(createAtaIx);

  // 2. TransferChecked instruction (DUSD has 6 decimals)
  const decimals = 6;
  const rawAmount = BigInt(Math.round(amount * 10 ** decimals));

  const transferIx = createTransferCheckedInstruction(
    clientAta,
    mintPubkey,
    freelancerAta,
    payerPublicKey,
    rawAmount,
    decimals
  );

  // 3. Attach reference key as non-signer, non-writable account for Solana Pay queryability
  transferIx.keys.push({
    pubkey: referencePubkey,
    isSigner: false,
    isWritable: false,
  });
  tx.add(transferIx);

  // 4. On-chain Memo instruction: FLOWPACT:<contractId>:<contractHash>
  // Strictly contains NO personal or private client/freelancer info
  const memoText = `FLOWPACT:${contractId.trim()}:${contractHash.trim()}`;
  const memoIx = new TransactionInstruction({
    keys: [{ pubkey: payerPublicKey, isSigner: true, isWritable: true }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memoText, "utf-8"),
  });
  tx.add(memoIx);

  return tx;
}
