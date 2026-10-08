export type ContractStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

export interface SettlementData {
  txSignature: string;
  payerWallet: string;
  recipientWallet: string;
  amount: number;
  mint: string;
  slot: number;
  blockTime: number;
  verifiedAt: string;
  explorerUrl: string;
}

export interface ContractData {
  contractId: string;
  projectTitle: string;
  scopeDescription: string;
  clientName: string;
  amount: number;
  tokenSymbol: string; // "DUSD"
  tokenMint: string;
  freelancerWallet: string;
  status: ContractStatus;
  contractHash: string;
  referencePublicKey: string;
  createdAt: string;
  settlement?: SettlementData;
}

export interface VerifyPaymentRequest {
  contractId: string;
  txSignature: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  message: string;
  contractId?: string;
  settlement?: SettlementData;
}
