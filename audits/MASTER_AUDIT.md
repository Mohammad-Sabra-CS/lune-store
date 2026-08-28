# LUNE — Master Audit & Rebuild Blueprint

Consolidation of all nine Phase A audits, their Phase B/C/D appendices, and the red-team review (`RED_TEAM_REPORT.md`), verified against the code. Sources are cited as: ARCH (`ARCHITECTURE_REPORT.md`), SEC (`SECURITY_AUDIT.md`), PERF (`PERFORMANCE_AUDIT.md`), SCALE (`SCALABILITY_REPORT.md`), QA (`QA_AUDIT.md`), RESP (`RESPONSIVE_A11Y_AUDIT.md`), UX (`UX_AUDIT.md`), DESIGN (`DESIGN_SYSTEM.md`), DATA (`DATA_MODEL_REPORT.md`), RT (`RED_TEAM_REPORT.md`).

Priority scale: **P0 — Critical** · **P1 — High** · **P2 — Medium** · **P3 — Low**. The security audit found **no critical vulnerabilities**; P0 labels below reflect business-blocking or plan-blocking impact, not inflated severity. All product/business unknowns are marked **TBD (owner-editable)** — nothing is invented. Product names remain **Apollo, Orion, Elysia, Aurora**. This document is audit-only: no code changes, no fixes, no migrations.

---

# 1. Current Architecture

Verified against code by ARCH and re-verified by RT.

- **Stack:** Next.js 16.3.0 App Router (Turbopack), React 19.2.8, TypeScript 5, Tailwind v4, next-intl v4, shadcn on @base-ui (no `asChild` — `render={<Link/>}`), Drizzle ORM + `@neondatabase/serverless` (neon-http, stateless fetch-per-query), `motion` v13, zod v4, resend, @vercel/blob. Deployed on Vercel (`lune-store`), Neon Postgres, ~95 tracked files, ~40 client components. `npx tsc --noEmit` and `npm run build` pass clean (ARCH/QA).
- **Routing:** locale routing in `src/proxy.ts` (Next 16 proxy convention; matcher excludes `api|admin|_next|_vercel|files`). Two root layouts each owning `<html>`: `src/app/[locale]/layout.tsx` (storefront, EN/AR RTL) and `src/app/admin/layout.tsx` (English-only, noindex). `experimental.globalNotFound` provides the branded 404.
- **Layering:** static product identity in `src/data/products.ts` (4 packages, slug/audience/phase/accent + seed copy) · editable state in the `products` DB table via `src/lib/products.ts` · business constants in `src/lib/constants.ts` (35 JD `PACKAGE_PRICE`, 3 JD `DELIVERY_FEE`, `MAX_QTY_PER_ITEM` 20, `DEFAULT_STOCK` 50, `ARCHIVE_AFTER_DAYS` 7) · pure isomorphic pricing in `src/lib/pricing.ts` · shared client/server validation constants in `src/lib/checkout-validation.ts` · data access in `src/lib/{orders,products,feedback}.ts`, each with a Neon path + gitignored `.{name}.dev.json` fallback.
- **Mutations:** server actions only — zero API route handlers. Checkout (`src/app/[locale]/checkout/actions.ts`), feedback (`src/components/feedback/actions.ts`), admin (`src/app/admin/actions.ts`, `src/app/admin/products/actions.ts`).
- **Read/write flow:** storefront pages are SSG; product data behind `unstable_cache` tagged `"products"` (`src/lib/products.ts:145-149`), invalidated with the current two-arg `revalidateTag("products", "max")` by every admin product mutation and every successful checkout. Checkout re-prices everything server-side from uncached `getStoreProductsFresh()`, decrements stock via conditional `UPDATE … WHERE stock >= qty`, inserts the order, awaits the receipt email, revalidates the tag. Cart is React context + localStorage — zero network requests.
- **Auth:** `/admin` cookie gate — `sha256("lune:" + ADMIN_PASSWORD)` static token (`src/lib/admin-auth.ts`), checked in every admin page and every mutating admin action.
- **Email:** bilingual branded receipt (`src/lib/email/receipt.ts`); never throws; log-only without `RESEND_API_KEY` (currently unset — no emails are actually sent).

# 2. Current Features

- **Storefront (EN LTR / AR RTL):** Home (hero with marble still + 3.9 MB idle-loaded video, four text-only "chapter" sections, ritual grid, story section) · Shop (client-side All/Him/Her filter, 2→4-col grid, sale/sold-out states) · Product page (gallery + thumbnails, poetry/character/description, "Inside the Box", price + Add to Cart) · Cart drawer (Base UI Sheet, side flips per locale, qty steppers, animated totals) · Checkout (single page, client+zod server validation, COD pre-selected, card rendered disabled "coming soon") · Confirmation (moon animation, order number from `?order=` param, no DB lookup) · bilingual 404/error pages · feedback widget (public, unauthenticated).
- **Commerce rules (code-verified):** exactly 4 packages @ 35 JD; 3 JD flat delivery; COD only (`z.literal("cod")`); qty 1–20/item, ≤10 items; stock clamped client-side on hydrate and refresh; sale windows evaluated client-side at view time via `effectivePrice`.
- **Admin:** dashboard (stats + latest 5 orders), orders (status flip, search/status/date filters, derived 7-day auto-archive), products (details/pricing+sale-window/stock/image editing with Blob uploads, Amman-timezone sale parsing), feedback list, login/logout.
- **Delivery promise "within 2 days"** exists only inside the (unsent) receipt email — **TBD (owner must confirm before site-wide use)** (UX F2).
- **i18n/RTL foundation:** logical properties throughout store components, `[dir="rtl"]` type compensation, Arabic-safe motion primitives, three-layer reduced-motion contract, no-JS reveal fallback at 2.5 s.

# 3. Critical Security Issues

SEC's Phase A verdict, RT-confirmed: **no exploitable critical vulnerabilities**. Server-side re-pricing, admin authorization on every page + action, parameterized queries, no XSS sinks, no secret exposure all verified correct. The material issues:

| Priority | Finding | Source / evidence |
|---|---|---|
| **P0** | **Denial-of-inventory: no rate limiting/bot protection on unauthenticated `placeOrder` + `submitFeedback`.** With COD and `DEFAULT_STOCK` 50, a trivial script zeroes all stock in ~3–10 requests and floods orders/feedback tables. Highest business risk in the audit. | SEC F-1 (High) · SCALE F4 · PERF F11 · DATA F8 — `checkout/actions.ts:57`, `feedback/actions.ts:15` |
| **P1** | Admin session token is a static, non-revocable, password-derived hash; non-timing-safe compares; no login throttling. Offline-crackable if the cookie ever leaks. | SEC F-2 — `admin-auth.ts:9,16,24` |
| **P1** | 5 MB global `serverActions.bodySizeLimit` reachable by unauthenticated actions; upload size validated only after full buffering. | SEC F-3 — `next.config.ts:15`, `admin/products/actions.ts:171` |
| **P1** | Receipt email interpolates customer name/city/address and product name into HTML unescaped — a phishing primitive that goes live the day `RESEND_API_KEY` is set. **Hard gate: escape before the key is ever set.** | SEC F-7 · QA-05 — `receipt.ts:81,129` |
| **P2** | Email-throw coupling: `sendReceiptEmail` sits inside the same try/catch as `createOrder`; a future throw would restore stock under an order that exists AND push the customer into a duplicate retry. Latent (invariant currently upheld) — structurally removed by the `after()` move. | RT D-2 — `checkout/actions.ts:105-114` |
| **P2** | `setOrderStatus` has no runtime enum validation (compile-time type only); with no DB CHECK, any string lands in `orders.status` and breaks `filterOrders`/`isArchived`. Admin-authed, so low exposure. | RT D-3 — `admin/actions.ts:36-44` |
| **P3** | Customer PII in dev JSON fallback files if ever active outside dev; needs a production guard in the future `createDevStore`. | SEC F-5 / condition C-6.1 |
| **P3** | `drizzle-kit` → esbuild moderate advisory (dev-only chain; not shipped to runtime). | SEC F-4 |

