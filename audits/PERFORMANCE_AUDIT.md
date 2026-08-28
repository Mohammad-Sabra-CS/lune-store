# Executive Summary

Phase A audit by SUB-AGENT 3 (Performance & Request Efficiency), 2026-08-27. Code + production build analyzed (`npm run build`, Next.js 16.3.0 / Turbopack). Live HTTP was not tested — this machine cannot reach `*.vercel.app` (TLS interception).

The architecture is fundamentally sound: all storefront pages (home, shop, product, checkout) are **SSG** with product data behind `unstable_cache` tagged `"products"`, invalidated with the current `revalidateTag("products", "max")` API. The cart is pure client state (localStorage) with **zero** network requests. There is no polling, no third-party scripts, no analytics beacons, no duplicate data fetching per route.

The main costs found, in order of impact:

1. **~460 KB of fonts (9 woff2 files) are preloaded on every storefront page in both scripts** — Arabic fonts (Amiri, IBM Plex Sans Arabic) are force-downloaded on English pages and vice versa (`src/app/[locale]/layout.tsx:17-39`).
2. **3.7 MB hero video** (`public/hero-loop.mp4`) downloaded on every home visit; the idle-mount strategy is good, but the file itself is oversized and served from `public/` (non-immutable caching on Vercel).
3. **Checkout server action performs ~5+ sequential Neon HTTP round trips plus an awaited email-API call** per order, including a redundant seed-INSERT on the hot path (`src/app/[locale]/checkout/actions.ts`, `src/lib/products.ts:83-97`).
4. **Admin queries are unbounded** — `listOrders()` / `listFeedback()` select every row with no `LIMIT`, no filters pushed to SQL, and no secondary indexes (`src/lib/orders.ts:63-68`, `src/lib/feedback.ts:52-54`).
5. **~944 KB raw / ~290 KB gzipped first-load JS** on every storefront page (16 chunks) — acceptable for a Motion-heavy brand site but at the ceiling of a sensible budget.

No finding requires removing functionality. All recommendations preserve security and correctness (server-side pricing, stock reservation, COD-only validation are untouched).

# Current State

## Build evidence (npm run build, Next 16.3.0)

```
● SSG:      /en, /ar (home) · /en|ar/shop · /en|ar/checkout · /en|ar/product/{apollo,orion,elysia,aurora}
ƒ Dynamic:  /[locale]/confirmation · /[locale]/[...rest] (branded 404) · /admin, /admin/{orders,products,products/[slug],feedback}
○ Static:   /_not-found, /icon.png
ƒ Proxy:    next-intl locale routing (src/proxy.ts) — excluded from /api, /admin, /_next, files
```

Measured assets (uncompressed unless noted):

| Asset | Size | Notes |
|---|---|---|
| First-load JS, home (16 chunks) | 944 KB raw / **290 KB gzip** | Shop 917 KB, checkout 919 KB, product 916 KB raw — same shared set |
| CSS (single chunk) | 95 KB raw | Tailwind v4, one file, immutable `/_next/static` |
| Fonts preloaded per page | **9 files, 460 KB** | Playfair (3 wts + italic), Jost, Amiri (2 wts), Plex Arabic (4 wts) — all `rel=preload` on every page, both locales |
| Fonts total shipped | 34 files, 860 KB | Non-preloaded subsets load on demand via unicode-range (fine) |
| `public/hero-loop.mp4` | **3.7 MB** | Client-mounted after idle; plays once |
| `public/products/*.jpg` | 28–72 KB each (10 files) | Served via `/_next/image` with proper `sizes` — good |
| `src/app/icon.png` | 72 KB | Favicon fetched by every browser |
| Home HTML | 80 KB (en) / 82 KB (ar) | Includes RSC payload + full product catalog serialization |

## Caching model (verified against `node_modules/next/dist/docs`)

`cacheComponents` is **not** enabled (`next.config.ts`), so the project correctly uses the documented "previous model" (`01-app/02-guides/caching-without-cache-components.md`): `unstable_cache` with `tags: ["products"]` (`src/lib/products.ts:145-149`) + `revalidateTag("products", "max")` (`checkout/actions.ts:108`, `admin/products/actions.ts:24`). The `"max"` profile is the current recommended stale-while-revalidate form; the one-argument form is deprecated. Tag invalidation marks SSG pages stale; the next visitor gets stale HTML while regeneration happens in the background — correct and cheap for a 4-product store.

## Request map — PAGE → REQUESTS → PURPOSE → CAN BE CACHED? → CAN BE REMOVED?

Storefront runtime DB requests are **zero on cache hit** for all SSG pages; the DB is touched only during background regeneration after `revalidateTag`.

### Home `/{locale}` (`src/app/[locale]/page.tsx`) — SSG

