# FlowPact Security Model

## 1. Zero Trust of Client State
- The frontend wallet adapter signs and broadcasts the transaction, but **cannot** mutate the contract status in Firestore.
- Firestore security rules restrict status updates to Server Admin keys (`firebase-admin`).

## 2. Replay Protection
- Every contract generates a fresh, unique Solana `referencePublicKey`.
- The verification endpoint enforces that every transaction signature is stored in a unique settlement index. Replaying an existing or prior transaction signature is immediately rejected with HTTP 400.

## 3. Data Privacy on Public Ledger
- No names, emails, descriptions, or intellectual property are posted to the blockchain.
- Only the deterministic `contractHash` and `contractId` are anchored on-chain.

## 4. Test Token Safety
- FlowPact explicitly uses **Demo USD (DUSD)** on Solana Devnet.
- No real mainnet funds, real USDC, or private key custody exist in the platform.
