import type { NextApiRequest, NextApiResponse } from "next";
import { PublicKey, Keypair } from "@solana/web3.js";
import crypto from "crypto";
import { contractStore } from "../../../lib/firebaseAdmin";
import { createContractHash } from "../../../lib/hash";
import { DEFAULT_DUSD_MINT } from "../../../lib/solana";
import { ContractData } from "../../../types/contract";

const ALLOWED_FIELDS = new Set([
  "projectTitle",
  "scopeDescription",
  "clientName",
  "amount",
  "freelancerWallet",
]);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ success: false, error: "Invalid JSON request body" });
    }

    // 1. Reject extra unsafe fields
    const bodyKeys = Object.keys(req.body);
    for (const key of bodyKeys) {
      if (!ALLOWED_FIELDS.has(key)) {
        return res.status(400).json({
          success: false,
          error: `Unrecognized or unsafe field: '${key}'`,
        });
      }
    }

    const {
      projectTitle,
      scopeDescription,
      clientName,
      amount,
      freelancerWallet,
    } = req.body;

    // 2. Validate projectTitle
    if (typeof projectTitle !== "string" || !projectTitle.trim()) {
      return res.status(400).json({
        success: false,
        error: "projectTitle is required and must be a non-empty string",
      });
    }

    // 3. Validate scopeDescription
    if (typeof scopeDescription !== "string" || !scopeDescription.trim()) {
      return res.status(400).json({
        success: false,
        error: "scopeDescription is required and must be a non-empty string",
      });
    }

    // 4. Validate clientName
    if (typeof clientName !== "string" || !clientName.trim()) {
      return res.status(400).json({
        success: false,
        error: "clientName is required and must be a non-empty string",
      });
    }

    // 5. Validate amount
    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || !isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: "amount must be a valid number greater than 0",
      });
    }

    // 6. Validate freelancerWallet is a valid Solana public key
    if (typeof freelancerWallet !== "string" || !freelancerWallet.trim()) {
      return res.status(400).json({
        success: false,
        error: "freelancerWallet is required",
      });
    }

    const trimmedWallet = freelancerWallet.trim();
    try {
      const pubkey = new PublicKey(trimmedWallet);
      if (!PublicKey.isOnCurve(pubkey.toBuffer())) {
        return res.status(400).json({
          success: false,
          error: "freelancerWallet is not a valid Solana public key (off curve)",
        });
      }
    } catch {
      return res.status(400).json({
        success: false,
        error: "freelancerWallet must be a valid base58 Solana public key",
      });
    }

    // 7. Server generates contract parameters
    const randomSuffix = crypto.randomBytes(4).toString("hex");
    const contractId = `fp_${Date.now().toString(36)}_${randomSuffix}`;
    const referencePublicKey = Keypair.generate().publicKey.toBase58();
    const tokenMint =
      process.env.NEXT_PUBLIC_DUSD_MINT?.trim() || DEFAULT_DUSD_MINT;
    const tokenSymbol = "DUSD";

    const contractHash = createContractHash({
      contractId,
      projectTitle,
      scopeDescription,
      clientName: clientName.trim(),
      amount: parsedAmount,
      tokenSymbol,
      tokenMint,
      freelancerWallet: trimmedWallet,
      referencePublicKey,
    });

    const newContract: ContractData = {
      contractId,
      projectTitle,
      scopeDescription,
      clientName: clientName.trim(),
      amount: parsedAmount,
      tokenSymbol,
      tokenMint,
      freelancerWallet: trimmedWallet,
      status: "PENDING",
      contractHash,
      referencePublicKey,
      createdAt: new Date().toISOString(),
    };

    // 8. Write using Firebase Admin only
    await contractStore.saveContract(newContract);

    return res.status(201).json({
      success: true,
      contract: newContract,
      payUrl: `/pay/${contractId}`,
      fullPayUrl: `${(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").trim().replace(/\/+$/, "")}/pay/${contractId}`,
    });
  } catch (err: any) {
    console.error("[ERROR] Failed to create contract:", err?.message || err);
    return res.status(500).json({
      success: false,
      error: "Internal server error creating contract",
    });
  }
}
