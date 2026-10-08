import assert from "node:assert/strict";
import listContractsHandler from "../src/pages/api/contracts/index";
import getContractHandler from "../src/pages/api/contracts/[contractId]";
import createContractHandler from "../src/pages/api/contracts/create";

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

async function testFlutterApiEndpoints() {
  console.log("=== RUNNING FLUTTER BACKEND API INTEGRATION & SECURITY TESTS ===\n");

  process.env.FIREBASE_ADMIN_KEY_PATH = "D:/flowpact/secrets/firebase-admin.json";

  // 1. Test GET /api/contracts
  console.log("[1] Testing GET /api/contracts (List Contracts)...");
  {
    const { req, res, getStatus, getBody } = mockReqRes("GET");
    await listContractsHandler(req, res);

    assert.equal(getStatus(), 200, "Must return HTTP 200");
    const body = getBody();
    assert.equal(body.success, true, "Body must indicate success: true");
    assert.ok(Array.isArray(body.contracts), "Must return contracts array");
    assert.ok(body.contracts.length > 0, "Must return non-empty contracts list");

    console.log(`  PASS: GET /api/contracts returned ${body.contracts.length} contracts`);

    // Verify safe fields only & no secret leak
    const forbiddenKeys = [
      "privateKey",
      "secret",
      "credential",
      "credentials",
      "firebase",
      "FIREBASE_ADMIN_KEY_PATH",
      "_init",
    ];

    for (const c of body.contracts) {
      assert.ok(c.contractId, "Contract must have contractId");
      assert.ok(c.projectTitle, "Contract must have projectTitle");
      assert.ok(c.clientName, "Contract must have clientName");
      assert.ok(typeof c.amount === "number", "Contract amount must be a number");
      assert.ok(c.status, "Contract must have status");
      assert.ok(c.freelancerWallet, "Contract must have freelancerWallet");

      // Verify no leaked secrets
      const rawString = JSON.stringify(c);
      for (const forbidden of forbiddenKeys) {
        assert.ok(
          !rawString.toLowerCase().includes(forbidden.toLowerCase()),
          `Response must not contain sensitive keyword: ${forbidden}`
        );
      }
    }
    console.log("  PASS: Security check passed - zero sensitive/admin fields exposed");

    // Verify persistent demo contract is present
    const persistent = body.contracts.find((c: any) => c.contractId === "fp_muzpxry5_41122c61");
    assert.ok(persistent, "Persistent demo contract fp_muzpxry5_41122c61 must be in contracts list");
    assert.equal(persistent.status, "CONFIRMED", "Persistent demo contract must have status CONFIRMED");
    assert.equal(persistent.amount, 250, "Persistent demo contract amount must be 250");
    console.log("  PASS: Persistent demo contract fp_muzpxry5_41122c61 found and verified");
  }

  // 2. Test GET /api/contracts/[contractId]
  console.log("\n[2] Testing GET /api/contracts/[contractId]...");
  {
    const { req, res, getStatus, getBody } = mockReqRes("GET", {}, { contractId: "fp_muzpxry5_41122c61" });
    await getContractHandler(req, res);

    assert.equal(getStatus(), 200, "Must return HTTP 200");
    const body = getBody();
    assert.equal(body.success, true);
    assert.equal(body.contract.contractId, "fp_muzpxry5_41122c61");
    assert.equal(body.contract.clientName, "Demo Global Client");
    assert.ok(body.contract.settlement, "Confirmed contract must have settlement data");
    assert.ok(body.contract.settlement.txSignature, "Settlement must have txSignature");
    console.log("  PASS: Single contract fetch returns full accurate contract data");
  }

  // 3. Test POST /api/contracts/create validation
  console.log("\n[3] Testing POST /api/contracts/create Validation...");
  {
    const { req, res, getStatus } = mockReqRes("POST", {
      projectTitle: "",
      clientName: "Test Client",
    });
    await createContractHandler(req, res);
    assert.equal(getStatus(), 400, "Must reject invalid request body with HTTP 400");
    console.log("  PASS: Rejects invalid contract creation requests");
  }

  console.log("\n ALL FLUTTER BACKEND INTEGRATION & SECURITY TESTS PASSED!\n");
}

testFlutterApiEndpoints().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
