# LUNE — Cloudflare Architecture & Deployment Preparation Report

Date: 2026-08-28 · Phase: architecture / compatibility / deployment preparation only. **Nothing was deployed, no DNS changed, no Cloudflare resources created, no packages installed, no production data touched.** Facts verified against the repository at commit `18c4c20` + WP0 addendum working tree, against read-only production introspection (2026-08-28, WP0 report), and against current (August 2026) Cloudflare/OpenNext/vinext documentation and issue trackers. Audit sources: `MASTER_AUDIT.md` (consolidating ARCH/SEC/PERF/SCALE/QA/RESP/UX/DESIGN/DATA/RT), `docs/DATABASE_MIGRATIONS.md`, `WP0_REPORT.md`. (`DATABASE_AUDIT.md` and `RED_TEAM_AUDIT.md` do not exist under those names; their content is `DATA_MODEL_REPORT.md` and `RED_TEAM_REPORT.md`, consolidated in the master audit. No `CLOUDFLARE_DEPLOYMENT_AUDIT.md` existed before this report.)

---

# 1. Current Architecture

Verified from the repository, not assumed:

| Layer | Actual state (verified) |
|---|---|
| Framework | Next.js **16.3.0** App Router, Turbopack build; React **19.2.8**; TypeScript 5 |
| Rendering | Storefront fully **SSG** (19 static pages: `/en`, `/ar`, shop, 4×2 product pages, checkout, 404s); dynamic routes: `/[locale]/confirmation` (reads `searchParams` server-side), all `/admin/*`, `/[locale]/[...rest]` |
| Mutations | **Server actions only — zero route handlers** (`Glob src/app/**/route.ts` → none). Checkout, feedback, admin auth/orders/products |
| Middleware | `src/proxy.ts` (Next 16 proxy convention) — thin wrapper around `next-intl/middleware`; matcher excludes `api\|admin\|_next\|_vercel\|files with .` |
| i18n | next-intl **4.13.6** via `createNextIntlPlugin("./src/i18n/request.ts")` in `next.config.ts` |
| Data | Drizzle ORM **0.45.2** + `@neondatabase/serverless` **1.1.0** over **neon-http** (stateless fetch per query, no TCP, no pool). Neon Postgres in **aws us-east-1**, provisioned **via the Vercel Marketplace integration** (billing/ownership flows through Vercel — see §19 R1) |
| Migrations | WP0 system: versioned `drizzle/` history, `scripts/migrate-deploy.mjs` runs before `next build` at deploy time; journal `drizzle.__drizzle_migrations` live on prod; deployed-env guards already recognize `VERCEL \|\| CF_PAGES \|\| WORKERS_CI` |
| Auth | `/admin` cookie gate — `sha256("lune:" + ADMIN_PASSWORD)` static token via `import { createHash } from "crypto"` (`src/lib/admin-auth.ts`) — the app's only Node-API import besides the dev fallback |
| Dev fallback | `fs/promises` **dynamic imports only** in `orders/products/feedback.ts`; `hasDatabase()` throws in any deployed env without `DATABASE_URL` (WP0 fix) |
| Email | Resend SDK 6.19 (pure HTTPS API) — `RESEND_API_KEY` unset, log-only today; never-throws invariant |
| Images | `next/image` in 6 components; static JPGs in `public/` (33–73 KB each); admin-uploaded product images in **Vercel Blob** (`@vercel/blob` `put()` in `admin/products/actions.ts:180`, `remotePatterns` allows `*.public.blob.vercel-storage.com`) |
| Fonts | `next/font/google` × 4 families (Playfair, Jost, Amiri, IBM Plex Sans Arabic), all in the one `[locale]` layout → 9 self-hosted files ≈ 460 KB preloaded on every page in both scripts (PERF F1; WP7 fixes) |
| Video | `public/hero-loop.mp4` = **3,875,284 bytes**; already **non-critical by design**: `hero-media.tsx` paints a priority poster JPG, mounts the `<video>` only via `requestIdleCallback` (2.5 s timeout), crossfades in on `playing`, back to the still on `ended` |
| Caching | `unstable_cache` tagged `"products"` (`src/lib/products.ts:145`), invalidated by `revalidateTag("products", "max")` (Next 16 two-arg form) from checkout + every admin product mutation; money paths always read uncached `getStoreProductsFresh()` |
| Client JS | ~290 KB gz first load (PERF F5); cart = React context + localStorage, **zero network requests** |
| Config flags | `experimental.globalNotFound: true`; `serverActions.bodySizeLimit: "5mb"` |

Node-API surface relevant to Workers: `crypto.createHash` (supported under `nodejs_compat`), `fs/promises` (dev-only, guarded), nothing else — no `net`, no `child_process`, no `sharp`, no long-lived sockets.

# 2. Cloudflare Compatibility

Feature-by-feature verdict for **this** app on Workers:

| Feature (actual usage) | Workers compatibility |
|---|---|
| App Router, RSC, streaming SSR, SSG | ✅ Supported by both adapter options |
| Server actions (the app's only mutation path) | ✅ Supported (POST to page URLs; survives unchanged) |
| `proxy.ts` (next-intl) | ⚠️ **The single open compatibility gate.** Next 16 renamed middleware→proxy and runs it on the Node runtime; OpenNext lists "Node middleware not yet supported" and issue [#962](https://github.com/opennextjs/opennextjs-cloudflare/issues/962) / wrangler [#13937](https://github.com/cloudflare/workers-sdk/issues/13937) track Next 16 `proxy.ts` recognition. Mitigation is trivial and app-local: `src/proxy.ts` is 13 lines wrapping `next-intl/middleware`; it can be renamed back to the still-supported (deprecated) `middleware.ts` edge-middleware convention if the adapter still requires it at migration time. **Gate CF-G1: prove locale routing works in the CF-0 build test before anything else.** |
| `unstable_cache` + `revalidateTag("products","max")` | ⚠️ Works via OpenNext's incremental cache + tag cache components (R2/KV + D1/DO) — must be **explicitly provisioned**; the two-arg `"max"` profile form is new in Next 16 and its adapter parity is **Gate CF-G2** in the build test. Without the components, SSR works but tag revalidation does not. |
| `experimental.globalNotFound` | ⚠️ Build-time feature, expected to pass through; **verify in CF-0** (Gate CF-G3). |
| `after()` (planned WP4) | ✅ OpenNext supports `after()`; Workers `waitUntil` semantics fit exactly (receipt email off the response path). |
| `crypto.createHash` | ✅ `nodejs_compat` covers `node:crypto`. |
| `fs/promises` dev fallback | ✅ Never executes deployed (WP0 guard throws); dynamic import means it isn't even loaded on the request path. |
| neon-http Drizzle driver | ✅ Pure `fetch` — works on Workers unchanged, zero config. |
| Resend | ✅ Pure HTTPS API. |
| `@vercel/blob` uploads | ✅ HTTP API — works from Workers with the token; but it is a Vercel service dependency to retire (§10). |
| `next/image` optimization | ⚠️ Vercel's optimizer disappears; replace with Cloudflare image transformations binding via the adapter (§10). |
| `next/font` self-hosted files | ✅ Emitted as static assets, served free (§12). |
| 5 MB server-action body (admin uploads) | ✅ Within Workers request-body limits on all plans. |
| Windows dev machine | ⚠️ OpenNext documents Windows local builds as "not guaranteed" — run adapter builds in WSL or CI (Gate CF-G4). |
| Worker bundle size | ⚠️ 3 MiB compressed (free) / 10 MiB (paid). This app's server bundle (drizzle-orm, next-intl, resend, react-dom/server) very likely exceeds 3 MiB and comfortably fits 10 MiB → **paid plan is effectively required** (also for CPU headroom). Measured in CF-0. |

**Why Cloudflare Workers (acceptance Q1):** the storefront is already ~fully static — Workers Static Assets serves it **free with zero Worker executions and zero egress charges**, from PoPs near Jordan; the Worker runs only for checkout submits, admin, and (until WP4) the confirmation page. That is the cheapest possible shape for "low cost at low traffic, absorbs Instagram spikes" — and the same zone gives WAF/rate-limiting/bot/DDoS for the WP3 abuse problem (SEC F-1) without new vendors.

# 3. Vinext vs OpenNext

Both evaluated against the **actual** project (next-intl 4, Next 16.3, self-hosted next/font, `unstable_cache`, server actions, no route handlers):

| | **Vinext** (`cloudflare/vinext`) | **OpenNext** (`@opennextjs/cloudflare`) |
|---|---|---|
| What it is | Vite plugin **reimplementing** the Next.js API surface (~94% of Next 16); Cloudflare's recommended default for new/migrated apps; **beta** | Adapter that runs the real `next build` output on Workers; partner in Next 16.2's stable Adapter API; OpenNext members sit in the Next.js Ecosystem WG |
| Compatibility (this app) | ❌ **`createNextIntlPlugin` fails today** ([vinext#202](https://github.com/cloudflare/vinext/issues/202) — next-intl's Next-version probe throws when `next` isn't a real dependency). i18n is the heart of this app. Also: fonts switch to **Google-CDN loading** (breaks self-hosted next/font strategy and WP7's preload-split plan), images move to a different pipeline (@unpic), `next dev` replaced by Vite toolchain | ✅ App Router, RSC, server actions, SSG/ISR, `after()`, `use cache`, PPR, Turbopack, Next 16 minors supported; next-intl works as on Vercel; one open gate: `proxy.ts` (§2, trivial mitigation) |
| Risk | **High for a money-handling store**: repo warns "experimental software with known bugs", "hasn't been battle-tested with real production traffic", AI-driven development with "minimal human code review" | Moderate-low: years of production use across the OpenNext ecosystem; the risks are enumerable gates (G1–G4), each testable locally |
| Complexity | New toolchain (Vite) + new font/image pipelines + workarounds for next-intl | Keeps `next build`; adds one build transform + wrangler config + caching bindings (R2/D1/DO) |
| Performance | Claims better edge TTFB / smaller bundles (unverifiable for this app until next-intl works) | `next build` output as-is; static storefront is CDN-served either way, so the delta on real traffic is small for LUNE |
| Cloudflare support | First-party Cloudflare project, recommended default, beta | Cloudflare co-maintains the adapter and documents it as the path for apps with vinext compatibility gaps — exactly LUNE's situation |
| Migration effort | Blocked at step 1 today (i18n plugin); plus font/image strategy rewrites | Small: build script + wrangler.jsonc + caching bindings + proxy-gate resolution |
| Maintenance | Fast-moving beta; API surface may shift | Stable release cadence; Next 14 support sunset announced properly (Q1 2026) — predictable lifecycle |
| Known limitations | No webpack/turbopack config, CDN-only Google Fonts, runtime-only image optimization, Node-native module restrictions | Node middleware unsupported (proxy gate), Windows builds shaky, caching stack must be provisioned explicitly, 10 MiB bundle cap |

# 4. Final Recommendation

**OpenNext (`@opennextjs/cloudflare`) on Cloudflare Workers** (acceptance Q2/Q3/Q4).

Not because of popularity — because of three project-specific facts:

1. **next-intl is load-bearing and currently broken on vinext** (issue #202). Every storefront string, route, and the proxy flow through it.
2. **Checkout handles money.** vinext's own README disqualifies it for that today ("experimental… known bugs… not battle-tested"). The audit's frozen invariants (server re-pricing, conditional decrement, tag invalidation) deserve a runtime that executes the real `next build` output.
3. **The audit roadmap assumes the Next toolchain.** WP7 (font preload split via `next/font` options), WP6 (`use cache` migration gated on route-staticness CI), and the WP2 pipeline all map 1:1 onto OpenNext; vinext would fork the font and image strategies mid-rebuild.

**Re-evaluate vinext** at a natural boundary (e.g., after the visual rebuild, or when it leaves beta AND vinext#202 is fixed) — Cloudflare's direction of travel is clear, and the report's architecture (static-first, Workers for writes, zone security) is adapter-agnostic, so a later swap changes build tooling, not architecture.

**How Next.js runs on Workers:** `next build` (Turbopack, unchanged) → `opennextjs-cloudflare build` transforms output → one Worker (server code: RSC rendering, server actions, ISR) + **Workers Static Assets** (all prerendered HTML, `/_next/static`, `public/`) + bindings: R2 (incremental cache), D1 (tag cache), Durable Object (revalidation queue) → `wrangler deploy` (atomic version swap). Static asset requests never invoke the Worker and are free.

# 5. PostgreSQL Strategy

**Keep Neon Postgres, keep the neon-http Drizzle driver, change nothing in the data layer for the move** (acceptance Q5).

Options analyzed:

1. **Direct TCP Postgres (node-postgres/postgres.js):** possible on Workers (TCP sockets + `nodejs_compat`) but per-request connection setup (TCP + TLS + Postgres auth ≈ several round trips) from ephemeral isolates is exactly the pathology Hyperdrive exists to fix. Strictly worse than options 2/3 alone. Rejected as a standalone approach.
2. **Hyperdrive (+ node-postgres):** see §6 — right answer *later*, wrong answer *now*.
3. **Current provider's serverless driver (`@neondatabase/serverless`, neon-http):** stateless HTTPS fetch per query — no connection to establish, no pool to exhaust, works identically on Vercel and Workers, zero migration risk, already what the code does. Neon's own pooler (`-pooler` endpoints, PgBouncer) covers connection multiplexing on the database side.

The WP0 migration system is **unchanged**: migrations run via `scripts/migrate-deploy.mjs` in CI before deploy (plain Node + `DATABASE_URL`; the deployed-env guards already recognize `CF_PAGES`/`WORKERS_CI`). **No migration ever runs during a user request** — same guarantee, same mechanism (§17).

**Latency reality (identified bottleneck, not theoretical):** Neon is in **aws us-east-1**; customers are in Jordan. A Jordan-PoP Worker doing checkout's ~5 sequential DB round trips (audit PERF F3) would pay ~5 × 150–200 ms transatlantic. Two mitigations, both cheap:
- **Enable Smart Placement** on the Worker (free config flag): Cloudflare runs DB-heavy invocations near us-east-1 instead of near the user — one long hop instead of five. Browsing is unaffected (static, still edge-served).
- **WP2's ≤4-round-trip budget** (already ruled) shrinks the multiplier.
- Longer-term option (owner decision, NOT this phase): move the Neon project to a European region (~60–80 ms from Jordan) during a low-traffic window; requires a data migration, so it belongs with a deliberate maintenance plan or the gateway milestone.

# 6. Hyperdrive Evaluation

**Not now — adopt at the payment-gateway/transaction milestone** (acceptance Q6).

| Consideration | Finding for THIS app |
|---|---|
| What Hyperdrive accelerates | TCP driver connection setup (pooling + placement + optional query caching). It requires a TCP driver (node-postgres/postgres.js) — Neon's own docs say don't pair it with the serverless driver |
| Current driver | neon-http has **no connection setup to amortize** — each query is one HTTPS request. Hyperdrive's headline gains don't apply |
| Current traffic | ~1,500 Instagram followers, checkout is the only hot write path; Neon's pooler is nowhere near stressed |
| Transactions | neon-http **cannot do interactive transactions** — but WP2 was explicitly designed for that constraint (single-statement atomic decrement, T1 staged-atomicity ruling). The audit already schedules a **driver swap at the gateway milestone** for real transactions |
| The right moment | That gateway-milestone driver swap on Workers should be **node-postgres through Hyperdrive** (Hyperdrive is included in the $5 Workers Paid plan): connection pooling for ephemeral isolates + transaction support + placement — one change, at the already-planned boundary |
| Operational complexity now | A new binding, a new failure mode, config in two places — for zero measurable benefit at current scale |

**When it becomes valuable:** (a) the gateway milestone's transaction requirement (primary trigger), or (b) sustained checkout concurrency where per-query HTTPS latency to us-east-1 measurably hurts even after Smart Placement — measure first, then enable.

# 7. Request Map

Principle: **no request without a purpose.** Map of every request per page as the app stands (Cloudflare-target; "static asset" = served from Workers Static Assets/CDN, zero Worker execution, zero DB). Answers acceptance Q7–Q11.

**Homepage `/en` or `/ar`** — 0 Worker executions, 0 DB on the browse path:
| Request | Purpose | Source | Cacheable | DB | Removable? |
|---|---|---|---|---|---|
| HTML document | prerendered page | static asset | ✅ CDN, tag-invalidated | ❌ | No |
| CSS (1 file ~top) | styles | static asset, immutable | ✅ | ❌ | No |
| JS chunks (~290 KB gz total) | hydration, cart, motion | static assets, immutable | ✅ | ❌ | Shrink (WP6 payload slimming; budget ≤300 KB) |
| 9 font files ≈ 460 KB | typography both scripts | static assets, immutable | ✅ | ❌ | **~half per locale removable — WP7 preload split** (PERF F1) |
| `hero-marble.jpg` 73 KB (priority) | LCP poster | static asset / image transform | ✅ | ❌ | No — it is the LCP |
| `hero-loop.mp4` 3.9 MB (idle-deferred) | ambience | static asset | ✅ immutable | ❌ | **Shrink to ≤1.2–1.5 MB + reduced-motion/save-data gate (WP7)**; never critical (§11) |
| `icon.png` 71 KB | favicon | static asset | ✅ | ❌ | Shrink ≤10 KB (WP7) |

**Shop `/[locale]/shop`** — identical shape: static HTML + shared chunks + product card images (33–45 KB each, lazy). Filter (All/Him/Her) is pure client state — 0 requests. 0 DB.

**Product `/[locale]/product/[slug]`** — static HTML (all 8 prerendered) + gallery images (lazy, thumbnails). Add to Cart = context/localStorage write — **0 network requests**. 0 DB.

**Cart (drawer, any page)** — open/edit/qty/remove: **0 requests of any kind** (localStorage + context). Stock clamp uses product data already in the RSC payload. 0 DB. This is frozen behavior (audit §12).

**Checkout `/[locale]/checkout`** — page load: static HTML + shared assets, 0 DB. Submit: **1 POST** (server action) → 1 Worker execution → today ~5 sequential Neon round trips (seed ×2 + fresh read + decrement + insert; WP2 contracts this to **≤4 flat** and removes the seed writes) → (future, WP4) receipt email via `after()` off the response path → `revalidateTag` → D1 tag-cache write + cache purge. Not cacheable, not removable — this is the money path.

**Confirmation `/[locale]/confirmation?order=…`** — currently **dynamic**: 1 Worker execution per view (renders `searchParams`; **0 DB** — no order lookup by frozen ruling T2/SEC F-6). WP4 makes it SSG + client `useSearchParams` → drops to a static asset. Until then it is the only per-visitor storefront Worker execution.

**Admin login `/admin`** — 1 Worker execution (dynamic, `noindex`); submit = 1 POST action, env-var compare, 0 DB. Never cacheable.

**Admin dashboard `/admin`** (authed) — 1 Worker execution + DB: today a **full `orders` table read** to render 5 rows + stats (audit PERF F4/SCALE F5; WP5 bounds it with `LIMIT 5` + one aggregate query + indexes) plus fresh products read. Never cacheable (cookie-gated, `private`).

**Cross-cutting removable requests** (all already in the audit roadmap): seed-on-read `INSERT` ×2 per checkout (WP6 §here-documented; largest pointless DB write), awaited email in the response (WP4 `after()`), wrong-script font preloads (WP7), full-catalog RSC payload duplication (WP6).

# 8. Caching Strategy

(Acceptance Q12/Q13.)

**PUBLIC / CACHEABLE** — storefront HTML (home, shop, product, checkout shell, 404s; later confirmation), `/_next/static/*` (content-hashed → `immutable`), fonts, images, video, icons, `messages`-derived static content. Served from Static Assets/CDN; product-dependent pages carry the `products` tag.

**PRIVATE / NEVER CACHE** — anything under `/admin` (cookie-gated, `Cache-Control: private, no-store`), all server-action POSTs (never cached by design), the admin session cookie, checkout responses, customer/order data, the receipt email content, the confirmation page while it renders `searchParams` server-side.

**Correctness invariants (the price/inventory/order-state rule):**
- Money paths **never** read cached data: checkout re-prices from uncached `getStoreProductsFresh()` — frozen audit invariant, unchanged on Cloudflare.
- Cached storefront product data (price/sale/stock badges) is **display-only**; a stale sale badge can never produce a wrong charge because the server recomputes everything. Staleness window = time between mutation and tag purge (seconds).
- Order state is never cached anywhere (admin dynamic, confirmation does no lookup).

**Invalidation requirements (documented for implementation):**
- `revalidateTag("products", "max")` fires on: every admin product mutation (price/sale/stock/images/copy) and every successful checkout (stock change). This must keep working identically → requires OpenNext **tag cache (D1)** + **incremental cache (R2)** + **revalidation queue (DO)** + the **automatic cache-purge** component so the CDN copy dies when the tag does.
- Deploy = new asset manifest → static HTML refreshes atomically with the Worker version; no manual purge step.
- Gate CF-G2 (build test): prove admin price edit → storefront reflects it within seconds on the Workers build, and that the two-arg `"max"` profile behaves; fallback is the one-arg call if adapter parity lags (same semantics for this app's single tag).

**Config note:** KV is documented by OpenNext as eventually-consistent and less suited to production incremental cache; **R2 (incremental) + D1 (tag) + DO (queue)** is the chosen stack — all have free tiers far above LUNE's volume (4 products, tag invalidations = admin edits + orders/day).

# 9. Static Asset Strategy

Already near-optimal for Workers: everything in `public/` + build output becomes **Workers Static Assets — free, no egress charges, no Worker invocation on hit**, served from Cloudflare's edge (PoPs near Jordan).

- **CSS/JS**: content-hashed under `/_next/static` → `public, max-age=31536000, immutable` (adapter default; verify in CF-0).
- **Fonts**: §12. **Images**: §10. **Video**: §11.
- **`public/` media** (`hero-marble.jpg`, product JPGs, `hero-loop.mp4`): filenames are **not** content-hashed and are admin-independent; give them long-but-not-immutable cache (`max-age=86400, stale-while-revalidate`) via the assets `_headers` mechanism unless renamed to hashed names during the rebuild. The 3.9 MB video specifically must never be re-downloaded per visit — today it has no explicit immutable header on Vercel either (PERF F2); fix lands with WP7 regardless of host.
- **No new storage provider for static assets**: R2 is **not** needed for the current asset set (largest file 3.9 MB, total `public/` < 5 MB). R2 enters only as (a) the OpenNext incremental cache and (b) the WP3-era home for admin-uploaded product images (§10). Do not move `public/` media to R2 just because it exists.
- 71 KB `src/app/icon.png` → ≤10 KB (WP7, unchanged priority).

# 10. Image Strategy

Two image populations with different answers:

1. **Static `public/` JPGs** (hero poster, current product/gallery shots): served as static assets. `next/image` keeps working via **Cloudflare image transformations** configured through the adapter's image loader — format negotiation (WebP/AVIF), responsive `sizes` (already used correctly in code, e.g. `hero-media.tsx` `sizes="(max-width: 1024px) 90vw, 40vw"`), lazy loading everywhere except the priority hero. Volume math: ~10 originals × a handful of width/format variants ≪ **5,000 free unique transformations/month** — effectively $0. Escape hatch if transformations misbehave in CF-0: `images.unoptimized` + hand-sized variants is acceptable at 33–73 KB per source file, decided at the gate, not now.
2. **Admin-uploaded product images** (currently Vercel Blob): `@vercel/blob` keeps working from Workers (HTTPS API + token), and existing `*.public.blob.vercel-storage.com` URLs stored in the DB keep serving — so the cutover has **no image-migration prerequisite**. The **retirement plan** is WP3, which already redesigns uploads (client uploads behind an admin-gated token endpoint): implement that design against **R2 + a custom domain** instead of Blob, add the R2 host to `remotePatterns`, and lazily re-upload the ~8 existing images via the admin UI. Until WP3, Blob remains a tolerated Vercel dependency — but it must survive Vercel-project deletion (§19 R1 — verify Blob store ownership before decommissioning, or simply complete WP3 first).
3. **Future real photography** (owner-supplied, per audit): drops into the same pipeline — upload via admin → R2 → transformations serve AVIF/WebP at responsive sizes with CDN caching. No architecture change needed. Nothing generated or replaced now.

# 11. Video Strategy

Analyzed (`hero-media.tsx` + measured file):

| Aspect | Current state | Verdict / plan |
|---|---|---|
| File | `hero-loop.mp4`, **3.88 MB**, H.264 | WP7: re-encode ≤1.2–1.5 MB (audit budget), same slot |
| Criticality | **Already non-critical — keep this design.** Priority poster JPG paints first; video mounts only on `requestIdleCallback` (2.5 s timeout), fades in only `onPlaying`, falls back to the still `onEnded` or if it never plays | Site is fully functional with the video absent/failed/blocked — requirement met today; preserve through the rebuild |
| Mobile / slow connections | Idle-deferred but **still downloads 3.9 MB on 3G and for reduced-motion users** (QA-12/RESP M-1) | WP7: gate mount on `prefers-reduced-motion` and `navigator.connection.saveData`; consider `<source>` with a smaller mobile rendition |
| Poster | 73 KB JPG, `priority`, correct `sizes` | Keep; it is the LCP — never let the video into the LCP race |
| Caching | No immutable header today | Long-cache via static-assets headers (§9); rename with a content hash on re-encode |
| Format | Single MP4 | Optional AV1/HEVC secondary source at re-encode time — quality-per-byte win, not required |
| Delivery | Static asset (free egress on Workers) | **No** Cloudflare Stream / R2 needed at this size — zero-cost as-is |

# 12. Font Strategy

Current: 4 `next/font/google` families in the single `[locale]` layout → 9 woff2 files ≈ 460 KB **all preloaded on every page in both scripts** (PERF F1 — Arabic faces force-downloaded on `/en` and vice versa). `next/font` self-hosts at build time → on Workers these are immutable static assets (free, edge-cached) — the mechanism survives the migration unchanged. (Under vinext it would not — fonts move to Google-CDN loading; another reason for §4's choice.)

Target (WP7, unchanged by Cloudflare, works identically there): keep all 4 families registered (the CSS font stack must fall through for mixed-script content — e.g. Arabic product copy containing Latin names), but stop **preloading** wrong-script faces: `preload: false` on Amiri + Plex Arabic in the EN-dominant path and on Playfair-italic/Jost extras for AR, or a per-locale font module split. Budget: ≤5 files / ≤250 KB preloaded per page. Typography quality is untouched — same families, same fallback stacks, same `[dir="rtl"]` compensations; only transport priority changes.

# 13. Security / WAF Strategy

Cloudflare **supplements** the app's controls; application-level authorization stays mandatory and unchanged (per-action admin checks, zod validation, `z.literal("cod")`, server re-pricing — audit frozen list). This section maps the audit's WP3 plan (Vercel-WAF-first, ruling T3) onto the Cloudflare zone — a *better* fit, since WAF/rate-limiting/bot tooling is native here (acceptance Q15).

- **Scope note:** zone-level WAF applies once the domain's DNS is on Cloudflare (cutover phase). The workers.dev preview gets only basic protections — acceptable for a preview behind no marketing.
- **DDoS**: unmetered L3/4/7, on by default. **Bot Fight Mode**: on (free), verify it doesn't challenge the Instagram in-app browser (Jordanian carrier IPs + webviews are the traffic).
- **Rate limiting / WAF rules** (targets, since server actions POST to page URLs — identified by path + `Next-Action` header per SEC C-3.2):
  1. `POST /en/checkout`, `/ar/checkout` — generous hourly caps per IP (carrier-NAT-aware: thresholds in tens/hour, not units/minute — SCALE R1).
  2. `POST` feedback paths (widget action) — similar.
  3. `/admin` + `POST /admin` — tighter caps (login throttling also lands app-side in WP1, durable — don't rely on the zone alone).
  4. Optional hardening: challenge non-browser UAs on checkout POST; **Cloudflare Access (Zero Trust, free ≤50 users) in front of `/admin`** is a cheap defense-in-depth option the owner can adopt later without code changes.
- **LOG → TUNE → ENFORCE**: adopted as required. Honest plan-limit note: the free plan allows only a small number of rate-limiting/WAF custom rules and free rate-limiting is enforce-only (block); staged log-first rollout of *rate limits* needs Pro (~$25/mo) or can be approximated free by launching WAF custom rules in **Log/Managed-Challenge** action first, tuning thresholds, then switching to Block. Decision point at cutover; the audit's dry-run-during-first-campaign requirement (SCALE T3) stands either way. Exact rule counts per plan are a **verify-at-setup** item, not hardcoded here.
- **App-level items that Cloudflare does NOT replace** (unchanged WP roadmap): WP1 sessions (random revocable tokens, timing-safe compares), WP3 honeypot + min-submit-time, WP4 email escaping **before `RESEND_API_KEY` exists**, WP2 idempotency. The Postgres-counter rate-limit fallback (SEC C-3.1) remains the committed contingency if zone rules prove insufficient.

# 14. Secrets Strategy

Classification of every environment variable in use (verified by full-repo grep; **no values printed anywhere in this phase**), and how each moves to Workers (acceptance Q14):

| Variable | Class | Read at | Cloudflare handling |
|---|---|---|---|
| `DATABASE_URL` | **SERVER SECRET** | `src/lib/db/index.ts`, migrate script (CI) | Worker **secret** (`wrangler secret put` / dashboard, encrypted at rest, never in `wrangler.jsonc`); *also* a CI secret (GitHub Actions encrypted secret) for the migration step |
| `ADMIN_PASSWORD` | **SERVER SECRET** | `src/lib/admin-auth.ts` | Worker secret |
| `RESEND_API_KEY` | **SERVER SECRET** (currently unset — WP4's escaping gate must land before it is ever set) | `src/lib/email/receipt.ts` | Worker secret, set only at WP4 |
| `BLOB_READ_WRITE_TOKEN` | **SERVER SECRET** (until WP3 retires Blob for R2 — R2 then uses a binding, no token secret at all) | `admin/products/actions.ts` | Worker secret (transitional) |
| `EMAIL_FROM` | Config (non-secret) | receipt module | Plain var in `wrangler.jsonc` |
| `VERCEL` / `CF_PAGES` / `WORKERS_CI` | Platform markers | WP0 guards | Set by platforms; nothing to do |
| `NEXT_PUBLIC_*` | — | **None exist** (grep-verified) | Keep it that way; nothing is inlined into client bundles |

Rules: secrets never in `wrangler.jsonc`/git (a `.dev.vars` file for local Workers dev must be added to `.gitignore` the moment it's created — the current `.env*` pattern does not cover it); `nodejs_compat` population makes `process.env` reads work unchanged, so **no code changes**; CI redacts by default but the migrate script already never prints the URL; `hasDatabase()` throw-guard already covers CF markers (WP0 addendum).

# 15. Scalability Analysis

Read/write separation is the whole story (acceptance Q16/Q17):

| Load | Reads (browse) | Writes (checkout/feedback/admin) |
|---|---|---|
| **100 concurrent** | Static assets from PoP cache — no Worker, no DB. Effectively idle infrastructure | A few orders/min at most → single-digit Neon QPS. Nothing to do |
| **1,000 concurrent** | Same — CDN absorbs linearly, zero backend amplification | If 1–3% convert: ~10–30 checkout submits/min → ~50–150 DB round trips/min on neon-http (stateless — no pool to exhaust, the audit's SCALE verdict holds). Conditional decrement serializes on row locks; oversell impossible (frozen) |
| **10,000 concurrent (Instagram/Reels spike)** | Still CDN — this is precisely the case the static-first shape exists for. Watch: confirmation page is 1 Worker exec/view **until WP4** (10k views ≈ 10k execs ≈ still trivially inside paid-plan quotas) | Checkout bursts are the real test: today's duplicate-order hole (QA-02, no idempotency) and stock-drain abuse (SEC F-1) are **application** problems scheduled in WP2/WP3 — Cloudflare must not be claimed to solve them. Zone rate limits cap the blast radius |

**Actual bottleneck list (ranked, no invented ones):**
1. **Unauthed write abuse** — WP3 (zone rules + honeypot + fallback counter). Highest business risk (audit P0).
2. **Duplicate orders on mobile retries** — WP2 idempotency. Architecture requirement on Cloudflare: none beyond a Postgres unique key — fully supported.
3. **Checkout latency Jordan↔us-east-1** — Smart Placement (§5) + WP2's ≤4 round trips + (gateway milestone) Hyperdrive.
4. **Admin O(orders) full-table reads** — WP5 (`LIMIT`/indexes); grows monotonically but only for the admin.
5. **Neon cold start** (scale-to-zero first query) — accept at this scale, or disable scale-to-zero later ($).
The WP2 pipeline (idempotency pre-check, single-statement decrement `UPDATE … FROM (VALUES …)`, constraint-discriminating retry, `after()` email) is **plain Postgres + one Workers primitive (`waitUntil`)** — nothing in it requires Vercel. Confirmed supportable before WP2 starts.

# 16. Cost Analysis

(Acceptance Q18/Q19.) New brand, ~1,500 followers, spiky Instagram traffic → the static-first shape makes cost nearly flat:

| Item | Plan/tier | Expected monthly cost |
|---|---|---|
| Workers **Paid** | $5 flat: 10M requests + 30M CPU-ms incl.; also 10 MiB bundle (free tier's 3 MiB likely doesn't fit, and 100k req/day + 10 ms CPU caps are uncomfortable for a store) | **$5** |
| Static assets (all storefront HTML/CSS/JS/fonts/images/video) | Free, **no egress charges** — a viral Reel costs $0 in delivery | $0 |
| R2 (incremental cache; later product images) | Free tier: 10 GB + generous ops; LUNE uses MBs | $0 |
| D1 (tag cache) + Durable Objects (revalidation queue) | Free tiers dwarf a 4-product catalog's revalidation volume; DO included in paid plan | $0 |
| Image transformations | 5,000 unique/mo free; LUNE needs dozens | $0 |
| Hyperdrive (when adopted) | Included in Workers Paid | $0 incremental |
| Neon | Existing plan (currently via Vercel Marketplace — see §19 R1; direct Neon free/launch tier fits current volume) | $0 → provider-dependent |
| Resend | Free tier 3,000 emails/mo ≫ order volume | $0 |
| Domain + DNS | Registration at cost; DNS/DDoS/CDN free | ~$10–15/yr |
| **Total** | | **≈ $5/month + domain** |

**What could increase cost (watch list):** Pro plan $25/mo *only if* staged log-mode rate limiting / more WAF rules are wanted (decision at cutover); CPU-ms overage if admin table scans grow unchecked (WP5 fixes the growth curve first); unique-transformation explosion if the rebuild generates unbounded image variant combinations (pin the `sizes`/width set); Workers Logs beyond free sampling; Neon compute if scale-to-zero is disabled or a bigger tier is chosen; per-checkout `revalidateTag` bursts writing D1 (trivial now; bounded by order volume — the audit already flags per-checkout re-busting for WP2-adjacent cleanup). Every recurring request has passed the STATIC? CACHED? LOCAL? ELIMINATED? test in §7 — the residual Worker/DB surface is checkout, admin, and (until WP4) confirmation, which is the irreducible core.

# 17. Deployment Pipeline

Documented for later implementation — **nothing deployed in this phase** (acceptance Q20):

```
Git push (master or release branch)
  ↓
CI — GitHub Actions (preferred: migration step + tests need a full Node env
     and CI secrets; Workers Builds remains a viable alternative — WP0 guards
     already recognize WORKERS_CI)
  ↓
Install + gates:  npm ci → lint → tsc --noEmit → tests (WP11 suite as it lands)
                  → drizzle-kit check (migration-history consistency, offline)
  ↓
DB migration:     node scripts/migrate-deploy.mjs --require-db   (CI secret DATABASE_URL;
                  fails loudly → pipeline stops BEFORE any deploy; WP0 system unchanged)
  ↓
Build:            next build  →  npx opennextjs-cloudflare build
  ↓
Deploy:           wrangler deploy   (atomic version swap; optionally staged via
                  Workers gradual deployments once traffic justifies canaries)
  ↓
Smoke tests:      GET / , /en , /ar , /en/shop , one product page , /admin (login form)
                  → 200s + locale redirect correctness; read-only journal row-count check;
                  one preview-env test checkout in staging pipelines only (never prod)
```

**Ordering rationale — migrate BEFORE deploy, expand-contract:** during the window between migration and version swap, the **old** Worker serves traffic against the **new** schema. This is safe iff migrations are additive-first — which is exactly WP0's committed policy (`docs/DATABASE_MIGRATIONS.md`: additive/expand-contract, destructive changes gated separately). **Honest zero-downtime claim:** the Workers swap itself is atomic (zero downtime); deployments carrying *additive* migrations are zero-downtime end-to-end; deployments carrying *destructive/contracting* migrations are NOT automatically zero-downtime and follow the WP0 destructive policy (explicit migration, Neon restore point, deploy-coupled execution, possible maintenance window). No claim beyond that.

Environments: `production` (custom domain) + `preview` (workers.dev + **Neon branch** database — never prod data; the audit's "all DB testing on branches" rule). Preview pipelines run the same YAML with different secrets.

# 18. Rollback Strategy

(Acceptance Q21.)

- **Application:** `wrangler rollback` (or redeploy the previous version) — instant, atomic, no build needed. With gradual deployments, abort mid-rollout. During the migration window, **Vercel remains fully deployed and untouched** — the ultimate rollback is DNS back to Vercel (minutes at Cloudflare's TTLs), kept available until Cloudflare has soaked (per the no-production-changes rule, nothing Vercel-side is dismantled in this phase or the next).
- **Database:** migrations are **forward-only** (WP0 documented honestly — no auto-down). Rollback options in order: (1) old app code keeps working against the newer additive schema — *application* rollback usually needs **no** DB action (that's the point of expand-contract); (2) a compensating forward migration; (3) Neon point-in-time restore / pre-migration branch snapshot for the destructive-change case (snapshot is **mandatory before** any destructive migration per WP0 policy — restore loses writes since the snapshot, which is why destructive migrations get maintenance-window treatment).
- **Cloudflare configuration:** `wrangler.jsonc` + `open-next.config.ts` live in git — config rolls back by redeploying the previous commit. Zone-level settings (WAF rules, rate limits, DNS records) are dashboard state: export/record them in `docs/` at cutover (or manage via API/Terraform later), so any rule can be reverted deliberately. DNS rollback = repoint records to Vercel (keep the Vercel domain config intact until decommission).
- **Irreversibility ledger:** the *only* irreversible acts in the whole plan are destructive DB migrations (policy-gated) and deleting the Vercel project / Marketplace integration (**last step, after soak, and only after §19 R1 is resolved**).

# 19. Risks

Ranked, with mitigations:

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| **R1** | **Neon is provisioned through the Vercel Marketplace** — billing/lifecycle are coupled to the Vercel account. Deleting the Vercel project/integration could suspend or deprovision the production database | **Critical (data loss)** | **Hard precondition to decommissioning:** transfer the database to a direct Neon account (Neon supports marketplace→direct transfer) or re-provision + migrate data deliberately; update `DATABASE_URL` everywhere; verify with row counts. Until then Vercel must not be deleted. Same check applies to the Blob store before WP3 completes |
| R2 | Next 16 `proxy.ts` unsupported by the adapter at migration time (open issues #962/#13937) | High (blocks build) | Gate CF-G1; trivial app-side fallback (rename to legacy `middleware.ts` — 13-line file); track adapter releases |
| R3 | Tag revalidation semantics differ on Workers (`revalidateTag("products","max")`, cache-purge timing) → stale prices/stock **displayed** (never charged — server re-prices) | Medium | Gate CF-G2 with an explicit admin-edit→storefront test; one-arg fallback; money paths are structurally immune (frozen fresh-read invariant) |
| R4 | Worker bundle exceeds limits / CPU-ms surprises in admin table scans | Medium | Paid plan (10 MiB); measure in CF-0; WP5 bounds admin queries |
| R5 | Windows dev machine can't run adapter builds reliably | Medium (DX) | Build in CI/WSL (Gate CF-G4); local `next dev` unchanged |
| R6 | Checkout latency to us-east-1 degrades conversion | Medium | Smart Placement + WP2 round-trip budget; measure; region move as a deliberate later decision |
| R7 | Dual-run window (Vercel + Cloudflare on one prod DB): both apps mutate stock/orders | Low-Medium | Same code, same invariants (conditional decrement serializes at the row); keep the window short; do **not** run conflicting cron/queue jobs (none exist); cutover checklist includes disabling Vercel *traffic* (DNS) not the deployment |
| R8 | `experimental.globalNotFound` or Next-canary-adjacent APIs behave differently under the adapter | Low | Gate CF-G3 in CF-0; the branded 404 is cosmetic, never blocking |
| R9 | Zone security rules over-block Jordanian carrier NAT / Instagram webviews | Low-Medium (conversion) | §13 LOG→TUNE→ENFORCE, generous hourly thresholds, dry-run during first campaign (audit SCALE T3) |
| R10 | vinext becomes the only supported path faster than expected (OpenNext deprecation) | Low (years-scale) | Adapter-agnostic architecture (§4); re-evaluate at each Next major |

# 20. Migration Plan

Phased; **every phase below requires explicit approval before execution — none of it was started:**

- **CF-0 — Local/CI compatibility proof (no Cloudflare account resources).** Add `@opennextjs/cloudflare` + `wrangler` as devDependencies (the only installs this migration needs; justified as the safe local compatibility test), author `wrangler.jsonc` + `open-next.config.ts` (R2/D1/DO caching stack, Smart Placement, `nodejs_compat`), run the build in CI/WSL, and clear the gates: **G1** proxy/next-intl locale routing, **G2** tag revalidation end-to-end, **G3** globalNotFound, **G4** build reproducibility + bundle size vs 10 MiB. Local preview via `wrangler dev` with a **Neon branch** DB.
- **CF-1 — Preview deployment** (workers.dev, preview env, Neon **branch** database, preview secrets): full manual matrix (EN/AR, RTL, cart, checkout with test order against the branch DB, admin) + smoke automation from §17. First creation of any Cloudflare resources — all non-production.
- **CF-2 — Production shadow** (production secrets, custom domain **not** yet cut over): short dual-run against prod DB per R7, one witnessed live test checkout, verify revalidation + Smart Placement metrics.
- **CF-3 — Cutover:** DNS to Cloudflare, zone security per §13 in log/tune mode, monitor §Observability signals; Vercel stays deployed as instant rollback.
- **CF-4 — Soak + decommission:** after a stable period and **R1 resolved** (Neon transferred to direct account; Blob retired by WP3 or ownership verified), remove the Vercel project. End state: zero Vercel dependencies.

Sequencing with the WP roadmap: CF-0/CF-1 can proceed in parallel with WP1 (admin sessions — pure app code); WP2–WP4 land on whichever platform is production at the time (their designs are platform-agnostic by construction — verified in §15); the **visual rebuild (WP8–WP10) should happen after cutover** so it is built and tested once, on the final platform.

**Observability (minimal, mostly free):** Workers Logs (free sampling) + `wrangler tail` for live debugging; Cloudflare analytics + **Cloudflare notifications** for error-rate/spike alerts; an external uptime check (free tier of any monitor) on `/en` and `/en/checkout`; app-side structured `console.error` prefixes already conventional (`[migrate]`, checkout/email failures) — grep-able in Workers Logs. Failed checkouts and DB errors surface as logged server-action errors; a later WP11 item can add a lightweight admin "last N errors" view if wanted. No paid APM until a concrete need appears.

# 21. Final Architecture Diagram

```
                         Users (Jordan; Instagram in-app browser heavy)
                                          │
                        ┌─────────────────▼──────────────────┐
                        │  CLOUDFLARE ZONE  (custom domain)  │
                        │  DNS · DDoS · Bot mgmt · WAF/rate  │
                        │  rules on POST checkout/feedback/  │
                        │  admin  (log → tune → enforce)     │
                        └───────┬────────────────────┬───────┘
                     static hit │                    │ dynamic / POST
                                ▼                    ▼
                ┌────────────────────────┐   ┌─────────────────────────────┐
                │ WORKERS STATIC ASSETS  │   │ WORKER (OpenNext adapter,   │
                │ (free, no egress, no   │   │  nodejs_compat, Smart       │
                │  Worker invocation)    │   │  Placement → near DB)       │
                │ • all SSG storefront   │   │ • server actions: checkout, │
                │   HTML (EN/AR)         │   │   feedback, admin           │
                │ • /_next/static (imm.) │   │ • admin SSR, confirmation   │
                │ • fonts (WP7 split)    │   │   SSR (until WP4 → static)  │
                │ • images / video / icon│   │ • ISR/tag revalidation      │
                └────────────────────────┘   └──────┬──────────┬───────────┘
                                                    │          │
                              caching stack ┌───────▼───┐      │ neon-http (HTTPS,
                              (adapter)     │ R2  incr. │      │  stateless; Hyperdrive
                                            │ D1  tags  │      │  + pg at gateway
                                            │ DO  queue │      │  milestone)
                                            │ + purge   │      ▼
                                            └───────────┘  ┌──────────────────────┐
                                                           │ NEON POSTGRES        │
   Deploy path:  Git → GitHub Actions → lint/tsc/tests →   │ us-east-1 · Drizzle  │
   drizzle migrate (WP0, fail-loud) → next build →         │ WP0 versioned        │
   opennextjs-cloudflare build → wrangler deploy (atomic)  │ migrations journal   │
   → smoke tests.  Rollback: wrangler rollback / DNS →     │ (⚠ transfer off      │
   Vercel (kept until soak + R1 resolved).                 │  Vercel Marketplace  │
                                                           │  before decommission)│
   Email: Resend HTTPS from after() (WP4) — off the        └──────────────────────┘
   response path, never blocks an order, key set only
   after escaping lands.
```

---

**Acceptance answers index:** Q1 §2 · Q2/Q3 §3–4 · Q4 §4 · Q5 §5 · Q6 §6 · Q7–Q11 §7 · Q12/Q13 §8 · Q14 §14 · Q15 §13 · Q16/Q17 §15 · Q18/Q19 §16 · Q20 §17 · Q21 §18.

**Phase discipline honored:** no deploy, no DNS change, no Cloudflare resources, no DB migration, no UI/checkout implementation, no packages installed (CF-0 names the two devDependencies that will need approval), no secrets printed or committed.
