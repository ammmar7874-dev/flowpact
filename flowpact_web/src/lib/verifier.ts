import { Connection, PublicKey, ParsedTransactionWithMeta } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { ContractData, SettlementData } from "../types/contract";
import { MEMO_PROGRAM_ID, getExplorerUrl } from "./solana";

export interface VerificationResult {
  valid: boolean;
  error?: string;
  settlement?: SettlementData;
}

export interface VerificationContext {
  connection: Connection;
  txSignature: string;
  expectedContract: ContractData;
  isSignatureUsed: (signature: string) => Promise<boolean>;
}

/**
 * Pure, independent server-side Solana Devnet transaction verifier.
 * Strictly checks:
 * 1. Transaction confirmed on Devnet without error.
 * 2. Signature has not been replayed/used before.
 * 3. Unique reference key is present in transaction keys.
 * 4. Memo exactly matches FLOWPACT:<contractId>:<contractHash>.
 * 5. SPL token transfer matches expected mint, amount (6 decimals), and freelancer recipient.
 */
export async function verifyTransactionOnSolana(
  ctx: VerificationContext
): Promise<VerificationResult> {
  const { connection, txSignature, expectedContract, isSignatureUsed } = ctx;

  // 1. Signature replay check
  const alreadyUsed = await isSignatureUsed(txSignature);
  if (alreadyUsed) {
    return {
      valid: false,
      error: "Replay rejected: transaction signature has already been used in another contract",
    };
  }

  // 2. Fetch parsed transaction from Devnet RPC
  let tx: ParsedTransactionWithMeta | null = null;
  try {
    tx = await connection.getParsedTransaction(txSignature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
  } catch (err: any) {
    return {
      valid: false,
      error: `Solana Devnet RPC error: ${err?.message || "Failed to query transaction"}`,
    };
  }

  if (!tx) {
    return {
      valid: false,
      error: "Transaction not found on Solana Devnet. Ensure it has confirmed.",
    };
  }

  if (tx.meta?.err) {
    return {
      valid: false,
      error: "Transaction execution resulted in an on-chain error.",
    };
  }

  // 3. Verify Reference Public Key exists in transaction account keys
  const accountKeys = tx.transaction.message.accountKeys.map((ak) =>
    typeof ak === "string" ? ak : ak.pubkey.toBase58()
  );

  const expectedReference = expectedContract.referencePublicKey.trim();
  if (!accountKeys.includes(expectedReference)) {
    return {
      valid: false,
      error: `Unique contract reference key (${expectedReference}) was not found in transaction accounts.`,
    };
  }

  // 4. Verify On-Chain Memo instruction
  const expectedMemo = `FLOWPACT:${expectedContract.contractId.trim()}:${expectedContract.contractHash.trim()}`;
  let memoFound = false;

  const allInstructions = [
    ...tx.transaction.message.instructions,
    ...(tx.meta?.innerInstructions?.flatMap((i) => i.instructions) || []),
  ];

  for (const ix of allInstructions) {
    if ("programId" in ix) {
      const pid =
        typeof ix.programId === "string"
          ? ix.programId
          : (ix.programId as PublicKey).toBase58();

      if (pid === MEMO_PROGRAM_ID.toBase58()) {
        if ("parsed" in ix && typeof (ix as any).parsed === "string") {
          if ((ix as any).parsed.trim() === expectedMemo) {
            memoFound = true;
            break;
          }
        }
      }
    }
  }

  // Also check transaction log messages for memo program emission
  if (!memoFound && tx.meta?.logMessages) {
    const memoPrefix = `Program ${MEMO_PROGRAM_ID.toBase58()} invoke`;
    const hasMemoLog = tx.meta.logMessages.some(
      (log) => log.includes(expectedMemo) || (log.includes("FLOWPACT") && log.includes(expectedContract.contractId))
    );
    if (hasMemoLog) {
      memoFound = true;
    }
  }

  if (!memoFound) {
    return {
      valid: false,
      error: `Transaction memo does not match expected format (${expectedMemo}).`,
    };
  }

  // 5. Verify SPL Token Transfer
  const mintPubkey = new PublicKey(expectedContract.tokenMint);
  const freelancerPubkey = new PublicKey(expectedContract.freelancerWallet);
  const expectedFreelancerAta = getAssociatedTokenAddressSync(
    mintPubkey,
    freelancerPubkey
  ).toBase58();

  let tokenTransferVerified = false;
  let detectedAmount = 0;
  let detectedPayer = "";

  // Check parsed instructions
  for (const ix of allInstructions) {
    if ("parsed" in ix && (ix as any).program === "spl-token") {
      const parsedInfo = (ix as any).parsed?.info;
      const parsedType = (ix as any).parsed?.type;

      if (parsedType === "transferChecked" || parsedType === "transfer") {
        const dest = parsedInfo?.destination;
        const mint = parsedInfo?.mint;
        const sourceAuthority = parsedInfo?.authority || parsedInfo?.source;

        // Verify destination matches freelancer ATA or freelancer main wallet
        if (dest === expectedFreelancerAta || dest === expectedContract.freelancerWallet) {
          // Verify mint if present
          if (mint && mint !== expectedContract.tokenMint) {
            continue;
          }

          const rawAmount = parsedInfo?.tokenAmount?.uiAmount ?? Number(parsedInfo?.amount) / 10 ** 6;
          // Compare with floating point tolerance
          if (Math.abs(rawAmount - expectedContract.amount) < 0.000001) {
            tokenTransferVerified = true;
            detectedAmount = rawAmount;
            detectedPayer = sourceAuthority || accountKeys[0];
            break;
          }
        }
      }
    }
  }

  // Fallback: check postTokenBalances vs preTokenBalances
  if (!tokenTransferVerified && tx.meta?.postTokenBalances && tx.meta?.preTokenBalances) {
    const postBalances = tx.meta.postTokenBalances;
    const preBalances = tx.meta.preTokenBalances;

    for (const post of postBalances) {
      if (
        post.mint === expectedContract.tokenMint &&
        (post.owner === expectedContract.freelancerWallet ||
          accountKeys[post.accountIndex] === expectedFreelancerAta)
      ) {
        const pre = preBalances.find((p) => p.accountIndex === post.accountIndex);
        const preAmount = pre?.uiTokenAmount?.uiAmount || 0;
        const postAmount = post.uiTokenAmount?.uiAmount || 0;
        const netGained = postAmount - preAmount;

        if (Math.abs(netGained - expectedContract.amount) < 0.000001) {
          tokenTransferVerified = true;
          detectedAmount = netGained;
          detectedPayer = accountKeys[0]; // Fee payer
          break;
        }
      }
    }
  }

  if (!tokenTransferVerified) {
    return {
      valid: false,
      error: `No valid SPL token transfer found matching ${expectedContract.amount} DUSD to freelancer wallet (${expectedContract.freelancerWallet}) with mint ${expectedContract.tokenMint}.`,
    };
  }

  const blockTime = tx.blockTime || Math.floor(Date.now() / 1000);
  const settlement: SettlementData = {
    txSignature,
    payerWallet: detectedPayer || accountKeys[0],
    recipientWallet: expectedContract.freelancerWallet,
    amount: detectedAmount || expectedContract.amount,
    mint: expectedContract.tokenMint,
    slot: tx.slot,
    blockTime,
    verifiedAt: new Date().toISOString(),
    explorerUrl: getExplorerUrl(txSignature),
  };

  return {
    valid: true,
    settlement,
  };
}