| Request | Purpose | Cacheable? | Removable? |
|---|---|---|---|
| HTML document | Page shell | Yes — CDN, SWR after tag invalidation (already so) | No |
| 16 JS chunks (~290 KB gz) | Hydration, Motion reveals, cart | Yes — immutable `/_next/static` (already so) | Partially — see F5 |
| 1 CSS chunk (95 KB) | Styling | Yes — immutable (already so) | No |
| 9 font preloads (460 KB) | Typography | Yes — immutable (already so) | **~half per locale** — Arabic fonts need not be preloaded on EN pages and vice versa (F1) |
| `/_next/image?url=/products/hero-marble.jpg` (preloaded, priority) | LCP hero image | Yes — optimized + long-lived (already so) | No — this is the correct LCP strategy |
| `hero-loop.mp4` (3.7 MB, after `requestIdleCallback`) | Hero ambience, plays once | Partially — `public/` on Vercel is edge-cached but browser-revalidated (not immutable) | Not removable (brand), but **shrinkable ~60-70%** (F2) |
| Link prefetches (shop, 4 product pages, from viewport) | Instant navigation | Yes — RSC prefetch of SSG routes is cached | Keep — default Next behavior, good UX; all targets are static |
| DB queries at runtime | — | — | **None** — requirement "homepage must not query DB for static product info" is MET (SSG + `unstable_cache`) |

### Shop `/{locale}/shop` — SSG

Same shared JS/CSS/font set (browser-cached after first page). Product data comes embedded in the RSC payload via `ProductsProvider` — **no client fetch, no DB at runtime**. Additional requests: 4 × `/_next/image` product cards (proper `sizes="(max-width:640px) 50vw, 25vw"`). Filter tabs are pure client state — zero requests. Nothing removable.

### Product `/{locale}/product/[slug]` — SSG (8 paths prebuilt)

Additional requests: gallery images — **all** gallery `<Image fill>` layers are mounted at full display size plus thumbnails (`src/components/product/gallery.tsx:25-45`); for ~3-image galleries that is ~6 image requests up front, inactive ones hidden at `opacity: 0` but still in-viewport (so not lazy-deferred). Acceptable at 3 images; would not scale to 10. Not removable; could defer non-active slides with `loading="lazy"` + off-viewport technique if galleries grow.

### Checkout `/{locale}/checkout` — SSG page + 1 server action on submit

| Request | Purpose | Cacheable? | Removable? |
|---|---|---|---|
| HTML + shared static assets | Form shell | Yes (already SSG) | No |
| `placeOrder` server action POST (1 request) | Create order | No — mutation | No. This is the only network request in the entire cart→order flow; requirement MET |

Inside that single POST, however (`src/app/[locale]/checkout/actions.ts:57-115`), the server performs **sequentially** over Neon's HTTP driver (no connection reuse between round trips):

1. `getStoreProductsFresh()` → `ensureSeeded()` INSERT…ON CONFLICT (`src/lib/products.ts:83-97`) — **redundant every order** (F3a)
2. …then SELECT all products (`products.ts:104-113`) — required (authoritative pricing/stock)
3. `decrementStock()` — 1 conditional UPDATE **per cart item** (`products.ts:224-245`) — required
4. `createOrder()` INSERT (`src/lib/orders.ts:47-50`) — required
5. `await sendReceiptEmail()` — external Resend API RTT **blocks the user's response** (`actions.ts:107`) (F3b)
6. `revalidateTag("products", "max")` — required, cheap

### Confirmation `/{locale}/confirmation?order=…` — **Dynamic** (ƒ)

