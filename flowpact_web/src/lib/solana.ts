import { Connection, PublicKey } from "@solana/web3.js";

// Official SPL Memo Program ID v2
export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

// Fallback Demo USD mint on Devnet if environment variable is not yet configured
export const DEFAULT_DUSD_MINT =
  process.env.NEXT_PUBLIC_DUSD_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export const DEVNET_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export function getSolanaDevnetConnection(): Connection {
  return new Connection(DEVNET_RPC_URL, "confirmed");
}

export function formatAddress(address: string, chars = 4): string {
  if (!address || address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function getExplorerUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}
