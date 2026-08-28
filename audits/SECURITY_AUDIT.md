# Executive Summary

The LUNE reference codebase is, on balance, in solid security shape for a small
Cash-on-Delivery storefront. The two highest-risk business surfaces — checkout
pricing and admin authorization — are implemented correctly on the server: prices,
totals, delivery fee and payment method are all re-derived server-side and never
trusted from the client, and every admin page and mutating admin server action
re-checks `isAdminAuthenticated()` rather than relying on hidden URLs or the
`robots: noindex` header.

No critical (exploitable, high-impact) vulnerabilities were found in the current
reference code. The material findings are:

- **High:** the two unauthenticated write endpoints — public feedback
  (`submitFeedback`) and checkout (`placeOrder`) — have no rate limiting, no
  bot/abuse protection, and no CAPTCHA. This allows spam/DB-flooding and stock
  exhaustion (fake COD orders drive real inventory to zero).
- **Medium:** the admin session is a fixed, non-expiring-value cookie (the token
  is a deterministic hash of the password, identical for every login and every
  admin), so it cannot be individually revoked and is vulnerable to session
  fixation-style reuse; password comparison is also non-constant-time.
- **Medium:** `serverActions.bodySizeLimit` is raised to 5 MB globally, and the
  admin image upload declares a 4 MB limit but validates size only *after* the
  full body is buffered — an unauthenticated actor can force the server to buffer
  5 MB bodies against *any* server action.
- **Low:** known moderate `npm audit` advisory in the `drizzle-kit` dev
  dependency chain (esbuild); customer PII stored in a world-readable-in-repo dev
  JSON fallback if misconfigured; minor error-handling/IDOR observations.

All findings include concrete files, attack scenarios, fixes and verification
steps below. This is a Phase A report only — no code was modified.

# Current State

## What is done well (verified)

- **Server-side re-pricing (correct).** `src/app/[locale]/checkout/actions.ts`
  ignores any client-supplied price/total/delivery fee. It accepts only
  `{ slug, qty }` per item (`checkoutSchema`, lines 23–40), looks each product up
  in `getStoreProductsFresh()`, computes `effectivePrice()` server-side, sums the
  subtotal, and adds the server constant `DELIVERY_FEE`. `paymentMethod` is a
  `z.literal("cod")` so `card` is rejected at the schema. This satisfies binding
  rules 14 and 15.
- **Quantity / inventory bounds.** `qty` is `int().min(1).max(MAX_QTY_PER_ITEM)`
  (20), array length capped at 10, and each line is re-checked against live
  `product.stock` (`actions.ts:70`). Stock is decremented with a conditional
  `UPDATE ... WHERE stock >= qty` (`src/lib/products.ts:224–245`), preventing
  oversell on the DB path.
- **Admin authorization is server-enforced everywhere.** Every admin page
  (`src/app/admin/page.tsx:13`, `orders/page.tsx:28`, `feedback/page.tsx:10`,
  `products/page.tsx:32`, `products/[slug]/page.tsx:20`) and every mutating admin
  action (`setOrderStatus` in `admin/actions.ts:40`; all five product actions in
  `admin/products/actions.ts:54,85,126,154`) calls `isAdminAuthenticated()`. The
  admin area does not rely on `robots.txt` or hidden URLs for protection.
  Special-attention requirement satisfied.
- **Admin login cookie flags are reasonable.** `httpOnly: true`, `sameSite:
  "lax"`, `secure` in production, `path: "/admin"`, `maxAge` 12h
  (`admin/actions.ts:19–25`). The password is never returned to the client; the
  login form posts via a server action.
- **Image upload allow-lists type.** `admin/products/actions.ts` maps only
  `image/jpeg | png | webp` (lines 139–143, 167–170), rejects empty files, and
  the blob key is derived from a validated `slug` + fixed `slot` + `Date.now()` —
  no user-controlled filename reaches the storage path, so no path traversal.
- **No SQL injection surface.** All DB access goes through Drizzle's
  parameterized query builder (`src/lib/products.ts`, `orders.ts`, `feedback.ts`);
  the only raw SQL is `sql\`${col} - ${qty}\`` with bound parameters. No string
  concatenation into queries.
- **No XSS sink in the app UI.** No `dangerouslySetInnerHTML`, `eval`, or
  `new Function` anywhere in `src/` (grep clean). React auto-escapes. No
  `NEXT_PUBLIC_*` secret exposure; DB/admin/API secrets are read only in
  server-only modules.
