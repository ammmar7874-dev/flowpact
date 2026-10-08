import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { ShieldCheck, CheckCircle2, AlertCircle, ExternalLink, ArrowRight } from "lucide-react";
import { buildMilestonePaymentTransaction } from "../../lib/transactionBuilder";
import { formatAddress, getExplorerUrl } from "../../lib/solana";
import { ContractData } from "../../types/contract";

export default function PaymentPage() {
  const router = useRouter();
  const { contractId } = router.query;
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [contract, setContract] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Payment states: idle | signing | submitting | verifying | confirmed | failed
  const [payState, setPayState] = useState<string>("idle");
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");

  useEffect(() => {
    if (!contractId || typeof contractId !== "string") return;

    fetch(`/api/contracts/${contractId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.contract) {
          setContract(data.contract);
          if (data.contract.status === "CONFIRMED") {
            setPayState("confirmed");
            setTxSignature(data.contract.settlement?.txSignature || null);
          }
        } else {
          setError(data.error || "Contract not found");
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [contractId]);

  const handlePay = async () => {
    if (!contract || !publicKey) return;

    try {
      setPayState("signing");
      setStatusMessage("Preparing atomic transaction on Solana Devnet...");

      const tx = await buildMilestonePaymentTransaction(connection, {
        payerPublicKey: publicKey,
        freelancerWallet: contract.freelancerWallet,
        tokenMint: contract.tokenMint,
        amount: contract.amount,
        referencePublicKey: contract.referencePublicKey,
        contractId: contract.contractId,
        contractHash: contract.contractHash,
      });

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      setStatusMessage("Please approve transaction in your wallet...");
      const signature = await sendTransaction(tx, connection);

      setPayState("submitting");
      setTxSignature(signature);
      setStatusMessage("Transaction broadcasted. Awaiting on-chain confirmation...");

      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      // CRITICAL ARCHITECTURE RULE:
      // Independent server-side verification. The client does NOT mark status confirmed.
      setPayState("verifying");
      setStatusMessage("Verifying transaction independently on FlowPact server...");

      const verifyRes = await fetch("/api/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: contract.contractId,
          txSignature: signature,
        }),
      });

      const verifyData = await verifyRes.json();

      if (verifyData.success) {
        setPayState("confirmed");
        setStatusMessage("Verified on Solana Devnet!");
        setContract((prev) =>
          prev ? { ...prev, status: "CONFIRMED", settlement: verifyData.settlement } : null
        );
      } else {
        setPayState("failed");
        setError(verifyData.message || "Server verification failed");
      }
    } catch (err: any) {
      console.error(err);
      setPayState("failed");
      setError(err?.message || "Transaction failed");
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 640, margin: "80px auto", textAlign: "center", color: "var(--text-muted)" }}>
        Loading contract details...
      </div>
    );
  }

  if (error && !contract) {
    return (
      <div style={{ maxWidth: 640, margin: "80px auto", padding: 20 }}>
        <div className="glass-card" style={{ padding: 30, textAlign: "center" }}>
          <AlertCircle size={40} color="#ef4444" style={{ margin: "0 auto 16px" }} />
          <h2>Unable to Load Contract</h2>
          <p style={{ color: "var(--text-muted)", marginTop: 8 }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: "40px auto", padding: "0 20px" }}>
      <Head>
        <title>Pay Milestone — {contract?.projectTitle}</title>
      </Head>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldCheck size={28} color="#14F195" />
          <span style={{ fontSize: "1.2rem", fontWeight: 700 }}>FlowPact</span>
        </Link>
        <span className="devnet-badge">Demo USD · Devnet Test Token</span>
      </header>

      <div className="glass-card" style={{ padding: 32, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Milestone Payment Request
            </span>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginTop: 4 }}>{contract?.projectTitle}</h1>
          </div>
          <span className={`status-badge ${contract?.status === "CONFIRMED" ? "status-confirmed" : "status-pending"}`}>
            {contract?.status === "CONFIRMED" ? "PAID" : "PENDING"}
          </span>
        </div>

        <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: 24 }}>
          {contract?.scopeDescription}
        </p>

        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Client:</span>
            <span style={{ fontWeight: 500 }}>{contract?.clientName}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Freelancer Recipient:</span>
            <span style={{ fontFamily: "monospace", fontSize: "0.9rem" }}>
              {formatAddress(contract?.freelancerWallet || "", 6)}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Contract Reference:</span>
            <span style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "#c084fc" }}>
              {contract?.contractId}
            </span>
          </div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "14px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600 }}>Amount Due:</span>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: "1.8rem", fontWeight: 800, color: "#14F195" }}>
                {contract?.amount}
              </span>
              <span style={{ fontSize: "1rem", fontWeight: 600, color: "#c084fc", marginLeft: 6 }}>
                DUSD
              </span>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                Demo USD — Solana Devnet Test Token
              </div>
            </div>
          </div>
        </div>

        {/* Action Panel */}
        {payState === "confirmed" ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#14F195", fontWeight: 600, fontSize: "1.1rem", marginBottom: 12 }}>
              <CheckCircle2 size={24} />
              Payment Verified on Solana Devnet
            </div>
            {txSignature && (
              <div style={{ marginBottom: 20 }}>
                <a
                  href={getExplorerUrl(txSignature)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{ display: "inline-flex", fontSize: "0.85rem" }}
                >
                  View on Solana Explorer <ExternalLink size={14} />
                </a>
              </div>
            )}
            <div>
              <Link href={`/verify/${txSignature}`} className="btn-primary" style={{ width: "auto" }}>
                View Cryptographic Proof Receipt <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <WalletMultiButton style={{ background: "rgba(255,255,255,0.08)", borderRadius: 10, height: 42 }} />
            </div>

            {connected ? (
              <button
                onClick={handlePay}
                disabled={payState !== "idle" && payState !== "failed"}
                className="btn-primary"
                style={{ height: 50, fontSize: "1.05rem" }}
              >
                {payState === "idle" || payState === "failed" ? "Approve & Pay Milestone (Test DUSD)" : statusMessage}
              </button>
            ) : (
              <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem", padding: 12 }}>
                Please connect your Phantom or Solflare wallet on Devnet to approve payment.
              </div>
            )}

            {error && (
              <div style={{ marginTop: 14, color: "#ef4444", fontSize: "0.85rem", textAlign: "center" }}>
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem", lineHeight: 1.5 }}>
        FlowPact uses near-zero Solana network fees with no real-money cost during the Devnet demo.
      </div>
    </div>
  );
}
