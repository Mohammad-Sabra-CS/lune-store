# Executive Summary

LUNE's backend is a small, well-shaped serverless stack: Next.js 16 server actions + Drizzle over the `@neondatabase/serverless` HTTP driver, a 3-table schema (`orders`, `products`, `feedback`), a tag-cached product read for the storefront, and conditional-UPDATE stock decrements. For a 4-SKU COD store in Jordan this architecture is fundamentally sound — there is no connection-pool risk, oversell is prevented per item, and the storefront serves from cache rather than hitting Neon per visitor.

The audit found **no scalability blocker for realistic launch traffic** (hundreds of concurrent browsers, tens of concurrent checkouts). The material issues are:

1. **A seed-check write query (`INSERT … ON CONFLICT DO NOTHING`) runs on every product read**, including twice per checkout — pure write amplification and latency on the hot path.
2. **Checkout is not atomic and has no idempotency key** — a multi-step, non-transactional sequence (price read → N stock decrements → order insert → email) whose failure compensation is best-effort; duplicate submissions create duplicate orders and double stock decrements.
3. **Unauthenticated write paths (checkout, feedback) have no rate limiting** — a trivial script can drain all stock with fake COD orders (denial-of-inventory) or bloat the feedback table.
4. **Admin order views load the entire `orders` table into memory** with no SQL filtering, pagination, or supporting indexes — fine today, degrades linearly forever.

All fixes below are right-sized: no new services, no queues, no Redis, at most one SQL statement reshaped and a handful of indexes.

# Current State

## Database connection behavior

- `src/lib/db/index.ts` — `neon(DATABASE_URL)` + `drizzle-orm/neon-http`, memoized in a module-level singleton (`_db`). The HTTP driver is **stateless fetch-per-query**: no TCP connections held, no pool to exhaust, safe under Vercel Fluid Compute concurrency where many invocations share one instance. This is the correct driver choice for this workload. **Consequence:** every query is a full HTTPS round trip to Neon, and **the neon-http driver has no interactive transactions** (acknowledged in the comment at `src/lib/products.ts:218-223`).
- `hasDatabase()` gates a dev-only JSON-file fallback (`.orders.dev.json`, `.products.dev.json`, `.feedback.dev.json`). The dev fallback's read-modify-write pattern is racy but never runs in production; not a finding.

## Schema and indexes (`src/lib/db/schema.ts`)

- `orders`: uuid PK, `order_number` UNIQUE (implicit index), jsonb `items` snapshot, integer money (whole JD — correct, no float money), `status` varchar, `created_at`, `delivered_at`. **No index on `created_at`, `status`, or `delivered_at`.**
- `products`: `slug` PK (4 rows), integers for prices/stock, jsonb copy fields. At 4 rows, indexing is irrelevant.
- `feedback`: uuid PK, unbounded growth table, no index on `created_at`.

## Query patterns

- **Storefront** (`/[locale]` layout, home, product pages): `getStoreProducts` (`src/lib/products.ts:145-149`) wraps `loadStoreProducts` in `unstable_cache` keyed `["store-products"]`, tagged `"products"`. Pages use `generateStaticParams`; product data is served from the framework cache, not Neon. Invalidation via `revalidateTag("products", "max")` from every admin product mutation (`src/app/admin/products/actions.ts:23-27`) and every successful checkout (`src/app/[locale]/checkout/actions.ts:108`). **Repeated product browsing does not generate repeated DB queries — good.**
- **Checkout** (`src/app/[locale]/checkout/actions.ts:57-115`): zod-validate → `getStoreProductsFresh()` (uncached, authoritative price/stock) → per-item availability check → `decrementStock` (conditional `UPDATE … SET stock = stock - qty WHERE slug = … AND stock >= qty` per item, `src/lib/products.ts:224-260`) → `createOrder` insert → awaited `sendReceiptEmail` → `revalidateTag`. Failure after decrement triggers `restoreStock` compensation (`src/lib/products.ts:263-285`).
- **Admin** (`force-dynamic`): dashboard and orders pages call `listOrders()` (`src/lib/orders.ts:63-68`) — `SELECT * FROM orders ORDER BY created_at DESC` with **no LIMIT/WHERE**; archive split, text search, and date filtering all happen in JS (`filterOrders`, `src/lib/orders.ts:109-128`; `src/app/admin/orders/page.tsx:43-46`).
- **Seeding**: `ensureSeeded()` (`src/lib/products.ts:83-97`) issues `INSERT … ON CONFLICT DO NOTHING` and is called at the top of `listProductRows`, `updateRow`, and `decrementStock` — i.e., **on every product read and write, forever**, even though it only matters once per environment.