- **Secrets not committed.** `.env*` and the three `*.dev.json` stores are
  gitignored and absent from `git ls-files`.

## Scope notes

- There is **no `src/app/api/` directory** — the "API abuse" surface is entirely
  Server Actions, which is the correct place to look.
- Locale proxy (`src/proxy.ts`) correctly excludes `/admin` and `/api` from i18n
  rewriting; it is not an auth boundary and does not claim to be.

# Findings

## F-1 — No rate limiting / abuse protection on public write endpoints (High)

**Affected:** `src/components/feedback/actions.ts` (`submitFeedback`),
`src/app/[locale]/checkout/actions.ts` (`placeOrder`).

**Explanation.** Both are unauthenticated server actions that write to the
database (or dev JSON) on every call. Neither has rate limiting, IP throttling,
CAPTCHA, honeypot, or duplicate-submission guards.

**Attack scenarios.**
1. *Feedback spam / storage flooding.* An attacker scripts thousands of
   `submitFeedback` calls (3–1000 char message, name/email optional). The feedback
   table fills with junk, the admin feedback view becomes unusable, and DB storage
   / Neon compute costs rise. Message content is attacker-controlled free text.
2. *Inventory / stock-exhaustion via fake orders.* `placeOrder` decrements real
   stock on success. An attacker submits valid-looking COD orders (fake name /
   Jordanian-format phone / any email) for every product up to `stock`. Because
   payment is Cash-on-Delivery, there is no payment step to deter this: real
   inventory shows sold-out, blocking genuine customers, and the admin dashboard
   floods with bogus orders. This is a direct denial-of-inventory attack.
3. *Order-table flooding.* Even without exhausting stock, high-volume order
   submission pollutes the orders table and inflates DB cost.

