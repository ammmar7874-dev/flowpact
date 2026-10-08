import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { ShieldCheck, CheckCircle2, AlertCircle, ExternalLink, QrCode } from "lucide-react";
import { formatAddress, getExplorerUrl, getSolanaDevnetConnection, MEMO_PROGRAM_ID } from "../../lib/solana";
import { createContractHash } from "../../lib/hash";
import { ContractData } from "../../types/contract";

export default function VerificationPage() {
  const router = useRouter();
  const { signature } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [onChainData, setOnChainData] = useState<{
    signature: string;
    blockTime: number;
    slot: number;
    memo: string;
    contractId: string;
    contractHash: string;
    payer: string;
  } | null>(null);

  const [matchedContract, setMatchedContract] = useState<ContractData | null>(null);
  const [hashMatches, setHashMatches] = useState<boolean>(false);

  useEffect(() => {
    if (!signature || typeof signature !== "string") return;

    const verify = async () => {
      try {
        setLoading(true);
        const connection = getSolanaDevnetConnection();
        const tx = await connection.getParsedTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        });

        if (!tx) {
          setError("Transaction was not found on Solana Devnet");
          return;
        }

        if (tx.meta?.err) {
          setError("Transaction resulted in an on-chain execution error");
          return;
        }

        // Extract Memo
        const allIxs = [
          ...tx.transaction.message.instructions,
          ...(tx.meta?.innerInstructions?.flatMap((i) => i.instructions) || []),
        ];

        let rawMemo = "";
        for (const ix of allIxs) {
          if ("programId" in ix) {
            const pid = typeof ix.programId === "string" ? ix.programId : ix.programId.toBase58();
            if (pid === MEMO_PROGRAM_ID.toBase58()) {
              if ("parsed" in ix && typeof (ix as any).parsed === "string") {
                rawMemo = (ix as any).parsed;
                break;
              }
            }
          }
        }

        if (!rawMemo && tx.meta?.logMessages) {
          const log = tx.meta.logMessages.find((l) => l.includes("FLOWPACT"));
          if (log) {
            const match = log.match(/FLOWPACT:[^\s"]+/);
            if (match) rawMemo = match[0];
          }
        }

        const parts = rawMemo.split(":");
        const contractId = parts[1] || "Unknown";
        const contractHash = parts[2] || "Unknown";

        const accountKeys = tx.transaction.message.accountKeys.map((ak) =>
          typeof ak === "string" ? ak : ak.pubkey.toBase58()
        );

        const parsed = {
          signature,
          blockTime: tx.blockTime || Math.floor(Date.now() / 1000),
          slot: tx.slot,
          memo: rawMemo,
          contractId,
          contractHash,
          payer: accountKeys[0] || "Unknown",
        };

        setOnChainData(parsed);

        // Fetch database contract to verify hash integrity
        if (contractId && contractId !== "Unknown") {
          const res = await fetch(`/api/contracts/${contractId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.contract) {
              setMatchedContract(data.contract);
              const computedHash = createContractHash(data.contract);
              if (computedHash.toLowerCase() === contractHash.toLowerCase()) {
                setHashMatches(true);
              }
            }
          }
        }
      } catch (err: any) {
        setError(err?.message || "Failed to query Solana Devnet");
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [signature]);

  if (loading) {
    return (
      <div style={{ maxWidth: 640, margin: "80px auto", textAlign: "center", color: "var(--text-muted)" }}>
        Querying Solana Devnet RPC verification...
      </div>
    );
  }

  if (error || !onChainData) {
    return (
      <div style={{ maxWidth: 640, margin: "80px auto", padding: 20 }}>
        <div className="glass-card" style={{ padding: 30, textAlign: "center" }}>
          <AlertCircle size={40} color="#ef4444" style={{ margin: "0 auto 16px" }} />
          <h2>Verification Failed</h2>
          <p style={{ color: "var(--text-muted)", marginTop: 8 }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: "40px auto", padding: "0 20px" }}>
      <Head>
        <title>On-Chain Verification — FlowPact</title>
      </Head>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldCheck size={28} color="#14F195" />
          <span style={{ fontSize: "1.2rem", fontWeight: 700 }}>FlowPact</span>
        </Link>
        <span className="devnet-badge">Solana Devnet Proof</span>
      </header>

      <div className="glass-card" style={{ padding: 32, marginBottom: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#14F195", fontWeight: 700, fontSize: "1.3rem" }}>
            <CheckCircle2 size={28} />
            Verified on Solana Devnet
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: 6 }}>
            Cryptographic Transaction Settlement Audit
          </p>
        </div>

        {hashMatches && (
          <div
            style={{
              background: "rgba(20, 241, 149, 0.12)",
              border: "1px solid rgba(20, 241, 149, 0.3)",
              color: "#14F195",
              padding: "12px 16px",
              borderRadius: 10,
              fontSize: "0.9rem",
              fontWeight: 600,
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            ✓ Contract Record Matches On-Chain Proof
          </div>
        )}

        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Network:</span>
            <span style={{ fontWeight: 600, color: "#c084fc" }}>Solana Devnet</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Block Time:</span>
            <span style={{ fontSize: "0.85rem" }}>
              {new Date(onChainData.blockTime * 1000).toUTCString()}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Payer:</span>
            <span style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
              {formatAddress(onChainData.payer, 6)}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Contract Reference ID:</span>
            <span style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "#38bdf8" }}>
              {onChainData.contractId}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>On-Chain Hash:</span>
            <span style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              {formatAddress(onChainData.contractHash, 8)}
            </span>
          </div>
          {matchedContract && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Verified Amount:</span>
              <span style={{ fontWeight: 700, color: "#14F195" }}>
                {matchedContract.amount} DUSD
              </span>
            </div>
          )}
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "14px 0" }} />
          <div>
            <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", display: "block", marginBottom: 4 }}>
              Transaction Signature:
            </span>
            <span style={{ fontFamily: "monospace", fontSize: "0.75rem", wordBreak: "break-all", color: "#9ca3af" }}>
              {onChainData.signature}
            </span>
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <a
            href={getExplorerUrl(onChainData.signature)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ display: "inline-flex" }}
          >
            Inspect on Solana Explorer <ExternalLink size={14} />
          </a>
        </div>
      </div>

      <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.75rem", lineHeight: 1.5 }}>
        Note: This document represents a cryptographic on-chain transaction settlement audit on Solana Devnet. It does not constitute government, bank, embassy, or tax certification.
      </div>
    </div>
  );
}
