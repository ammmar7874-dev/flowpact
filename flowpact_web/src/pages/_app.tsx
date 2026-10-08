import type { AppProps } from "next/app";
import Head from "next/head";
import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { DEVNET_RPC_URL } from "../lib/solana";

import "../styles/globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";

export default function App({ Component, pageProps }: AppProps) {
  const endpoint = DEVNET_RPC_URL;
  // Standard Solana wallets (Phantom, Solflare, Backpack) are auto-detected by Solana Wallet Standard
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Head>
            <title>FlowPact — Verified Milestone Payments</title>
            <meta
              name="description"
              content="FlowPact — Verified Milestone Payments & Cryptographic Income Proof for Global Freelancers on Solana Devnet"
            />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <link rel="icon" href="/favicon.ico" />
          </Head>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <Component {...pageProps} />
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