**Recommended fix.**
- Add per-IP + per-fingerprint rate limiting to both actions. Since the project is
  on Vercel, prefer the already-available platform primitives (Vercel Firewall /
  WAF rate-limit rules, or `@vercel/firewall`'s `checkRateLimit`) so no new heavy
  runtime dependency is introduced (binding rule 10). If an app-level limiter is
  wanted, an Upstash Redis token bucket (already discoverable via the Vercel
  Marketplace / Neon+Upstash) keyed on IP is the standard choice.
- Add a hidden honeypot field + minimum time-to-submit check on the feedback and
  checkout forms as cheap bot filtering.
- For `placeOrder`, consider a short per-IP cooldown and a per-order max distinct
  items already partly bounded (10 items, qty ≤ 20). Consider soft stock
  reservation with expiry rather than hard decrement on unpaid COD orders, so
  abandoned/abusive orders release inventory.

**Verification.** Script N rapid calls to each action; confirm the limiter
returns a rejection after the threshold and that stock/feedback rows stop growing.
Integration test: assert the 11th call within the window is rejected.

## F-2 — Admin session token is a static, non-revocable, non-random value (Medium)

**Affected:** `src/lib/admin-auth.ts` (`expectedToken`, `tokenForPassword`,
`isAdminAuthenticated`); `src/app/admin/actions.ts` (`adminLogin`).

**Explanation.** The session cookie value is
`sha256("lune:" + ADMIN_PASSWORD)` — a **deterministic constant**. Every
successful login on every device sets the identical cookie value, and the value is
literally a hash of the password. Consequences:
- **No session identity / no revocation.** Individual sessions cannot be
  invalidated; the only way to log everyone out is to change `ADMIN_PASSWORD`.
- **Session fixation / replay.** If the cookie value ever leaks (shared device,
  proxy log, backup, XSS in some future admin change), it is valid until the
  password changes, and is the same token an attacker could pre-seed. `httpOnly`
  mitigates JS theft but not other exfiltration paths.
- **Offline password inference risk.** The cookie value equals a hash of the
  password with a fixed, code-visible prefix and no per-user salt. Anyone who
  obtains the cookie can run an offline dictionary/brute-force against a weak
  `ADMIN_PASSWORD` (single sha256, no KDF, no salt beyond the constant `lune:`).

**Related — non-constant-time comparison (Medium, same file).**
`tokenForPassword` compares `password !== process.env.ADMIN_PASSWORD` (line 24)
and `isAdminAuthenticated` compares cookie `=== token` (line 16) with `===`.
These are not constant-time; in principle they leak timing about the password /
token. Practical exploitability over a network is low, but it is trivially
fixable.

**Related — no login rate limiting / brute force (Medium).** `adminLogin` has no
attempt throttling or lockout. Combined with a weak `ADMIN_PASSWORD`, the login is
brute-forceable online.

**Recommended fix.**
- Generate a **random session id** at login (e.g. `crypto.randomUUID()` or random
  bytes), store the cookie value = that id, and keep a server-side mapping of
  valid session ids (a small `admin_sessions` table with `expiresAt`, or a signed
  JWT/`iron-session`-style sealed cookie carrying an expiry + random nonce). This
  gives revocation and removes the password-derived value from the wire.
- If keeping the hash approach short-term, at minimum use a per-issue random nonce
  in the token and compare with `crypto.timingSafeEqual`. Replace the raw password
  `!==` check with `timingSafeEqual` over fixed-length buffers.
- Add login attempt throttling / temporary lockout (ties into F-1's limiter).
- Document a strong `ADMIN_PASSWORD` requirement.

**Verification.** Log in twice from two browsers and confirm cookie values differ;
delete a single session server-side and confirm only that browser is logged out;
confirm the cookie value is not a function of the password (cannot be reproduced
from `ADMIN_PASSWORD` alone). Timing test around login comparison.

## F-3 — 5 MB global server-action body limit + post-buffer upload size check (Medium)

**Affected:** `next.config.ts` (`serverActions.bodySizeLimit: "5mb"`);
`src/app/admin/products/actions.ts` (`MAX_IMAGE_BYTES`, size check at line 171).

**Explanation.** `bodySizeLimit` is global to *all* server actions, including the
unauthenticated `placeOrder` and `submitFeedback`. An attacker can POST up to 5 MB
bodies to any action. Combined with F-1 (no rate limiting), this is a cheap
memory/bandwidth amplification vector (5 MB × many concurrent requests).

For the image upload specifically, the auth check runs first (good), but the 4 MB
`file.size` check happens only after Next has already buffered the whole
multipart body into the action — the size ceiling is really the 5 MB config, not
4 MB, and the buffering happens regardless.

**Attack scenario.** Authenticated-or-not flooding of large bodies to exhaust
function memory / inflate Vercel bandwidth and compute. Even unauth `placeOrder`
accepts a 5 MB JSON body that must be parsed before Zod rejects it.

**Recommended fix.**
- Keep the raised limit as narrow as possible. If per-action limits are not
  supported in this Next version, gate the large-body path behind the admin
  boundary at the platform edge (Vercel WAF) and keep public actions rejecting
  oversize bodies early.
- Enforce image size at the edge / via the Vercel Firewall and validate
  `Content-Length` before buffering where possible.
- Pair with F-1 rate limiting so large-body floods are throttled.

**Verification.** Send a 5 MB body to `submitFeedback`; confirm it is rejected/
throttled rather than fully parsed. Send a 4.5 MB image to the upload action;
confirm rejection.

## F-4 — Known npm advisory in drizzle-kit dependency chain (Low)

**Affected:** dev dependency `drizzle-kit@^0.31.10` → `@esbuild-kit/*` → `esbuild
<=0.24.2` (GHSA-67mh-4wv8-2f99).

**Explanation.** `npm audit` reports 4 moderate advisories, all from the esbuild
dev-server SSRF issue reachable only through `drizzle-kit`. This is a **build/dev
tool**, not shipped to production runtime, so real-world exposure is limited to a
developer running the tool on a hostile network. No production-runtime dependency
(next, react, next-intl, drizzle-orm, @vercel/blob, resend, zod) shows an
advisory.

**Recommended fix.** Upgrade `drizzle-kit` to a release whose esbuild chain is
patched when convenient (the auto-fix is flagged as a breaking major, so do it
deliberately, not via `--force`). Low priority.

**Verification.** `npm audit` shows 0 advisories after upgrade; `npx drizzle-kit
push` still works.

## F-5 — Customer PII in local JSON fallback stores (Low / operational)

**Affected:** `src/lib/orders.ts` (`.orders.dev.json`), `src/lib/feedback.ts`
(`.feedback.dev.json`).

**Explanation.** When `DATABASE_URL` is unset, full orders (name, email, phone,
city, address = customer PII) and feedback are written to plaintext JSON files at
the repo root. These are correctly gitignored today. Risk is operational: if this
fallback is ever active in a deployed/shared environment, or the files are
accidentally included in a backup/artifact, PII leaks. On serverless (Vercel) the
filesystem is ephemeral/read-only, so the fallback silently loses data there too.

**Recommended fix.** Keep the fallback strictly dev-only; add a startup warning
when `hasDatabase()` is false in `NODE_ENV === "production"`. Confirm the dev
files never ship in deploy artifacts (they are gitignored — keep it that way). No
change needed for the reference build.

**Verification.** Confirm `.orders.dev.json` / `.feedback.dev.json` remain
gitignored and absent from `vercel` build output.

## F-6 — Confirmation page has no order-scoped data exposure (Informational — good)

**Affected:** `src/app/[locale]/confirmation/page.tsx`.

**Explanation.** The confirmation page reads only `?order=<orderNumber>` and
renders it back through `ConfirmationReveal`; it does **not** look the order up in
the database, so there is **no IDOR** — an attacker guessing/altering the order
number learns nothing (no customer data, no order details are fetched). This is the
correct design. Order numbers (`L-` + 6 chars from a 30-char alphabet) are used
only for display. No action required; noted so a future refactor does not
introduce an order lookup on this public page without an ownership check.

## F-7 — Receipt email HTML interpolation of customer fields (Low)

**Affected:** `src/lib/email/receipt.ts` (interpolation of `item.name`,
`order.customerName`, `order.city`, `order.address`, `order.orderNumber` into an
HTML string, lines 81–133).

**Explanation.** Customer-controlled fields are interpolated into the receipt
HTML without escaping. The email recipient is the customer themselves (their own
`order.email`), so this is self-XSS at worst and not a classic attack path. Fields
are length-bounded by the checkout Zod schema. However, `item.name` comes from the
product row (admin-editable) and the address/name/city are free text; a `<` or
tag-like content would render oddly or could enable HTML/style injection in the
email body, and if any receipt is ever forwarded to staff/admin it becomes a
cross-recipient concern.

**Recommended fix.** HTML-escape all interpolated dynamic values in
`buildReceiptHtml` (a tiny `escapeHtml` for `& < > " '`). Cheap, no dependency.

**Verification.** Place an order with `name = "<b>x</b>"`; confirm the receipt
renders the literal text, not markup.

## F-8 — Minor observations (Informational)

- **Error handling does not leak internals to clients.** `placeOrder`,
  `submitFeedback`, and admin actions log details server-side (`console.error`)
  and return generic codes/strings to the client — good. Keep it that way.
- **`revalidateTag("products", "max")`** is called from the unauthenticated
  `placeOrder` — this is legitimate (stock changed) and not attacker-controllable
  beyond a valid order, so not a cache-poisoning vector.
- **Phone/email regexes** (`checkout-validation.ts`) are permissive but only used
  for format validation, not as a security boundary — acceptable.
- **`setOrderStatus` / product actions silently return** on auth failure (no
  error thrown). Not a vulnerability (fails closed), but returning a clear
  unauthorized state — as the product actions already do via `UNAUTHORIZED` — is
  friendlier and less likely to mask a real bug.

# Severity / Priority

| ID | Finding | Severity | Priority |
|----|---------|----------|----------|
| F-1 | No rate limiting on public write endpoints (feedback + checkout / stock exhaustion) | **High** | 1 |
| F-2 | Static, non-revocable password-derived admin session token; non-constant-time compare; no login throttling | **Medium** | 2 |
| F-3 | 5 MB global server-action body limit + post-buffer upload size check | **Medium** | 3 |
| F-4 | drizzle-kit → esbuild moderate advisory (dev-only) | **Low** | 5 |
| F-5 | Customer PII in local JSON fallback stores | **Low** | 4 |
| F-6 | Confirmation page (no IDOR) | Informational (good) | — |
| F-7 | Unescaped customer fields in receipt email HTML | **Low** | 4 |
| F-8 | Minor error-handling / cache observations | Informational | — |

No Critical findings. Highest actionable risk is F-1 because it combines with the
COD model to allow denial-of-inventory with zero authentication.

# Recommendations

Ordered by priority:

1. **F-1 — Add rate limiting + bot filtering to `submitFeedback` and
   `placeOrder`.** Prefer Vercel Firewall / WAF rate-limit rules or
   `@vercel/firewall` (no new runtime dependency). Add a honeypot + min-submit-time
   to both forms. For COD, consider soft stock reservations with expiry instead of
   hard decrement on unpaid orders.
2. **F-2 — Rework the admin session.** Issue a random, server-tracked (or signed +
   nonce'd + expiring) session token so it is revocable and not derived from the
   password. Use `crypto.timingSafeEqual` for password and token comparison. Add
   login attempt throttling. Require a strong `ADMIN_PASSWORD`.
3. **F-3 — Narrow the large-body exposure.** Keep the 5 MB allowance as close to
   the admin upload path as the framework allows; validate `Content-Length` early;
   throttle via the same limiter as F-1.
4. **F-5 / F-7 — Hardening.** Add an HTML-escape helper in `buildReceiptHtml`; add
   a production warning when the DB fallback is active.
5. **F-4 — Upgrade `drizzle-kit`** deliberately (not `--force`) to clear the
   esbuild advisory.

Do **not** remove existing functionality to achieve these (binding rule 3); all
recommendations are additive hardening. None require converting Server Components
to Client Components (rule 11) or fabricating product/business data (rules 4–6).

# Risks

- **Denial of inventory (F-1) is the most business-damaging risk.** Because
  payment is Cash-on-Delivery, there is no payment gate to deter fake orders;
  automated order submission can zero out real stock and bury genuine orders. This
  should be treated as the priority-1 rebuild requirement.
- **Admin compromise blast radius (F-2).** The admin can edit prices, sale
  windows, stock, product copy, images, and order status. A leaked/guessed session
  or weak password gives an attacker full control of storefront pricing and
  inventory. Revocable sessions + brute-force protection materially reduce this.
- **Cost/DoS risk (F-1 + F-3).** Unauthenticated large-body floods and DB write
  floods translate directly into Neon/Vercel compute and bandwidth cost.
- **Residual/low risks (F-4, F-5, F-7)** are contained today (dev-only tool,
  gitignored files, self-directed email) but should be closed to prevent future
  regressions during the rebuild.
- **Regression risk during rebuild:** the currently-correct server-side re-pricing
  (checkout) and per-page/per-action admin auth checks must be preserved. Any new
  public page that fetches an order by number (see F-6) must add an ownership
  check.

# Verification / Testing

Per-finding verification is listed under each finding. Suite-level:

- **Pricing integrity (regression guard):** submit `placeOrder` with a manipulated
  client payload attempting to set price/total/deliveryFee/paymentMethod=`card`;
  confirm the server ignores them, re-prices from the DB, and rejects `card`.
  Confirm `qty > stock` and `qty > 20` and >10 items are rejected.
- **Admin authz:** call each admin server action (`setOrderStatus`,
  `saveProductDetails`, `saveProductPricing`, `saveProductStock`,
  `replaceProductImage`) and load each admin page **without** a valid
  `lune_admin` cookie; confirm every one denies (returns unauthorized / renders
  the login form) and performs no mutation.
- **Rate limiting (after F-1 fix):** automated N-in-window calls to feedback and
  checkout return rejections past the threshold; stock cannot be driven to zero by
  scripted orders faster than the limit.
- **Session (after F-2 fix):** two logins produce distinct cookies; server-side
  revocation logs out exactly one session; cookie value is not reproducible from
  `ADMIN_PASSWORD`.
- **Upload:** wrong MIME (e.g. `image/gif`, `text/html` renamed) rejected; >4 MB
  rejected; blob key contains only validated slug/slot/timestamp (no traversal).
- **Dependencies:** `npm audit` re-run after the drizzle-kit upgrade shows 0
  advisories.
- **Email (after F-7 fix):** order with markup in name/address renders as literal
  text in the receipt.
- **Secrets:** confirm no `NEXT_PUBLIC_*` carries a secret, no secret value in
  client bundles, and `.env*` / `*.dev.json` remain gitignored (all currently
  pass).

# Phase C — Review of Proposed Architecture

Security review of "# Phase B — Consolidated Target Architecture" in
`audits/ARCHITECTURE_REPORT.md` (§1–§5, rulings T1–T9, WP0–WP11), assessed
against Phase A findings F-1…F-8 above. **Overall verdict: APPROVED WITH
CONDITIONS.** The proposal resolves every Phase A finding in substance, and the
rulings that touched security (T2, T3, T4, T5) are sound. The conditions below
are mostly specification gaps in *new* mechanisms the proposal introduces
(idempotency key, Blob client-upload tokens, durable throttling) — none require
changing the architecture's shape.

## Coverage of Phase A findings

| Phase A | Resolved by | Status |
|---|---|---|
| F-1 rate limiting / denial-of-inventory (High) | WP3 (WAF + honeypot + min-submit-time), T3 | Resolved, with conditions C-3.1/C-3.2 |
| F-2 admin session (Medium) | WP1 (random revocable tokens, timing-safe compares, throttling, logout path fix), T5 | Resolved, with conditions C-1.1…C-1.4 |
| F-3 5 MB body limit (Medium) | WP3/T4 (Blob client uploads → 1 MB default restored) | Resolved, with conditions C-3.3…C-3.5 |
| F-4 drizzle-kit advisory (Low) | WP6 | Resolved |
| F-5 PII in dev JSON fallback (Low) | WP6 `createDevStore` — prod guard **not stated** | Partial — condition C-6.1 |
| F-6 no-IDOR confirmation (good design) | T2 explicitly freezes it ("no DB lookup ever") | Preserved — endorsed |
| F-7 email HTML escaping (Low) | WP4, gated *before* `RESEND_API_KEY` is ever set | Resolved — gate ordering endorsed |
| F-8 minor observations | WP1 (`setOrderStatus` error surfacing), WP10 (governorate select shrinks free text) | Resolved |

## Rulings review (security-relevant)

- **T2 (static confirmation, no order lookup) — SOUND.** Rejecting server-side
  existence checking is exactly right: verification would create the IDOR
  surface F-6 warned about, for zero security benefit. The `&receipt=1` query
  flag is non-sensitive. Endorsed as written.
- **T3 (WAF over in-memory limiter) — SOUND.** Matches my Phase A
  recommendation; SCALE's NAT'd-carrier warning correctly rules out naive IP
  buckets, and the no-Redis stance respects rule 10. Conditions C-3.1/C-3.2.
- **T4 (Blob client uploads) — SOUND in principle, underspecified.** It genuinely
  closes F-3 (body limit back to 1 MB) rather than papering over it. But
  client uploads move the trust boundary into a token-minting endpoint, which
  the proposal does not specify. Conditions C-3.3…C-3.5 are mandatory.
- **T5 (no proxy pre-filter; `requireAdmin()` + per-action checks) — SOUND.**
  Identical to my Phase A position: per-page + per-action server checks are the
  real boundary; entangling `/admin` with the locale proxy adds risk, not
  security. The "revisit as a WAF rule, not proxy code" note is correct.
- **T1 (staged atomicity; single-statement decrement now) — SOUND from the
  security seat.** Server-side re-pricing and the conditional decrement shape
  are preserved (frozen list, §2). The interim residual (decrement without
  insert) is an integrity/availability issue owned by SCALE/DATA; drift
  detection as an admin stat is an acceptable compensating control.
- **T9 (optional email) — no objection**, provided escaping (WP4) still ships
  first, which the ruling already states.

## Verdicts per work package

**WP0 — Migrations baseline. APPROVED.** Security-positive: banning
`drizzle-kit push` on production and testing on Neon branches removes a whole
class of accidental-DDL/data-loss incidents. No conditions.

**WP1 — Admin session integrity. APPROVED WITH CONDITIONS.**
Resolves F-2 completely *as described*; the description must be pinned down:
- **C-1.1 — Token spec.** Session token = ≥128 bits from `crypto.randomBytes`/
  `randomUUID`; stored server-side (sessions table or sealed cookie with random
  nonce + expiry); expiry enforced **server-side**, not only via cookie
  `maxAge`; all sessions invalidated when `ADMIN_PASSWORD` changes. Cookie
  keeps `httpOnly`, `secure` (prod), `sameSite: "lax"`, `path: "/admin"`, and
  set/delete use the identical path (the QA-01 fix).
- **C-1.2 — Timing-safe compare correctness.** `crypto.timingSafeEqual` throws
  on unequal-length buffers; compare fixed-length digests (e.g. SHA-256 of
  both sides), never raw variable-length strings.
- **C-1.3 — Durable login throttling.** SCALE's own multi-instance argument
  (T3) applies to login throttling too: an in-memory counter under-blocks on
  serverless. The throttle must be durable — a small Postgres attempt counter
  or a WAF rule on the admin login action — with lockout/backoff documented.
- **C-1.4 — Store the token hashed.** If sessions live in a DB table, store a
  hash of the token, not the token itself, so a DB read (backup, injection
  elsewhere, ops access) does not yield live admin sessions.

**WP2 — Checkout integrity. APPROVED WITH CONDITIONS.**
The pricing trust model survives intact (re-price fresh → atomic decrement →
insert; frozen consensus). The **new** mechanisms need guardrails:
- **C-2.1 — Idempotency key is client-supplied input; treat it as hostile.**
  Validate shape server-side (strict UUID regex, fixed length) before it
  reaches the DB. Bound its storage (it already is `UNIQUE`); reject, don't
  truncate, oversized values.
- **C-2.2 — Replay must not become an oracle.** On key conflict, return only
  `{ ok, orderNumber }` — never the stored order's customer fields. And a
  conflicting key with a **different payload** (different items/customer) must
  return a generic error, not the original order's number — otherwise an
  attacker who obtains/guesses a victim's key (shared device, referrer leak,
  logs) can confirm and enumerate order numbers. Cheapest robust form: store a
  payload hash alongside the key; replay requires hash match.
- **C-2.3 — `expectedTotal` is UX only.** The equality check may produce
  "priceChanged", but the **server-computed** total must remain what is stored
  and charged; the client value must never be persisted. (The proposal implies
  this; make it explicit in the action's contract/tests.)
- **C-2.4 — Reservation lifetime.** "Retry reuses the reservation" — define
  what happens when the client never retries (decrement happened, no order).
  The drift-detection admin stat (T1) is the accepted answer; ensure it ships
  in the same WP as the idempotency key, not later.

**WP3 — Abuse protection. APPROVED WITH CONDITIONS.** This is the package that
closes the High finding; the conditions are about making it real, not
decorative:
- **C-3.1 — Verify WAF rate-limit availability on the current Vercel plan
  before WP3 is marked done.** T3's fallback (durable Postgres counter) must be
  a committed contingency with an owner, not a footnote — honeypot +
  min-submit-time alone do **not** resolve F-1 against a scripted attacker.
- **C-3.2 — WAF rules must actually match server actions.** Server actions POST
  to the *page* URL (distinguished by the `Next-Action` header), so rules
  should target `POST` on the checkout/feedback/admin-login paths (all
  locales), with thresholds generous per SCALE's NAT warning. Add a test that
  the rule fires on scripted POSTs and does *not* fire on normal navigation.
- **C-3.3 — Blob client-upload token endpoint is a new trust boundary.** The
  token-minting handler (`handleUpload` route) MUST: require the admin session
  (same `requireAdmin()` gate) before issuing any token; pin
  `allowedContentTypes` to `image/jpeg`, `image/png`, `image/webp`; set
  `maximumSizeInBytes` to the 4 MB product limit; and pin the pathname to the
  validated `products/<slug>-<slot>-` prefix server-side (slug checked against
  the static catalog, slot from the literal set) so a token cannot write
  arbitrary blob paths. Tokens must be single-use/short-lived (library
  default — do not extend).
- **C-3.4 — Validate the recorded URL.** The server action that persists the
  uploaded image URL must verify host (`*.public.blob.vercel-storage.com`,
  ideally the project's own store id) and expected pathname prefix before
  writing it to the product row. Never store an arbitrary client-supplied URL.
  (Defense in depth: `next.config.ts` `remotePatterns` already constrains
  rendering — keep that too.)
- **C-3.5 — Architecture-consistency note.** §3 says "no API routes", but
  `@vercel/blob/client` requires a server endpoint for token exchange. Accept
  this explicitly as the *single* sanctioned route, admin-gated, so a future
  cleanup doesn't remove or generalize it. (If the current library/Next version
  supports doing the token exchange through a server action instead of a
  route, that is equally acceptable — the C-3.3 requirements are identical
  either way.)

**WP4 — Email & confirmation truth. APPROVED.** Escaping-before-key gate is the
correct ordering and is written into the WP gate. One explicitness request
(non-blocking): `escapeHtml` must cover **every** interpolation in
`buildReceiptHtml` — including admin-editable `item.name` and `orderNumber` —
not just the customer fields; and the never-throws invariant must survive the
`after()` move (the `after()` callback needs its own try/catch).

**WP5 — Data-model evolution. APPROVED WITH CONDITIONS.**
- **C-5.1 — Cancel/restock must be idempotent at the DB, not the app.** "Restore
  stock once" should be enforced by `cancelled_at` set-once semantics
  (`UPDATE … SET cancelled_at = now() WHERE … AND cancelled_at IS NULL`,
  restock only when that UPDATE reports a row) or an equivalent transition
  guard — otherwise a double-click or replayed admin action inflates
  inventory. Same set-once pattern for `deliveredAt` (already proposed —
  endorsed).
- **C-5.2 — Define legal status transitions** (at minimum: `cancelled` and
  `delivered` are terminal, or explicitly define un-cancel with a matching
  re-decrement). An unconstrained status flip is a stock-integrity hole even
  with an honest admin. Exposure is admin-only (behind WP1), so severity is
  low, but the constraint is cheap at schema time.

**WP6 — Platform modernization. APPROVED WITH CONDITIONS.**
- **C-6.1 — `createDevStore` prod guard (closes F-5).** The generic dev-store
  must refuse to activate (or at minimum log a loud warning) when
  `NODE_ENV === "production"` and `DATABASE_URL` is unset, so customer PII
  never lands in plaintext files on a shared/deployed host.
- **C-6.2 — `use cache` hygiene.** The migrated cached read must keep a
  user-input-free cache key (it has no arguments today — keep it that way),
  and `getStoreProductsFresh` must remain uncached for checkout pricing
  (already frozen in §2 — keep the existing tamper test as the regression
  guard). `revalidateTag("products")` triggered by unauthenticated
  `placeOrder` remains acceptable: an attacker can only *invalidate* (forcing
  a re-read of truthful data), never inject cache content.

**WP7 — Asset & delivery. APPROVED.** No security surface. (Immutable caching
applies to public assets only — nothing order- or admin-scoped is cached.)

**WP8 — Design-token layer. APPROVED.** No security surface.

**WP9 — A11y & RTL foundation. APPROVED.** No security surface.

**WP10 — Conversion rebuild. APPROVED.** Two notes, neither blocking: the
governorate `<select>` shrinks the free-text surface feeding the receipt email
(helps F-7); `?audience=` shop deep links must be validated against the enum
(men/women) server-side — React escaping already covers rendering, so this is
a one-line refine.

**WP11 — Verification net. APPROVED WITH CONDITIONS.**
- **C-11.1 — The security regression suite from Phase A must be named in the
  net**, not implied: price/total/paymentMethod tamper rejection; auth-denial
  of every admin page *and* action without a valid session; session
  revocation and distinct-cookie tests (post-WP1); rate-limit threshold tests
  (post-WP3); upload-token scope tests — wrong MIME, >4 MB, non-admin token
  request, foreign pathname (post-WP3); idempotency replay + wrong-payload
  replay (post-WP2); receipt markup-escaping test (post-WP4). Most already
  exist in my Phase A "Verification / Testing" section — adopt it wholesale
  into WP11's suite definition.

## New risks introduced by the proposal (summary)

1. **Blob client-upload token minting** (WP3/T4) — a new unauthenticated-facing
   endpoint if gating is forgotten; arbitrary-path or arbitrary-type uploads if
   token options are left default; stored-URL injection if the recorded URL is
   not validated. Covered by C-3.3/C-3.4/C-3.5. This is the largest *new*
   attack surface in the proposal.
2. **Idempotency-key replay oracle / key guessing** (WP2) — covered by
   C-2.1/C-2.2.
3. **Illusory throttling** (WP1/WP3) — in-memory counters on serverless, or WAF
   rules that miss server-action POSTs, would leave F-1 (and login brute force)
   nominally "fixed" but actually open. Covered by C-1.3/C-3.1/C-3.2.
4. **Admin stock inflation via repeated cancel/restock** (WP5) — covered by
   C-5.1/C-5.2.
5. **`use cache` migration** (WP6) — negligible new risk given no user-derived
   keys and the frozen uncached checkout path; C-6.2 pins it.
6. **Residual, accepted:** the T1 interim (decrement-without-order on insert
   failure) is an availability/integrity risk, not confidentiality; acceptable
   with C-2.4's drift stat until the gateway-milestone transaction lands.

## Security requirements to add before implementation

Consolidated, in the order the WPs land: C-1.1…C-1.4 (WP1), C-2.1…C-2.4 (WP2),
C-3.1…C-3.5 (WP3), C-5.1…C-5.2 (WP5), C-6.1…C-6.2 (WP6), C-11.1 (WP11), plus
the WP4 escaping-coverage note. No OBJECTION is recorded against any package:
every condition is implementable inside the proposed architecture without
changing its shape, dependencies, or rulings.
