import crypto from "crypto";
import { ContractData } from "../types/contract";

/**
 * Creates a deterministic SHA-256 hash of canonical contract fields.
 * Ensures off-chain deliverables and contract terms cannot be tampered with after creation.
 */
export function generateContractHash(contract: {
  contractId?: string;
  projectTitle: string;
  scopeDescription: string;
  clientName: string;
  amount: number;
  tokenSymbol?: string;
  tokenMint: string;
  freelancerWallet: string;
  referencePublicKey: string;
}): string {
  const canonicalString = [
    (contract.contractId || "").trim(),
    contract.projectTitle,
    contract.scopeDescription,
    contract.clientName.trim(),
    contract.amount.toFixed(6),
    (contract.tokenSymbol || "DUSD").trim().toUpperCase(),
    contract.tokenMint.trim(),
    contract.freelancerWallet.trim(),
    contract.referencePublicKey.trim(),
  ].join("|");

  return crypto.createHash("sha256").update(canonicalString, "utf8").digest("hex");
}

export const createContractHash = generateContractHash;

/**
 * Verifies if an existing contract's canonical data matches its stored hash.
 */
export function verifyContractHash(contract: any, expectedHash?: string): boolean {
  const hashToCompare = expectedHash || (contract as ContractData).contractHash;
  if (!hashToCompare) return false;
  const computed = generateContractHash(contract);
  return computed.toLowerCase() === hashToCompare.toLowerCase();
}
