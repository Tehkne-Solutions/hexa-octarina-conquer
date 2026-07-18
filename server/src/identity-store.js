import { resolve } from "node:path";

import { MemoryIdentityStore } from "./identity-memory.js";
import { PostgresIdentityStore } from "./identity-postgres.js";
import { SqliteIdentityStore } from "./identity-sqlite.js";

export async function createIdentityStore({ mode = process.env.HEXA_IDENTITY_STORE ?? "sqlite" } = {}) {
  if (mode === "memory") return new MemoryIdentityStore();
  if (mode === "sqlite") {
    return new SqliteIdentityStore({
      filename: process.env.HEXA_IDENTITY_DB_PATH ?? resolve(process.cwd(), ".data", "hexa-identity.sqlite"),
    });
  }
  if (mode === "postgres") return PostgresIdentityStore.connect();
  throw new Error(`Unsupported HEXA_IDENTITY_STORE mode: ${mode}`);
}

export { MemoryIdentityStore, PostgresIdentityStore, SqliteIdentityStore };
