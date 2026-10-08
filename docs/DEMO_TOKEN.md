# Demo USD (DUSD) Specification

## Overview
**Demo USD (DUSD)** is a purpose-built SPL test token created solely for the FlowPact prototype on **Solana Devnet**.

## Token Attributes
- **Name**: `Demo USD`
- **Symbol**: `DUSD`
- **Decimals**: `6`
- **Network**: `Solana Devnet`
- **Monetary Value**: **$0.00 (Zero)**

## Minting Instructions
A script is provided in `scripts/create_demo_token.ts`.
To run:
1. Ensure your local Devnet wallet has at least 1 Devnet SOL (`solana airdrop 1`).
2. Run:
   ```bash
   cd scripts
   npm install
   npx ts-node create_demo_token.ts
   ```
3. Copy the output mint address and place it in `flowpact_web/.env.local`:
   ```env
   NEXT_PUBLIC_DUSD_MINT="<generated_mint_address>"
   ```
