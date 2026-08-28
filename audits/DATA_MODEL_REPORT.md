# Executive Summary

The LUNE data model is deliberately small — three tables (`orders`, `products`, `feedback`) in `src/lib/db/schema.ts` on Neon Postgres via Drizzle (neon-http driver), with a local JSON fallback per store when `DATABASE_URL` is unset. For a 4-package COD shop the shape is fundamentally sound: orders snapshot their items as JSONB (correct denormalization), products split identity (static `src/data/products.ts`) from editable state (DB rows), and checkout re-prices and reserves stock server-side.

The important gaps are operational, not structural:

1. **No versioned migrations** — schema changes go to production via `drizzle-kit push` with no history, review, or rollback path (HIGH).
2. **Checkout is non-transactional** — the neon-http driver cannot open transactions; stock decrement → order insert relies on best-effort compensation that can silently lose stock (HIGH).
3. **Zero database-level integrity constraints** beyond PK/unique — status, payment method, non-negative stock, and sale-price sanity are enforced only in TypeScript (MEDIUM).
4. **Order lifecycle is too narrow** (`new`/`delivered` only) — a refused COD delivery cannot be cancelled, its stock is never restored, and the admin "Revenue" figure counts undelivered orders and delivery fees (MEDIUM).
5. **Admin reads scale linearly** — every admin page loads the entire `orders` table and filters/archives in JavaScript; no indexes on `created_at`, `status`, or `delivered_at` (MEDIUM, acceptable today).

Nothing here requires destroying data. Every recommendation below has an additive, non-destructive migration path. Static/DB/cache boundaries are already close to right and should mostly be kept as-is.

# Current State

## Schema (`src/lib/db/schema.ts` — single source of truth)

### `orders`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK, `defaultRandom()` | |
| `order_number` | `varchar(16)` NOT NULL UNIQUE | `L-` + 6 chars from a 31-char alphabet, generated in `src/app/[locale]/checkout/actions.ts` |
| `customer_name`, `email`, `city`, `address` | `text` NOT NULL | length limits enforced only by zod (`src/lib/checkout-validation.ts`) |
| `phone` | `varchar(32)` NOT NULL | |
| `items` | `jsonb` NOT NULL | typed `{ slug, name, qty, price }[]` — purchase-time snapshot; no FK to `products` (intentional) |
| `subtotal`, `delivery_fee`, `total` | `integer` NOT NULL | whole JD |
| `payment_method` | `varchar(16)` NOT NULL | only `"cod"` accepted by the checkout action; no DB constraint |
| `status` | `varchar(16)` NOT NULL DEFAULT `'new'` | TS type `OrderStatus = "new" \| "delivered"`; no DB constraint |
| `locale` | `varchar(5)` NOT NULL DEFAULT `'en'` | drives receipt language |
| `created_at` | `timestamptz` NOT NULL DEFAULT now | no index |
| `delivered_at` | `timestamptz` NULL | set when status flips to `delivered`; drives derived auto-archive (`ARCHIVE_AFTER_DAYS = 7`, `src/lib/constants.ts`) |

### `products`
| Column | Type | Notes |
|---|---|---|
| `slug` | `varchar(32)` PK | natural key matching `src/data/products.ts` (apollo, orion, elysia, aurora) |
| `name` | `text` NOT NULL | |
| `base_price` | `integer` NOT NULL | whole JD; seeded from `PACKAGE_PRICE` (35) |
| `sale_price` | `integer` NULL | app enforces `< base_price`; no DB constraint |
| `sale_starts_at`, `sale_ends_at` | `timestamptz` NULL | sale window; `effectivePrice()` in `src/lib/pricing.ts` evaluates at read time |
| `stock` | `integer` NOT NULL DEFAULT 50 | `DEFAULT_STOCK`; no `>= 0` CHECK (app-side conditional UPDATE guards it) |
| `image` | `text` NOT NULL | Vercel Blob URL after first admin upload; static `/products/*.jpg` path before |
| `gallery` | `jsonb` NOT NULL `string[]` | 3 slots managed by `replaceProductImage` in `src/app/admin/products/actions.ts` |
| `poetry`, `character`, `description` | `jsonb` NOT NULL `Record<"en"\|"ar", string>` | bilingual copy — good fit for JSONB, avoids a translations table |
| `updated_at` | `timestamptz` NOT NULL DEFAULT now | maintained in app code (`updateRow` in `src/lib/products.ts`) |

