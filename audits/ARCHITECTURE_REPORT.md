# Executive Summary

LUNE is a small, well-shaped Next.js 16 App Router codebase (~95 tracked files, ~40 client components) with a healthy server/client split, a single data-access layer under `src/lib/`, server-actions-only mutations (zero API routes), and server-side re-pricing at checkout. Type check (`npx tsc --noEmit`) passes clean. The architecture is fundamentally sound for a 4-product COD store and should be treated as the reference skeleton for the rebuild, not discarded.

The most significant issues found:

1. **A database write runs on every product read** — `ensureSeeded()` issues an `INSERT … ON CONFLICT DO NOTHING` before every uncached read, including every checkout and every admin page view (`src/lib/products.ts`).
2. **`unstable_cache` is a replaced API in Next 16** — the bundled Next docs state it has been superseded by the `use cache` directive; the storefront product cache sits on a deprecated foundation (`src/lib/products.ts:145`).
3. **Checkout stock reservation is non-transactional** — per-item conditional decrements with best-effort compensation because the `neon-http` driver has no transactions; documented as an accepted micro-race, but a transactional driver exists and removes the race entirely.
4. **Triplicated dev-store fallback logic** — the JSON-file fallback (`devRead`/`devWrite`) is copy-pasted across `orders.ts`, `products.ts`, and `feedback.ts`.
5. **Admin auth gate is repeated in five pages** and the `/admin` subtree has no proxy/middleware protection layer — pages and actions are the sole gates (they do check consistently, which is correct defense-in-depth, but the pattern is duplicated).

No functionality should be deleted. All findings below have concrete file/line citations and defined replacement behavior.

# Current State

## Stack (verified against `package.json` and `node_modules/next/dist/docs/`)

- Next.js 16.3.0 (Turbopack), React 19.2.8, TypeScript 5, Tailwind v4 (`@tailwindcss/postcss`)
- next-intl v4 — locale routing in `src/proxy.ts` (Next 16 proxy convention, named `config` matcher excludes `api|admin|_next|_vercel|.*\..*`)
- shadcn on `@base-ui/react` (Button uses `render={<Link/>}`, no `asChild`)
- Drizzle ORM + `@neondatabase/serverless` (neon-http driver, lazily constructed singleton in `src/lib/db/index.ts`)
- `motion` v13 (framer-motion correctly absent), `zod` v4, `resend`, `@vercel/blob`, `lucide-react`
- Two root layouts (`src/app/[locale]/layout.tsx`, `src/app/admin/layout.tsx`), each owning `<html>`; `experimental.globalNotFound` provides the branded 404 outside both (`next.config.ts:11`, `src/app/global-not-found.tsx`)

## Layering (as it exists today)

| Layer | Location | Notes |
|---|---|---|
| Static product identity | `src/data/products.ts` | 4 packages (Apollo, Orion, Elysia, Aurora), slug/audience/phase/accent + seed copy |
| Editable product state | `src/lib/db/schema.ts` (`products` table) + `src/lib/products.ts` | price, sale window, stock, images, copy — seeded from static file on first read |
| Business constants | `src/lib/constants.ts` | `PACKAGE_PRICE` 35, `DELIVERY_FEE` 3, `MAX_QTY_PER_ITEM` 20, `ARCHIVE_AFTER_DAYS` 7, `DEFAULT_STOCK` 50 |
| Pure business logic | `src/lib/pricing.ts` (`effectivePrice`, `isSoldOut`), `src/lib/orders.ts` (`isArchived`, `filterOrders`) | isomorphic, no I/O — good |
| Shared validation constants | `src/lib/checkout-validation.ts` | single source for client validator and server zod schema — good pattern |
| Data access | `src/lib/orders.ts`, `src/lib/products.ts`, `src/lib/feedback.ts` | each with Neon path + `.{name}.dev.json` fallback |
| Mutations | Server actions only: `src/app/[locale]/checkout/actions.ts`, `src/components/feedback/actions.ts`, `src/app/admin/actions.ts`, `src/app/admin/products/actions.ts` | zero `app/api` route handlers |
| Auth | `src/lib/admin-auth.ts` | SHA-256(password)-derived cookie, checked per admin page and per admin action |
| Email | `src/lib/email/receipt.ts` | bilingual HTML; never throws; log-only without `RESEND_API_KEY` — matches the stated rule |
| UI state | `src/components/cart/cart-context.tsx` (localStorage cart), `src/components/product/products-context.tsx` (server-resolved catalog handed to client) | |

## Data flow

- **Storefront read path:** `[locale]/layout.tsx:79` calls `getStoreProducts()` (an `unstable_cache` wrapper tagged `"products"`) once per render and feeds the full `StoreProduct[]` into the client `ProductsProvider`. Home and product pages call `getStoreProducts()` again (deduped by the cache). Sale-window expiry is evaluated **client-side at view time** in `purchase-panel.tsx`/`product-card.tsx` via `effectivePrice(product, now)` — a deliberate and sound choice that lets static pages show correct sale state without revalidation.
- **Checkout write path** (`checkout/actions.ts:57-115`): zod-parse → re-price from `getStoreProductsFresh()` (uncached, authoritative) → conditional `decrementStock` → `createOrder` → `sendReceiptEmail` (non-fatal) → `revalidateTag("products", "max")`. Client totals are never trusted (rules 14/15 satisfied).
- **Admin write path:** every action in `admin/actions.ts` and `admin/products/actions.ts` independently re-checks `isAdminAuthenticated()` before mutating, then revalidates tag + paths.
- **Cache invalidation:** single tag `"products"`, revalidated by checkout stock changes and all four admin product mutations. Orders/feedback admin pages are `force-dynamic` and read fresh.

## Server/Client component inventory

40 files carry `"use client"`. Nearly all are justified leaves (cart, forms, Motion primitives, Base UI wrappers, admin forms). All pages and both layouts are Server Components. The notable boundary observations are in Findings F3, F12.

# Findings

