// Applies pending Drizzle migrations from ./drizzle against DATABASE_URL.
//
// Invoked two ways:
//   - `npm run build`      → deploy-time step (Vercel). Missing DATABASE_URL is
//                            fatal on Vercel, a loud no-op skip locally.
//   - `npm run db:migrate` → manual controlled run (passes --require-db, so a
//                            missing DATABASE_URL is always fatal).
//
// DATABASE_URL is read from process.env ONLY — deliberately no .env/.env.local
// loading, so a local `npm run build` can never migrate production by accident.
// Migrating from a dev machine requires exporting the variable explicitly.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const requireDb = process.argv.includes("--require-db");
const url = process.env.DATABASE_URL;

if (!url) {
  if (process.env.VERCEL || requireDb) {
    console.error(
      "[migrate] FATAL: DATABASE_URL is not set. Deployed environments must always migrate; refusing to continue."
    );
    process.exit(1);
  }
  console.warn(
    "[migrate] DATABASE_URL not set — skipping migrations for this local build. " +
      "The dev JSON fallback stores are unaffected. To migrate a real database, run `npm run db:migrate` with DATABASE_URL exported."
  );
  process.exit(0);
}

const { neon } = require("@neondatabase/serverless");
const { drizzle } = require("drizzle-orm/neon-http");
const { migrate } = require("drizzle-orm/neon-http/migrator");

try {
  const db = drizzle(neon(url));
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[migrate] OK — all pending migrations applied (journal: drizzle.__drizzle_migrations).");
} catch (err) {
  console.error("[migrate] FATAL: migration failed —", err instanceof Error ? err.message : err);
  process.exit(1);
}