Identity fields (`audience`, `phase`, `accent`, gallery defaults, copy defaults) stay in `src/data/products.ts`; DB rows are seeded from it by `ensureSeeded()` (`INSERT … ON CONFLICT DO NOTHING`) on every read path.

### `feedback`
`id` uuid PK, nullable `name`/`email`, `message text NOT NULL`, `locale varchar(5)`, `created_at timestamptz`. Public insert via `submitFeedback` (`src/components/feedback/actions.ts`, zod max 1000 chars); admin list via `listFeedback` (`src/lib/feedback.ts`). No read/handled flag, no index beyond PK, no rate limiting.

## Consumers

- **`src/lib/orders.ts`** — `createOrder`, `listOrders` (full-table `SELECT … ORDER BY created_at DESC`), `updateOrderStatus`, plus pure helpers `isArchived` (derived at read time — no cron, good) and `filterOrders` (in-memory substring/date filtering). JSON dev fallback `.orders.dev.json`.
- **`src/app/[locale]/checkout/actions.ts`** — zod-validates, re-prices from `getStoreProductsFresh()` (never trusts client totals — correct), `decrementStock` (conditional `UPDATE … WHERE stock >= qty` per item) **before** `createOrder`, compensating `restoreStock` on failure, `sendReceiptEmail` (documented never-throws — verified in `src/lib/email/receipt.ts`), `revalidateTag("products")`.
- **`src/lib/products.ts`** — `getStoreProducts` = `unstable_cache(..., { tags: ["products"] })` for the storefront; `getStoreProductsFresh` (uncached) for checkout and admin; all admin mutations call `revalidateTag("products")`.
- **`src/app/admin/`** — dashboard and orders pages are `force-dynamic`, load **all** orders + fresh products per view; `StatCards` computes revenue as `sum(o.total)` over all orders; `setOrderStatus` in `src/app/admin/actions.ts` is auth-gated; product edit actions in `src/app/admin/products/actions.ts` are auth-gated and zod-validated.
- **Migrations** — `drizzle.config.ts` points `out: "./drizzle"`, but **no `drizzle/` directory exists in the repo**: the only mechanism ever used is `drizzle-kit push`.

# Findings

## F1 — No versioned migration history (HIGH)
`drizzle-kit push` diffs the live database against `schema.ts` interactively. There are no committed migration files, no record of what production's actual schema is, no rollback artifact, and `push` will happily generate destructive statements (column drops, type changes that rewrite tables) if the schema drifts. A rebuild that renames or reshapes columns via `push` is exactly the scenario where production order data gets truncated or dropped. This is the single largest data-loss risk in the project.

## F2 — Non-transactional checkout with best-effort compensation (HIGH)
`src/lib/db/index.ts` uses `drizzle-orm/neon-http`, which does not support transactions (acknowledged in the `decrementStock` doc comment). The checkout sequence is: decrement stock per item → insert order → (on insert failure) `restoreStock`. Failure windows:
- `createOrder` throws (e.g. `order_number` unique collision, network blip) and `restoreStock` **also** fails → stock is silently lost; only a `console.error` remains. There is no ledger or reconciliation query to detect drift between `products.stock` and actual orders.
- Multi-item carts: a mid-loop failure triggers `restoreStock(done)` — same silent-failure exposure.
- Process death between decrement and insert loses stock with no trace.

For current volume this is an accepted micro-race, but it becomes unacceptable the moment a payment gateway is wired (rule: never trust client state; money + stock must move atomically).

## F3 — No database-level integrity constraints (MEDIUM)
Everything beyond NOT NULL / PK / UNIQUE lives only in TypeScript:
- `orders.status` and `orders.payment_method` are free-text `varchar(16)` — a typo'd status from any future code path silently corrupts the admin views (`filterOrders` and `isArchived` compare exact strings).
- No `stock >= 0` CHECK (the conditional UPDATE guards decrements, but `restoreStock` and admin `saveProductStock` write unconditionally).
- No `sale_price < base_price` or `sale_ends_at > sale_starts_at` CHECK (enforced in `saveProductPricing` only).
- No `total = subtotal + delivery_fee` CHECK.

