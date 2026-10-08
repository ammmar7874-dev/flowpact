import assert from "node:assert/strict";
import { PublicKey } from "@solana/web3.js";
import createContractHandler from "../src/pages/api/contracts/create";
import getContractHandler from "../src/pages/api/contracts/[contractId]";
import { contractStore, getFirestoreDb } from "../src/lib/firebaseAdmin";
import { createContractHash } from "../src/lib/hash";

const mockReqRes = (method: string, body?: any, query?: any) => {
  let statusCode = 200;
  let jsonBody: any = null;
  const req = { method, body: body || {}, query: query || {} } as any;
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
};

async function runContractCreationE2ETest() {
  console.log("=== FLOWPACT CONTRACT CREATION END-TO-END TEST ===\n");

  const freelancerPubkey = "GtZfVRzNj5fb2tZ8wwNzFEuvXEGP4wGHQ2ccoPntWP1A";

  // -------------------------------------------------------------
  // PART 1: SERVER-SIDE VALIDATION CHECKS
  // -------------------------------------------------------------
  console.log("[Part 1] Server-side Validation Checks");

  // 1.1 Reject extra unsafe fields
  {
    const { req, res, getStatus, getBody } = mockReqRes("POST", {
      projectTitle: "Test",
      scopeDescription: "Scope",
      clientName: "Client",
      amount: 100,
      freelancerWallet: freelancerPubkey,
      maliciousField: "DROP TABLE contracts;",
    });
    await createContractHandler(req, res);
    assert.equal(getStatus(), 400, "Must reject extra unsafe fields");
    assert.match(getBody()?.error, /Unrecognized or unsafe field/);
    console.log("  PASS: Rejects extra unsafe fields");
  }

  // 1.2 Reject missing projectTitle
  {
    const { req, res, getStatus, getBody } = mockReqRes("POST", {
      scopeDescription: "Scope",
      clientName: "Client",
      amount: 100,
      freelancerWallet: freelancerPubkey,
    });
    await createContractHandler(req, res);
    assert.equal(getStatus(), 400, "Must reject missing projectTitle");
    assert.match(getBody()?.error, /projectTitle is required/);
    console.log("  PASS: Rejects missing projectTitle");
  }

  // 1.3 Reject non-positive amount
  {
    const { req, res, getStatus, getBody } = mockReqRes("POST", {
      projectTitle: "Test",
      scopeDescription: "Scope",
      clientName: "Client",
      amount: -50,
      freelancerWallet: freelancerPubkey,
    });
    await createContractHandler(req, res);
    assert.equal(getStatus(), 400, "Must reject negative amount");
    assert.match(getBody()?.error, /amount must be a valid number greater than 0/);
    console.log("  PASS: Rejects non-positive amount");
  }

  // 1.4 Reject invalid freelancerWallet
  {
    const { req, res, getStatus, getBody } = mockReqRes("POST", {
      projectTitle: "Test",
      scopeDescription: "Scope",
      clientName: "Client",
      amount: 100,
      freelancerWallet: "invalid_solana_address_123",
    });
    await createContractHandler(req, res);
    assert.equal(getStatus(), 400, "Must reject invalid solana address");
    assert.match(getBody()?.error, /freelancerWallet must be a valid base58/);
    console.log("  PASS: Rejects invalid freelancerWallet");
  }

  // -------------------------------------------------------------
  // PART 2: CREATE TEMPORARY TEST CONTRACT
  // -------------------------------------------------------------
  console.log("\n[Part 2] End-to-End Contract Creation Flow");

  const validPayload = {
    projectTitle: "Mobile UI Redesign",
    scopeDescription: "Flutter dashboard implementation and UI polish",
    clientName: "Demo Client",
    amount: 250,
    freelancerWallet: freelancerPubkey,
  };

  const { req: createReq, res: createRes, getStatus: getCreateStatus, getBody: getCreateBody } =
    mockReqRes("POST", validPayload);

  await createContractHandler(createReq, createRes);

  assert.equal(getCreateStatus(), 201, "Contract creation must return HTTP 201");
  const createData = getCreateBody();
  assert.equal(createData.success, true, "Response must report success: true");
  assert.ok(createData.contract, "Response must contain created contract object");

  const contract = createData.contract;
  const contractId = contract.contractId;
  console.log("  PASS: API returned HTTP 201 with success: true");
  console.log("  Created Contract ID:", contractId);

  // -------------------------------------------------------------
  // PART 3: VERIFY FIRESTORE DOCUMENT & GENERATED FIELDS
  // -------------------------------------------------------------
  console.log("\n[Part 3] Field & Hash Integrity Verification");

  // 3.1 Verify status == PENDING
  assert.equal(contract.status, "PENDING", "Contract status must be 'PENDING'");
  console.log("  PASS: status == 'PENDING'");

  // 3.2 Verify contractHash exists and is deterministic
  assert.ok(contract.contractHash, "contractHash must exist");
  assert.equal(contract.contractHash.length, 64, "contractHash must be 64-char SHA-256");
  const expectedHash = createContractHash(contract);
  assert.equal(contract.contractHash, expectedHash, "contractHash must match deterministic SHA-256 calculation");
  console.log("  PASS: contractHash exists and matches deterministic SHA-256 algorithm");

  // 3.3 Verify referencePublicKey exists and is valid Solana public key
  assert.ok(contract.referencePublicKey, "referencePublicKey must exist");
  assert.doesNotThrow(() => new PublicKey(contract.referencePublicKey), "referencePublicKey must be valid PublicKey");
  console.log("  PASS: referencePublicKey exists and is valid Solana Public Key");

  // 3.4 Confirm Firestore document exists via Firebase Admin directly
  const db = getFirestoreDb();
  if (db) {
    const firestoreDoc = await db.collection("contracts").doc(contractId).get();
    assert.equal(firestoreDoc.exists, true, "Firestore document must exist in 'contracts' collection");
    const docData = firestoreDoc.data();
    assert.equal(docData?.status, "PENDING");
    assert.equal(docData?.amount, 250);
    assert.equal(docData?.clientName, "Demo Client");
    console.log("  PASS: Firestore document confirmed in live database via Firebase Admin");
  } else {
    // In-memory fallback verification
    const inMem = await contractStore.getContract(contractId);
    assert.ok(inMem, "In-memory contract must exist");
    console.log("  PASS: Contract confirmed in store");
  }

  // -------------------------------------------------------------
  // PART 4: VERIFY GET /api/contracts/[contractId]
  // -------------------------------------------------------------
  console.log("\n[Part 4] GET /api/contracts/[contractId] Verification");

  const { req: getReq, res: getRes, getStatus: getGetStatus, getBody: getGetBody } =
    mockReqRes("GET", undefined, { contractId });

  await getContractHandler(getReq, getRes);

  assert.equal(getGetStatus(), 200, "GET endpoint must return HTTP 200");
  const getData = getGetBody();
  assert.equal(getData.success, true);
  assert.equal(getData.contract.contractId, contractId);
  assert.equal(getData.contract.projectTitle, "Mobile UI Redesign");
  assert.equal(getData.contract.amount, 250);
  assert.equal(getData.contract.status, "PENDING");
  assert.equal(getData.contract.freelancerWallet, freelancerPubkey);
  console.log("  PASS: GET endpoint returned complete contract data accurately");

  // -------------------------------------------------------------
  // PART 5: CLEANUP TEMPORARY TEST CONTRACT
  // -------------------------------------------------------------
  console.log("\n[Part 5] Temporary Contract Cleanup");

  const deleted = await contractStore.deleteContract(contractId);
  assert.equal(deleted, true, "deleteContract must succeed");

  // Verify deletion from Firestore / store
  if (db) {
    const deletedDoc = await db.collection("contracts").doc(contractId).get();
    assert.equal(deletedDoc.exists, false, "Contract must be completely deleted from Firestore");
  }
  const checkAfterDelete = await contractStore.getContract(contractId);
  assert.equal(checkAfterDelete, null, "Contract must no longer exist in contractStore");
  console.log("  PASS: Temporary test contract successfully and completely deleted from Firestore");

  console.log("\n ALL END-TO-END CONTRACT CREATION TESTS PASSED SUCCESSFULLY! ");
}

runContractCreationE2ETest().catch((err) => {
  console.error(" TEST FAILED:", err);
  process.exit(1);
});