The page reads `searchParams` server-side (`src/app/[locale]/confirmation/page.tsx:17-27`) only to pass `order` into the client `ConfirmationReveal`. This forces a full server render (locale layout included) per view for what is otherwise a static page. Cacheable: could be fully SSG if the order number were read client-side (F6). No DB queries (layout's `getStoreProducts` is cache-hit). Low traffic, low priority.

### Catch-all 404 `/{locale}/[...rest]` — Dynamic (ƒ)

Every bad URL under a locale triggers an SSR invocation (branded 404). Acceptable; bot noise cost only.

### Admin `/admin*` — `force-dynamic`, cookie-gated, per view

| Page | DB round trips per view | Notes |
|---|---|---|
| `/admin` (`admin/page.tsx:17-21`) | 3 — `listOrders()` (all rows), `ensureSeeded` INSERT, products SELECT | Fetches **every order ever** to show 5 (`slice(0, 5)` in JS) (F4) |
| `/admin/orders` | 3 — same; filtering/search/date range all done in JS after full-table fetch (`admin/orders/page.tsx:43-46`) | F4 |
| `/admin/products`, `/admin/products/[slug]` | 2 — `ensureSeeded` + SELECT | F3a applies |
| `/admin/feedback` | 1 — `listFeedback()` all rows (`src/lib/feedback.ts:52-54`) | F4 |
| Login POST | 0 DB — sha256 compare (`src/lib/admin-auth.ts`) | Fine |
| Image upload action | server action (≤5 MB body) → `@vercel/blob put` | Bytes traverse client→function→Blob (double transfer); admin-only, acceptable. Client-upload tokens are the optimization if uploads grow |

Admin correctly imports no Motion; separate root layout loads only Jost.

### Site-wide client behavior (verified)

- **Cart** (`src/components/cart/cart-context.tsx`): React context + `localStorage` (`lune-cart`); add/remove/qty/totals produce **zero network requests**. Requirement MET.
- **Feedback widget** (`src/components/feedback/feedback-widget.tsx`): renders on all storefront pages; one server-action POST on submit, DB INSERT (`feedback/actions.ts`). No throttling/rate limit (cost exposure — coordinate with security agent).
- **No polling, no `setInterval`, no client `fetch()` calls, no third-party scripts, no analytics** anywhere in `src/` (grep-verified).
- `NextIntlClientProvider` ships the full message catalog to the client (~4.3 KB en / 5.4 KB ar raw) — negligible at this size.
- `ProductsProvider` (`src/app/[locale]/layout.tsx:79,96`) serializes the **full bilingual catalog** (poetry/character/description in both locales + gallery arrays) into every page's RSC payload, including checkout/confirmation (verified in built HTML). ~4 products → small today; shape is wasteful in principle (F8).

# Findings

**F1 — Both scripts' fonts are preloaded on every page (460 KB, 9 files).**
`src/app/[locale]/layout.tsx:17-39` declares Playfair (3 weights × 2 styles), Jost, Amiri (2 weights), IBM Plex Sans Arabic (4 weights), all with default `preload: true`. Built HTML for `/en` contains 9 `<link rel="preload" as="font">` entries totaling 460 KB — including the two largest files (108 KB + 100 KB, the Arabic faces). `rel=preload` defeats the unicode-range lazy-loading that would otherwise skip unused scripts, so English visitors download the whole Arabic set before first paint and vice versa. The font-stack fallthrough architecture itself is fine and should stay — only the preload flags are wrong.

**F2 — 3.7 MB hero video, not immutable-cached.**
`public/hero-loop.mp4` is the largest asset in the project by 50×. The delivery strategy in `src/components/home/hero-media.tsx:15-23` is genuinely good: mounted only after `requestIdleCallback` (2.5 s timeout), marble still (`hero-marble.jpg`, priority, via `/_next/image`) owns LCP, video crossfades in and plays once. Remaining problems: (a) the file is simply too big for a single-play ambience loop — 3.7 MB per home visit on mobile data; (b) files in `public/` are served by Vercel with revalidation-based caching, not `immutable`, so repeat visitors re-negotiate; (c) `autoPlay` triggers a full-file fetch with no quality tiering (`media="(min-width:…)"` sources or a smaller mobile encode).

**F3 — Checkout POST latency: redundant seed write + awaited email on the hot path.**
(a) `ensureSeeded()` (`src/lib/products.ts:83-97`) issues `INSERT … ON CONFLICT DO NOTHING` before **every** uncached product read — every checkout, every admin page view. The seed is only ever needed once per environment (products are fixed at 4). Over `neon-http` each statement is a separate HTTPS round trip, so every order pays an extra ~30-80 ms write for nothing.
(b) `await sendReceiptEmail(orderInput)` (`checkout/actions.ts:107`) blocks the customer's confirmation on the Resend API round trip (once `RESEND_API_KEY` is set; today it only logs). Email failure already cannot fail the order (errors swallowed in `src/lib/email/receipt.ts:169-171`), so there is no correctness reason to await it before responding.
(c) `decrementStock` runs one UPDATE per item sequentially (`products.ts:230-243`) — fine at ≤4 line items; documented micro-race is an accepted trade-off, do not "optimize" it away.

**F4 — Unbounded admin queries, no SQL-level filtering, no secondary indexes.**
`listOrders()` is `SELECT * FROM orders ORDER BY created_at DESC` with no `LIMIT` (`src/lib/orders.ts:63-68`); the dashboard then keeps 5 rows in JS (`admin/page.tsx:22`), and `/admin/orders` filters status/search/date range in JS (`admin/orders/page.tsx:43-46`, `lib/orders.ts` `filterOrders`). `listFeedback()` likewise (`feedback.ts:52-54`). `src/lib/db/schema.ts` defines only primary keys — no index on `orders.created_at` or `orders.status`. At hundreds of orders this is fine; at thousands, every admin page view transfers the whole table (each row includes full items JSON + address) and scans it.

**F5 — First-load JS ~290 KB gzipped (944 KB raw, 16 chunks) on every storefront page.**
Shared across all pages (so paid once per session), dominated by React 19 + Motion + next-intl + Base UI (largest chunks: 232 KB, 184 KB, 152 KB, 112 KB raw). Nothing pathological — no accidental double-bundling detected, `framer-motion` is correctly absent, admin ships no Motion. But every storefront route hydrates the full header/cart/drawer/feedback/motion stack, and 290 KB gz is at the top of a reasonable budget for a 4-product store on mid-range mobiles (~1 s+ parse/execute on low-end Android).

**F6 — Confirmation page is dynamic only because `searchParams` is read server-side.**
`src/app/[locale]/confirmation/page.tsx:17-27` awaits `searchParams` to pass `order` as a prop to the client component `ConfirmationReveal`. That single read makes the route ƒ (server render per view, cold-start eligible). The order number is non-sensitive display data already handled client-side.

**F7 — `src/app/icon.png` is 72 KB.**
Served as the favicon to every visitor and fetched by browsers eagerly. Typical optimized favicons are 3–15 KB.

**F8 — Full bilingual catalog serialized into every page's RSC payload.**
`ProductsProvider` receives complete `StoreProduct[]` (both locales' poetry/character/description + gallery arrays) in the locale layout (`layout.tsx:79,96`); verified present even in `checkout.html`. Client consumers (cart math, drawer, shop grid, checkout) need only `slug, name, price, salePrice, saleStartsAt/EndsAt, stock, image, audience`. Cost today ≈ 3-4 KB/page — a shape problem more than a byte problem, but it grows with every copy edit and any future product count.

**F9 — Aurora backdrop: 3 blurred (`blur(70px)`), `mix-blend-mode: screen` layers per section, animating indefinitely.**
`src/components/aurora.tsx` + `globals.css:176-195,312-335`. Transform-only animation with `will-change: transform` (compositor-friendly — good), and the global `prefers-reduced-motion` block (`globals.css:337-348`) halts it. The home page stacks 3 instances (hero + 2 subtle). On low-end mobile GPUs, large blurred blended layers are the most likely jank source in the design. Not a defect — a measurement target for the rebuild.

**F10 — Housekeeping: empty route directory `src/app/api/test-order/`** (no `route.ts`; produces no route in the build). Dead scaffolding from testing; confirmed obsolete by build output (no `/api/test-order` route emitted).

**F11 — Unthrottled write endpoints (cost/scalability, security-adjacent).**
`placeOrder` and `submitFeedback` server actions accept unauthenticated POSTs with no rate limiting; each performs Neon writes (and, later, Resend sends). This is primarily the security agent's territory — flagged here because the failure mode is infrastructure cost (DB write amplification, email quota) under abuse. Coordinate; do not implement independently.

## Requirements check (from role definition)

| Requirement | Status |
|---|---|
| Homepage: no DB query for static product info | **PASS** — SSG + `unstable_cache`, 0 runtime DB on cache hit |
| Cart works locally without DB requests | **PASS** — verified, zero network |
| Product browsing avoids unnecessary DB requests | **PASS** — DB-driven products fully cached behind tag; only checkout/admin read fresh (correctly) |
| Checkout makes only genuinely required requests | **PARTIAL** — 1 client request (correct); server-side has 1 redundant write (F3a) and 1 blocking external call (F3b) |

# Severity / Priority

| # | Finding | Severity | Effort | Expected result |
|---|---|---|---|---|
| F1 | Cross-script font preloading (460 KB/page) | **High** | Low | ~200-260 KB fewer render-blocking-priority bytes per first visit per locale |
| F2 | 3.7 MB hero video size + caching | **High** | Medium | ~2.2-2.7 MB less per home visit; immutable repeat visits |
| F3 | Checkout hot-path: seed write + awaited email | **Medium** | Low | 1 fewer DB round trip + email RTT removed from every order → est. 100-400 ms faster order confirmation |
| F4 | Unbounded admin queries, no indexes | **Medium** | Medium | Admin stays O(page) not O(table) as orders grow |
| F11 | Unthrottled write actions (cost) | **Medium** | — | Hand to security agent |
| F5 | 290 KB gz first-load JS | **Medium** (budget) | High | Enforce budget in rebuild; no quick win |
| F6 | Confirmation needlessly dynamic | **Low** | Low | 0 server renders per confirmation view |
| F7 | 72 KB favicon | **Low** | Trivial | ~60 KB less per new visitor |
| F8 | Full catalog in every RSC payload | **Low** | Low | Smaller, stable client payload shape |
| F9 | Aurora GPU cost | **Low** (measure) | — | Data before action |
| F10 | Empty `api/test-order` dir | **Low** | Trivial | Housekeeping |

# Recommendations

Each is scoped for the rebuild (Phase B+); none change business rules, pricing, security posture, or the four product names.

**R1 (F1).** In `src/app/[locale]/layout.tsx`, add `preload: false` to the `Amiri` and `IBM_Plex_Sans_Arabic` declarations (lines 29-39). Unicode-range in the generated `@font-face` already ensures browsers fetch them only when Arabic glyphs render, so Arabic pages still get them — just without preload priority. Optionally also drop `preload` on Playfair *italic* if metrics show it below the fold. Expected result: EN first visit loses ~200 KB of preloaded fonts (the two largest files are Arabic faces); AR pages keep working, with Arabic faces loading at normal priority. If AR-page FOUT is unacceptable, the finer alternative is a per-locale layout split that preloads only that locale's primary faces — bigger change, same byte win, defer to rebuild.

**R2 (F2).** Re-encode `public/hero-loop.mp4`: target ≤1.2 MB H.264 (or dual-source with AV1/WebM ~700 KB), 720p is sufficient for a 3:4 crop at 40vw desktop / 90vw mobile; strip audio track if present (it is muted). Serve it with an immutable cache strategy — either a content-hashed filename (`hero-loop.v2.mp4`) plus a `headers()` entry in `next.config.ts` setting `Cache-Control: public, max-age=31536000, immutable` for it, or import it as a static asset so it lands in `/_next/static`. Keep the existing idle-mount + still-first pattern in `hero-media.tsx` exactly as is — it is correct. Expected result: home page total transfer drops from ~4.7 MB to ~2 MB; repeat visits skip the video entirely.

**R3 (F3).**
(a) Remove `ensureSeeded()` from the read path (`src/lib/products.ts:104,158,228`). Replace with a module-level `let seeded = false` guard (seed once per lambda instance) or, better, move seeding to a one-time script/`drizzle-kit` step alongside `npx drizzle-kit push`. Expected result: one fewer Neon round trip on every checkout and every admin page view.
(b) In `checkout/actions.ts:107`, wrap the email in `after()` from `next/server` (documented for exactly this: work after the response flushes): `after(() => sendReceiptEmail(orderInput))`. Error handling inside `sendReceiptEmail` already guarantees order safety. Expected result: customer sees the confirmation one external-API RTT sooner; email still sends.

**R4 (F4).** Push admin filtering into SQL: `listOrders({ limit, status, from, to, q })` using Drizzle `where`/`limit`/`offset`; dashboard calls it with `limit: 5` plus a `COUNT(*)`-based stats query (or accepts approximate stats). Add to `src/lib/db/schema.ts`: index on `orders.createdAt` (desc) and on `orders.status`. Keep the JSON dev-store fallback filtering in JS (its data volume is trivial). Expected result: admin page transfer and query time stay flat as order history grows; no behavior change visible to the admin.

**R5 (F5) — performance budget for the rebuild** (enforce via `npm run build` + a CI size check):

| Metric | Budget |
|---|---|
| First-load JS (gzipped), any storefront route | ≤ 300 KB now; target ≤ 250 KB in rebuild |
| CSS (gzipped) | ≤ 25 KB |
| Fonts preloaded per page | ≤ 5 files / ≤ 250 KB |
| Largest single media asset | ≤ 1.5 MB (hero video), images ≤ 150 KB |
| Runtime DB round trips: storefront page view | 0 (cache hit) |
| Runtime DB round trips: checkout submit | ≤ 2 + 1 per line item |
| Server requests per cart interaction | 0 |
| LCP (mid-tier mobile, 4G) | ≤ 2.5 s · CLS ≤ 0.1 · INP ≤ 200 ms |

Concrete JS reductions to evaluate in the rebuild (in order): lazy-load `FeedbackWidget` (`next/dynamic`, it is below-the-fold chrome on every page); audit Motion usage for `LazyMotion`/`domAnimation` feature bundle; verify lucide-react tree-shaking (only 2-3 icons are used).

**R6 (F6).** In `confirmation/page.tsx`, stop awaiting `searchParams` server-side; read the order number inside the already-client `ConfirmationReveal` via `useSearchParams()` (wrapped in the existing Suspense-compatible tree). Expected result: `/[locale]/confirmation` becomes SSG — zero server renders and zero cold starts per confirmation view.

**R7 (F7).** Replace `src/app/icon.png` with a ≤10 KB export (48-64 px). One-line asset swap; ~60 KB saved per new visitor.

**R8 (F8).** In the rebuild, split `StoreProduct` into a server shape and a client `ClientProduct` (slug, name, price, salePrice, sale window, stock, image, audience) and pass only the latter to `ProductsProvider`. Pages that need copy (home, product) already render it server-side. Expected result: RSC payload per page shrinks and stops scaling with copy length; no behavior change.

**R9 (F9).** Before redesigning anything visual: profile the home page on a real mid-tier Android (Chrome DevTools performance trace, GPU track). If the aurora layers cause dropped frames, cheapest mitigations in order: reduce hero instances from 3 to 2 blobs, lower `blur(70px)` to ~50px, or pre-render the blur into the gradient itself (larger, softer gradient stops, no `filter`). Keep the brand look — this is tuning, not removal (rule 19).

**R10 (F10).** Delete the empty `src/app/api/test-order/` directory (confirmed: contains no files, emits no route). Coordinate with whichever agent owns route structure.

**R11 (F11).** Hand to the security agent: rate limiting for `placeOrder` and `submitFeedback` (e.g. per-IP token bucket in proxy or action-level). Performance stake: caps worst-case DB write and email spend.

# Risks

- **R1 (font preload):** Arabic pages will show a brief fallback-font flash for Arabic text on cold cache (fonts load at normal priority instead of preload). Mitigate by testing AR home on throttled 4G; if unacceptable, use the per-locale preload split instead. Do not remove the font-stack fallthrough itself — CLAUDE.md documents it as deliberate.
- **R2 (video):** Re-encoding trades visual fidelity for bytes; the marble still already covers the LCP so the risk is purely aesthetic — get sign-off on the re-encode before swapping. Renaming the file requires updating one string in `hero-media.tsx`.
- **R3a (seeding):** Moving seeding out of the read path means a fresh environment (new DB, wiped dev JSON) shows an empty catalog until seeded. The module-level once-per-instance guard avoids this entirely and is the safe first step; the script approach needs a documented setup step.
- **R3b (`after()`):** Email moves off the response path; if the platform kills the function early the email could be lost. Resend is not yet live (no `RESEND_API_KEY`), so this can be validated before launch; `after()` is the documented Next.js mechanism for exactly this pattern.
- **R4 (SQL filters):** Two code paths (SQL vs dev-JSON) must stay behaviorally identical — the existing `filterOrders` unit semantics become the spec. Archive logic (`isArchived`, `ARCHIVE_AFTER_DAYS`) involves date math that must move to SQL carefully.
- **R6 (confirmation):** `useSearchParams()` requires a Suspense boundary in Next 16; missing it fails the build (loud, not silent).
- **General:** All storefront caching depends on every product mutation calling `revalidateTag("products", "max")` — any new admin mutation added in the rebuild must keep doing so, or stale prices/stock will persist on SSG pages until the next unrelated invalidation. Never cache `getStoreProductsFresh()` in checkout — its freshness is a correctness requirement (server-side pricing/stock), not an optimization target.

# Verification / Testing

All verification below is code/build-level (live `*.vercel.app` is unreachable from this machine — per project notes, verify deploys with `vercel inspect <url> --wait`).

1. **Route staticness:** `npm run build` — confirm home/shop/product/checkout remain `●` (SSG); after R6, `/[locale]/confirmation` must flip from `ƒ` to `●`. Any storefront route flipping to `ƒ` is a regression gate.
2. **Font preloads:** after R1, `grep -c 'as="font"' .next/server/app/en.html` must drop from 9 to ≤5, and the two ~100 KB Arabic `.p.` files must no longer appear in `en.html`; confirm they still load on an AR page at runtime when Arabic text renders (browser devtools network filter on woff2, done on the user's machine).
3. **JS budget:** re-run the chunk sum used in this audit — extract `/_next/static/chunks/*.js` refs from a built page's HTML, `gzip -c | wc -c` each, sum; assert ≤ budget (script this into CI).
4. **Checkout round trips:** with `DATABASE_URL` unset (dev JSON fallback), instrument `db()`/`devRead` call counts in a dev run of `placeOrder`; after R3a expect exactly: 1 product read + N stock updates + 1 order insert. Confirm the receipt log line still appears (email path) after R3b.
5. **Tag invalidation:** dev-run: edit a price in `/admin/products/[slug]`, then load `/en` and `/en/shop` — new price must appear within one navigation (SWR allows one stale view). Place a dev order to stock ≤ threshold and confirm shop/product reflect it post-refresh.
6. **Cart offline check:** DevTools → Network → Offline on a loaded shop page: add/remove/qty/cart-drawer must work with zero failed requests (only checkout submit may fail).
7. **Admin scale test:** seed the dev JSON with ~2,000 fake orders; `/admin/orders` first-byte and HTML size must stay near-flat after R4 (SQL path needs an equivalent test against a branch database).
8. **Video:** after R2, confirm `hero-loop` still absent from initial HTML (`grep -c hero-loop .next/server/app/en.html` → 0), request fires only after idle, and the response carries `immutable` cache headers (checked via `vercel inspect`/user's browser, not local curl).
9. **Web Vitals in production:** enable Vercel Web Analytics / Speed Insights on the `lune-store` project to get field LCP/CLS/INP against the R5 budget — this is the only way to measure real traffic given local TLS constraints (requires user/team action; read results via the Vercel MCP `get_web_analytics`).
10. **Reduced motion:** with OS-level reduce-motion, verify aurora/starfield/Motion reveals settle instantly (the `globals.css:337` block plus `MotionConfig reducedMotion="user"` already cover this — regression-test it in the rebuild).

# Phase C — Review of Proposed Architecture

Review of `ARCHITECTURE_REPORT.md` "# Phase B — Consolidated Target Architecture" strictly from the performance / request-efficiency perspective. **Overall verdict: APPROVED WITH CONDITIONS.** Every High/Medium Phase A finding of this audit is addressed and mapped to a work package; the conditions below are gates and small corrections, not redesigns.

## Coverage of Phase A findings

| Phase A finding | Where resolved in Phase B | Status |
|---|---|---|
| F1 font preload split (High) | WP7 + `layout.tsx` note ("Arabic fonts preload:false or per-locale split") | Resolved |
| F2 hero video re-encode + immutable + reduced-motion (High) | WP7 (spec ≤1.2 MB; budget ceiling 1.5 MB — consistent) | Resolved |
| F3a seed-once | WP2 ("seed-once (script + per-instance memo)") | Resolved |
| F3b `after()` email | WP4 | Resolved |
| F3c per-item decrement loop | WP2 single-statement atomic decrement — **improves** on Phase A: N sequential UPDATEs collapse to 1 round trip | Resolved+ |
| F4 admin LIMIT/indexes | WP5 (indexes now) + Phase 4 (SQL filters at ~1k-order threshold) — matches my "fine today, index now" position | Resolved |
| F5 JS budget as CI gate | Adopted in §3 + WP11 perf-budget CI, "continuous from WP1" | Resolved, see condition C5 |
| F6 confirmation → SSG | WP4 / ruling T2 (client-side `useSearchParams`, regex validation, **no DB lookup ever**) — exactly my R6; T2's rejection of server-side existence checks is the right call, it would have re-dynamized the route | Resolved |
| F7 favicon | WP7 | Resolved |
| F8 ClientProduct slimming | WP6 (locale-resolved slim shape) | Resolved |
| F9 aurora GPU profiling | **Not present in Phase B** | Missing — see M1 |
| F10 empty `api/test-order/` dir | **Not present in Phase B** | Missing — see M2 |
| F11 unthrottled writes (cost) | WP3 (WAF + honeypot/min-time, no Redis — matches my "no new dependency" preference) | Resolved |

## Verdicts per work package (performance-relevant)

**WP1 (admin sessions) — APPROVED WITH CONDITIONS.** "Random server-tracked session token (revocable, expiring)" implies a session lookup on every admin request — a **new DB round trip per admin page view and per admin action** that does not exist today (the current check is a local hash compare, 0 round trips). Acceptable (admin-only, low traffic), on two conditions: (C1a) validation is one indexed primary-key lookup, optionally memoized per lambda instance for its TTL; (C1b) session validation must never enter any storefront path — the storefront's 0-runtime-DB invariant is a budget line.

**WP2 (checkout integrity) — APPROVED WITH CONDITIONS.** The single-statement decrement is a net performance win and deletes the compensation path. Condition (C2): the idempotency key must be enforced via the UNIQUE constraint itself — `INSERT … ON CONFLICT` / catch-unique-violation with the existing row returned — **not** a SELECT-then-INSERT pre-check, which would add a round trip to every order to optimize for the rare replay. With C2, the happy-path checkout becomes: 1 fresh product SELECT + 1 atomic decrement + 1 idempotent INSERT = **3 round trips regardless of item count**, beating the budget's "≤ 2 + 1 per item". Recommend tightening that budget line to "≤ 3 flat" once WP2 lands. The `expectedTotal` equality check is pure computation — zero added requests.

**WP3 (abuse protection) — APPROVED.** WAF rate-limit rules evaluate at the edge with negligible added latency and zero app code — no performance concern. Honeypot/min-submit-time are client-local. Blob **client** uploads add one small token-mint server-action call per upload but remove the full file body from the function path (double-transfer eliminated) and let the global body limit drop to 1 MB — net win; admin-only either way.

**WP4 (email & confirmation) — APPROVED.** `after()` + skip-when-absent + SSG confirmation is precisely Phase A R3b/R6. No new costs.

**WP5 (data model) — APPROVED WITH CONDITIONS.** Indexes and additive constraints are cheap. Conditions: (C3a) the T1 "drift-detection query as an admin stat" must not add a standing query to every dashboard view — compute it on the page it belongs to, or behind an explicit refresh; (C3b) when stats are relabeled (T8), resist adding separate `COUNT(*)` queries per stat card — one aggregate query for the dashboard.

**WP6 (`use cache` migration + ClientProduct) — APPROVED WITH CONDITIONS.** ClientProduct slimming: approved as specced. The `use cache`/`cacheTag` migration is **the single riskiest performance change in the plan**: per the bundled Next 16 docs, `use cache` sits under Cache Components (`cacheComponents: true`), which changes the rendering/prerender model for the entire app, not just the migrated function — route staticness can silently shift. Conditions: (C4a) gate the migration on a before/after `npm run build` route-table assertion (home/shop/product/checkout stay fully prerendered; runtime DB on cache hit stays 0) — this assertion must be live in WP11 CI *before* WP6 starts; "continuous from WP1" permits this but does not guarantee it, so make it an explicit WP6 precondition; (C4b) pair the directive with an explicit `cacheLife` profile and verify `revalidateTag("products", "max")` semantics end-to-end (admin edit → storefront SWR) on a preview deploy; (C4c) `getStoreProductsFresh` stays uncached — already frozen in §2, reaffirmed here as a correctness line no perf work may touch.

**WP7 (assets & delivery) — APPROVED**, with one ordering note (O1 below). Contents match Phase A R1/R2/R7 exactly, plus the reduced-motion gate QA/RESP asked for — which also *saves* 3.7 MB for reduced-motion users, a performance feature in its own right.

**WP8/WP9 (tokens, a11y/RTL) — APPROVED.** No request-efficiency impact; the alias layer is CSS-only and the live region/skip link are free.

**WP10 (conversion rebuild) — APPROVED WITH CONDITIONS.** New content adds real bytes: "chapters w/ image+price" puts ~4 product images on the home page, and trust strip/WhatsApp/policy content lengthens several routes. Conditions: (C6a) chapter images are below-the-fold → default lazy loading, correct `sizes`, no `priority` — the marble hero must remain the sole LCP candidate; (C6b) every WP10 screen ships under the WP11 budget gates, so conversion content can never regress LCP unnoticed; (C6c) `?audience=` shop deep links must not make `/shop` dynamic — filter client-side from the already-embedded catalog (the current `ShopGrid` mechanism already does this; keep it, reading the param via `useSearchParams` in the client component only).

**WP11 (verification net) — APPROVED WITH CONDITIONS.** My build-output assertions (route staticness, font-preload count, chunk budget) and Web Analytics enablement are all carried. Condition (C5): the §3 budget as transcribed is a **truncated** copy of Phase A R5 — it drops the CSS line (≤ 25 KB gz), the per-image cap (≤ 150 KB), CLS ≤ 0.1 and INP ≤ 200 ms, and the "0 server requests per cart interaction" line. Restore the full table as the CI gate; the omitted lines are exactly the ones WP8 (CSS/token layer) and WP10 (content images) could silently violate.

## New costs introduced by the proposal — assessment

| New mechanism | Cost | Verdict |
|---|---|---|
| WAF rate-limit rules | Edge-evaluated, ~0 added latency | Accept |
| Idempotency key | 0 extra round trips **if** C2 (unique-violation path) is followed; +1 SELECT per order if not | Accept with C2 |
| Order-number collision retry | Extra round trips only on actual collision (rare by design) | Accept |
| Server-tracked admin sessions | +1 DB round trip per admin request | Accept with C1 (admin-only, indexed, never storefront) |
| Blob client uploads | +1 token-mint action per upload; −1 full file transit through the function | Net win |
| Storage-event cart sync | Zero network (browser-local event) | Accept |
| `cacheComponents` flip (implied by WP6) | Potential app-wide rendering-model change | The one real risk — gated by C4 |
| Home chapter images / trust content (WP10) | +~4 optimized image requests, below fold | Accept with C6 |
| CHECK constraints, `cancelled_at`, indexes | Negligible runtime; indexes speed reads | Accept |
| Honeypot / min-submit-time fields | Client-local, zero requests | Accept |

Nothing in the proposal violates the storefront invariants: SSG everywhere, 0 runtime DB on cache hit, cart fully local, checkout as a single client request. The T2 and T5 rulings both explicitly chose the statically-cacheable option over alternatives that would have added per-request work — correct calls from this seat.

## Ordering — one recommendation, no objection

**O1:** WP7 is scheduled P1 behind WP5/WP6, but it has zero dependencies on them (font preload flags, a video file, a favicon, a client-side storage listener — no schema, no cache API, no session work) and contains the two highest user-visible wins in this audit (F1: ~200–260 KB per page; F2: ~2.5 MB per home visit). Recommend running WP7 in parallel with WP2–WP4 or immediately after; there is no technical reason for it to wait. Not an objection — the P0 ordering (integrity/security first) is otherwise right, and WP11-from-WP1 is exactly where the budget gate needs to sit, with C4a making the route-staticness assertion a hard precondition for WP6 specifically.

## Missing items

**M1 (Low):** Phase A F9 — aurora GPU profiling on a mid-tier Android before/during the WP8/WP10 visual rebuild — appears nowhere in Phase B. Fold into WP11 (a one-time runtime profile alongside Web Analytics enablement) so the rebuild's heaviest visual element gets a measurement, not a guess.

**M2 (Trivial):** Phase A F10 — deleting the empty `src/app/api/test-order/` directory — is unassigned. Fold into WP6 cleanup.

## Summary of conditions

C1 admin-session lookup: single indexed query, admin paths only · C2 idempotency via unique-violation, no pre-SELECT (then tighten the checkout budget line to ≤ 3 flat round trips) · C3 no standing drift/COUNT queries on the dashboard · C4 `use cache` migration gated on a route-table CI assertion live before WP6 starts, explicit `cacheLife`, tag invalidation verified on a preview deploy, fresh path untouched · C5 restore the full Phase A budget table (CSS, per-image cap, CLS/INP, cart-zero-requests) as the WP11 CI gate · C6 WP10 images lazy/sized/non-priority, screens ship under budget gates, `?audience=` stays client-side · O1 pull WP7 forward · M1 aurora profiling into WP11 · M2 dead-dir cleanup into WP6.