## F4 — Order lifecycle cannot represent reality of COD (MEDIUM)
`OrderStatus = "new" | "delivered"` only. Consequences, all concrete:
- A refused/failed COD delivery has no `cancelled` state; its reserved stock is never restored (stock drains permanently for orders that never complete).
- `StatCards` "Revenue" (`src/app/admin/_components/stat-cards.tsx`) sums `o.total` over **all** orders — including brand-new undelivered COD orders and the 3 JD delivery fee. For COD, revenue before delivery is aspiration, not revenue.
- Re-clicking "delivered" overwrites `delivered_at`, resetting the 7-day archive clock (`updateOrderStatus` always sets `deliveredAt = new Date()`).

## F5 — Admin order queries do all work in JavaScript; no indexes (MEDIUM, fine today)
`listOrders()` pulls every row on every admin page render (`force-dynamic`), then `isArchived`/`filterOrders` run in JS. There is no index on `created_at` (the ORDER BY), `status`, or `delivered_at`. At dozens–hundreds of orders this is genuinely fine and simpler than SQL filters; at thousands it degrades every admin view and there is no pagination. This is a "when it grows" item, not a defect — but the rebuild should not carry the pattern forward unexamined.

## F6 — `ensureSeeded()` runs on every product read, including checkout (LOW)
`listProductRows` → `ensureSeeded()` issues an `INSERT … ON CONFLICT DO NOTHING` round trip on **every** uncached read — every checkout, every admin page. It is idempotent and race-safe (good), but it violates "avoid unnecessary database queries": after the first successful seed of the 4 known slugs, the query is pure overhead in the hottest path.

## F7 — Order number collision has no retry (LOW)
`generateOrderNumber()` gives ~887M combinations; a collision hits the UNIQUE constraint, the whole checkout fails with `error: "server"`, stock is compensated, and the customer must resubmit. Probability is tiny at this scale, but the fix (retry the insert with a fresh number, or suffix from a DB sequence) is one loop.

## F8 — Feedback table is an unbounded, unauthenticated insert target (LOW)
`submitFeedback` is a public server action with zod caps (1000 chars) but no rate limiting, honeypot, or dedupe at any layer, and `message` is unbounded `text` in the DB. A trivial script can bloat the table and the admin feedback page (which also loads all rows). Also: no `handled`/`read` flag, so the admin view can only ever grow.

## F9 — Money as whole-JD integers (LOW, document-and-keep)
`subtotal`/`total`/`base_price`/`sale_price` are integers of whole JD. Correct and simple for 35/3 JD today. Jordan prices in fils (3 decimals); the moment a percentage discount or a gateway (amounts in minor units) arrives, whole-JD integers are insufficient. This is a known constraint to carry, not a bug — but the rebuild should decide it consciously (see Recommendations).

## F10 — Dev JSON fallback: three stores, non-atomic writes (LOW, dev-only)
`.orders.dev.json`, `.products.dev.json`, `.feedback.dev.json` each re-implement read/write with full-file rewrites (torn writes possible on crash) and hand-maintained date-string mirroring (`DevRow` in `src/lib/products.ts`). Acceptable for local dev; just don't let the dual-path complexity grow — every new data feature is currently implemented twice.

## What is right and should be kept (explicitly)
- **JSONB `items` snapshot on orders** — for a 4-product store, an `order_items` table would be over-normalization. The snapshot correctly freezes name/price at purchase time (sale prices captured via `effectivePrice`). Keep.
- **Bilingual copy as `Record<"en"|"ar", string>` JSONB** — avoids a translations table for exactly 2 locales. Keep.
- **Static identity + DB editable-state split for products** — `audience`/`phase`/`accent` are code-level design decisions, not content; keeping them in `src/data/products.ts` is correct. Keep.
- **Derived archive (`isArchived` at read time)** — no cron, no extra status, no migration. Keep.
- **Server-side re-pricing in checkout** — never trusts client totals. Keep.
- **`unstable_cache` + `revalidateTag("products")`** — right cache boundary: cached storefront, fresh checkout/admin, invalidation on every mutation. Keep.