## F1 — DB write on every product read (`ensureSeeded`)
`src/lib/products.ts:83-97` — `ensureSeeded()` executes `INSERT … ON CONFLICT DO NOTHING` (4 rows) and is called by `listProductRows()` (`:104-105`), `updateRow()` (`:160`), and `decrementStock()` (`:227`). Because `getStoreProductsFresh()` is uncached and used by **every checkout submission and every admin products/dashboard page view**, each of those requests pays an extra DB round-trip that does nothing after first boot. On the cached storefront path it also runs on every cache miss/revalidation. This violates rule 12 (avoid unnecessary database queries) and rule 9 (every request must have a clear reason).

**Replacement behavior:** seed once — either a per-process memo (`let seeded = false; if (seeded) return;` — resets per cold start, still ~1 write per instance instead of per request) or, better, an explicit seed step (`npx drizzle-kit push` + a `scripts/seed.ts` run at deploy). Expected result: one fewer DB round-trip on every checkout and admin page view.

## F2 — `unstable_cache` is a replaced API in Next 16
`src/lib/products.ts:2,145-149`. `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_cache.md` states: *"This API has been replaced by `use cache` in Next.js 16. We recommend opting into Cache Components and replacing `unstable_cache` with the `use cache` directive."* The current code works, and the paired `revalidateTag("products", "max")` two-argument form (`checkout/actions.ts:108`, `admin/products/actions.ts:24`) is the **correct, current** signature (the single-argument form is what's deprecated) — so only the cache wrapper itself is on borrowed time.

**Replacement behavior:** in the rebuild, mark `loadStoreProducts` with `use cache` + `cacheTag("products")` (Cache Components), keeping `getStoreProductsFresh()` as the uncached authoritative read. No behavior change; removes the deprecated API.

## F3 — Full bilingual catalog serialized into every page's RSC payload
`src/app/[locale]/layout.tsx:79,96` passes the complete `StoreProduct[]` — including **both** locales of `poetry`, `character`, and `description`, plus full gallery arrays — into the client `ProductsProvider` on every route (home, shop, product, checkout, confirmation). Client consumers (`cart-context`, `cart-drawer`, `product-card`, `checkout-form`, `purchase-panel`) only ever read the *active* locale's `poetry` (product card) and never read `character`/`description` at all — those are consumed server-side in `product/[slug]/page.tsx:75-93`. At 4 products this is a few KB, not a crisis, but it doubles localized copy and ships unused fields on every navigation.

**Replacement behavior:** provide a slimmed, locale-resolved shape to the client (slug, name, image, audience, phase, accent, price, salePrice, saleStartsAt/EndsAt, stock, poetry[activeLocale]). Expected result: smaller RSC payload on every page, no duplicated non-active-locale copy in HTML, no admin-edited long copy leaking into every storefront response.

## F4 — Dev JSON fallback logic triplicated
Identical `devRead`/`devWrite` + `hasDatabase()` branching pattern in:
- `src/lib/orders.ts:29-43` (`.orders.dev.json`)
- `src/lib/products.ts:30-97` (`.products.dev.json`, plus a `DevRow` ISO-string mirror type)
- `src/lib/feedback.ts:20-34` (`.feedback.dev.json`)

Three copies of file-store plumbing, three chances for drift (products already needed its own date-normalization variant).

**Replacement behavior:** one `src/lib/dev-store.ts` helper — `createDevStore<T>(file)` returning `{ read, write }` — consumed by all three modules. Expected result: ~80 fewer duplicated lines and a single place to fix fallback behavior.

## F5 — Checkout stock reservation is non-transactional
`src/lib/products.ts:224-285` performs per-item conditional `UPDATE … WHERE stock >= qty`, with best-effort `restoreStock` compensation on partial failure, and `checkout/actions.ts:105-114` compensates again if `createOrder` throws. The comment honestly documents this: *"neon-http has no transactions — an accepted micro-race."* Failure windows: (a) multi-item partial decrement then crash before restore; (b) order-insert failure after decrement with a failed restore → stock permanently understated.

**Replacement behavior:** switch `src/lib/db/index.ts` from `drizzle-orm/neon-http` to the WebSocket `Pool` client (`drizzle-orm/neon-serverless`), which supports `db.transaction()`, and wrap decrement+insert in one transaction; or perform all decrements in a single SQL statement (`UPDATE products SET stock = stock - v.qty FROM (VALUES …) …` with a row-count check). Same dependency (`@neondatabase/serverless`), no new package. Expected result: the compensation code (`restoreStock` and both call sites) becomes unnecessary and the race disappears.

## F6 — Admin gate duplicated across five pages; no route-level protection layer
`if (!(await isAdminAuthenticated())) return <LoginForm />;` appears in `src/app/admin/page.tsx:13`, `orders/page.tsx:28`, `products/page.tsx:32`, `feedback/page.tsx:10`, `products/[slug]/page.tsx:20`. `src/proxy.ts:12` deliberately excludes `/admin` from the proxy, so there is no request-level check — pages and actions are the entire gate. To the codebase's credit, **every admin server action independently re-checks auth** (`admin/actions.ts:40`, `admin/products/actions.ts:54,85,126,154`), which is the correct place per Next.js guidance (layouts don't re-render on soft navigation and must not be the only gate).

**Replacement behavior:** keep per-action checks exactly as they are; extract the page gate into one helper (e.g. `const admin = await requireAdmin(); if (!admin) return <LoginForm />;` or an `<AdminGate>` server wrapper) so the rule lives in one file. Optionally add a cheap cookie-presence check for `/admin/*` in `src/proxy.ts` as a first-layer filter (never the only layer). Expected result: one auth code path instead of six.

## F7 — Admin auth token design (flag for Security agent — boundary note only)
`src/lib/admin-auth.ts:6-27`: the cookie value is a static, unsalted `sha256("lune:" + ADMIN_PASSWORD)` — it never rotates, never expires server-side (only the 12h cookie `maxAge`, `admin/actions.ts:23`), logout only deletes the cookie, and `password !== process.env.ADMIN_PASSWORD` is not a timing-safe comparison; there is no login rate limiting. Architecturally the *placement* is right (single module, checked at every entry point); the token scheme itself belongs to the Security agent's report. Not expanded here per global rule 2.

