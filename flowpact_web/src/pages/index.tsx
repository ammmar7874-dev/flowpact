import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { ShieldCheck, ArrowRight, CheckCircle2, Copy } from "lucide-react";

export default function Home() {
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Quick demo contract generator for evaluation
  const handleCreateDemo = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectTitle: "Solana Mobile Wallet Adapter Integration",
          scopeDescription: "Implement bi-directional wallet connection & signing flows for Android APK",
          clientName: "Apex Global Labs",
          amount: 250,
          freelancerWallet: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        }),
      });
      const data = await res.json();
      if (data.contract) {
        setCreatedUrl(`/pay/${data.contract.contractId}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyUrl = () => {
    if (createdUrl) {
      navigator.clipboard.writeText(window.location.origin + createdUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 20px" }}>
      <Head>
        <title>FlowPact — Verified Milestone Payments</title>
      </Head>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 60 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldCheck size={32} color="#14F195" />
          <span style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.02em" }}>FlowPact</span>
        </div>
        <span className="devnet-badge">Solana Devnet Protocol</span>
      </header>

      <main>
        <section style={{ textAlign: "center", marginBottom: 60 }}>
          <h1 style={{ fontSize: "2.8rem", fontWeight: 800, lineHeight: 1.2, marginBottom: 20 }}>
            Verified Milestone Payments &amp; Cryptographic Income Proof
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "1.15rem", maxWidth: 650, margin: "0 auto 30px" }}>
            Designed for global knowledge workers to contract directly with international clients, eliminating 20% platform fees with atomic on-chain settlement on Solana Devnet.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
            <button onClick={handleCreateDemo} disabled={loading} className="btn-primary" style={{ width: "auto" }}>
              {loading ? "Generating Demo Contract..." : "Generate Test Milestone Invoice"}
              <ArrowRight size={18} />
            </button>
          </div>

          {createdUrl && (
            <div className="glass-card" style={{ maxWidth: 600, margin: "30px auto 0", padding: 20, textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#14F195", marginBottom: 10 }}>
                <CheckCircle2 size={18} />
                <span style={{ fontWeight: 600 }}>Demo Contract Generated</span>
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: 12 }}>
                Shareable client payment portal link:
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  readOnly
                  value={typeof window !== "undefined" ? window.location.origin + createdUrl : createdUrl}
                  style={{
                    flex: 1,
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#fff",
                    padding: "8px 12px",
                    borderRadius: 8,
                    fontSize: "0.85rem",
                  }}
                />
                <button onClick={copyUrl} className="btn-secondary">
                  <Copy size={16} />
                  {copied ? "Copied" : "Copy"}
                </button>
                <Link href={createdUrl} className="btn-secondary" style={{ background: "#9945FF" }}>
                  Open
                </Link>
              </div>
            </div>
          )}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: "1.1rem", marginBottom: 10, color: "#c084fc" }}>Atomic SPL Settlement</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.5 }}>
              Transfers Demo USD (DUSD) with zero intermediaries and near-zero Solana network fees on Devnet.
            </p>
          </div>
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: "1.1rem", marginBottom: 10, color: "#14F195" }}>Server-Side Verification</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.5 }}>
              The client browser is never trusted. An independent server endpoint verifies on-chain signatures, mint, and amounts.
            </p>
          </div>
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: "1.1rem", marginBottom: 10, color: "#38bdf8" }}>Cryptographic Proof</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.5 }}>
              Anchors tamper-evident contract hashes directly on-chain via SPL Memo for independent public audit.
            </p>
          </div>
        </section>
      </main>

      <footer style={{ marginTop: 80, textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
        FlowPact Prototype · Built for Colosseum Crypto World's Fair · Solana Devnet Demo
      </footer>
    </div>
  );
}