# Severity / Priority

| # | Finding | Severity | Priority |
|---|---|---|---|
| F1 | No versioned migrations; `drizzle-kit push` to prod | HIGH | P0 — before any rebuild schema change |
| F2 | Non-transactional checkout; silent stock loss window | HIGH | P1 — before payment gateway; document now |
| F3 | No DB constraints (status/payment/stock/sale sanity) | MEDIUM | P1 |
| F4 | No `cancelled` status; stock never restored; revenue stat misleading | MEDIUM | P1 |
| F5 | Full-table admin reads; no indexes on `orders` | MEDIUM | P2 — trigger: >~1k orders |
| F6 | `ensureSeeded` query in every hot-path read | LOW | P2 |
| F7 | Order number collision aborts checkout without retry | LOW | P2 |
| F8 | Feedback: no rate limit, no handled flag, unbounded | LOW | P2 |
| F9 | Whole-JD integer money | LOW | P3 — decide at rebuild, revisit at gateway |
| F10 | Triplicated dev JSON stores | LOW | P3 |

# Recommendations

## R1 (fixes F1) — Adopt versioned migrations, baselined non-destructively
1. Run `npx drizzle-kit generate` (no DB connection needed) to produce `drizzle/0000_*.sql` from the current `schema.ts`; commit it.
2. On production, adopt it as a baseline **without executing it** — either `drizzle-kit migrate` after manually inserting the baseline row into `drizzle.__drizzle_migrations`, or use `drizzle-kit push` one final time to confirm zero diff, then switch.
3. All future changes: edit `schema.ts` → `generate` → review the SQL diff in PR → `migrate`. Ban `push` against production (keep it for throwaway dev branches only).
Risk of the step itself: near zero — `generate` is offline; the baseline never executes DDL against existing tables.

## R2 (fixes F3, F4) — Additive lifecycle + constraints migration
All additive; no rewrites, no data loss:
```sql
-- 1. widen the lifecycle (keeps existing values valid)
ALTER TABLE orders ADD COLUMN cancelled_at timestamptz;      -- nullable, additive
-- status stays varchar; constrain it instead of converting to pgEnum
ALTER TABLE orders ADD CONSTRAINT orders_status_chk
  CHECK (status IN ('new','delivered','cancelled')) NOT VALID;
ALTER TABLE orders VALIDATE CONSTRAINT orders_status_chk;    -- separate step; fails only if bad data exists
ALTER TABLE orders ADD CONSTRAINT orders_payment_chk
  CHECK (payment_method IN ('cod','card')) NOT VALID;
ALTER TABLE orders VALIDATE CONSTRAINT orders_payment_chk;
ALTER TABLE orders ADD CONSTRAINT orders_total_chk
  CHECK (total = subtotal + delivery_fee) NOT VALID;
ALTER TABLE orders VALIDATE CONSTRAINT orders_total_chk;

ALTER TABLE products ADD CONSTRAINT products_stock_chk CHECK (stock >= 0) NOT VALID;
ALTER TABLE products VALIDATE CONSTRAINT products_stock_chk;
ALTER TABLE products ADD CONSTRAINT products_sale_chk
  CHECK (sale_price IS NULL OR sale_price < base_price) NOT VALID;
ALTER TABLE products VALIDATE CONSTRAINT products_sale_chk;
```
CHECK-on-varchar is deliberately preferred over `pgEnum`: adding enum values later is an `ALTER TYPE` with transaction caveats, while a CHECK swap (`DROP CONSTRAINT` + `ADD … NOT VALID` + `VALIDATE`) is trivially safe. App changes: extend `OrderStatus` with `"cancelled"`; on cancel, call `restoreStock(order.items)` and set `cancelled_at`; make `updateOrderStatus` set `deliveredAt` only when it is currently NULL (fixes the archive-clock reset); change `StatCards` revenue to sum `delivered` orders only (or show both, labeled). If the CHECK naming ("cancelled", exact stat semantics) needs a business decision, that decision must be made by the owner — do not fabricate refund/return rules beyond "cancel restores stock".

