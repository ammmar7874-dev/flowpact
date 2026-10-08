# FlowPact Technical Architecture

## 1. Overview
FlowPact bridges cross-border freelancers and international clients using atomic SPL token payments on Solana Devnet and independent server-side verification.

```
[Freelancer App (Flutter)]
        │ (1. Create Contract)
        ▼
[Firebase Cloud Firestore]
        ▲
        │ (2. Load Metadata)
[Client Web Portal (Next.js)]
        │ (3. Sign Atomic Transfer + Memo)
        ▼
[Solana Devnet RPC]
        │ (4. Settle in <1s)
        ▼
[FlowPact Verification API (/api/verify-payment)]
        │ (5. Independent Server-Side Audit)
        ▼
[Update Firestore: CONFIRMED + Settlement Data]
```

## 2. Canonical Contract Hash Algorithm
To prove that off-chain contract deliverables and terms have not been altered after creation, FlowPact calculates a deterministic SHA-256 hash across canonical fields:

```typescript
const canonicalString = [
  contract.contractId.trim(),
  contract.projectTitle.trim(),
  contract.scopeDescription.trim(),
  contract.clientName.trim(),
  contract.amount.toFixed(6),
  contract.tokenSymbol.trim().toUpperCase(),
  contract.tokenMint.trim(),
  contract.freelancerWallet.trim(),
  contract.referencePublicKey.trim(),
].join("|");

const contractHash = sha256(canonicalString);
```

### Exact Normalized Fields:
1. `contractId`: Unique contract identifier (e.g. `fp_c491a27e`).
2. `projectTitle`: Sanitized project title string.
3. `scopeDescription`: Normalized deliverable text description.
4. `clientName`: Client identifier or company name.
5. `amount`: Formatted strictly to 6 decimal precision (`toFixed(6)`).
6. `tokenSymbol`: Uppercase symbol (e.g. `DUSD`).
7. `tokenMint`: Base58 SPL token mint public key.
8. `freelancerWallet`: Base58 Solana public key of the recipient.
9. `referencePublicKey`: Unique single-use Solana reference key.

## 3. On-Chain Memo Specification
FlowPact commits zero private client or personal information to the public ledger.
The on-chain transaction includes an instruction to the official Solana SPL Memo Program (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`) with the exact format:

```
FLOWPACT:<contractId>:<contractHash>
```

## 4. Server-Side Verification Pipeline (`/api/verify-payment`)
The client browser is **never trusted** to mark a contract confirmed. The client sends only `{ contractId, txSignature }` to the server.

The server independently executes:
1. **Contract Existence**: Loads record from Firestore; rejects if missing or already confirmed.
2. **On-Chain Confirmation**: Fetches transaction from Solana Devnet RPC with `commitment: "confirmed"`. Rejects if `meta.err !== null`.
3. **Signature Uniqueness**: Checks database to ensure the transaction signature has not been used previously.
4. **Reference Key Check**: Verifies that `contract.referencePublicKey` exists in the transaction account list.
5. **Exact Memo Check**: Verifies that the transaction memo matches `FLOWPACT:<contractId>:<contractHash>`.
6. **Token & Amount Check**: Verifies that the recipient's Associated Token Account (ATA) received the exact expected amount in the expected DUSD mint.
7. **Settlement Persistence**: Writes verified settlement block time, slot, and payer info to Firestore, setting `status = "CONFIRMED"`.
