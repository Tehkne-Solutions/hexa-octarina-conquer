import { MemoryCompetitionStore } from "./competition-memory.js";

export async function createCompetitionStore({
  mode = process.env.HEXA_COMPETITION_STORE ?? (process.env.DATABASE_URL ? "postgres" : "memory"),
} = {}) {
  if (mode === "memory") return new MemoryCompetitionStore();
  if (mode === "postgres") {
    const { PostgresCompetitionStore } = await import("./competition-postgres.js");
    return PostgresCompetitionStore.connect();
  }
  throw new Error(`Unsupported HEXA_COMPETITION_STORE mode: ${mode}`);
}