## R3 (mitigates F2) — Transactions where cheap, ledger where not
Two options, in order of preference:
1. **Switch the driver** from `drizzle-orm/neon-http` to `drizzle-orm/neon-serverless` (WebSocket `Pool`) — same `@neondatabase/serverless` package, no new dependency, and `db.transaction()` becomes available. Wrap `decrementStock + createOrder` in one transaction; delete `restoreStock` compensation. Slightly higher per-query latency on cold paths; measure before committing.
2. **If staying on neon-http:** keep the compensation pattern but make drift *detectable*: add a nightly/admin reconciliation query — `DEFAULT_STOCK + sum(restocks) − sum(order item qty for non-cancelled orders)` vs `products.stock` — surfaced as an admin stat. Silent loss is the problem more than the loss itself.
Requirement regardless: this must be resolved as option 1 before any card gateway ships — payment capture and stock/order writes cannot rely on best-effort compensation.

## R4 (fixes F5) — Indexes now (cheap), SQL-side filters later (when needed)
Additive, instant on tables this size:
```sql
CREATE INDEX orders_created_at_idx ON orders (created_at DESC);
CREATE INDEX orders_status_idx ON orders (status);       -- or partial: WHERE status = 'new'
CREATE INDEX feedback_created_at_idx ON feedback (created_at DESC);
```
(Drizzle syntax: second argument callback with `index().on(...)` in `schema.ts`, then `generate`.) Keep in-memory `filterOrders` until order count makes admin pages sluggish (~1k+ rows); then move status/date filters and pagination (`LIMIT/OFFSET` or keyset on `created_at`) into `listOrders` and drop the load-everything pattern. Do not build pagination today — it is not needed for the current volume.

## R5 (fixes F6, F7) — Hot-path hygiene
- Memoize seeding: module-level `let seeded = false` flipped after the first successful `ensureSeeded()` per server instance (the `ON CONFLICT` guard still protects cross-instance races), or move seeding to `drizzle` migration `INSERT … ON CONFLICT DO NOTHING` seed SQL so runtime never seeds.
- Wrap the `createOrder` insert in a small retry (max 2–3 attempts) that regenerates `orderNumber` only on unique-violation errors.

## R6 (fixes F8) — Feedback hardening
Add `handled boolean NOT NULL DEFAULT false` (additive) so admins can triage; add a minimal rate limit on `submitFeedback` (per-IP timestamp check — no new dependency needed; even an in-memory sliding window per instance materially raises the bar). DB-side, a `CHECK (char_length(message) <= 2000)` backstops the zod cap.

## R7 (decides F9) — Money representation: keep integers, name the unit
Keep integer money (correct call — never floats), but in the rebuild rename/document the unit explicitly (`*_jd` whole dinars) **or** migrate to minor units (fils, ×1000) with a non-destructive path: add new column → backfill (`UPDATE SET total_fils = total * 1000`) → switch reads → drop old column only after verified (two-phase, reversible until the final drop). Recommendation: stay whole-JD until a discount/gateway feature actually requires sub-JD amounts; do not add precision speculatively.

## R8 — Static / database / cached boundaries (ruling)
| Data | Where it should live | Status |
|---|---|---|
| Product identity (slug, audience, phase, accent) | Static (`src/data/products.ts`) | Correct today — keep |
| Product editable state (price, sale, stock, images, copy) | Database | Correct today — keep |
| Constants (`PACKAGE_PRICE`, `DELIVERY_FEE`, `ARCHIVE_AFTER_DAYS`, `DEFAULT_STOCK`) | Static (`src/lib/constants.ts`) | Correct — a settings table for 4 constants is over-engineering |
| Storefront product reads | Cached (`unstable_cache` tag `products`) | Correct — keep |
| Checkout & admin product reads | Uncached fresh | Correct — keep |
| Orders / feedback | Database, always fresh | Correct — keep |
| Future discounts (promo codes) | New `discounts` table **only when the feature is commissioned** — current `sale_price` + window fields already cover per-product sales | Feasible later; do not build now |
| Future inventory | Current single `stock` integer suffices; a `stock_movements` ledger only if R3 option 2 is chosen or auditability is requested | Do not build now |