## Concurrency / consistency mechanisms present

- Oversell protection: the conditional decrement (`stock >= qty` in the UPDATE's WHERE) is atomic per item at the Postgres row level. Two concurrent checkouts for the last unit cannot both succeed. **Correct.**
- Client double-submit guard: submit button disabled while `isPending` (`src/components/checkout/checkout-form.tsx:286`). Client-side only.
- Server-side re-pricing: totals, sale price, and delivery fee are computed server-side from fresh DB state; client totals are never trusted. **Correct.**
- Email isolation: `sendReceiptEmail` never throws (`src/lib/email/receipt.ts:145-172`); email failure cannot fail an order. **Correct.**

# Findings

## F1 — Seed check is a write query on every product read (hot path)

`ensureSeeded()` runs an `INSERT … ON CONFLICT DO NOTHING` round trip before **every** product read (`src/lib/products.ts:105, 160, 227`). A single checkout executes it twice (once in `getStoreProductsFresh`, once in `decrementStock`). Every storefront cache-miss render also pays it. With neon-http, that is one extra sequential HTTPS round trip (~10–50 ms to Neon, more cross-region) plus constant write traffic against a 4-row table. Under a checkout burst, Neon sees 2 writes per order that do nothing.

## F2 — Checkout sequence is non-atomic; compensation is best-effort

Because neon-http cannot run transactions, one checkout is ~5+ sequential statements: seed check → product SELECT → seed check → N stock UPDATEs → order INSERT. Failure modes:

- **Order insert fails after stock decremented** (e.g., order-number collision, Neon transient error): `restoreStock` runs, but it is itself a sequence of network calls wrapped in a swallow-all try/catch (`src/lib/products.ts:282-284`). If the process is killed mid-compensation (Fluid instance recycle, timeout), **stock is silently lost** (phantom out-of-stock — never oversell, but lost sales until an admin notices).
- **Multi-item partial decrement**: item 1 decrements, item 2 is sold out → item 1 is restored via the same best-effort path (`src/lib/products.ts:238-241`). Same non-durable window.
- The code comment calls this "an accepted micro-race for a 4-product COD shop" — the *race* is acceptable; the *unlogged-to-durable-storage compensation* is the weak half.

## F3 — No idempotency key: duplicate orders on retry/double-invoke

`placeOrder` has no dedupe mechanism (`src/app/[locale]/checkout/actions.ts:57`). The only guard is the client's disabled button. A flaky mobile connection (common scenario: user's POST completes server-side but the response is lost, user retries), a double-tap before React re-renders, or a replayed request creates **two orders and two stock decrements** for one real purchase. With COD, the cost is a wasted delivery run (3 JD + courier time + customer annoyance) per incident — the most likely real-world consistency failure this store will actually see.

## F4 — No rate limiting on unauthenticated write endpoints (denial-of-inventory)

- `placeOrder` accepts up to 10 line items × qty 20 with any well-formed name/phone/address. A loop of fake COD orders can **zero out all stock in seconds** (default stock 50/SKU ≈ 3–10 requests), taking every product off sale (`isSoldOut` gates purchase and UI) and filling `orders` with garbage. No CAPTCHA, no per-IP throttle, no anomaly guard.
- `submitFeedback` (`src/components/feedback/actions.ts:15`) is an unauthenticated insert of up to ~1.3 KB per call into an unbounded table — a free DB-bloat/cost vector.