## F8 — Order-number generation has no collision handling
`checkout/actions.ts:48-55` generates `L-` + 6 chars from a 31-char alphabet (~887M combinations) with `Math.random()`. `orders.order_number` is `UNIQUE` (`schema.ts:13`), so a collision makes `createOrder` throw → customer sees a generic server error after stock was decremented and restored. Probability is negligible at this scale, but the failure mode is a lost sale.

**Replacement behavior:** retry once or twice on unique-violation before failing (3-line loop around `createOrder`). Expected result: collision becomes invisible to the customer.

## F9 — Admin order queries load everything and filter in memory
`src/lib/orders.ts:63-68` (`listOrders` = full table scan, all columns) feeds `admin/orders/page.tsx:43-46` (in-memory `isArchived` partition + `filterOrders`) and `admin/page.tsx:17-21` (stats over all orders + `slice(0, 5)`). At current volume this is fine and keeps the dev-JSON fallback trivial; it becomes a real cost only as orders accumulate (every dashboard view transfers the full order history from Neon). Also note `StatCards` "Revenue" (`admin/_components/stat-cards.tsx:15`) sums **all** orders including undelivered COD — a business-metric choice worth confirming, not a bug.

**Replacement behavior (when rebuilding, not urgent):** push `status`/date/search filters and `LIMIT` into the Drizzle query (`where`, `ilike`, `limit`), keeping `filterOrders` for the dev-store path. Expected result: bounded query cost as order history grows.

## F10 — `shadcn` CLI shipped as a runtime dependency
`package.json:25` lists `"shadcn": "^4.16.2"` under `dependencies`. It is a code-generator CLI, imported nowhere in `src/` (verified — no `from "shadcn"` imports). It is not bundled into the client, but it inflates production `npm install` and the serverless build surface for no reason.

**Replacement behavior:** move to `devDependencies`. Expected result: identical builds, smaller prod install.

## F11 — Dual source of truth for product content (deliberate, needs one guard)
Product name/copy/images exist in `src/data/products.ts` (identity + seed defaults) **and** in the `products` table (live values, admin-editable). `merge()` (`products.ts:115-130`) always prefers the DB row, so **edits to the static file after first seeding are silently ignored** for every field except `audience`/`phase`/`accent`/`slug`. This split is documented in code comments and is a reasonable design; the trap is a future developer "fixing" copy in `products.ts` and seeing no change.

**Replacement behavior:** keep the split; add a comment in `src/data/products.ts` stating which fields are seed-only, and/or an admin "reset to defaults" action per product. No schema change.

## F12 — Minor client-component overreach (low value, note only)
- `src/components/ui/table.tsx` and `src/components/ui/separator.tsx` are marked `"use client"` but render no interactivity themselves (shadcn defaults; separator may wrap a Base UI primitive — verify before changing). `table.tsx` is currently only consumed from the client `orders-table.tsx`, so the practical cost is zero today.
- `src/components/layout/header.tsx:36-66` vs `:83-111`: the cart button (badge + spring animation) is duplicated verbatim for the mobile and desktop layouts. Extract one `<CartButton>`; ~20 duplicated lines.
- `header.tsx` is fully client for a scroll flag + cart count; splitting nav links into a server shell is possible but not worth the churn given translations are needed anyway.

## F13 — No tracked migrations
`drizzle.config.ts` declares `out: "./drizzle"`, but no migration files are committed; the workflow is `drizzle-kit push` (per CLAUDE.md). Fine for a solo-operated store, but schema history is unrecoverable and destructive pushes have no review step.

**Replacement behavior (rebuild):** adopt `drizzle-kit generate` + committed migration files, keep `push` for local experiments only.

## F14 — Positive observations (preserve in the rebuild)
- Server actions only, no API routes: minimal HTTP surface, typed end-to-end.
- `checkout-validation.ts` shared constants between client validator and server zod schema — no drift possible.
- Pure, isomorphic `pricing.ts` with explicit Date|string normalization for the RSC serialization boundary.
- Email is structurally non-fatal (`receipt.ts:145-172` never throws) — matches the business rule.
- Derived auto-archiving (`isArchived`, `orders.ts:93-97`) — no cron, no extra status enum value.
- Cart clamps to live stock on hydration and on fresh data (`cart-context.tsx:45-83`), and `router.refresh()` after a sold-out checkout re-syncs the provider.
- Motion foundation centralized in `src/components/motion/primitives.tsx` with reduced-motion guards and a no-JS reveal fallback; admin intentionally Motion-free.
- `OrderInput.paymentMethod: "cod" | "card"` (`orders.ts:18`) with the zod schema pinned to `z.literal("cod")` (`checkout/actions.ts:29`) is correct forward-compatibility for the planned gateway — do not "simplify" it away.

# Severity / Priority

| ID | Finding | Severity | Priority |
|---|---|---|---|
| F1 | Seed write on every product read | Medium | P1 — cheap fix, every checkout pays it |
| F2 | `unstable_cache` replaced in Next 16 | Medium | P1 — foundation for all storefront reads |
| F5 | Non-transactional stock reservation | Medium | P1 — correctness under concurrency |
| F3 | Full bilingual catalog in every RSC payload | Medium | P2 |
| F4 | Triplicated dev-store logic | Medium | P2 — rebuild hygiene |
| F6 | Admin gate duplicated ×5, no proxy layer | Medium | P2 |
| F9 | Full-table admin order reads | Low | P3 — scale-dependent |
| F8 | No order-number collision retry | Low | P3 |
| F10 | `shadcn` in runtime deps | Low | P3 — one-line change |
| F11 | Dual source of truth for product copy | Low | P3 — document/guard |
| F12 | Minor client overreach / header duplication | Low | P4 |
| F13 | No tracked migrations | Low | P4 |
| F7 | Auth token scheme | (Security agent) | — |