# Risks

- **R1 baseline risk:** if production schema has drifted from `schema.ts` (e.g. a column added manually or by an older push), the generated baseline will not match reality and a later `migrate` could fail or, worse, `push` could propose drops. Mitigation: before baselining, run `drizzle-kit push` in dry/verbose mode (or `drizzle-kit pull`) purely to *compare* — read the diff, apply nothing destructive.
- **R2 VALIDATE risk:** `VALIDATE CONSTRAINT` fails if existing rows violate a check (e.g. a legacy order whose `total ≠ subtotal + delivery_fee`). Mitigation: `NOT VALID` first (instant, protects new writes), query for violations, fix or exclude, then validate. Never add these checks as plain `ADD CONSTRAINT` in one step on production.
- **R3 driver-swap risk:** neon-serverless WebSocket pooling behaves differently in Vercel Fluid/serverless lifecycles (connection reuse, cold start). Mitigation: change only `src/lib/db/index.ts`, keep the `db()` accessor signature identical, test checkout + admin flows on a preview deployment before promoting.
- **Enum-vs-check regret:** converting `status` to a real `pgEnum` later, after CHECKs, is still possible (`ALTER COLUMN … TYPE … USING`) but rewrites the table; the CHECK approach avoids ever needing it.
- **Dual dev/prod code paths (F10):** every schema change must be mirrored in three JSON dev stores; a missed mirror ships bugs that only appear locally (or only in prod). Mitigation for the rebuild: consider a local Postgres (or Neon branch) for dev instead of JSON files — removes ~200 lines of duplicated logic; keep JSON only if offline dev is a hard requirement.
- **Doing nothing risk (F2/F4):** stock drift is currently invisible. With `DEFAULT_STOCK = 50` per product, even a handful of refused COD deliveries or failed compensations will surface as "sold out" products that are physically in stock — a direct revenue loss with no alarm.

# Verification / Testing

1. **Migration pipeline (R1):** in a Neon branch (never production), run `drizzle-kit generate` → `migrate` from empty; then diff against production schema via `drizzle-kit pull` output. Assert zero unexplained differences before baselining prod.
2. **Constraint safety (R2):** before `VALIDATE`, run read-only violation probes, e.g. `SELECT id FROM orders WHERE total <> subtotal + delivery_fee;` and `SELECT id FROM orders WHERE status NOT IN ('new','delivered');` — expect zero rows; investigate any hit before validating.
3. **Checkout atomicity (R3):** integration test against a Neon dev branch: (a) two concurrent checkouts for the last unit of one slug — exactly one succeeds, final stock 0; (b) force `createOrder` to throw (duplicate `order_number` injected) — assert stock is restored; (c) with the transaction driver, kill mid-transaction — assert neither order nor decrement persisted.
4. **Cancel flow (R2 app change):** unit test: cancel a `new` order → stock restored once; cancel twice → restored once (idempotency); revenue stat excludes cancelled and new orders per the chosen definition.
5. **Archive clock fix:** set order delivered → wait/mock 3 days → set delivered again → assert `delivered_at` unchanged and archive date not reset.
6. **Sale-window pricing:** `effectivePrice` boundary tests at `saleStartsAt − 1s / + 1s` and `saleEndsAt ± 1s` (both `Date` and ISO-string inputs — the dual representation in `src/lib/pricing.ts` is a real seam); confirm checkout charges the sale price during the window and base price outside it via `getStoreProductsFresh` (uncached, so no stale-cache pricing).
7. **Seed idempotency (R5):** run `ensureSeeded` (or the seed SQL) twice against a branch DB — 4 rows, no duplicates, admin edits not overwritten by re-seed.
8. **Index effectiveness (R4, when SQL filters land):** `EXPLAIN ANALYZE` the admin list query on a branch seeded with ~5k synthetic orders; assert index scan on `orders_created_at_idx`.
9. **All tests run against local JSON stores or a disposable Neon branch — never the production database** (Phase A constraint, and a good permanent rule).