This overlaps the security agent's remit; flagged here because the scalability symptom (stock drained, tables bloated, Neon compute burned) is an availability failure. Coordinate before implementing.

## F5 — Admin order views: full table scan + in-memory filtering, no pagination, no indexes

`listOrders()` fetches every row (each carrying a jsonb `items` snapshot) on every admin dashboard/orders view; archive split, search, and date range are computed in JS. The dashboard only needs 5 rows + counts. Fine at 500 orders; at 10k+ orders (2–3 successful years) each admin page view transfers megabytes and does O(n) work. Missing indexes (`created_at DESC`, `status`) make the eventual SQL-side fix slower than it should be.

## F6 — Order-number collision has no retry

`generateOrderNumber()` draws from 31⁶ ≈ 887M (`src/app/[locale]/checkout/actions.ts:48-55`) against a UNIQUE column. Birthday math: ~1% cumulative collision probability by ~4,200 lifetime orders, ~5% by ~9,500. On collision, the insert throws **after stock was decremented** — the customer sees a generic server error and must re-enter checkout. Cheap to make a non-event with a retry loop.

## F7 — Awaited email in the checkout response path

`await sendReceiptEmail(orderInput)` (`src/app/[locale]/checkout/actions.ts:107`) adds Resend's API latency (typically 300–800 ms) to every checkout response once `RESEND_API_KEY` is set. It cannot fail the order, but it slows the single most conversion-sensitive response in the app.

## F8 — Cache invalidation notes (minor)

- Every successful checkout calls `revalidateTag("products", "max")` — correct for stock display, but at high order rates each bust triggers cache-miss reloads that each pay F1's seed query. Fixing F1 removes the sting.
- `unstable_cache` is the legacy API in Next 16 (Cache Components / `"use cache"` is the current direction). The bundled docs in `node_modules/next/dist/docs/` contain only an index page, so the exact `revalidateTag(tag, "max")` profile semantics could not be verified locally — it is used consistently across the codebase and evidently works in production. Verify against canonical Next 16 docs during the rebuild rather than assuming trained knowledge.
- Admin absolute stock writes (`updateProductStock` sets `stock = N`, `src/lib/products.ts:207-209`) can clobber a decrement that lands between the admin reading the form and saving it. Single-admin store → accept, but the rebuilt admin could use a relative adjustment or show a staleness warning.

## What is explicitly fine (do not "fix")

- neon-http driver + module singleton: correct for Vercel Fluid; no pooling work needed. Do **not** introduce a Pool/websocket client except as the deliberate transaction fix in R2.
- Tag-cached storefront reads: browsing traffic does not touch Neon. Many simultaneous browsers are served by the CDN/framework cache.
- Server-side re-pricing and per-item conditional decrement: keep exactly this shape.
- Integer JD money, jsonb order-item snapshots, derived archiving (no cron): all appropriately simple.

# Severity / Priority

| # | Finding | Severity | Likelihood | Priority |
|---|---------|----------|------------|----------|
| F4 | No rate limiting → stock-drain / table-bloat via unauthenticated writes | **High** | Medium (trivial to execute) | P1 |
| F3 | No idempotency → duplicate orders + double decrements | **Medium** | High (flaky mobile networks) | P1 |
| F2 | Non-atomic checkout, non-durable stock compensation | **Medium** | Low–Medium | P2 |
| F1 | Seed write on every product read (latency + write amplification) | **Medium** | Certain (every request) | P2 |
| F5 | Admin full-table scans, no pagination/indexes | **Low now → Medium at ~5k+ orders** | Certain (grows monotonically) | P3 |
| F6 | Order-number collision unretried | **Low** | Low (~1% by 4k orders) | P3 |
| F7 | Awaited email latency in checkout response | **Low** | Certain once Resend is live | P3 |
| F8 | Cache API legacy status / admin stock clobber | **Low** | Low | P4 |

# Recommendations

All are implementable with existing dependencies (Drizzle, zod, Next, Neon) — no new packages except optionally the already-Neon-owned websocket path in R2.