# Recommendations

## Target architecture (rebuild blueprint)

Keep the current macro-structure — it is correct. Formalize these boundaries:

```
src/
  data/products.ts        # identity + seed defaults ONLY (document seed-only fields)
  lib/
    constants.ts          # business constants (unchanged)
    pricing.ts            # pure business logic (unchanged)
    checkout-validation.ts# shared validation constants (unchanged)
    db/                   # schema + client (switch to neon-serverless Pool for transactions)
    dev-store.ts          # NEW: single generic JSON fallback helper
    orders.ts / products.ts / feedback.ts   # data access; SQL-side filters as volume grows
    admin-auth.ts         # auth module (scheme per Security agent's report)
    email/receipt.ts      # unchanged
  app/
    [locale]/…            # RSC pages; server actions colocated per route
    admin/…               # separate root; requireAdmin() helper used by every page;
                          #   every action keeps its own isAdminAuthenticated() check
  components/…            # client leaves only where interactivity requires (as today)
  proxy.ts                # next-intl routing + optional cookie-presence pre-filter for /admin
```

Concrete steps, in order:

1. **Seed once** (F1): move `ensureSeeded` behind a per-process memo now; in the rebuild, replace with an explicit seed script run alongside `drizzle-kit push`. One fewer DB round-trip per checkout/admin view.
2. **Migrate the product cache to `use cache` + `cacheTag("products")`** (F2), keeping `getStoreProductsFresh()` uncached for checkout/admin. The existing `revalidateTag("products", "max")` call sites already use the current two-argument API and need no change.
3. **Adopt transactions** (F5): switch the Drizzle driver to `drizzle-orm/neon-serverless` (same npm package already installed) and wrap stock-decrement + order-insert in one transaction; delete `restoreStock` and both compensation call sites once transactional.
4. **Slim the client catalog** (F3): resolve locale server-side in the layout and provide only the fields client components read. One RSC payload reduction on every page view.
5. **Extract `createDevStore<T>()`** (F4) and a `requireAdmin()` page helper (F6); add the optional `/admin` cookie pre-filter in `proxy.ts` without removing in-page/in-action checks.
6. **Small items:** collision retry around `createOrder` (F8); move `shadcn` to devDependencies (F10); seed-only comment in `data/products.ts` (F11); extract header `<CartButton>` (F12); committed migrations (F13).

Do **not**: convert Motion leaves or Base UI wrappers to server components (rule 11 works both ways — they need the client), remove the dev-JSON fallback (it is what makes the repo runnable without Neon), or collapse the static/DB product split (it deliberately keeps unknown fragrance facts editable later, per rule 6).

# Risks

- **F5 driver switch:** `neon-serverless` (WebSocket Pool) has different connection semantics than stateless `neon-http` on serverless platforms (connections must be created/closed per request handler or pooled carefully). Mitigate: isolate in `src/lib/db/index.ts`, verify cold-start latency on Vercel before committing; the http driver can remain for read paths.
- **F2 `use cache` migration:** Cache Components change caching semantics project-wide when enabled. Mitigate: migrate only `loadStoreProducts` first, verify `revalidateTag` still reaches the tagged scope, keep the storefront's client-side sale-window evaluation (it is what makes cached pages show correct sale state).
- **F3 payload slimming:** `StoreProduct` is consumed in 6+ client files; a shape change touches cart, drawer, checkout, product card. Mitigate: introduce a distinct `ClientProduct` type so TypeScript surfaces every consumer.
- **F6 proxy pre-filter:** `/admin` is currently excluded from the proxy matcher for a reason (locale routing must not touch it). Adding an admin check to `proxy.ts` must not accidentally pull `/admin` into next-intl handling. Mitigate: separate branch before the intl handler, or leave the proxy untouched and rely on the extracted `requireAdmin()`.
- **Concurrent rebuild by 10 agents:** several findings (F5, F7) border the Security and Performance agents' remits. This report defines architecture-level placement only; coordinate before any agent implements overlapping changes (global rule 2).
- **General:** the live site is unreachable from this machine (TLS interception) — every claim above is code-derived; runtime behavior on Vercel (cache hits, cold starts) should be confirmed via `vercel inspect`/logs before and after changes.

# Verification / Testing

