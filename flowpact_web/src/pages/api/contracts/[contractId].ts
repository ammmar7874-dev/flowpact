import type { NextApiRequest, NextApiResponse } from "next";
import { contractStore } from "../../../lib/firebaseAdmin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { contractId } = req.query;

  if (typeof contractId !== "string" || !contractId.trim()) {
    return res.status(400).json({ success: false, error: "Invalid contractId parameter" });
  }

  try {
    const contract = await contractStore.getContract(contractId.trim());
    if (!contract) {
      return res.status(404).json({ success: false, error: "Contract not found" });
    }

    // Return safe public contract data needed by payment and verifier pages
    return res.status(200).json({
      success: true,
      contract: {
        contractId: contract.contractId,
        projectTitle: contract.projectTitle,
        scopeDescription: contract.scopeDescription,
        clientName: contract.clientName,
        amount: contract.amount,
        tokenSymbol: contract.tokenSymbol,
        tokenMint: contract.tokenMint,
        freelancerWallet: contract.freelancerWallet,
        status: contract.status,
        contractHash: contract.contractHash,
        referencePublicKey: contract.referencePublicKey,
        createdAt: contract.createdAt,
        settlement: contract.settlement || null,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: "Internal server error retrieving contract",
    });
  }
}