**R1 (P1) — Rate-limit public writes.** Prefer platform-level enforcement first: Vercel WAF rate-limit rules on the checkout/feedback action routes (zero code, zero deps). If code-level is preferred, an in-memory per-instance token bucket keyed by IP (`headers()`) is imperfect under Fluid but blocks naive loops; a durable variant can use a tiny Postgres upsert counter. Also cap `items` uniqueness (reject duplicate slugs in one payload — currently 10 entries × same slug is accepted, `src/app/[locale]/checkout/actions.ts:31-39`). **Expected result:** a scripted loop can no longer zero stock; fake-order rate bounded to the human-plausible range (e.g., ≤3 orders/min/IP).

**R2 (P2) — Make checkout atomic in one statement (fixes F2, shrinks F1/F6 exposure).** Two right-sized options, in order of preference:
   1. *Single-statement decrement:* replace the per-item loop with one `UPDATE products SET stock = stock - v.qty FROM (VALUES …) AS v(slug, qty) WHERE products.slug = v.slug AND products.stock >= v.qty RETURNING products.slug` and verify `rowCount === items.length`; if short, the single statement is itself atomic — Postgres rolls back the whole UPDATE, so **no compensation path is needed for the multi-item case**. Order insert failure still needs `restoreStock`, but the window shrinks to one statement pair.
   2. *Full transaction:* switch `src/lib/db/index.ts` to `drizzle-orm/neon-serverless` (websocket `Pool` from the same `@neondatabase/serverless` package) for the checkout path only, wrap decrement + insert in `db.transaction`. More moving parts; only take this if option 1 proves insufficient.
   **Expected result:** zero possible stock-leak states from multi-item checkouts; compensation code path deleted or reduced to one narrow case.

**R3 (P1) — Idempotency key on orders.** Client generates `crypto.randomUUID()` when the checkout form mounts; add a nullable-then-backfilled `idempotency_key` UNIQUE column to `orders`; `createOrder` uses `ON CONFLICT (idempotency_key) DO NOTHING` + select-existing, returning the original order number on replay. **Expected result:** N identical submissions → exactly 1 order, 1 decrement; duplicate-delivery incidents go to zero.

**R4 (P2) — Seed once, not always.** Remove `ensureSeeded()` from the read/write hot paths. Right-sized options: run seeding as a one-shot script alongside `drizzle-kit push` (a `npm run db:seed` invoking the same `defaultRow` logic), or keep lazy seeding but memoize success in a module-level flag so each warm instance pays it at most once (cold-start-only cost). Keep the dev-JSON path as is. **Expected result:** checkout drops 2 sequential DB round trips (measurable ~20–100 ms p50 improvement); storefront cache-miss drops 1; write QPS to `products` from reads goes to ~0.

**R5 (P3) — Push admin filtering into SQL with indexes.** Add to `src/lib/db/schema.ts`: index on `orders(created_at DESC)`, index on `orders(status)` (or composite `(status, delivered_at)` to serve the archive predicate), index on `feedback(created_at DESC)`; apply via `drizzle-kit push`. Give `listOrders` a filtered/paginated variant (`WHERE`/`ILIKE`/date range/`LIMIT 50 OFFSET`), and a count query for the tab badges; dashboard fetches `LIMIT 5` + counts only. Keep `filterOrders` for the dev-JSON path. **Expected result:** admin page payload and latency flat (O(page)) regardless of order history; holds sub-100 ms query time at 100k orders.

**R6 (P3) — Retry order-number generation.** On unique-violation from the insert, regenerate and retry (2–3 attempts) inside `createOrder`. **Expected result:** collision becomes invisible; no customer-facing failure after a successful stock reservation.

**R7 (P3) — Move receipt email out of the response path.** Use `after()` from `next/server` (Next 16 App Router; verify exact API in canonical docs per AGENTS.md) so the email sends after the response streams, preserving the "email failure never fails the order" invariant by construction. **Expected result:** checkout response time excludes Resend latency (~300–800 ms saved) once emails go live.