**Performed during this audit (read-only):**
- `npx tsc --noEmit` — **passes, exit 0**.
- `npm run build` — attempted; blocked by *another already-running `next build`* (a concurrent audit agent's process; exit message "Another next build process is already running"). Not retried to avoid contention. The clean type check plus the deployed `master` history (`615674c` shipped to production) indicate the build is green; re-run `npm run build` when the pipeline is idle to confirm.
- Framework claims cross-checked against the bundled Next 16 docs (`node_modules/next/dist/docs/…/unstable_cache.md`, `…/revalidateTag.md`) per `AGENTS.md`.

**Current test infrastructure: none.** No test runner, no test files, no CI config beyond `.claude/settings.json`. For the rebuild, the minimum verification net for the behaviors this report touches:

1. **Unit (pure logic, no framework):** `effectivePrice` sale-window edges (start/end boundaries, string vs Date inputs), `isArchived` boundary at exactly `ARCHIVE_AFTER_DAYS`, `filterOrders` combinations, order-number alphabet/length.
2. **Integration (server actions against the dev JSON store):** `placeOrder` happy path, sold-out path (stock 0 and qty > stock), price-tamper attempt (client sends manipulated payload — server total must come out at re-priced value), order-insert failure restores stock (until F5 removes the compensation).
3. **Post-change checks per recommendation:** F1 — log/inspect Neon query counts for one checkout before/after (expect one fewer INSERT); F2 — admin price edit propagates to storefront after `revalidateTag`; F5 — two concurrent checkouts for the last unit: exactly one succeeds, stock ends at 0.
4. **Smoke (manual or Playwright, both locales):** home → shop → product → cart → checkout → confirmation in `en` and `ar` (RTL drawer side, logical-property mirroring), admin login → order status flip → product price edit, with `prefers-reduced-motion` enabled once.

# Phase B — Consolidated Target Architecture

Consolidation of all nine Phase A reports: this report (ARCH), `SECURITY_AUDIT.md` (SEC F-1…F-8), `PERFORMANCE_AUDIT.md` (PERF F1…F11), `SCALABILITY_REPORT.md` (SCALE F1…F8), `QA_AUDIT.md` (QA-01…QA-20), `RESPONSIVE_A11Y_AUDIT.md` (RESP A-x/C-x/R-x/V-x/M-x), `UX_AUDIT.md` (UX F1…F21), `DESIGN_SYSTEM.md` (DESIGN F1…F8), `DATA_MODEL_REPORT.md` (DATA F1…F10). Appended per the Phase B mandate; the Phase A sections above are unchanged.

## 1. Cross-report convergence

Themes found independently by multiple agents — the strongest evidence in the audit. Each is a single work item in §5, not nine separate fixes.

| Theme | Independent findings | Consensus |
|---|---|---|
| **Checkout atomicity + idempotency + collision retry** | ARCH F5/F8 · SCALE F2/F3/F6 · DATA F2/F7 · QA-02/QA-03/QA-11 · PERF F3c | The single most-cited cluster. Non-transactional decrement with best-effort compensation (silent stock loss window), no idempotency key (duplicate COD orders from double-submit/second tab — SCALE rates this the most likely real-world failure), no order-number retry. All agents agree the conditional `stock >= qty` decrement itself is correct and must be kept. |
| **`ensureSeeded` write amplification** | ARCH F1 · PERF F3a · SCALE F1 · DATA F6 | Four agents flagged the same line (`src/lib/products.ts:83-105`): a DB `INSERT` on every product read — twice per checkout (SCALE), every admin view, every cache miss. Unanimous: seed once. |
| **Rate limiting / denial-of-inventory** | SEC F-1 (High, top finding) · SCALE F4 (P1) · PERF F11 · DATA F8 · ARCH F7-adjacent | Unauthenticated `placeOrder` + `submitFeedback` with COD and `DEFAULT_STOCK` 50 means a trivial script zeroes all stock (SEC's attack scenario, SCALE's availability framing, PERF's cost framing). Highest business risk in the whole audit. |
| **Admin auth weaknesses** | SEC F-2 · QA-01 · QA-18 · ARCH F6/F7 | Static password-derived cookie (non-revocable, offline-crackable), non-timing-safe compares, no login throttling (SEC) — **plus QA-01: sign-out very likely doesn't work at all** (cookie set with `path: "/admin"`, deleted with default `path: "/"`). ARCH adds the ×5 duplicated page gate. All agents endorse keeping per-action checks. |
| **Admin full-table reads, no indexes** | ARCH F9 · PERF F4 · SCALE F5 · DATA F5 | `listOrders()` = unbounded `SELECT *`, JS-side filtering, no index on `created_at`/`status`. Consensus: fine today, add indexes now (cheap), SQL-side filters when volume demands. |
| **Cache API + client payload** | ARCH F2/F3 · PERF F8 + caching model verification · SCALE F8 | `unstable_cache` is the replaced API in Next 16 (ARCH verified against bundled docs; SCALE deferred, ARCH's citation stands); `revalidateTag(tag, "max")` two-arg form is *current* (ARCH + PERF both verified). Full bilingual catalog serialized into every RSC payload (ARCH F3, PERF F8) — slim to a locale-resolved `ClientProduct`. |
| **Receipt email** | SEC F-7 + QA-05 (unescaped HTML → phishing primitive) · PERF F3b + SCALE F7 (awaited on the hot path → `after()`) · UX F3 (confirmation falsely claims "receipt sent") | Three distinct defects in one module (`src/lib/email/receipt.ts` + confirmation copy); all agree the never-throws invariant is correct and must survive. |
| **RTL / accessibility cluster** | RESP A-1…A-11, C-1…C-4, R-1…R-5, M-1 · QA-06/07/08/12/13/19 · UX F15/F20/F21 · DESIGN F2/F3/F4 | Independent triple-confirmation of: unannounced checkout errors (RESP Critical A-1 = UX F15 = QA-09-adjacent), silent add-to-cart (RESP Critical A-2), fake tabs (RESP A-7 = QA-19 = UX F20), unlabeled steppers (RESP A-4 = QA-13 = UX F21), Arabic tracking fracture at ~15 sites (RESP R-1 High = DESIGN F4 → `.label-caps`), synthetic Arabic italic (QA-07 = DESIGN italic policy), hero video ignoring reduced motion (QA-12 = RESP M-1 = PERF F2-adjacent), gold-on-ivory contrast failures (RESP C-1 = DESIGN F2/F3, including the focus ring at 2.18:1). DESIGN supplies the systematic fixes the others requested. |
| **Order lifecycle gap** | DATA F4 · ARCH F9 note · SCALE F8 | No `cancelled` status → refused COD deliveries permanently drain stock; "Revenue" stat counts undelivered orders; re-clicking "delivered" resets the archive clock. |
| **Migrations + schema safety** | DATA F1 (High, "single largest data-loss risk") · ARCH F13 | No versioned migrations; `drizzle-kit push` against production. Must be fixed **before** any rebuild schema change. |
| **Dev-store triplication** | ARCH F4 · DATA F10 | Same `devRead`/`devWrite` copy-pasted three times; DATA adds: every schema change is currently implemented twice. |
| **Trust/conversion content gap** | UX F1–F5 (P0) — corroborated by SEC F-6 (order number is display-only) and the receipt findings | COD signal, 2-day promise, WhatsApp, and policies are absent pre-checkout; unique to UX but gates the value of every other fix. All content requires owner confirmation (binding rules 4/6). |

## 2. Conflicts / tensions between reports — rulings

**T1 — How to make checkout atomic.** ARCH F5 leads with the neon-serverless WebSocket `Pool` + `db.transaction()`; SCALE R2 explicitly prefers a **single-statement decrement** (`UPDATE … FROM (VALUES …) … RETURNING`) and warns the Pool "reintroduces connection lifecycle concerns on Fluid Compute"; DATA R3 prefers the driver swap and makes transactions a hard requirement before any card gateway.
**Ruling: staged.** Now: SCALE's single-statement atomic decrement (no driver change, Postgres atomicity eliminates the multi-item compensation path entirely) + idempotency key + collision retry. At the payment-gateway milestone (already planned per CLAUDE.md): the driver swap and a full decrement+insert transaction, satisfying DATA's non-negotiable. Rationale: gets ~90% of the correctness win with zero new connection semantics on serverless; defers the risky change to the milestone that actually requires it. Interim residual (order-insert failure after a successful decrement) is covered by the idempotency key (retry reuses the reservation) plus DATA R3-option-2's drift-detection query as an admin stat.

**T2 — Confirmation page: static vs verified.** PERF R6 wants it fully SSG (read `?order=` client-side via `useSearchParams`); QA-16 wants param validation and "optionally verify existence server-side"; SEC F-6 documents the *absence* of an order lookup as the correct no-IDOR design; UX R2 wants truthful copy "gated on a server-passed flag."
**Ruling: static wins; no DB lookup ever.** Validate the param shape client-side (`/^L-[A-Z2-9]{6}$/`, QA-16's regex) with a neutral fallback state; never fetch the order (preserves SEC F-6). UX's truthfulness needs no server flag: the new default copy is email-free ("We will call you to confirm — delivery within 2 days"); when Resend ships, the checkout redirect appends a non-sensitive `&receipt=1` the client reads — the page stays SSG. Server-side existence checking is rejected: it would re-dynamize the route *and* create the IDOR surface SEC warned against.

**T3 — Rate-limiting mechanism.** SEC and SCALE both prefer platform WAF; SCALE explicitly warns that an in-memory app limiter both under-blocks (multi-instance) and over-blocks (NAT'd Jordanian mobile carriers behind few IPs); SEC also floats an Upstash bucket (a new dependency).
**Ruling:** Vercel WAF rate-limit rules first (zero code, zero deps — rule 10), plus SEC's honeypot + minimum time-to-submit in both forms (cheap, in-app, carrier-safe). No Redis. A durable Postgres counter is the fallback only if WAF rules prove unavailable on the current plan. Generous thresholds per SCALE's NAT warning.

**T4 — The 5 MB body limit vs admin uploads.** SEC F-3 wants the global `serverActions.bodySizeLimit: "5mb"` narrowed but concedes per-action limits may not exist; PERF notes upload bytes traverse client→function→Blob twice and names client-upload tokens as the fix.
**Ruling: solve both with one change.** Move admin image uploads to Vercel Blob **client uploads** (`@vercel/blob/client`, already a dependency): the file goes browser→Blob directly under a short-lived token, the server action only records the URL. The global body limit then drops back to the 1 MB default, closing SEC F-3 entirely and halving upload transfer (PERF). WAF (T3) covers the interim.

**T5 — Admin gate placement.** ARCH proposes an optional cookie-presence pre-filter in `src/proxy.ts`; ARCH's own risk note and the proxy matcher's deliberate `/admin` exclusion (next-intl must not touch it) cut against it; SEC is satisfied by per-page + per-action checks.
**Ruling:** `requireAdmin()` helper for pages, per-action checks untouched — no proxy involvement. The proxy pre-filter is dropped: its marginal value (blocking anonymous HTML renders of the login form) does not justify the risk of entangling `/admin` with locale routing. Revisit only if login-page abuse is observed (then as a WAF rule, not proxy code).

**T6 — Cart drawer side.** RESP R-2 and UX F17 independently flag that the EN drawer opens opposite its desktop trigger; both defer to the owner; RESP notes the fix interacts with the sheet close-button position (A-5).
**Ruling:** recommend end-side (right in LTR, left in RTL — matches the desktop trigger and e-commerce convention; mobile trigger-at-start is the acknowledged trade-off), but this is an **owner decision** — implement together with A-5's logical `end-3` close button in one change, and record the decision in CLAUDE.md either way.

**T7 — Design-token rename vs everything else touching classes.** DESIGN renames the whole palette (`night`→`obsidian`, `gold`→`champagne`…); QA/RESP/UX fixes all cite current class names.
**Ruling:** DESIGN's own deprecated-alias mechanism resolves this: aliases land first (both names → same hex), all functional fixes may use either name, screens migrate to canonical names as they are rebuilt, aliases die only when grep shows zero uses. No fix is blocked on the rename; no big-bang rename commit exists.

**T8 — "Revenue" stat and `cancelled` semantics.** DATA proposes delivered-only revenue and a `cancelled` status with stock restore; ARCH flagged the same stat; exact semantics (label, whether delivery fees count, cancel-restock policy nuances) are business rules.
**Ruling:** implement DATA R2 mechanically (additive `cancelled_at`, CHECK constraints, cancel→restore-stock-once idempotently, `deliveredAt` set only when NULL), but the stat definition and any refund/return semantics beyond "cancel restores stock" go on the owner-decision list — rule 4 forbids inventing them.

**T9 — Email optional (UX R5) vs receipt architecture.** Making email optional removes the receipt path for those customers; QA's matrix and SEC's escaping work assume email exists.
**Ruling:** adopt UX R5 — phone is the fulfillment-critical contact for COD; email becomes optional with "(optional) — for your receipt" framing; `sendReceiptEmail` is skipped when absent (one guard). Escaping (SEC F-7) still ships first since the field remains.

**No-conflict confirmations:** every agent that touched them independently endorsed keeping — server-side re-pricing, the conditional stock decrement shape, the never-throws email invariant, tag-based cache invalidation, JSONB item snapshots, bilingual JSONB copy, static-identity/DB-state product split, derived archiving, integer whole-JD money (until a gateway), the single responsive site, the motion foundation with its three-layer reduced-motion contract, and the no-`asChild` Base UI convention. These are load-bearing consensus and are frozen into the target below.

## 3. Consolidated target architecture

Macro-structure unchanged from Phase A's blueprint (validated independently by SEC, PERF, SCALE, DATA: "fundamentally sound", "right-sized"). No queues, no Redis, no microservices, no API routes — server actions only. What follows integrates all nine reports into that skeleton.

```
Platform      Vercel (project lune-store) + Neon Postgres + Vercel Blob + Resend
              Vercel WAF rate-limit rules on public write actions      [SEC F-1, T3]

src/
  proxy.ts             next-intl locale routing ONLY (admin/api excluded — unchanged)  [T5]
  data/products.ts     identity + seed defaults; seed-only fields documented           [ARCH F11]
  lib/
    constants.ts       business constants (unchanged)
    pricing.ts         pure isomorphic pricing (unchanged — frozen)
    checkout-validation.ts  shared client/server rules + governorate list              [UX R5]
    db/
      schema.ts        + idempotency_key UNIQUE, cancelled_at, CHECK constraints,
                         indexes (created_at DESC, status, feedback.created_at),
                         feedback.handled                                              [DATA R2/R4/R6, SCALE R3/R5]
      index.ts         neon-http now; neon-serverless Pool at gateway milestone        [T1]
      migrations: drizzle/ committed, generate→review→migrate; push banned on prod     [DATA R1]
    dev-store.ts       ONE generic JSON fallback helper (createDevStore<T>)            [ARCH F4, DATA F10]
    orders.ts          + createOrder retry-on-collision, idempotent insert;
                         SQL-side filters/limit when volume demands                    [SCALE R6, DATA R5]
    products.ts        seed-once (script + per-instance memo); single-statement
                         atomic decrement; compensation path deleted for multi-item    [T1, ARCH F1]
                       "use cache" + cacheTag("products") replaces unstable_cache;
                         getStoreProductsFresh stays uncached (correctness, frozen)    [ARCH F2, PERF]
                       ClientProduct: slim, locale-resolved shape for the client       [ARCH F3, PERF F8]
    admin-auth.ts      random server-tracked session token (revocable, expiring),
                         timing-safe compares, login throttling, symmetric cookie
                         set/delete path                                               [SEC F-2, QA-01]
                       requireAdmin() page helper; per-action checks kept verbatim     [ARCH F6, SEC]
    email/receipt.ts   escapeHtml on all interpolations; sent via after(); skipped
                         when email absent; never-throws invariant kept                [SEC F-7, PERF R3b, T9]
  app/
    [locale]/          RSC pages (SSG, tag-invalidated); confirmation goes SSG         [T2]
      checkout/actions.ts  validate (+unique-slug refine, +expectedTotal equality
                           check → "priceChanged") → re-price fresh → atomic decrement
                           → idempotent insert w/ retry → after(email) → revalidateTag [QA-04/10, T1]
      layout.tsx       Arabic fonts preload:false (or per-locale preload split);
                         persistent aria-live region; skip link                        [PERF R1, RESP A-2/A-8]
    admin/             own root; requireAdmin(); Blob CLIENT uploads (body limit back
                         to default); cancelled flow + truthful labeled stats;
                         AdminActionState surfaced by setOrderStatus                   [T4, T8, QA-18]
  components/
    ui/                logical-properties pass (end-3, ps/pe, text-start);
                         localized sheet/dialog close labels                           [RESP R-3/A-5]
    design system      token layer per DESIGN §1–§6: obsidian/midnight/silver/
                         champagne/ivory + deprecated aliases; --ring #7c6132 on
                         light; opacity floors; .label-caps w/ RTL tracking reset;
                         [dir="rtl"] not-italic policy; luxe/xl button + h-12
                         checkout inputs; 3-tier elevation; Western digits +
                         tabular-nums everywhere                                       [DESIGN, T7]
    cart/              context + storage-event cross-tab sync; labeled steppers w/
                         disabled-at-limit; itemized soldOut feedback                  [QA-03/13/15]
    motion/            unchanged foundation; hero video gated on
                         prefers-reduced-motion + aria-hidden; re-encoded ≤1.2 MB,
                         immutable-cached                                              [RESP M-1, PERF R2]
  content (owner-confirmed only): trust strip (COD · 2-day · 3 JD), WhatsApp links,
    delivery/returns page, homepage chapters w/ image+price via effectivePrice,
    post-add "View cart / Checkout" row, ?audience= shop deep links                    [UX R1–R8]
```

**Performance budget (PERF R5, adopted as a rebuild gate):** first-load JS ≤ 300 KB gz (target 250), ≤ 5 preloaded fonts / ≤ 250 KB, hero video ≤ 1.5 MB, storefront page view = 0 runtime DB round trips on cache hit, checkout ≤ 2 + 1-per-item round trips, LCP ≤ 2.5 s mid-tier mobile.

**Verification net (all reports' suites, consolidated):** unit tests for `effectivePrice`/`isArchived`/`filterOrders`/order-number; integration tests for oversell race, multi-item atomicity, idempotency replay, tamper/price-manipulation rejection, auth-denial of every admin action; QA's viewport × locale manual matrix; RESP's SR/contrast/RTL acceptance checks; axe-core per page per locale; SCALE's Neon-branch load tests; PERF's build-output assertions (route staticness, font-preload count, chunk budget) in CI. All DB tests on Neon branches, never production.

## 4. Migration strategy

Non-destructive, no big-bang, respecting: production data preserved, screen-by-screen token migration via deprecated aliases, migrations baseline before any schema change.

**Phase 0 — Baseline (blocks everything schema-touching).** `drizzle-kit generate` from current `schema.ts` → commit `drizzle/0000_*` → adopt as baseline on prod without executing DDL (verify zero diff via one final `push`/`pull` comparison first — DATA R1's drift check). From here, `push` is banned against production.

**Phase 1 — Correctness & security on the current codebase (no visual change, independently shippable).** Logout cookie fix; timing-safe compares + login throttling; WAF rules + honeypot/min-time; `escapeHtml` in receipt; `after()` email + skip-when-absent; single-statement atomic decrement; idempotency key (additive nullable→unique column); collision retry; unique-slug refine; `expectedTotal`/"priceChanged"; seed-once; truthful confirmation copy. Each is small, additive, and testable in isolation; the storefront looks identical.

**Phase 2 — Platform (still no redesign).** Additive migration: CHECK constraints (`NOT VALID` → probe → `VALIDATE`, per DATA's two-step), `cancelled_at`, indexes, `feedback.handled`; app-side cancelled flow + stat relabel (owner-confirmed); `use cache` migration (one function first, tag reachability verified); `ClientProduct` slimming (new type so TS surfaces all consumers); `createDevStore` extraction; `requireAdmin()`; Blob client uploads + body-limit restore; random session tokens; storage-event cart sync; confirmation → SSG; font preload split; hero re-encode + immutable headers; favicon; `shadcn`→devDependencies; drizzle-kit upgrade.

**Phase 3 — UI/UX rebuild, screen by screen.** Token layer + aliases land first (T7), then per screen (suggested order: product card → product page → cart drawer → checkout → home → shop → confirmation → admin polish): migrate to canonical tokens, apply `.label-caps`/italic-policy/contrast floors, wire the a11y foundation (live region, skip link, form-error ARIA, labeled steppers, `aria-pressed` filters, localized close buttons), and add the owner-confirmed conversion content (trust strip, chapter images+prices, checkout friction pass, post-add row, policy page, WhatsApp). Each screen ships behind the standing EN/AR × viewport screenshot check; deprecated aliases keep unmigrated screens rendering identically throughout.

**Phase 4 — Cleanup & hardening.** Delete deprecated aliases (grep gate: zero `night|gold-|navy-lune` in `src/`); delete the now-dead compensation code; gateway-milestone work when commissioned (driver swap + full transaction + money-unit decision per DATA R7); optional SQL-side admin filters when order volume triggers (DATA's ~1k threshold).

**Rollback posture:** every phase-1/2 change is behind a small, revertible commit; schema changes are additive-only until Phase 4; the alias layer makes any Phase 3 screen individually revertible.

## 5. Proposed implementation order — work packages

| # | Package | Resolves | Gate |
|---|---|---|---|
| **WP0** | Migrations baseline + Neon branch test setup | DATA F1, ARCH F13 | Before any schema change |
| **WP1** | Admin session integrity: logout path fix, random revocable tokens, timing-safe compares, login throttling, `requireAdmin()`, `setOrderStatus` error surfacing | QA-01, SEC F-2, QA-18, ARCH F6/F7 | P0 |
| **WP2** | Checkout integrity: single-statement atomic decrement, idempotency key, collision retry, unique-slug refine, priceChanged check, seed-once | SCALE F1/F2/F3/F6, DATA F2/F6/F7, QA-02/03/04/10/11, ARCH F1/F5/F8, PERF F3a/F3c | P0 |
| **WP3** | Abuse protection: WAF rate limits, honeypot + min-submit-time, Blob client uploads → restore 1 MB body limit | SEC F-1/F-3, SCALE F4, PERF F11, DATA F8, T3/T4 | P0 |
| **WP4** | Email & confirmation truth: escapeHtml, `after()`, skip-when-absent, truthful SSG confirmation with param validation | SEC F-7, QA-05/16, PERF F3b/F6, SCALE F7, UX F3, T2 | P0 (escaping before `RESEND_API_KEY` is ever set) |
| **WP5** | Data-model evolution: CHECK constraints, `cancelled` lifecycle + stock restore, indexes, `deliveredAt` idempotence, feedback `handled`, labeled stats | DATA F3/F4/F5, SCALE F5/F8, ARCH F9 | P1; stat/cancel semantics owner-confirmed (T8) |
| **WP6** | Platform modernization: `use cache` + `cacheTag`, `ClientProduct` payload slimming, `createDevStore`, header `CartButton` dedupe, `shadcn`→dev, drizzle-kit upgrade | ARCH F2/F3/F4/F10/F12, PERF F8, SEC F-4, DATA F10 | P1 |
| **WP7** | Asset & delivery: Arabic-font preload split, hero video re-encode + immutable caching + reduced-motion gate, favicon, cart cross-tab sync | PERF F1/F2/F7, RESP M-1, QA-12/03 | P1 |
| **WP8** | Design-token layer: new palette + deprecated aliases, ring fix, silver family, opacity floors, `.label-caps`, italic policy, `luxe`/`xl` controls, elevation scale | DESIGN F1–F8, RESP C-1…C-4, QA-07 | P2 — prerequisite for WP10 |
| **WP9** | A11y & RTL foundation: live region + announcements, skip link, checkout error ARIA + focus, labeled steppers, `aria-pressed` filters, localized/logical sheet close, ui/* logical-properties pass, `lang` markup, locale-switcher query preservation | RESP A-1…A-11, R-1/R-3/R-4/R-5, QA-06/08/09/13/19, UX F15/F20/F21 | P2 |
| **WP10** | Conversion rebuild (screen-by-screen, owner content confirmed): trust strip, chapters w/ image+price, checkout friction (optional email, governorate select), post-add path, delivery/returns page, WhatsApp, `?audience=` links, drawer-side decision, mobile hero CTA | UX F1–F19, RESP V-1/V-3, T6/T9 | P2–P3; blocked on owner-decision list |
| **WP11** | Verification net: unit/integration suites, QA manual matrix, axe-core, Playwright viewport checks, perf-budget CI, Neon-branch load tests, Web Analytics enablement | All reports' Verification sections | Continuous from WP1 |

**Owner-decision checklist (blocking WP10, partially WP5):** site-wide 2-day delivery promise, WhatsApp number, return/exchange policy text, delivery coverage area, revenue-stat definition, cancel/refund semantics beyond stock restore, cart-drawer side, fate of the orphaned "Our Story" nav key, hero-video re-encode sign-off. None may be invented (binding rules 4/6).
