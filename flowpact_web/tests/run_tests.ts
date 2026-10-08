import verifyPaymentHandler from '../src/pages/api/verify-payment';
import assert from 'node:assert/strict';
import { Keypair, PublicKey, Connection } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { generateContractHash, verifyContractHash } from '../src/lib/hash';
import { buildMilestonePaymentTransaction } from '../src/lib/transactionBuilder';
import { verifyTransactionOnSolana } from '../src/lib/verifier';
import { MEMO_PROGRAM_ID } from '../src/lib/solana';
import { ContractData } from '../src/types/contract';

async function runAllTests() {
  console.log('=== RUNNING FLOWPACT TEST SUITE ===\n');

  // ==========================================
  // SUITE 1: CANONICAL CONTRACT HASH
  // ==========================================
  console.log('[Suite 1] Deterministic Canonical Hash & Tamper Resistance');
  {
    const baseContract = {
      projectTitle: 'Solana Mobile SDK Integration',
      scopeDescription: 'Integrate Solana Mobile Wallet Adapter and build payment screen',
      clientName: 'Alice Dev Studio',
      freelancerWallet: Keypair.generate().publicKey.toBase58(),
      amount: 250.0,
      tokenMint: 'DUSD111111111111111111111111111111111111111',
      referencePublicKey: Keypair.generate().publicKey.toBase58(),
    };

    const hash1 = generateContractHash(baseContract);
    const hash2 = generateContractHash(baseContract);
    assert.equal(hash1, hash2, 'Hash must be strictly deterministic');
    assert.equal(hash1.length, 64, 'SHA-256 hex must be 64 characters');
    assert.equal(verifyContractHash(baseContract, hash1), true, 'Hash verification must succeed for identical data');

    // Tamper tests: modifying any field must invalidate the hash
    const tamperedAmount = { ...baseContract, amount: 250.01 };
    assert.notEqual(generateContractHash(tamperedAmount), hash1, 'Tampered amount must produce different hash');
    assert.equal(verifyContractHash(tamperedAmount, hash1), false, 'Verification must fail on tampered amount');

    const tamperedTitle = { ...baseContract, projectTitle: 'Solana Mobile SDK Integration ' };
    assert.notEqual(generateContractHash(tamperedTitle), hash1, 'Tampered title whitespace must produce different hash');

    const tamperedScope = { ...baseContract, scopeDescription: 'Modified scope text' };
    assert.notEqual(generateContractHash(tamperedScope), hash1, 'Tampered scope must produce different hash');

    const tamperedWallet = { ...baseContract, freelancerWallet: Keypair.generate().publicKey.toBase58() };
    assert.notEqual(generateContractHash(tamperedWallet), hash1, 'Tampered freelancer wallet must produce different hash');

    console.log('  PASS: Deterministic hash and tamper-proofing confirmed');
  }

  // ==========================================
  // SUITE 2: PAYMENT TRANSACTION BUILDER
  // ==========================================
  console.log('\n[Suite 2] Payment Transaction Construction');
  {
    const payer = Keypair.generate();
    const freelancer = Keypair.generate();
    const mint = Keypair.generate();
    const reference = Keypair.generate();
    const contractId = 'fp_test_98765';
    const contractHash = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
    const amount = 150.0;

    const mockConn = {} as Connection;
    const tx = await buildMilestonePaymentTransaction(mockConn, {
      payerPublicKey: payer.publicKey,
      freelancerWallet: freelancer.publicKey.toBase58(),
      tokenMint: mint.publicKey.toBase58(),
      amount,
      referencePublicKey: reference.publicKey.toBase58(),
      contractId,
      contractHash,
    });

    assert.equal(tx.instructions.length, 3, 'Transaction must contain exactly 3 instructions (ATA, TransferChecked, Memo)');

    // 1. ATA instruction
    const ataIx = tx.instructions[0];
    assert.ok(ataIx, 'ATA instruction must exist');

    // 2. TransferChecked instruction
    const transferIx = tx.instructions[1];
    assert.ok(transferIx, 'Transfer instruction must exist');
    // Verify reference public key is attached as non-signer in transferIx.keys
    const hasReferenceKey = transferIx.keys.some(
      (k) => k.pubkey.toBase58() === reference.publicKey.toBase58() && !k.isSigner && !k.isWritable
    );
    assert.equal(hasReferenceKey, true, 'Unique reference public key must be attached to transfer instruction');

    // 3. Memo instruction
    const memoIx = tx.instructions[2];
    assert.equal(memoIx.programId.toBase58(), MEMO_PROGRAM_ID.toBase58(), 'Memo instruction must target SPL Memo program');
    const expectedMemo = `FLOWPACT:${contractId}:${contractHash}`;
    assert.equal(memoIx.data.toString('utf-8'), expectedMemo, 'Memo data must strictly match FLOWPACT:<contractId>:<contractHash>');

    console.log('  PASS: Transaction builder constructs ATA + TransferChecked + ReferenceKey + Memo properly');
  }

  // ==========================================
  // SUITE 3: SERVER VERIFICATION AUDIT RULES
  // ==========================================
  console.log('\n[Suite 3] Server Verification Independent Audit Rules');
  {
    const payer = Keypair.generate();
    const freelancer = Keypair.generate();
    const mint = Keypair.generate();
    const reference = Keypair.generate();
    const contractId = 'fp_audit_001';
    const contractHash = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
    const amount = 200.0;
    const txSig = '5j1Kx...validSig1234567890abcdefghijklmnopqrstuvwxyz';

    const expectedContract: ContractData = {
      contractId,
      projectTitle: 'Backend Security Architecture',
      scopeDescription: 'Implement independent server verification',
      clientName: 'Acme Corp',
      freelancerWallet: freelancer.publicKey.toBase58(),
      amount,
      tokenSymbol: 'DUSD',
      tokenMint: mint.publicKey.toBase58(),
      status: 'PENDING',
      contractHash,
      referencePublicKey: reference.publicKey.toBase58(),
      createdAt: new Date().toISOString(),
    };

    const freelancerAta = getAssociatedTokenAddressSync(mint.publicKey, freelancer.publicKey);
    const payerAta = getAssociatedTokenAddressSync(mint.publicKey, payer.publicKey);

    // Helper to generate mock parsed transaction
    const makeMockTx = (overrides?: {
      amount?: number;
      recipient?: string;
      mint?: string;
      memo?: string;
      omitReference?: boolean;
    }) => {
      const curAmount = overrides?.amount !== undefined ? overrides.amount : amount;
      const curRecipient = overrides?.recipient || freelancerAta.toBase58();
      const curMint = overrides?.mint || mint.publicKey.toBase58();
      const curMemo = overrides?.memo || `FLOWPACT:${contractId}:${contractHash}`;

      const keys: any[] = [
        { pubkey: payer.publicKey, signer: true, writable: true },
        { pubkey: new PublicKey(curRecipient), signer: false, writable: true },
        { pubkey: freelancer.publicKey, signer: false, writable: false },
        { pubkey: new PublicKey(curMint), signer: false, writable: false },
        { pubkey: MEMO_PROGRAM_ID, signer: false, writable: false },
      ];

      if (!overrides?.omitReference) {
        keys.push({ pubkey: reference.publicKey, signer: false, writable: false });
      }

      return {
        slot: 9876543,
        blockTime: 1770000000,
        transaction: {
          signatures: [txSig],
          message: {
            accountKeys: keys,
            instructions: [
              {
                program: 'spl-token',
                programId: TOKEN_PROGRAM_ID,
                parsed: {
                  type: 'transferChecked',
                  info: {
                    source: payerAta.toBase58(),
                    destination: curRecipient,
                    mint: curMint,
                    authority: payer.publicKey.toBase58(),
                    amount: String(Math.round(curAmount * 1_000_000)),
                    tokenAmount: {
                      amount: String(Math.round(curAmount * 1_000_000)),
                      decimals: 6,
                      uiAmount: curAmount,
                      uiAmountString: String(curAmount),
                    },
                  },
                },
              },
              {
                programId: MEMO_PROGRAM_ID,
                parsed: curMemo,
              },
            ],
          },
        },
        meta: {
          err: null,
          fee: 5000,
          preTokenBalances: [],
          postTokenBalances: [],
        },
      } as any;
    };

    // Rule 1: Reject duplicate signature (Replay attack)
    {
      const mockConn = {} as Connection;
      const res = await verifyTransactionOnSolana({
        connection: mockConn,
        txSignature: txSig,
        expectedContract,
        isSignatureUsed: async () => true, // simulates duplicate signature
      });
      assert.equal(res.valid, false, 'Duplicate signature must be rejected');
      assert.match(res.error || '', /Replay rejected/, 'Must specify replay rejection');
      console.log('  PASS: Rejects duplicate/replayed transaction signature');
    }

    // Rule 2: Reject missing unique reference public key
    {
      const mockConn = {
        getParsedTransaction: async () => makeMockTx({ omitReference: true }),
      } as unknown as Connection;
      const res = await verifyTransactionOnSolana({
        connection: mockConn,
        txSignature: txSig,
        expectedContract,
        isSignatureUsed: async () => false,
      });
      assert.equal(res.valid, false, 'Missing reference public key must be rejected');
      assert.match(res.error || '', /Unique contract reference key.*was not found/, 'Must specify reference key error');
      console.log('  PASS: Rejects transaction missing unique contract reference key');
    }

    // Rule 3: Reject wrong memo
    {
      const mockConn = {
        getParsedTransaction: async () => makeMockTx({ memo: 'FLOWPACT:wrong_id:wrong_hash' }),
      } as unknown as Connection;
      const res = await verifyTransactionOnSolana({
        connection: mockConn,
        txSignature: txSig,
        expectedContract,
        isSignatureUsed: async () => false,
      });
      assert.equal(res.valid, false, 'Wrong memo must be rejected');
      assert.match(res.error || '', /memo does not match/, 'Must specify memo mismatch');
      console.log('  PASS: Rejects transaction with wrong memo or tampered contractId/hash');
    }

    // Rule 4: Reject wrong recipient
    {
      const wrongRecipient = Keypair.generate().publicKey.toBase58();
      const mockConn = {
        getParsedTransaction: async () => makeMockTx({ recipient: wrongRecipient }),
      } as unknown as Connection;
      const res = await verifyTransactionOnSolana({
        connection: mockConn,
        txSignature: txSig,
        expectedContract,
        isSignatureUsed: async () => false,
      });
      assert.equal(res.valid, false, 'Wrong recipient ATA must be rejected');
      assert.match(res.error || '', /No valid SPL token transfer found/, 'Must specify transfer verification error');
      console.log('  PASS: Rejects transaction paid to wrong recipient ATA');
    }

    // Rule 5: Reject wrong mint
    {
      const wrongMint = Keypair.generate().publicKey.toBase58();
      const mockConn = {
        getParsedTransaction: async () => makeMockTx({ mint: wrongMint }),
      } as unknown as Connection;
      const res = await verifyTransactionOnSolana({
        connection: mockConn,
        txSignature: txSig,
        expectedContract,
        isSignatureUsed: async () => false,
      });
      assert.equal(res.valid, false, 'Wrong mint must be rejected');
      assert.match(res.error || '', /No valid SPL token transfer found/, 'Must specify transfer verification error');
      console.log('  PASS: Rejects transaction transferring wrong token mint');
    }

    // Rule 6: Reject wrong amount
    {
      const wrongAmount = 100.0; // Expected 200.0
      const mockConn = {
        getParsedTransaction: async () => makeMockTx({ amount: wrongAmount }),
      } as unknown as Connection;
      const res = await verifyTransactionOnSolana({
        connection: mockConn,
        txSignature: txSig,
        expectedContract,
        isSignatureUsed: async () => false,
      });
      assert.equal(res.valid, false, 'Wrong amount must be rejected');
      assert.match(res.error || '', /No valid SPL token transfer found/, 'Must specify transfer verification error');
      console.log('  PASS: Rejects underpaid or incorrect amount');
    }

    // Rule 7: Accept valid transaction and extract settlement proof
    {
      const mockConn = {
        getParsedTransaction: async () => makeMockTx(),
      } as unknown as Connection;
      const res = await verifyTransactionOnSolana({
        connection: mockConn,
        txSignature: txSig,
        expectedContract,
        isSignatureUsed: async () => false,
      });
      assert.equal(res.valid, true, 'Valid transaction must be accepted');
      assert.ok(res.settlement, 'Must return settlement data');
      assert.equal(res.settlement?.txSignature, txSig);
      assert.equal(res.settlement?.amount, amount);
      assert.equal(res.settlement?.recipientWallet, freelancer.publicKey.toBase58());
      assert.equal(res.settlement?.mint, mint.publicKey.toBase58());
      console.log('  PASS: Accepts valid transaction and extracts complete settlement data');
    }
  }

  
  // ==========================================
  // SUITE 4: POST /api/verify-payment ENDPOINT
  // ==========================================
  console.log('\n[Suite 4] POST /api/verify-payment Security & Validation Rules');
  {
    const mockReqRes = (method: string, body: any) => {
      let statusCode = 200;
      let jsonBody: any = null;
      const req = { method, body } as any;
      const res = {
        status(code: number) {
          statusCode = code;
          return res;
        },
        json(data: any) {
          jsonBody = data;
          return res;
        },
      } as any;
      return { req, res, getStatus: () => statusCode, getBody: () => jsonBody };
    }

    // 1. Method Not Allowed
    {
      const { req, res, getStatus } = mockReqRes('GET', {});
      await verifyPaymentHandler(req, res);
      assert.equal(getStatus(), 405, 'Non-POST requests must return 405 Method Not Allowed');
      console.log('  PASS: Rejects non-POST requests with HTTP 405');
    }

    // 2. Missing Parameters
    {
      const { req, res, getStatus, getBody } = mockReqRes('POST', {});
      await verifyPaymentHandler(req, res);
      assert.equal(getStatus(), 400, 'Requests missing contractId/txSignature must return 400');
      assert.equal(getBody()?.success, false);
      console.log('  PASS: Rejects missing contractId / txSignature with HTTP 400');
    }

    // 3. Unknown Contract Rejection
    {
      const { req, res, getStatus, getBody } = mockReqRes('POST', {
        contractId: 'fp_unknown_nonexistent_contract',
        txSignature: '5j1Kx...dummySignature1234567890abcdefghijklmnopqrstuvwxyz',
      });
      await verifyPaymentHandler(req, res);
      assert.equal(getStatus(), 404, 'Unknown contract must be rejected with 404 Not Found');
      assert.equal(getBody()?.success, false);
      assert.match(getBody()?.message || '', /was not found in database/);
      console.log('  PASS: Rejects unknown / non-existent contract with HTTP 404');
    }
  }

  console.log('\n ALL FLOWPACT TESTS PASSED SUCCESSFULLY! ');
}

runAllTests().catch((err) => {
  console.error(' TEST SUITE FAILED:', err);
  process.exit(1);
});
