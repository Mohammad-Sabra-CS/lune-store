# Database migrations (WP0)

Versioned Drizzle migrations replace `drizzle-kit push` as the production schema
mechanism. **`drizzle-kit push` is banned against production.**

## The pipeline

```
src/lib/db/schema.ts          edit the schema
        ↓
npm run db:generate           drizzle-kit generate → drizzle/NNNN_*.sql (offline)
        ↓
review the SQL                every migration is code-reviewed like any change
        ↓
npm run db:check              validates migration history consistency (offline)
        ↓
git commit                    drizzle/ (SQL + meta/) is committed history
        ↓
deploy                        `npm run build` runs scripts/migrate-deploy.mjs
                              before `next build`; pending migrations apply,
                              build fails loudly if migration fails
        ↓
production                    applied migrations recorded in
                              drizzle.__drizzle_migrations (hash + timestamp)
```

## Local development vs production

| | Local | Production (Vercel) |
|---|---|---|
| `npm run build` | Migration step **skips loudly** (no `DATABASE_URL` in the script's env) | Migration step **runs**; missing `DATABASE_URL` fails the build |
| Data | JSON dev-store fallback (`.orders.dev.json` etc.) unless `DATABASE_URL` exported | Neon Postgres, always |
| Applying migrations | `npm run db:migrate` with `DATABASE_URL` explicitly exported (deliberate, controlled) | Automatic during deploy build |

`scripts/migrate-deploy.mjs` reads `DATABASE_URL` from **process env only — it
never loads `.env`/`.env.local`**. This is deliberate: a local `npm run build`
can never migrate production by accident. The app itself (`next dev`/`next
build`) still loads `.env.local` as before.

`src/lib/db/index.ts` additionally refuses the JSON dev fallback in deployed
environments: `hasDatabase()` throws if `VERCEL` is set and `DATABASE_URL` is
missing (WP0's one permitted production-safety fix; previously the fallback
engaged silently).

## Baseline (0000_baseline)

Production was introspected read-only on 2026-08-27 before baselining:

- `public` schema **exactly matches** `schema.ts` (all columns, types, defaults,
  nullability, PKs, `orders_order_number_unique`). Zero drift.
- Live data present: 10 orders, 4 products, 1 feedback — preserved untouched.
- No `drizzle.__drizzle_migrations` journal existed (push-only history).

`drizzle/0000_baseline.sql` was generated from the schema and edited **before
first application** to use `CREATE TABLE IF NOT EXISTS`, making adoption a
guaranteed no-op on production while still creating the schema on a fresh
database. It is applied by the first deploy (or a manual `npm run db:migrate`),
which also creates the journal.

**Frozen rule:** never edit a migration file after it has been applied anywhere
(the journal stores a content hash). Schema changes = new migration.

## Identifying applied migrations

`drizzle.__drizzle_migrations` (schema `drizzle`) holds one row per applied
migration (content hash + created_at). The migrator compares it against
`drizzle/meta/_journal.json` and applies only what's pending.

## Rollback, backup, destructive changes

- **Migrations are forward-only.** Drizzle has no automatic down-migrations, and
  the neon-http migrator does not guarantee a multi-statement migration applies
  atomically — do not claim reversibility that doesn't exist.
- **Policy: additive / expand-contract only** in normal work (add nullable
  column → backfill → tighten). This also makes preview-deploy builds (which
  share the production `DATABASE_URL`) safe: an additive migration applied
  early by a preview build cannot break the running production code.
- **Destructive changes** (DROP/ALTER that loses data) require: an explicit,
  separately reviewed migration; a Neon point-in-time restore point / branch
  snapshot taken immediately before; and application only via a production
  deploy — never from a dev machine.
- **Backups:** Neon provides point-in-time restore; take a named branch
  snapshot before any destructive migration and before the payment-gateway
  milestone's driver/transaction change.

## Out of scope for Drizzle

The `neon_auth` schema in the same database belongs to Neon's auth integration.
Drizzle manages only `public`; never generate or hand-write migrations against
`neon_auth`.

## Documented for WP6 (do not fix in WP0)

`ensureSeeded()` in `src/lib/products.ts:83-105` fires an
`INSERT … ON CONFLICT DO NOTHING` on **every** DB product read (including
checkout, twice). WP6 should memoize it per server instance (module-level flag;
the `ON CONFLICT` guard still covers cross-instance races) or move seeding into
a migration/seed SQL so runtime never seeds. Not required for the migration
baseline, so left untouched per WP0 scope.
