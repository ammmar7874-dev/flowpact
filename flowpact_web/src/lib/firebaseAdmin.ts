import * as fs from "fs";
import * as admin from "firebase-admin";
import { ContractData } from "../types/contract";

export interface ContractStore {
  getContract(contractId: string): Promise<ContractData | null>;
  saveContract(contract: ContractData): Promise<void>;
  updateSettlement(
    contractId: string,
    settlement: ContractData["settlement"]
  ): Promise<boolean>;
  deleteContract(contractId: string): Promise<boolean>;
  isSignatureUsed(signature: string): Promise<boolean>;
  recordSignature(signature: string): Promise<void>;
  listContracts(): Promise<ContractData[]>;
}

// In-memory contract store fallback for test mode or missing credential
const memoryStore = new Map<string, ContractData>();
const usedSignatures = new Set<string>();

class InMemoryContractStore implements ContractStore {
  async getContract(contractId: string): Promise<ContractData | null> {
    return memoryStore.get(contractId) || null;
  }

  async saveContract(contract: ContractData): Promise<void> {
    memoryStore.set(contract.contractId, { ...contract });
  }

  async updateSettlement(
    contractId: string,
    settlement: ContractData["settlement"]
  ): Promise<boolean> {
    const existing = memoryStore.get(contractId);
    if (!existing) return false;
    existing.status = "CONFIRMED";
    existing.settlement = settlement;
    memoryStore.set(contractId, existing);
    return true;
  }

  async deleteContract(contractId: string): Promise<boolean> {
    return memoryStore.delete(contractId);
  }

  async isSignatureUsed(signature: string): Promise<boolean> {
    return usedSignatures.has(signature);
  }

  async recordSignature(signature: string): Promise<void> {
    usedSignatures.add(signature);
  }

  async listContracts(): Promise<ContractData[]> {
    return Array.from(memoryStore.values()).sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }
}

class FirestoreContractStore implements ContractStore {
  private db: admin.firestore.Firestore;

  constructor(db: admin.firestore.Firestore) {
    this.db = db;
  }

  async getContract(contractId: string): Promise<ContractData | null> {
    const doc = await this.db.collection("contracts").doc(contractId).get();
    if (!doc.exists) return null;
    return doc.data() as ContractData;
  }

  async saveContract(contract: ContractData): Promise<void> {
    await this.db.collection("contracts").doc(contract.contractId).set(contract);
  }

  async updateSettlement(
    contractId: string,
    settlement: ContractData["settlement"]
  ): Promise<boolean> {
    await this.db.collection("contracts").doc(contractId).update({
      status: "CONFIRMED",
      settlement,
    });
    return true;
  }

  async deleteContract(contractId: string): Promise<boolean> {
    await this.db.collection("contracts").doc(contractId).delete();
    return true;
  }

  async isSignatureUsed(signature: string): Promise<boolean> {
    const snapshot = await this.db
      .collection("contracts")
      .where("settlement.txSignature", "==", signature)
      .limit(1)
      .get();
    return !snapshot.empty;
  }

  async recordSignature(signature: string): Promise<void> {
    // Automatically indexed via settlement.txSignature in Firestore
  }

  async listContracts(): Promise<ContractData[]> {
    const snapshot = await this.db.collection("contracts").get();
    const contracts: ContractData[] = [];
    snapshot.forEach((doc) => {
      if (doc.id === "_init") return;
      const data = doc.data() as ContractData;
      if (data && data.contractId) {
        contracts.push(data);
      }
    });
    return contracts.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }
}

let adminApp: admin.app.App | null = null;
let firestoreDb: admin.firestore.Firestore | null = null;
let storeInstance: ContractStore;

export function getFirebaseAdminApp(): admin.app.App | null {
  if (adminApp) return adminApp;

  if (admin.apps.length > 0) {
    adminApp = admin.app();
    return adminApp;
  }

  // 1. Production Mode: Base64-encoded Service Account JSON (server-side only)
  const b64 = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_B64;
  if (b64 && b64.trim()) {
    try {
      const decoded = Buffer.from(b64.trim(), "base64").toString("utf-8");
      const serviceAccount = JSON.parse(decoded);
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      return adminApp;
    } catch (err: any) {
      console.error("[WARN] Failed to initialize Firebase Admin with FIREBASE_ADMIN_SERVICE_ACCOUNT_B64");
    }
  }

  // 2. Local Development Mode: Path to JSON credential file
  const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH;
  if (keyPath && fs.existsSync(keyPath)) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      return adminApp;
    } catch (err: any) {
      console.error("[WARN] Failed to initialize Firebase Admin with FIREBASE_ADMIN_KEY_PATH");
    }
  }

  return null;
}

export function getFirestoreDb(): admin.firestore.Firestore | null {
  if (firestoreDb) return firestoreDb;
  const app = getFirebaseAdminApp();
  if (app) {
    firestoreDb = admin.firestore(app);
    return firestoreDb;
  }
  return null;
}

// Lazy getter or initialize storeInstance
function getStore(): ContractStore {
  if (storeInstance) return storeInstance;
  const db = getFirestoreDb();
  if (db) {
    storeInstance = new FirestoreContractStore(db);
  } else {
    storeInstance = new InMemoryContractStore();
  }
  return storeInstance;
}

export const contractStore: ContractStore = {
  getContract: (id) => getStore().getContract(id),
  saveContract(c) { return getStore().saveContract(c); },
  updateSettlement: (id, s) => getStore().updateSettlement(id, s),
  deleteContract: (id) => getStore().deleteContract(id),
  isSignatureUsed: (sig) => getStore().isSignatureUsed(sig),
  recordSignature: (sig) => getStore().recordSignature(sig),
  listContracts: () => getStore().listContracts(),
};

export { admin };
