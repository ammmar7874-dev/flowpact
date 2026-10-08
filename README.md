# FlowPact

> **Cryptographic Milestone Settlements & Income Verification for Global Freelancers on Solana Devnet**

---

## 1. Problem Statement

Global freelancers often encounter high remittance friction, unpredictable settlement delays, and opaque payment tracking when working with international clients. Furthermore, independent digital contractors struggle to prove verified earnings to embassies, landlords, or financial institutions without disclosing sensitive client communications or proprietary deliverables.

---

## 2. The Solution

**FlowPact** bridges mobile freelancer workflows with high-speed Solana Devnet settlements:

1. **Milestone Coordination**: Freelancers define project scopes and deliverables from their mobile devices or web browsers.
2. **Deterministic Cryptographic Hash**: Every contract generates a tamper-evident SHA-256 digest binding scope, milestone value, recipient wallet, and a unique Solana reference key.
3. **Direct Client Payment**: Clients receive a clean web checkout link to settle the milestone using their preferred Solana wallet (Phantom, Solflare) on Solana Devnet.
4. **On-Chain Audit Receipt**: Settlements are verified by the server directly against Solana Devnet RPC and permanently verifiable through public, cryptographic audit receipts.

---

## 3. Key Features

- **Flutter Freelancer Mobile App (`flowpact_mobile`)**:
  - Real-time dashboard with verified income metrics and contract status tracking.
  - Instant milestone contract creation with client wallet parameters.
  - One-tap client payment link sharing and verified receipt inspection.
  - Configurable backend target via `--dart-define`.

- **Next.js Web Portal (`flowpact_web`)**:
  - Mobile-responsive client payment checkout (`/pay/[contractId]`).
  - Solana Wallet Adapter integration supporting standard Solana wallets.
  - Public on-chain verification receipt viewer (`/verify/[signature]`).
  - Health check endpoint (`/api/health`).

- **Server-Side Settlement Audit**:
  - Zero trust of client-submitted payment states.
  - Server independently queries Solana Devnet RPC to confirm token mint, exact amount, recipient address, reference key, and on-chain memo.

- **Deterministic SHA-256 Audit Trail**:
  - Canonical hashing algorithm ensures any post-creation tampering of milestone terms invalidates the proof.

---

## 4. Architecture Overview

```
 ┌────────────────────────────────────────────────────────┐
 │               Flutter Mobile App (Freelancer)          │
 └───────────────────────────┬────────────────────────────┘
                             │ REST API
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │           Next.js Backend & Web Portal                 │
 │   - Contract Management API  - Public Receipt Viewer  │
 │   - Payment Verification API - Client Checkout Portal │
 └─────────────┬────────────────────────────┬─────────────┘
               │                            │
   Admin SDK   │                            │ Solana RPC
   (Server)    ▼                            ▼
 ┌──────────────────────┐         ┌──────────────────────┐
 │  Firebase Firestore  │         │    Solana Devnet     │
 │  (Locked Direct Rule)│         │  - SPL Token Transfer│
 └──────────────────────┘         │  - SPL Memo Program  │
                                  │  - Reference Key     │
                                  └──────────────────────┘
```

---

## 5. Technology Stack

- **Mobile Client**: Flutter 3.x, Dart, Provider state management
- **Web & Backend**: Next.js 14, React 18, TypeScript
- **Blockchain**: `@solana/web3.js`, `@solana/spl-token`, Solana Wallet Adapter
- **Database**: Google Cloud Firestore (via Firebase Admin SDK server-side)
- **Network**: Solana Devnet

---

## 6. Token Specification (DUSD)

> **Important**: **DUSD** is strictly a **valueless Devnet demo token** created exclusively for hackathon evaluation and technical prototyping on Solana Devnet.
>
> - **Mint Address (Devnet)**: `ERnsPVfYhVPLxzYobSGAXuYnSW93SR92tJrmp55QP7KH`
> - **Monetary Value**: **$0.00 (Zero)**
> - DUSD is not real USDC, is not backed by fiat currency, and has no financial value.

---

## 7. Security Architecture

1. **Non-Custodial Flow**: The platform does not hold custody of user funds. Transfers execute directly from the client's wallet to the freelancer's recipient address.
2. **Server-Verified Settlement**: The contract status `CONFIRMED` can only be set by server-side verification against the Solana Devnet blockchain. Direct client modifications are strictly denied.
3. **Firestore Security Rules**: Direct client read/write access to Firestore is completely disabled (`allow read, write: if false;`). All database access occurs exclusively through the Firebase Admin SDK on the backend.
4. **Credential Isolation**: All service account credentials, authority keys, and environment secrets are excluded from source control. Both file-path mode (`FIREBASE_ADMIN_KEY_PATH`) and production base64 mode (`FIREBASE_ADMIN_SERVICE_ACCOUNT_B64`) are supported without committing credentials.

---

## 8. Local Setup & Quickstart

### Prerequisites
- Node.js 18+ (tested on Node 20+)
- Flutter SDK 3.x
- Android Studio / Android Emulator (for mobile testing)

### Web Portal (`flowpact_web`)

1. Navigate to the web directory:
   ```bash
   cd flowpact_web
   npm install
   ```

2. Configure environment variables in `.env.local`:
   ```env
   # Server-side Firebase Admin (Local Path OR Base64)
   FIREBASE_ADMIN_KEY_PATH="../secrets/firebase-admin.json"
   # Or for production: FIREBASE_ADMIN_SERVICE_ACCOUNT_B64="<base64>"

   # Solana Devnet Configuration
   NEXT_PUBLIC_SOLANA_RPC_URL="https://api.devnet.solana.com"
   NEXT_PUBLIC_DUSD_MINT="ERnsPVfYhVPLxzYobSGAXuYnSW93SR92tJrmp55QP7KH"
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```
   Web checkout and API endpoints will be accessible at `http://localhost:3000`.

### Mobile Application (`flowpact_mobile`)

1. Navigate to the mobile directory:
   ```bash
   cd flowpact_mobile
   flutter pub get
   ```

2. Run tests:
   ```bash
   flutter test
   ```

3. Launch on Android Emulator:
   ```bash
   flutter run
   ```
   *(For custom backend URLs, pass `--dart-define=API_BASE_URL=https://your-domain.com --dart-define=APP_URL=https://your-domain.com`)*

---

## 9. Hackathon Disclaimer

FlowPact is a prototype developed for technical demonstration and hackathon evaluation.
- All blockchain interactions operate strictly on **Solana Devnet**.
- Tokens used (DUSD) have **no real-world monetary value**.
- This project does not claim to provide financial services, banking facilities, escrow holding services, or government-certified income documentation.