Positive controls to preserve verbatim: `z.literal("cod")`, server-side re-pricing, per-action auth checks, no-IDOR confirmation page (SEC F-6 — frozen by ruling T2: **no order lookup ever**).

# 4. Critical Bugs

| Priority | Bug | Source / evidence |
|---|---|---|
| **P0** | **Admin sign-out does not sign out**: cookie set with `path: "/admin"`, deleted with default path `/` — the original cookie survives. | QA-01 (RT-confirmed) — `admin/actions.ts:24` vs `:32` |
| **P0** | **Duplicate orders**: no idempotency key + no synchronous submit guard (only `disabled={isPending}`, effective next render) + no cross-tab cart sync. Double-tap, second tab, or a replayed lost-response request each create two real orders and two stock decrements. SCALE rates the mobile-retry variant the most likely real-world failure. | QA-02/QA-03 · SCALE F3 — `checkout-form.tsx:81-111`, `cart-context.tsx` (no `storage` listener, RT-verified) |
| **P1** | Silent price divergence: server re-prices with fresh data and never compares against the total the customer saw — customer learns the real total from the courier. | QA-04 — `checkout/actions.ts:64-81` |
| **P1** | Synthetic italic applied to Arabic poetry (`italic` utility, no `font-style` reset anywhere in `globals.css` — RT grep-verified), violating the project's own documented rule. | QA-07 — `product-card.tsx:61`, `product/[slug]/page.tsx:74` |
| **P2** | Locale switch drops the query string — the order number vanishes from `/ar/confirmation` (and email receipts don't send, so it's the customer's only record). | QA-06 — `locale-switcher.tsx:18` |
| **P2** | RTL cart drawer: sheet close button hardcoded `absolute top-3 right-3` + untranslated sr-only "Close" — collides with the RTL title edge. | QA-08 · RESP A-5 — `ui/sheet.tsx:68` |
| **P2** | Duplicate slugs in the items payload bypass `MAX_QTY_PER_ITEM` (no unique-slug refine): 10 × {apollo, qty 20} = 200 units, correctly priced but rule-bypassing. | QA-10 — `checkout/actions.ts:31-39` |
| **P2** | Sold-out feedback fork: the DB path of `decrementStock` reports only the **first** failing slug while the dev path reports all — the planned itemized sold-out messaging would behave differently in production. | RT D-1 — `products.ts:238-240` vs `:247-252` |
| **P2** | Delivered→new nulls `deliveredAt` (history loss); re-clicking "delivered" resets the 7-day archive clock. | DATA F4 + RT D-3 — `orders.ts:74` |
| **P3** | Order-number collision (31-char alphabet, ~887M combos) aborts the whole checkout after decrement instead of retrying. | ARCH F8 · QA-11 · SCALE F6 — `checkout/actions.ts:48-55` |
| **P3** | Confirmation renders full success UI for any/no/junk `?order=` param (React-escaped; layout-break + fake-URL nuisance only). | QA-16 — `confirmation/page.tsx:25` |
| **P3** | Admin date filters parse in server TZ (UTC) not Amman — night orders land on the wrong filter day. | QA-17 — `orders.ts:111` vs the `parseAmman` convention in `admin/products/actions.ts:33` |
| **P3** | `setOrderStatus` silently no-ops on expired session (products actions return `UNAUTHORIZED`; this one returns void). | QA-18 — `admin/actions.ts:40` |
| **P3** | Rapid add-to-cart clicks swallowed for 1.4 s with no visual disabled state. | QA-14 — `add-to-cart-button.tsx:50-57` |

# 5. Performance Problems

| Priority | Problem | Source / evidence |
|---|---|---|
| **P1** | All 9 font files (460 KB) preloaded on every page in **both** scripts — Arabic faces force-downloaded on EN pages and vice versa (zero `preload:` options, RT-verified). | PERF F1 — `[locale]/layout.tsx:17-39` |
| **P1** | 3.9 MB hero video (`public/hero-loop.mp4` = 3,875,284 bytes, RT-measured) per home visit; not immutable-cached; ignores `prefers-reduced-motion` and `saveData`. | PERF F2 · QA-12 · RESP M-1 — `hero-media.tsx` |
| **P1** | Checkout hot path: redundant seed INSERT ×2 + awaited Resend call (300–800 ms once live) inside the response, ~5+ sequential Neon HTTP round trips. | PERF F3 · ARCH F1 · SCALE F1/F2 — `products.ts:105,160,227`, `checkout/actions.ts:107` |
| **P2** | Unbounded admin queries: full `orders`/`feedback` table transferred per admin view (dashboard keeps 5 rows in JS); no secondary indexes. | PERF F4 · ARCH F9 · SCALE F5 · DATA F5 — `orders.ts:63-68` |
| **P2** | ~290 KB gz first-load JS on every storefront route — acceptable ceiling, budget-gate it. | PERF F5 |
| **P2** | Full bilingual catalog (both locales' poetry/character/description + galleries) serialized into every page's RSC payload; client consumers use a fraction. | ARCH F3 · PERF F8 — `[locale]/layout.tsx:79,96` |
| **P3** | Confirmation page is dynamic solely because `searchParams` is read server-side. | PERF F6 — `confirmation/page.tsx:18-25` |
| **P3** | 71 KB favicon (`src/app/icon.png`, RT-measured). | PERF F7 |
| **P3** | Aurora backdrop (3 blurred blended layers) — profile on mid-tier Android before visual rebuild; measurement target, not a defect. | PERF F9 / condition M1 |

# 6. Unnecessary Requests

Every request must have a reason (binding rule 9). Confirmed waste:

| Priority | Request | Fix direction |
|---|---|---|
| **P1** | `INSERT … ON CONFLICT DO NOTHING` seed write before every uncached product read — twice per checkout, every admin view, every cache miss (4-agent consensus). | Seed once: script + per-instance memo (WP2) |
| **P1** | Awaited email API call in the checkout response path. | `after()` (WP4) |
| **P1** | ~230 KB wrong-script font preloads per locale per first visit. | `preload:false` on Arabic faces or per-locale split (WP7) |
| **P1** | 3.9 MB video fetch per home visit incl. reduced-motion/data-saver users. | Re-encode ≤1.2 MB, immutable cache, motion gate (WP7) |
| **P2** | Full order history transferred to render 5 dashboard rows. | `LIMIT 5` + counts (WP5), SQL filters at ~1k orders |
| **P2** | Admin image bytes traverse client→function→Blob twice under a 5 MB global body limit. | Blob client uploads; body limit back to 1 MB default (WP3) |
| **P3** | 71 KB favicon to every new visitor; duplicated non-active-locale copy in every RSC payload. | ≤10 KB icon (WP7); `ClientProduct` slimming (WP6) |

Storefront invariants already met and frozen: 0 runtime DB round trips on cache hit; cart interactions = 0 network requests; checkout = 1 client request (PERF requirements table — all PASS except the hot-path items above).

# 7. Database Problems

| Priority | Problem | Source / evidence |
|---|---|---|
| **P0** | **No versioned migrations** — schema changes go to production via `drizzle-kit push` with no history/review/rollback (`drizzle/` dir absent, RT-verified). Single largest data-loss risk; blocks every schema-touching WP. | DATA F1 — `drizzle.config.ts` |
| **P1** | Non-transactional checkout (neon-http has no transactions): decrement → insert with best-effort, swallow-all `restoreStock`; process death or double failure silently loses stock with no drift detection. | DATA F2 · ARCH F5 · SCALE F2 — `products.ts:224-285` |
| **P1** | Zero DB-level integrity constraints beyond PK/unique: `status`/`payment_method` free varchar, no `stock >= 0`, no `sale_price < base_price`, no `total = subtotal + delivery_fee`. | DATA F3 — `schema.ts` (RT-verified: no CHECKs, no indexes) |
| **P1** | Order lifecycle too narrow (`new`/`delivered`): refused COD deliveries can't be cancelled, their stock never returns; "Revenue" stat counts undelivered orders + delivery fees (stat definition **TBD — owner decision**). | DATA F4 — `stat-cards.tsx:15` |
| **P2** | No indexes on `orders.created_at`/`status`/`delivered_at` or `feedback.created_at`; full-table + JS filtering pattern degrades monotonically. | DATA F5 · SCALE F5 |
| **P2** | Feedback: unbounded unauthenticated insert target, no `handled` flag, no DB length backstop. | DATA F8 |
| **P3** | Whole-JD integer money — correct today; insufficient at fils/gateway granularity. Decide consciously at the gateway milestone (DATA R7); do not add precision speculatively. | DATA F9 |
| **P3** | Dev JSON fallback triplicated across three modules — every schema change implemented twice; torn-write risk on crash. | DATA F10 · ARCH F4 |
| **P3** | Admin absolute stock write can clobber a concurrent checkout decrement (read 50 → sale decrements to 49 → admin saves 50). | SCALE F8 / edge case 4 |

# 8. Scalability Risks

SCALE's verdict, RT-stress-checked: **no structural blocker for realistic launch traffic** (10,000 simultaneous browsers are absorbed by CDN/framework cache; neon-http has no pool to exhaust; the conditional decrement serializes correctly on row locks — oversell is impossible).

| Priority | Risk | Source |
|---|---|---|
| **P0** | Stock-drain via scripted COD orders (availability framing of SEC F-1). | SCALE F4 |
| **P1** | Duplicate orders on mobile-network retries — the most probable real incident (~every few hundred orders). | SCALE F3 |
| **P1** | Non-durable compensation window: decrement-succeeded/insert-failed with failed restore = silent phantom out-of-stock, unbounded in time without the drift-detection stat (must ship **in WP2**, per SCALE C5). | SCALE F2/C5 |
| **P2** | Seed write amplification under checkout bursts (2 useless writes/order). | SCALE F1 |
| **P2** | Admin full-table reads grow O(orders) forever; SQL filters + pagination deferred to ~1k-order threshold (correctly). | SCALE F5 |
| **P2** | WAF thresholds vs Jordanian carrier NAT: over-tight per-IP limits over-block legitimate promo traffic. Generous hourly limits; honeypot/min-time carries fine-grained load; dry-run (log-only) during first campaign. | SCALE R1/T3 |
| **P3** | Order-number collision (~1% cumulative by ~4,200 orders) unretried; per-checkout `revalidateTag` re-busting cache under bursts (trivial once seed-once lands); Neon scale-to-zero first-query latency. | SCALE F6/F8 |

Checkout round-trip budget — **amended by RT ruling: "≤ 4 DB round trips per checkout regardless of cart size"** (idempotency pre-check + fresh read + single-statement decrement + insert). PERF's "≤ 3 flat" variant is overruled (see §17).

# 9. Responsive Problems

Foundation is strong (single responsive site, fluid `clamp()` type, logical properties, overflow discipline, pinch-zoom allowed — RESP). Defects:

| Priority | Problem | Source / evidence |
|---|---|---|
| **P2** | Shop filter row can overflow at 320px in EN (~300–315px of non-wrapping pills). One-class fix (`flex-wrap`), moved to WP9 by Phase D. | RESP V-1 — `shop-grid.tsx:30-61` |
| **P2** | Mobile hero pushes "Begin the Night" CTA to/below the fold (`order-first` media in `min-h-svh`); fix is layout reorder, which also aligns visual and DOM order. | UX F19 · RESP Phase D |
| **P3** | Admin orders table = 8 columns behind horizontal scroll on phones (internal tool; consider stacked cards `<md` in rebuild). | RESP V-2 |
| **P3** | ≥2560px screens are ~55% margin — nothing breaks; add `2xl:max-w-7xl` tier (DESIGN X1 amended container). | RESP V-3 |
| **P3** | Cart item names `truncate` instead of wrap (harmless with current Latin names). | RESP V-6 |
| Guardrails | New trust strip must wrap at 320px (never sticky/fixed); any future sticky mobile CTA must respect safe-area insets and never overlap the feedback tab. | RESP Phase D |

**Test matrix (binding):** 320 → 3840px (RESP's list supersedes DESIGN §3's 360–1920 floor — Phase D correction 5), every cell × EN-LTR and AR-RTL.

# 10. Accessibility Problems

| Priority | Problem | Source / evidence |
|---|---|---|
| **P0** | Checkout validation errors invisible to assistive tech: no `aria-invalid`/`aria-describedby`, no `role="alert"`, no focus move — a blind user fails checkout with zero feedback. | RESP A-1 (Critical) · UX F15 · QA-09-adjacent — `checkout-form.tsx` |
| **P0** | Add-to-cart never announced: the only `aria-live` region lives inside the closed drawer's portal and is unmounted (RT grep-verified: single occurrence at `cart-drawer.tsx:48`). Needs a persistent live region in the locale layout. | RESP A-2 (Critical) |
| **P1** | Focus ring fails WCAG 1.4.11 on light surfaces: `--ring: #c4a15e` = 2.18:1 on ivory. **RT amendment: the token fix alone is insufficient — `checkout-form.tsx:113-114` hardcodes `focus-visible:border-gold focus-visible:ring-gold/40`, bypassing the token; the call site must be fixed in the same WP8-lite slice (grep `(ring|border)-gold` on light surfaces).** | DESIGN F2 + RT C-2 |
| **P1** | `text-gold` "Coming soon" badge on light card ≈2.3:1, further dimmed by parent `opacity-60` — badge must be lifted out of the dimmed subtree. | RESP C-1 + DESIGN Phase D residual — `checkout-form.tsx:224,230` |
| **P1** | Arabic tracking fracture: inline `tracking-[0.2–0.35em]` on translated strings at ~15 call sites breaks joined script. Fix = opt-in `.label-caps` utility with RTL reset (DESIGN's ruling; the blanket `[dir=rtl]` selector is rejected — it would strip Latin product names, which correctly keep tracking). | RESP R-1 · DESIGN F4/self-correction |
| **P1** | Sheet/dialog close buttons: hardcoded English "Close", physical `right-3`. Decoupled from the drawer-side owner decision (Phase D correction 2) — ships in WP9 unconditionally. | RESP A-5/A-6 — `ui/sheet.tsx:62-77`, `ui/dialog.tsx:68` |
| **P1** | Shop filters misuse `role="tablist"/"tab"` with no keyboard contract → replace with `aria-pressed` buttons. | RESP A-7 · QA-19 · UX F20 — `shop-grid.tsx:32,40` |
| **P1** | No skip link; fixed header precedes `<main>`. | RESP A-8 |
| **P1** | Hero video ignores `prefers-reduced-motion` and lacks `aria-hidden` (native video bypasses MotionConfig). | RESP M-1 · QA-12 — `hero-media.tsx:36-47` |
| **P2** | Cart: count missing from cart-button name (A-3); qty steppers unlabeled + `aria-label` on a bare div + silent clamp at limit (A-4/QA-13); feedback widget errors/success unannounced, required field unmarked (A-9). | RESP · QA |
| **P2** | Sold-out status `text-night/50` ≈3.5:1 and struck price `/40` ≈2.6:1 on ivory — opacity floors: ≥`obsidian/65` on light, ≥`moon/60` on dark; replacements named (`text-taupe`). | RESP C-2/C-3 · DESIGN F3 |
| **P3** | `<s>` price semantics (sr-only "original/current price" prefixes); Latin runs lack `lang="en"` in AR; hardcoded hero alt; admin spinners lack `role="status"`; ritual copy `moon/50` borderline; physical properties in `ui/select`/`ui/table` (blocks RTL reuse — hard prerequisite for the checkout governorate select). | RESP A-10/R-4/R-5/A-11/C-4/R-3 |

# 11. UX Problems

The conversion story is the storefront's weakest layer (UX). Content marked TBD requires owner input — publishing invented policy copy is forbidden (binding rules 4/6).

| Priority | Problem | Source |
|---|---|---|
| **P0** | No COD signal, no delivery promise, no fee visibility anywhere pre-checkout — the two questions that decide a Jordanian COD purchase are answered only after commitment. (COD + 3 JD fee are shipped code facts and can surface now; the **2-day promise wording is TBD — owner**.) | UX F1/F2 |
| **P0** | Confirmation page falsely claims "A receipt has been sent to your email" while sending is log-only. Never lie on the success screen. Fix per ruling T2: truthful email-free copy now; `&receipt=1` client flag when Resend ships; page goes SSG; **no DB lookup ever**. | UX F3 |
| **P1** | No human contact channel: no phone/WhatsApp (**number TBD — owner**); Instagram DMs are the only path. | UX F4 |
| **P1** | No policies: returns/exchange, coverage area, terms (**all content TBD — owner**); the order number is a souvenir, not a tool. | UX F5 |
| **P1** | Homepage chapters sell blind: no image, no price, no set indicator on the primary discovery surface (all inputs exist in code — not owner-blocked, per Phase D WP10a). | UX F6/F7 |
| **P1** | Mandatory email in a COD market — hard validation wall on the least relevant field (ruling T9: optional, "(optional) — for your receipt", skip send when absent). | UX F13 |
| **P1** | Product page dead-ends after Add to Cart: no post-add path, no cross-links, confirmation easy to miss on mobile. | UX F10/F11/F18 |
| **P2** | Free-text city → 12-governorate select (public administrative fact, not owner-blocked; **depends on WP9's logical-properties pass on `ui/select`**). | UX F14 + Phase D |
| **P2** | Read-only checkout summary; no ETA at checkout/confirmation; shop filter not URL-persistent (`?audience=` deep links for Instagram). | UX F16/F9 |
| **P2** | Shared/generic gallery photography across packages (Apollo/Orion share sets; Aurora reuses the site hero) — **photography TBD (owner asset request, added to checklist by Phase D)**; fragrance notes remain **TBD — never fabricate**. | UX F12 |
| **P3** | Desktop cart drawer opens opposite its trigger (**drawer side TBD — owner decision, ruling T6**; recommend end-side; bundle with the already-decoupled close-button fix); orphaned "Our Story" nav key (**fate TBD — owner**). | UX F17/F8 |

# 12. What Should Be Preserved

Frozen consensus (every agent that touched these endorsed them; RT re-verified in code — do not "fix" during the rebuild):

- **Server-side re-pricing** — only `{slug, qty}` accepted; price/total/fee/payment recomputed fresh (`checkout/actions.ts:64-81`).
- **Conditional stock decrement shape** (`WHERE stock >= qty`) — oversell is impossible; keep exactly this predicate inside the new single statement.
- **Never-throws email invariant** (`receipt.ts:145-172`) — must survive the `after()` move with its own try/catch.
- **Tag-based cache invalidation** + uncached `getStoreProductsFresh()` for all money paths.
- **No-IDOR confirmation** — display-only order number, no lookup (SEC F-6/T2).
- **JSONB order-item snapshots**, bilingual JSONB copy, static-identity/DB-state product split, derived auto-archiving, integer whole-JD money (until gateway), `paymentMethod: "cod" | "card"` forward-compatibility.
- **Server actions only** — no API routes (single sanctioned exception: the admin-gated Blob token-exchange endpoint, SEC C-3.5).
- **Single responsive site**, logical properties, `[dir="rtl"]` type compensation, fluid `clamp()` display type.
- **Motion foundation** (`src/components/motion/`) with the three-layer reduced-motion contract + no-JS reveal fallback; admin Motion-free.
- **Base UI conventions**: no `asChild`; never wrap `SheetContent` in `AnimatePresence`; sharp 0.25rem radius; `background-image:` (never `background:` shorthand) for overlays; the base-layer cursor/focus rules.
- **Existing palette hexes** — the current values *are* the new direction under older names (DESIGN); `gold-deep` contrast lesson generalized, not replaced.
- **Dev JSON fallback existence** (repo runnable without Neon) — consolidated, not removed.
- **`checkout-validation.ts` shared-constants pattern**; pure isomorphic `pricing.ts`; cart clamp/prune logic; bilingual error/404 pages; `proxy.ts` matcher exclusions (load-bearing for i18n — no auth in proxy, ruling T5).

# 13. What Should Be Rebuilt

| Priority | Item | Replacement (defined) |
|---|---|---|
| **P0** | Checkout write pipeline | Idempotency pre-check → fresh re-price → single-statement atomic decrement (`UPDATE … FROM (VALUES …) RETURNING`) → idempotent insert with constraint-discriminating collision retry → conflict-loser-restores → `after()` email → revalidate (RT ruling C-1 = SCALE C1 pipeline; SEC C-2.1–2.4 hostile-input/oracle rules) |
| **P0** | Admin session | Random ≥128-bit server-tracked token, hashed at rest, server-side expiry, revocation, timing-safe compares, durable login throttling, symmetric cookie set/delete (SEC C-1.1–C-1.4; QA-01) |
| **P0** | Receipt email module | `escapeHtml` on **every** interpolation incl. `item.name`/`orderNumber`; `after()`; skip-when-absent; invariant kept |
| **P1** | Product cache layer | `use cache` + `cacheTag("products")` replacing `unstable_cache`, gated on route-staticness CI assertion live **before** the migration starts (PERF C4 — the riskiest platform change) |
| **P1** | Client catalog payload | Slim locale-resolved `ClientProduct` type so TS surfaces every consumer |
| **P1** | Admin order queries | Indexes now; `LIMIT 5` + counts on dashboard; SQL-side filters at ~1k orders; Amman-offset date parsing |
| **P1** | Order lifecycle | `cancelled_at` + CHECK constraints (NOT VALID → probe → VALIDATE); guarded set-once transitions **before** restock; explicit delivered→new semantics (RT D-3); truthful labeled stats (**definitions TBD — owner**) |
| **P1** | `ui/*` primitives | Logical-properties pass (`end-3`, `ps/pe`, `text-start`), localized close labels — prerequisite for RTL checkout select |
| **P1** | Design-token layer | Obsidian/Midnight/Silver/Champagne/Ivory rename via deprecated aliases; ring fix incl. the checkout inline override (RT C-2); opacity floors; `.label-caps`; italic policy; `luxe`/`xl` controls; 3-tier elevation |
| **P2** | Dev-store plumbing | One generic `createDevStore<T>()` with a production guard (SEC C-6.1) |
| **P2** | Admin page gates | Single `requireAdmin()` helper; per-action checks kept verbatim |
| **P2** | Confirmation page | SSG; client `useSearchParams` + shape validation; truthful copy |
| **P2** | Uploads | Blob client uploads behind an admin-gated token endpoint pinned to type/size/path (SEC C-3.3–3.5); body limit back to default |
| **P2** | Storefront resilience | Static-catalog fallback when cache regeneration fails with DB down (RT D-6) |

# 14. What Should Be Removed

Only items confirmed obsolete, or documented problems with replacement behavior defined (binding rule 3):

| Priority | Item | Justification + replacement |
|---|---|---|
| **P3** | Empty `src/app/api/test-order/` directory | Confirmed obsolete: contains no files, emits no route in the build (PERF F10, RT-verified empty). Replacement: none needed. Fold into WP6 cleanup. |
| **P3** | `shadcn` from runtime `dependencies` | CLI code-generator, imported nowhere in `src/` (ARCH F10, RT-verified `package.json:25`). Replacement: move to `devDependencies` — identical builds. |
| **P1** | `restoreStock` **multi-item** compensation path | Documented problem (silent-loss window); made structurally unnecessary by the single-statement atomic decrement. **Scoped per SCALE C3: the decrement-succeeded/insert-failed compensation stays until the gateway-milestone transaction lands** — only the multi-item partial path dies in WP2; full deletion in Phase 4. |
| **P1** | `unstable_cache` wrapper | Replaced API in Next 16 (ARCH F2, verified against the bundled docs — which do exist in full, contra SCALE's "index-only" claim). Replacement: `use cache` + `cacheTag`, deleted only after tag-reachability is proven on a preview deploy (SCALE/PERF C4 gates). |
| **P2** | `ensureSeeded()` on the read/write hot paths | Documented problem (4-agent consensus). Replacement: explicit seed script + per-instance memo. |
| **P2** | `role="tablist"/"tab"` on shop filters | Documented broken semantics. Replacement: `aria-pressed` toggle buttons (matches actual behavior). |
| **P2** | In-drawer `aria-live` region | Unmounted while closed (RESP A-2). Replacement: persistent polite live region in the locale layout, then remove the drawer one. |
| **P3** | Deprecated color aliases (`night|gold-*|navy-lune`) | Removed **only** after the grep gate shows zero uses in `src/` (DESIGN/T7) — end of Phase 3. |
| **P3** | Triplicated `devRead`/`devWrite` copies | Replaced by `createDevStore<T>()`; the fallback capability itself is preserved. |

Nothing else is deleted. Explicitly **not** removed: dev JSON fallback, static/DB product split, `paymentMethod` card forward-compatibility, motion primitives, per-action auth checks.

# 15. Proposed New Architecture

Phase B consolidated target (ARCH §3), as amended by Phase C conditions and RT corrections. Macro-structure unchanged — validated independently by SEC/PERF/SCALE/DATA. **No queues, no Redis, no microservices, no API routes** (single sanctioned Blob-token exception).

```
Platform   Vercel (lune-store) + Neon Postgres + Vercel Blob + Resend
           Vercel WAF rate-limit rules on public write actions [SEC F-1/T3; committed
           Postgres-counter fallback with an owner if WAF unavailable — SEC C-3.1]

src/
  proxy.ts              next-intl locale routing ONLY (admin/api excluded) [T5]
  data/products.ts      identity + seed defaults; seed-only fields documented [ARCH F11]
  lib/
    constants.ts        unchanged
    pricing.ts          unchanged (frozen)
    checkout-validation.ts  + governorate list [UX R5]
    db/schema.ts        + idempotency_key UNIQUE, cancelled_at, CHECKs,
                          indexes (created_at DESC, (status, delivered_at),
                          feedback.created_at), feedback.handled [DATA R2/R4/R6, SCALE]
    db/index.ts         neon-http now; neon-serverless Pool at gateway milestone [T1]
                        (no CTE shortcut for decrement+insert — SCALE's Postgres warning)
    migrations          drizzle/ committed; generate→review→migrate; push banned on prod [DATA R1]
    dev-store.ts        createDevStore<T>() + NODE_ENV=production guard [ARCH F4, SEC C-6.1]
    orders.ts           collision retry (constraint-discriminating — SCALE C2);
                          idempotent insert; SQL filters when volume demands
    products.ts         seed-once; single-statement atomic decrement returning the FULL
                          shortfall list (RT D-1); drift-detection query ships with WP2
                          (SCALE C5), computed on-demand, never per-dashboard-view (PERF C3a)
                        "use cache" + cacheTag("products"); getStoreProductsFresh uncached
                          (frozen); ClientProduct slim shape; static-catalog fallback on
                          regeneration failure (RT D-6)
    admin-auth.ts       random revocable hashed sessions; requireAdmin(); memo ≤60s (RT C-3);
                          per-action checks kept verbatim
    email/receipt.ts    escapeHtml everywhere; after(); skip-when-absent; never-throws kept
  app/
    [locale]/           SSG, tag-invalidated; confirmation SSG [T2]
      checkout/actions.ts  zod (+unique-slug refine, +expectedTotal → "priceChanged",
                           +runtime-validated idempotency key) → RT C-1 pipeline
      layout.tsx        Arabic font preload split; persistent aria-live; skip link
    admin/              requireAdmin(); Blob CLIENT uploads (admin-gated token endpoint —
                          the single sanctioned route [SEC C-3.5]); cancelled flow;
                          zod-validated setOrderStatus (RT D-3); AdminActionState surfaced
  components/
    ui/                 logical-properties pass; localized close labels [WP9]
    design system       token layer + aliases per DESIGN §1–§6 as amended (X1/X2/X3)
    cart/               storage-event cross-tab sync; labeled steppers; itemized soldOut
    motion/             unchanged foundation; hero video reduced-motion gate; ≤1.2 MB re-encode
  content (owner-confirmed only): trust strip, WhatsApp, delivery/returns page,
    chapters w/ image+price, post-add row, ?audience= links [UX R1–R8, WP10a/b split]
```

**Rulings in force:** T1 staged atomicity (single statement now, driver swap + full transaction at the gateway milestone — with SCALE's correction that the idempotency key does *not* cover orphaned decrements; the drift stat is the real backstop) · T2 static confirmation · T3 WAF-first rate limiting · T4 Blob client uploads · T5 no proxy auth · T6 drawer side = **TBD owner** (close-button fix decoupled) · T7 alias migration · T8 cancel semantics mechanical, stat definitions **TBD owner** · T9 optional email.

# 16. Proposed Data Strategy

Boundary ruling (DATA R8, endorsed unchanged):

| Data | Lives in | Status |
|---|---|---|
| Product identity (slug, audience, phase, accent) | Static `src/data/products.ts` | Keep |
| Editable product state (price, sale, stock, images, copy) | Database | Keep |
| Business constants (35/3 JD, archive days, default stock) | Static `constants.ts` | Keep — no settings table for 4 constants |
| Storefront reads | Cached (tag `products`) | Keep; migrate wrapper API only |
| Checkout/admin reads | Uncached fresh | Keep (frozen) |
| Orders / feedback | Database, always fresh | Keep |
| Future promo codes / inventory ledger | Only when commissioned | Do not build now |

- **P0 — Migrations first (WP0):** `drizzle-kit generate` baseline committed and adopted on prod without executing DDL (drift-check via pull/push comparison first); `push` banned against production thereafter. Blocks every schema change.
- **P1 — Additive schema evolution:** `idempotency_key` (nullable → UNIQUE), `cancelled_at`, CHECK constraints via the two-step `NOT VALID` → violation probe → `VALIDATE` pattern; CHECK-on-varchar deliberately over `pgEnum` (safe to widen later). Indexes: `orders(created_at DESC)`, composite `(status, delivered_at)` (SCALE's refinement — serves the archive predicate), `feedback(created_at DESC)`; `feedback.handled`.
- **P1 — Lifecycle:** guarded transitions — cancel = `UPDATE … SET cancelled_at=now() WHERE id=$1 AND cancelled_at IS NULL RETURNING id`, restock only on a returned row (transition **before** restore — SCALE C6/SEC C-5.1); `deliveredAt` set-once; delivered→new semantics defined explicitly or forbidden (RT D-3); legal-transition table (SEC C-5.2). Revenue/cancel semantics beyond "cancel restores stock once" are **TBD — owner**.
- **P2 — Drift detection** (baseline − non-cancelled order qty vs actual stock) ships with WP2 as the declared backstop for the accepted compensation residual; computed on demand.
- **P3 — Money:** whole-JD integers stay; unit named in docs; fils migration only at the gateway milestone via the two-phase backfill path (DATA R7).
- **P3 — Dev parity:** `createDevStore<T>()` with prod guard; consider a Neon branch for local dev to end dual implementations (DATA's mitigation).
- All DB testing on **Neon branches, never production** (universal rule across reports).

# 17. Proposed Request Strategy

**Performance budget — the FULL Phase A table is the CI gate (PERF C5; the truncated Phase B copy is superseded), with RT's round-trip amendment:**

| Metric | Budget |
|---|---|
| First-load JS (gz), any storefront route | ≤ 300 KB now; target ≤ 250 KB |
| CSS (gz) | ≤ 25 KB |
| Fonts preloaded per page | ≤ 5 files / ≤ 250 KB |
| Hero video | ≤ 1.5 MB (target 1.2); images ≤ 150 KB |
| Storefront page view, cache hit | **0 runtime DB round trips** |
| Checkout submit | **≤ 4 DB round trips regardless of cart size** (RT C-1 ruling — pre-check + fresh read + decrement + insert; supersedes both "≤ 2 + 1/item" and PERF's "≤ 3 flat") |
| Cart interaction | 0 server requests |
| LCP ≤ 2.5 s (mid-tier mobile 4G) · CLS ≤ 0.1 · INP ≤ 200 ms | field-measured via Vercel Web Analytics |

- **Checkout pipeline (P0):** the RT-ruled SCALE C1 sequence. Idempotency key: client `crypto.randomUUID()` at form mount, regenerated after success and on cart mutation (SCALE C4); server-validated as hostile input, payload-hash-matched on replay, `{ok, orderNumber}` only — never stored customer fields (SEC C-2.1/C-2.2); `expectedTotal` is UX-only, server total always authoritative (SEC C-2.3); sale-boundary clock-skew "priceChanged" is the tested graceful path (RT D-5).
- **Caching (P1):** SSG + tag invalidation everywhere; confirmation goes SSG; `use cache` migration gated on the pre-existing route-staticness CI assertion + preview-deploy tag-reachability proof (PERF C4, SCALE); explicit `cacheLife`; `getStoreProductsFresh` never cached.
- **Assets (P1, pull forward — PERF O1):** WP7 has zero dependencies on WP5/WP6 and holds the two largest user-visible wins (fonts ~200–260 KB/page; video ~2.5 MB/visit) — run parallel with WP2–WP4.
- **Email (P1):** `after()`; skipped when email absent (T9).
- **Uploads (P2):** Blob client uploads; one token-mint call replaces the full double transfer; global body limit back to 1 MB.
- **Admin (P2):** single indexed session lookup, admin paths only, memo ≤ 60 s (RT C-3); no standing drift/COUNT queries per dashboard view (PERF C3); one aggregate query for stat cards.
- **No new dependencies** anywhere in the request path (rule 10 — held by every ruling: WAF over Redis, native `after()`, existing `@vercel/blob`).

# 18. Proposed Security Strategy

Ordered by the WP sequence; every item is an acceptance criterion, not guidance:

1. **P0 — Abuse protection (WP3):** Vercel WAF rate-limit rules targeting `POST` on checkout/feedback/admin-login paths across all locales (server actions POST to page URLs — `Next-Action` header, SEC C-3.2), thresholds generous for carrier NAT, verified available on the current plan **before WP3 closes** (C-3.1) with the durable Postgres-counter fallback as a committed contingency; honeypot + min-submit-time in both public forms. Honeypot alone does not resolve F-1.
2. **P0 — Sessions (WP1):** random ≥128-bit tokens, stored hashed (C-1.4), server-side expiry + revocation, all sessions invalidated on password change, timing-safe fixed-length digest compares (C-1.2), durable login throttling (C-1.3 — in-memory counters under-block on serverless), symmetric cookie path set/delete, cookie flags kept (`httpOnly`, `secure` prod, `sameSite: lax`, `path: /admin`).
3. **P0 — Email escaping (WP4):** every interpolation escaped **before `RESEND_API_KEY` is ever set** (hard gate); never-throws survives `after()` with its own try/catch; RT D-2's regression test pins "email throw → order still succeeds, stock untouched."
4. **P1 — Idempotency hardening (WP2):** strict key shape validation; replay oracle prevention via payload hash; reject oversized values.
5. **P1 — Blob token endpoint (WP3) — the largest new attack surface:** `requireAdmin()` before any token; `allowedContentTypes` pinned to jpeg/png/webp; `maximumSizeInBytes` 4 MB; pathname pinned server-side to validated `products/<slug>-<slot>-` (current code already uses exactly this shape — `admin/products/actions.ts:180`); short-lived single-use tokens; recorded URL validated against host + prefix before persisting (C-3.3/C-3.4); accepted explicitly as the single sanctioned route (C-3.5).
6. **P2 — Admin input validation:** zod enum on `setOrderStatus` args (RT D-3); `?audience=` validated against the men/women enum; governorate validated against the fixed list.
7. **P2 — Data protection:** `createDevStore` refuses/warns in production without `DATABASE_URL` (C-6.1); `.env*`/`*.dev.json` stay gitignored; no order lookup ever added to the confirmation page without an ownership check (F-6 standing warning).
8. **P3 — Hygiene:** `drizzle-kit` upgrade clears the esbuild advisory; strong-`ADMIN_PASSWORD` requirement documented.
9. **Continuous — C-11.1 regression suite named in WP11:** tamper rejection (price/total/paymentMethod=card/qty>stock/>20/>10 items/duplicate slugs), auth-denial of every admin page and action, distinct-cookie + revocation tests, rate-limit thresholds, upload-token scope (wrong MIME, >4 MB, non-admin, foreign path), idempotency replay + wrong-payload replay, receipt escaping.

# 19. Proposed Responsive Strategy

1. **Single responsive site** (frozen) — one codebase, mobile-first, 320px → 4K. Zero horizontal scroll on `<body>` at 320px; wide content scrolls in its own `overflow-x-auto` container.
2. **Breakpoints:** Tailwind defaults with assigned roles (RESP table) — base 320–639 single column · `sm:` 640 full header/sheet caps · `md:` 768 reserved for tablet/admin card→table · `lg:` 1024 two-col product/checkout, 4-col grid · `2xl:` 1536+ **new tier**: `2xl:max-w-7xl` containers, +1 body step (DESIGN X1 amended).
3. **Preserve verbatim:** fluid `clamp()` display utilities, `[dir="rtl"]` line-height/size compensation, `svh` hero behavior, hover/pointer media guards.
4. **A11y foundation (WP9/WP9a):** persistent live region, skip link, checkout error ARIA + focus management, labeled steppers with disabled-at-limit, `aria-pressed` filters, localized/logical close buttons, `lang` markup, 44×44px effective targets at 360px (DESIGN gate — stricter than current 40px, adopted).
5. **New-content guardrails (RESP Phase D):** trust strip wraps (grid/flex-wrap, never sticky); chapter images `alt={product.name}`, lazy, never `priority`; post-add row ≥44px targets, announced once via the global live region, reduced-motion-guarded entrance; WhatsApp links named in text with `dir="ltr"` numbers; optional-email hint via `aria-describedby`.
6. **Test matrix (binding, WP11):** 320, 360, 390, 414, 640, 768, 820, 1024, 1280, 1536, 1920, 2560, 3840 + two landscape sizes — **every cell × EN-LTR and AR-RTL**, per rebuilt screen; axe-core per page per locale; 200% zoom / WCAG 1.4.10 reflow; keyboard-only full purchase; NVDA/VoiceOver smoke on checkout and cart. Runnable against `npm run dev` (production URL unreachable from the audit machine).

# 20. Proposed Design Direction

**Luxury Fragrance × Moonlight × Celestial Mystery — never sci-fi/cyberpunk/neon/gaming** (binding rule 20). DESIGN's system as amended by its own Phase D:

- **Palette:** existing hexes kept, renamed — Obsidian `#0b0e17` / Midnight ladder / Lunar Champagne `#c4a15e` (dark surfaces ONLY) / `champagne-700 #7c6132` (mandatory on light — the generalized `gold-deep` lesson) / Lunar Ivory / warm Moon text / wine + midnight-500 audience accents. **Moon Silver** (`#e6e9f0/#c8cede/#9aa3b8`) is the only new family — cool secondary text/hairlines on dark only. Migration via deprecated aliases (T7): both names valid during rebuild, aliases deleted only at grep-zero.
- **Contrast (binding, measured):** champagne never on light; opacity floors `obsidian/65` (light) and `moon/60` (dark); light-mode `--ring` → `#7c6132` **plus the RT-C-2 call-site sweep** (`(ring|border|text)-gold` on light surfaces, incl. `checkout-form.tsx:113-114,230`); destructive `#9d2f2f` at 6.52:1 for errors — all shipped early in the **WP8-lite** P0 slice (DESIGN X2 as amended), expressible in current token names.
- **Typography:** Playfair→Amiri display, Jost→Plex Arabic body — zero new fonts. Arabic first-class: canonical `[dir="rtl"]` scale rows; **italic is English-only** (`[dir="rtl"] not-italic` policy); tracking ≤ 0.12em on Arabic via the opt-in `.label-caps` utility (blanket selector rejected — Latin product names Apollo/Orion/Elysia/Aurora keep their tracking + gain `lang="en"`); Western digits + `tabular-nums` for all prices in both locales.
- **Components:** `luxe`/`luxe-outline` variants + `xl` (h-12) size end the ad-hoc CTA overrides; h-12 checkout inputs; three-tier elevation (none / overlay / dark-only champagne glow); sharp radius kept; state specs canonized (loading/error/empty per §5.7); new specs for trust strip, skip link, post-add row, `aria-pressed` filter pills, storefront governorate select, chapter price line (DESIGN G1–G6).
- **Motion:** existing foundation frozen — brand ease, 150ms–1.1s duration scale, fade/rise/clip vocabulary, RTL-safe `useDir()`, three-layer reduced-motion + no-JS contract; hero video gains its motion gate; aurora GPU-profiled on a real mid-tier Android before the visual rebuild (PERF M1).
- **Owner-gated content (all TBD, never invented):** 2-day promise wording, WhatsApp number, returns/coverage policy copy, per-package photography, drawer side, "Our Story" fate, hero re-encode sign-off, revenue-stat definition, fragrance notes (remain editable, absent until provided).

# 21. Implementation Roadmap

Amended work-package order (Phase B §5 + Phase C/D corrections + RT rulings). Every phase-1/2 change is a small revertible commit; schema changes additive-only until cleanup; the alias layer keeps unmigrated screens pixel-identical.

| Order | Package | Scope | Resolves | Gate / notes |
|---|---|---|---|---|
| 1 | **WP0** — Migrations baseline | `generate` → commit `drizzle/0000_*` → adopt on prod without DDL (drift-check first); Neon branch test setup; `push` banned on prod | DATA F1, ARCH F13 | **P0 — blocks everything schema-touching** |
| 2 | **WP1 + WP8-lite** — Admin session integrity + AA conformance slice | Logout path fix; random revocable hashed tokens; timing-safe compares; durable login throttling; `requireAdmin()`; zod-validated + surfaced `setOrderStatus`; **WP8-lite:** light `--ring` → `#7c6132`, `text-night/50` → `/70`, Coming-soon badge → `gold-deep` lifted from the dimmed subtree, **plus the checkout inline `ring-gold/40` override (RT C-2)** | QA-01, SEC F-2/C-1.1–1.4, QA-18, ARCH F6/F7, DESIGN F2/F3, RESP C-1/C-2, RT C-2/C-3/D-3(zod) | P0 — zero visual redesign |
| 3 | **WP2** — Checkout integrity | Seed-once; **RT-C-1 pipeline** (pre-check → single-statement decrement w/ full shortfall list [RT D-1] → idempotent insert → constraint-discriminating retry → conflict-loser-restores); key lifecycle (SCALE C4); unique-slug refine; `expectedTotal`/"priceChanged"; **drift-detection stat ships here** (SCALE C5, on-demand per PERF C3); multi-item compensation deleted, insert-failure compensation **kept** (SCALE C3) | SCALE F1/F2/F3/F6 + C1–C5, DATA F2/F6/F7, QA-02/03/04/10/11, ARCH F1/F5/F8, SEC C-2.1–2.4, RT C-1/D-1/D-5 | P0 — budget: ≤ 4 round trips flat |
| 4 | **WP3** — Abuse protection | WAF rules (availability verified before close; Postgres-counter fallback committed); honeypot + min-time; Blob client uploads behind the admin-gated pinned token endpoint; body limit → default | SEC F-1/F-3/C-3.1–3.5, SCALE F4, PERF F11, DATA F8 | P0 |
| 5 | **WP4** — Email & confirmation truth | `escapeHtml` everywhere; `after()` (+ own try/catch); skip-when-absent (T9); truthful SSG confirmation with param validation (T2); RT D-2 regression test | SEC F-7, QA-05/16, PERF F3b/F6, SCALE F7, UX F3, RT D-2 | **P0 — escaping lands before `RESEND_API_KEY` ever exists** |
| ∥ | **WP7** — Assets (parallel with WP2–WP4, per PERF O1) | Arabic font preload split; hero re-encode ≤1.2 MB + immutable caching + reduced-motion/`aria-hidden` gate; ≤10 KB favicon; storage-event cart sync | PERF F1/F2/F7, RESP M-1, QA-12/03 | P1 — zero dependencies on other WPs |
| 6 | **WP9a** — Critical ARIA slice (Phase D correction 1) | Checkout error ARIA + focus-to-first-invalid; persistent live region + add/qty announcements; cart-count button name; stepper labels | RESP A-1/A-2/A-3/A-4 (both Criticals), UX F15/F21, QA-13 | P0-equivalent a11y; zero visual change; may use current class names via aliases |
| 7 | **WP5** — Data-model evolution | CHECKs (two-step VALIDATE); `cancelled_at` + guarded transition-before-restore (C-5.1/C6); delivered→new semantics defined (RT D-3); set-once `deliveredAt`; composite `(status, delivered_at)` + `created_at DESC` + feedback indexes; dashboard `LIMIT 5` + single aggregate stats query; Amman-offset filters (QA-17); admin stock optimistic guard (SCALE edge 4); `feedback.handled` | DATA F3/F4/F5, SCALE F5/F8/C6, ARCH F9, QA-17, RT D-3 | P1; stat/cancel semantics **TBD owner** |
| 8 | **WP6** — Platform modernization | `use cache` + `cacheTag` (route-staticness CI assertion is a hard precondition — PERF C4; tag reachability proven on preview before deleting `unstable_cache`); `ClientProduct`; `createDevStore` + prod guard; static-catalog fallback (RT D-6); header `CartButton` dedupe; `shadcn`→dev; empty `api/test-order/` deletion; drizzle-kit upgrade | ARCH F2/F3/F4/F10/F12, PERF F8/F10/M2, SEC F-4/F-5/C-6.1–6.2, DATA F10, RT D-6 | P1 |
| 9 | **WP8** — Full design-token layer | Palette rename + aliases; silver family; `.label-caps` + italic policy; `luxe`/`xl` + h-12 inputs; elevation scale; remaining opacity floors | DESIGN F1–F8 (rest), RESP C-3/C-4, QA-07 | P2 — prerequisite for WP10; ordering before WP9's styled items explicit (Phase D correction 4) |
| 10 | **WP9** (remainder) — A11y & RTL foundation | Skip link; `aria-pressed` filters + **V-1 `flex-wrap`** (moved here — Phase D correction 3); localized/logical sheet close (**decoupled from T6** — correction 2); `ui/*` logical-properties pass (prereq for governorate select); `lang` markup; locale-switcher query preservation (QA-06); feedback widget ARIA; price semantics | RESP A-5…A-11/R-1/R-3/R-4/R-5/V-1, QA-06/08/19, UX F20 | P2 — each item lands before its WP10 screen |
| 11 | **WP10a** — Conversion rebuild, unblocked (Phase D split) | Chapters w/ image + `effectivePrice`; checkout friction pass (optional email per T9; governorate select; validation-drift fix QA-09); post-add row; `?audience=` deep links (client-side — stays SSG); mobile hero CTA reorder; trust strip with COD + fee lines (code facts) | UX F6/F7/F9/F10/F11/F13/F14/F15-mechanics/F18/F19, QA-09/15 | P2 — no owner dependency |
| 12 | **WP10b** — Conversion rebuild, **owner-gated** | 2-day promise site-wide; WhatsApp links; delivery/returns policy page; coverage claims; drawer-side decision (T6) recorded in CLAUDE.md; "Our Story" fate; per-package photography ingestion via existing admin uploader | UX F1(remainder)/F2/F4/F5/F8/F12/F16/F17 | P2–P3 — **blocked on owner-decision checklist; nothing invented** |
| ∞ | **WP11** — Verification net (continuous from WP1) | Unit + integration suites (oversell race, multi-item atomicity, idempotency sequential/concurrent/wrong-payload replay, collision discrimination, tamper suite C-11.1, email-throw isolation, cancel double-fire, sold-out itemization parity, sale-boundary priceChanged, session revocation timing); **full** perf-budget CI (PERF C5 table + ≤4-RT line); route-staticness assertion (live before WP6); 320→3840 × EN/AR matrix; axe-core per page/locale; Neon-branch load tests; aurora GPU profile (PERF M1); Vercel Web Analytics | All reports' verification sections + RT §Verification | Gates every WP above |
| Cleanup | Phase 4 | Delete aliases at grep-zero; delete the insert-failure compensation **only when** the gateway-milestone transaction lands (driver swap, no CTE shortcut); money-unit decision (DATA R7); SQL-side admin filters at ~1k orders | — | Post-rebuild |

**Owner-decision checklist (blocks WP10b, parts of WP5):** 2-day delivery promise wording · WhatsApp number · return/exchange policy text · delivery coverage area · revenue-stat definition · cancel/refund semantics beyond stock-restore · cart-drawer side · "Our Story" fate · hero re-encode sign-off · per-package photography (asset request) · fragrance notes (remain TBD/editable — binding rules 4/6).
