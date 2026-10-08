import type { NextApiRequest, NextApiResponse } from "next";
import { contractStore } from "../../lib/firebaseAdmin";
import { getSolanaDevnetConnection } from "../../lib/solana";
import { verifyTransactionOnSolana } from "../../lib/verifier";
import { VerifyPaymentRequest, VerifyPaymentResponse } from "../../types/contract";

/**
 * POST /api/verify-payment
 * 
 * SECURE SERVER-SIDE VERIFICATION ENDPOINT
 * 
 * Never trusts the browser state. Independently:
 * 1. Reads contract from Firestore.
 * 2. Fetches transaction directly from Solana Devnet RPC.
 * 3. Verifies confirmed status, amount, mint, recipient ATA, reference key, and memo hash.
 * 4. Rejects signature replay.
 * 5. Updates contract status to CONFIRMED only upon full verification.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VerifyPaymentResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { contractId, txSignature }: VerifyPaymentRequest = req.body;

  if (!contractId || !txSignature) {
    return res.status(400).json({
      success: false,
      message: "contractId and txSignature are required in request body",
    });
  }

  try {
    // 1. Fetch expected contract from Firestore
    const contract = await contractStore.getContract(contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: `Contract ${contractId} was not found in database`,
      });
    }

    if (contract.status === "CONFIRMED") {
      return res.status(200).json({
        success: true,
        message: "Contract is already verified and confirmed",
        contractId: contract.contractId,
        settlement: contract.settlement,
      });
    }

    // 2. Independent Solana Devnet verification
    const connection = getSolanaDevnetConnection();

    const result = await verifyTransactionOnSolana({
      connection,
      txSignature: txSignature.trim(),
      expectedContract: contract,
      isSignatureUsed: (sig) => contractStore.isSignatureUsed(sig),
    });

    if (!result.valid || !result.settlement) {
      return res.status(400).json({
        success: false,
        message: result.error || "On-chain transaction verification failed",
      });
    }

    // 3. Persist verified settlement in database
    await contractStore.updateSettlement(contractId, result.settlement);
    await contractStore.recordSignature(txSignature.trim());

    return res.status(200).json({
      success: true,
      message: "Payment successfully verified on Solana Devnet",
      contractId: contract.contractId,
      settlement: result.settlement,
    });
  } catch (err: any) {
    console.error("[ERROR] Verification handler failed:", err);
    return res.status(500).json({
      success: false,
      message: `Internal verification error: ${err?.message || "Unknown error"}`,
    });
  }
}
