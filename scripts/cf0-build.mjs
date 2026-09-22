// A compatibility build must never read or migrate the production database.
// Use a clean checkout: Next loads env files independently of this process.
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const envFiles = readdirSync(".").filter((name) =>
  /^(\.env($|\.)|\.dev\.vars($|\.))/.test(name),
);
if (envFiles.length) {
  throw new Error("CF-0 requires a clean checkout without local env files.");
}

const env = { ...process.env };
for (const key of [
  "DATABASE_URL", "ADMIN_PASSWORD", "RESEND_API_KEY", "EMAIL_FROM",
  "BLOB_READ_WRITE_TOKEN", "VERCEL", "CF_PAGES", "WORKERS_CI",
  "LUNE_DEPLOYMENT", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_API_KEY",
  "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_EMAIL",
]) {
  delete env[key];
}
env.NEXT_TELEMETRY_DISABLED = "1";
env.WRANGLER_SEND_METRICS = "false";

const result = spawnSync(
  process.execPath,
  ["node_modules/@opennextjs/cloudflare/dist/cli/index.js", "build"],
  { env, stdio: "inherit" },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
