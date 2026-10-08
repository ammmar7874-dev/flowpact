import type { NextApiRequest, NextApiResponse } from "next";
import { contractStore } from "../../../lib/firebaseAdmin";
import createContractHandler from "./create";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    try {
      const contracts = await contractStore.listContracts();
      // Return safe public contract information only
      const safeContracts = contracts.map((c) => ({
        contractId: c.contractId,
        projectTitle: c.projectTitle,
        scopeDescription: c.scopeDescription,
        clientName: c.clientName,
        amount: c.amount,
        tokenSymbol: c.tokenSymbol,
        tokenMint: c.tokenMint,
        freelancerWallet: c.freelancerWallet,
        status: c.status,
        contractHash: c.contractHash,
        referencePublicKey: c.referencePublicKey,
        createdAt: c.createdAt,
        settlement: c.settlement || null,
      }));

      return res.status(200).json({
        success: true,
        contracts: safeContracts,
      });
    } catch (err: any) {
      console.error("[ERROR] Failed to list contracts:", err?.message || err);
      return res.status(500).json({
        success: false,
        error: "Internal server error listing contracts",
      });
    }
  }

  if (req.method === "POST") {
    // Delegate to validated create handler
    return createContractHandler(req, res);
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
