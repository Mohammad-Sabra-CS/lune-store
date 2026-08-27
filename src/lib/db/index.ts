import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export function hasDatabase(): boolean {
  if (process.env.DATABASE_URL) return true;
  // Deployed environments must never silently fall back to the local JSON dev
  // stores; a missing DATABASE_URL on Vercel is a configuration error.
  if (process.env.VERCEL) {
    throw new Error(
      "DATABASE_URL is not set in a deployed environment; refusing to use the local dev fallback."
    );
  }
  return false;
}

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function db() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!_db) {
    _db = drizzle(neon(process.env.DATABASE_URL), { schema });
  }
  return _db;
}