**R8 (P4) — During the rebuild**, decide the caching story on current Next 16 primitives (`"use cache"` + `cacheTag` vs `unstable_cache`) from the canonical docs, and make admin stock edits either relative (+/− adjustment) or optimistic-concurrency-checked (`WHERE updated_at = <read value>`).

Recommended architecture: **unchanged** — Vercel + server actions + Neon HTTP driver + tag-cached product reads, with R1–R7 applied. No queues, no Redis, no microservices; nothing in this store's plausible traffic (a national 4-SKU launch spike is still only tens of checkouts/minute) justifies them.

# Risks

- **If nothing changes:** most probable incidents are (1) a duplicate-order delivery every few hundred real orders on mobile networks (F3), (2) a malicious or accidental stock-drain making the whole store unbuyable until an admin resets stock (F4), (3) slow admin pages in year 2+ (F5). Catastrophic data loss or oversell is *not* a risk in the current design.
- **R2 option 2 (websocket transactions)** reintroduces connection lifecycle concerns on Fluid Compute (pool per instance, idle disconnects); that is why option 1 (single-statement) is preferred.
- **R1 in-memory rate limiting** is per-instance under Fluid and can both under-block (multi-instance) and over-block (NAT'd Jordanian mobile carriers put many users behind few IPs — set generous limits). Platform WAF avoids both failure modes.
- **R5 pagination** changes admin UX (tab counts need dedicated count queries); coordinate with the admin/UX agent.
- **Next 16 API drift:** `revalidateTag` profiles, `after()`, and cache directives could differ from trained assumptions; the local docs bundle is index-only, so every framework-API change in the rebuild must be verified against the real Next 16 docs first (AGENTS.md requirement).
- **Migration risk:** new UNIQUE column (R3) and indexes (R5) via `drizzle-kit push` on the live Neon DB — additive and safe, but run against a branch/preview database first; never test against production (binding constraint).

# Verification / Testing

All tests run locally (dev JSON store) or against a **Neon branch database** — never production.

1. **Oversell race (must already pass, and must keep passing after R2):** seed a product to stock 1 on a Neon branch; fire 10 parallel `placeOrder` calls for qty 1 (script with `Promise.all`); assert exactly 1 order row and stock 0, 9 `soldOut` results.
2. **Multi-item atomicity (R2):** stock A=5, B=0; concurrent orders for {A×1, B×1}; assert A remains 5 (no transient decrement visible, no compensation log lines), 0 orders created.
3. **Idempotency (R3):** call `placeOrder` twice with the same idempotency key (simulate lost response); assert 1 order row, stock decremented once, both calls return the same order number.
4. **Rate limit (R1):** 50 sequential fake checkouts from one IP; assert cutoff at the configured threshold and that stock is not exhausted; verify a normal single checkout from the same IP after cooldown succeeds.
5. **Hot-path query count (R4):** with Neon query logging (or a driver-level counter in dev), count statements per checkout before/after — expect a reduction of ≥2 round trips; measure p50/p95 of `placeOrder` before/after (target: measurable drop, no regressions).
6. **Admin at scale (R5):** script-insert 50k synthetic orders into a Neon branch; load `/admin/orders` — target < 500 ms server render and payload proportional to page size, not table size; `EXPLAIN ANALYZE` the filtered query to confirm index usage (no Seq Scan on orders).
7. **Collision retry (R6):** unit-test `createOrder` with a mocked first-insert unique violation; assert a second attempt succeeds and the customer-visible result is `ok: true`.
8. **Email out-of-band (R7):** with a mocked slow Resend (2 s delay), assert checkout response returns before the email completes and that an email failure produces only a log line, never an order failure.
9. **Load smoke:** a simple autocannon/k6 run against local `npm run build && npm run start` — 100 concurrent browsers on `/` and `/en/product/apollo` (expect cache-served, near-zero DB queries), 20 concurrent checkouts (expect 0 errors, 0 negative stock, order count == successful responses).

# Phase C — Review of Proposed Architecture

Scope: scalability/concurrency review of "# Phase B — Consolidated Target Architecture" in `audits/ARCHITECTURE_REPORT.md` (§1–§5), against Phase A findings F1–F8 above. Verdicts cover the work packages and rulings that touch this agent's remit.

## Coverage of Phase A findings

| Phase A finding | Phase B disposition | Resolved? |
|---|---|---|
| F1 seed-on-every-read | WP2 seed-once (script + per-instance memo) | Yes |
| F2 non-atomic checkout | T1 staged: single-statement decrement now, transaction at gateway milestone | Partially — see T1 review below |
| F3 no idempotency | WP2 idempotency key (unique column) | Yes, **with the ordering condition below** |
| F4 rate limiting | WP3 WAF + honeypot/min-time, no Redis (T3) | Yes — matches R1, including the NAT-generosity warning |
| F5 admin scans/indexes | WP5 indexes now; SQL-side filters deferred to ~1k-order threshold | Yes — consistent with my P3 rating |
| F6 collision retry | WP2 | Yes, with the constraint-discrimination condition below |
| F7 awaited email | WP4 `after()` | Yes |
| F8 cache/stock-clobber notes | WP6 `use cache` migration; admin absolute-stock clobber **not addressed** | Mostly — one gap noted below |

## Verdicts per work package

**WP0 (migrations baseline + Neon branch tests) — APPROVED.** Prerequisite for every schema item below and for my Verification plan (tests 1–6 all require Neon branches).

**WP2 (checkout integrity) — APPROVED WITH CONDITIONS.** The components are all correct individually; the *composition* has one genuine concurrency flaw as written.

- **Condition C1 — pipeline ordering (blocking).** The §3 blueprint specifies "re-price fresh → atomic decrement → idempotent insert w/ retry". As ordered, the idempotency key dedupes the *order row* but not the *decrement*. Replay scenario: attempt 1 decrements and inserts successfully but the response is lost; the client retries with the same key; attempt 2 **decrements again**, then its insert hits the unique conflict and returns the existing order. Result: one real order, two decrements — the exact defect the key exists to prevent, now moved one statement earlier. Required algorithm:
  1. `SELECT` order by idempotency key; if found, return it (no decrement) — handles the common retry-after-success case.
  2. Single-statement atomic decrement.
  3. `INSERT … ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`; if **no row returned** (a concurrent duplicate won the race between steps 1 and 3), restore this request's decrement, then select and return the winner's order.
  The read-check (step 1) alone is TOCTOU-racy and must never be the only guard; the unique constraint (step 3) alone double-decrements on replays. Both are required, plus the conflict-loser-restores rule. This directly answers the coordinator's "unique constraint vs read-check" question: **constraint = correctness authority, read-check = required fast path, conflict handler = the reconciliation.**
- **Condition C2 — collision retry must discriminate constraints.** With two unique columns on `orders` (`order_number`, `idempotency_key`), the retry-on-unique-violation loop (my R6) must inspect **which** constraint fired. Retrying a `idempotency_key` conflict as if it were an order-number collision would regenerate the number and re-insert — either looping forever or, worse, creating a duplicate order under a fresh key. Order-number conflict → regenerate number, same key, retry; idempotency conflict → fetch and return the existing order.
- **Condition C3 — keep the insert-failure compensation until the gateway milestone.** §3 says the compensation path is "deleted for multi-item" (correct — the single statement makes it structurally unnecessary) but Phase 4 says "delete the now-dead compensation code". Only the *multi-item partial* path is dead now. The decrement-succeeded-insert-failed path still needs `restoreStock` until a real transaction exists. The deletion in Phase 4 must be scoped accordingly.
- **Condition C4 — idempotency key lifecycle.** Key generated at checkout-form mount must be **regenerated after a successful order and on any cart mutation**; otherwise a customer who orders, adds more items, and checks out again in the same mounted form replays the old key and silently receives their previous order. One `useRef` reset in the success handler; cheap, but it must be specified.

**T1 ruling (staged atomicity) — APPROVED WITH CONDITIONS, and one rationale correction.** The staging itself is the right call: the single-statement `UPDATE … FROM (VALUES …) … RETURNING` is genuinely atomic for the multi-item case (Postgres single-statement semantics; the per-row `stock >= qty` qual re-evaluates correctly under READ COMMITTED row-lock re-check, which is exactly why the current per-item decrement never oversells), and deferring the WebSocket-Pool driver to the gateway milestone avoids new connection semantics on Fluid for zero present benefit. **However, the ruling's residual-risk claim is overstated:** "order-insert failure after a successful decrement is covered by the idempotency key (retry reuses the reservation)" is not true under the proposed design. If the insert fails, **no order row exists**, so a retry finds nothing to reuse — it decrements fresh stock, and the failed attempt's units come back only via best-effort `restoreStock`. There is no "reservation" object; the key covers *duplicate orders*, not *orphaned decrements*. The residual window is therefore: P(insert fails after decrement) × P(compensation also fails) — small, never-oversells, COD-tolerable, and I still endorse the staging — but it must be covered by a **real, implemented safety net, not a rationale**:
- **Condition C5 — the drift-detection query ships in WP2, not later.** T1 mentions DATA's drift check "as an admin stat"; make it in-scope for WP2: `stock_expected = DEFAULT/admin-set baseline − SUM(qty of non-cancelled orders)` vs actual `products.stock`, surfaced on the admin dashboard. It is the declared backstop for the accepted residual; deferring it makes the residual silently unbounded in time.
- Note for the gateway milestone: a data-modifying CTE folding decrement + insert into one statement is *not* a safe shortcut to skip the driver swap — all CTE side effects commit together even when the gating branch selects zero rows, and cross-CTE visibility under EvalPlanQual makes an "all-or-nothing multi-item + insert" single statement subtly wrong. The planned transaction is the correct end state; don't let anyone "optimize" it into a CTE.

**WP3 (abuse protection) — APPROVED.** Matches Phase A R1 precisely, including rejecting in-memory limiters and Redis. One sizing note: WAF checkout thresholds must be set assuming Jordanian carrier NAT (many legitimate users per IP) — generous per-IP order limits (e.g., per-hour not per-minute granularity for the hard block), with the honeypot/min-time carrying the fine-grained load. Also confirm the duplicate-slug `refine` (WP2) rejects, not merges, duplicate slugs — merging would change totals the client didn't see; the paired `expectedTotal` equality check then correctly forces a "priceChanged" re-confirm.

**WP4 (email via `after()`) — APPROVED.** Preserves the never-throws invariant by construction; removes 300–800 ms from the checkout p95. Verify `after()` semantics against the bundled Next 16 docs at implementation time (AGENTS.md).

**WP5 (indexes, cancelled lifecycle) — APPROVED WITH CONDITIONS.**
- **Condition C6 — cancel must be a guarded transition executed BEFORE the restore.** "Cancel → restore-stock-once idempotently" is the right intent; the safe implementation order is: (1) `UPDATE orders SET status='cancelled', cancelled_at=now() WHERE id=$1 AND status <> 'cancelled' RETURNING id` — the row-level guard makes the *transition* the once-latch; (2) only if a row returned, restore stock with the existing relative `stock + qty` update. Reversing the order (restore first) lets two concurrent cancel clicks (double-tap, two admin tabs) both restore. The residual (crash between transition and restore → cancelled order whose stock never returned) is the mirror of the checkout residual and is caught by the same C5 drift query — which is another reason C5 ships early.
- Index detail: prefer the composite `(status, delivered_at)` (already suggested in my R5 and echoed by ARCH) over a bare `status` index, since the archive predicate always pairs them; `created_at DESC` as planned.
- Dashboard note: even before the deferred SQL-side filter work, the dashboard's `listOrders().slice(0, 5)` should become `LIMIT 5` + count queries when WP5 touches this file anyway — two lines, removes the largest recurring full-table read.

**WP6 (`use cache` migration, ClientProduct) — APPROVED**, with the plan's own verification condition emphasized: prove `revalidateTag("products", "max")` reaches the `cacheTag("products")` scope on a preview deployment **before** deleting the `unstable_cache` wrapper, and keep `getStoreProductsFresh()` uncached (correctly frozen in §2). The ClientProduct slimming has no concurrency impact; approved as-is.

## Concurrency edge cases the proposal misses (add before implementation)

1. **Concurrent duplicate submissions (not just sequential retries)** — two in-flight requests with the same idempotency key racing between the pre-check and the insert. Covered by C1's conflict-loser-restores rule; absent from the Phase B text.
2. **Constraint ambiguity in the retry loop** — C2 above.
3. **Cancel double-fire ordering** — C6 above.
4. **Admin absolute stock write clobbering a concurrent checkout decrement** (Phase A F8, unaddressed in Phase B): admin reads stock 50, a checkout decrements to 49, admin saves "50" → the sale's decrement is erased and drift begins. Right-sized fix inside WP5's admin work: optimistic guard (`WHERE stock = <value shown in the form>` with a "stock changed, re-check" error) or a relative +/− adjustment control. Low severity, two lines, and it protects the C5 drift metric from false positives.
5. **Idempotency-key staleness across successive orders in one session** — C4 above.

## 10k-visitor spike assessment

No structural break. Specifics:
- **Browsing:** storefront pages are SSG/tag-invalidated and the perf budget mandates 0 runtime DB round trips on cache hit — 10k browsers are absorbed by the CDN/framework cache; Neon sees only cache-miss reloads (1 SELECT each after seed-once). The per-checkout `revalidateTag` means a busy spike re-busts the cache continuously (worst case one reload per order) — at even 100 orders/min that is ~2 trivial SELECTs/s. Fine.
- **Checkout concurrency:** neon-http is stateless fetch-per-query — no pool to exhaust under Fluid fan-out; the single-statement decrement serializes correctly on Postgres row locks (4 hot rows; lock hold time is one statement — microseconds). Oversell remains impossible; the last-unit race degrades to fast, correct `soldOut` responses.
- **Budget arithmetic nit:** the adopted budget says "checkout ≤ 2 + 1-per-item round trips", but the corrected C1 pipeline is: idempotency pre-check (1) + fresh product read (1) + decrement (1) + insert (1) = **4 round trips flat for any cart size** — better than the stated budget for multi-item carts, one over it for the theoretical 1-item formula reading. Restate the budget as "≤ 4 DB round trips per checkout regardless of cart size" so CI doesn't encode the wrong shape.
- **WAF under NAT:** the only spike-specific failure mode I can construct is self-inflicted — WAF checkout limits tuned too tight for carrier-NAT'd traffic during a promotion. Set thresholds from the honest ceiling (a national 4-SKU launch is tens of checkouts/minute total) with headroom, and stage a WAF-rule dry-run (log-only mode) during the first real campaign.
- **Neon scale-to-zero:** first query after idle pays a compute-resume latency; irrelevant mid-spike (warm) but worth knowing for the *first* customer of the day. No action needed at this scale.

## Summary of verdicts

| Item | Verdict |
|---|---|
| WP0 | APPROVED |
| WP2 | APPROVED WITH CONDITIONS C1–C4 |
| T1 ruling (staged atomicity) | APPROVED WITH CONDITIONS — staging is safe **only with** C1/C3/C5; the "idempotency key covers the residual" rationale is incorrect as written and must not be relied on |
| WP3 | APPROVED (NAT-sizing note) |
| WP4 | APPROVED |
| WP5 | APPROVED WITH CONDITIONS C6 + composite index + dashboard LIMIT |
| WP6 | APPROVED (tag-reachability proof before deleting `unstable_cache`) |
| Perf budget | APPROVED with the round-trip wording fix |

No OBJECTION-level items: nothing in the proposal makes concurrency *worse* than today, and every condition above is a specification-level correction implementable within the already-approved work packages — no new dependencies, no architecture change.
