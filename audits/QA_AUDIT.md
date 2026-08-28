# Executive Summary

Phase A static-analysis QA audit of the Lune storefront (Next.js 16 App Router, next-intl v4, Neon/Drizzle, cart in React context + localStorage). The live site is unreachable from this machine, so every finding below comes from code inspection plus local compile-level evidence: `npx tsc --noEmit` passes with zero errors and `npm run build` completes successfully (19 static pages, all expected routes present).

Overall the codebase is in good shape: server-side re-pricing is done correctly, stock is reserved with conditional decrements, email failure cannot fail an order, error/404 boundaries are unusually thorough (bilingual, dependency-free), and the motion layer has real reduced-motion and no-JS fallbacks. No crash-level (Critical) bug was found.

The most important issues found, in order:

1. **Admin sign-out very likely does not sign you out** — the auth cookie is set with `path: "/admin"` but deleted with the default path `/`, a path mismatch that leaves the cookie alive (QA-01, High).
2. **Duplicate-order windows**: a fast double-submit on checkout before React re-renders the disabled button, and a second browser tab whose cart is never synced/cleared after tab A orders — both can produce two real orders with two stock decrements (QA-02/QA-03, High/Medium).
3. **The customer can be charged a total they never saw** — the server silently re-prices with fresh data and never compares against the total displayed to the client (QA-04, Medium).
4. **Receipt email HTML injection** — customer-supplied name/city/address are interpolated unescaped into the branded email (QA-05, Medium, security overlap).
5. A cluster of RTL/i18n defects: query string lost on locale switch (order number vanishes from the confirmation URL), synthetic italic applied to Arabic poetry text, potential title/close-button overlap in the RTL cart drawer (QA-06/QA-07/QA-08).

11 further Medium/Low findings cover validation drift, a MAX_QTY bypass via duplicate slugs, reduced-motion gaps, unlabeled cart controls, order-number collision handling, timezone drift in admin filters, and misc UX edge cases. A full viewport/network/RTL test matrix for later manual execution is in **Verification / Testing**.

# Current State

- **Build health**: `npx tsc --noEmit` → clean. `npm run build` → exit 0; `/en`, `/ar`, shop, all 8 product pages and checkout prerender as SSG; confirmation, `[...rest]` and all `/admin` routes are dynamic; proxy (middleware) compiled.
- **Message catalogs**: `messages/en.json` and `messages/ar.json` have exactly matching key sets (verified by flattening both trees — zero missing keys either way).
- **Checkout flow** (`src/app/[locale]/checkout/actions.ts`): zod-validated, server-side re-pricing, `paymentMethod: "cod"` literal enforced, conditional stock decrement before order insert, best-effort `restoreStock` compensation, `revalidateTag("products", "max")` after success. `sendReceiptEmail` is written to never throw (verified in `src/lib/email/receipt.ts:145-172`), so the catch-block compensation cannot mis-fire on email failure.
- **Cart** (`src/components/cart/cart-context.tsx`): hydrates from localStorage once, drops unknown/sold-out slugs, clamps qty to `min(MAX_QTY_PER_ITEM, stock)`, re-clamps when fresh product data arrives. No cross-tab synchronization.
- **Error paths**: `error.tsx` (bilingual, intl-free), `global-error.tsx` (own `<html>`, inline styles), `[...rest]` catch-all → styled locale-aware `not-found.tsx`, plus dependency-free `global-not-found.tsx`. All well constructed.
- **Motion**: `MotionConfig reducedMotion="user"` provider; scroll/SVG timelines carry explicit `useReducedMotion` guards; `reveal-fallback` CSS force-reveals content at 2.5 s if JS never runs (verified in `globals.css:294-309`). One gap: the hero video (QA-12).
- **Admin**: per-page cookie gate (`isAdminAuthenticated`), all mutating actions re-check auth, uploads validated (type allowlist, 4 MB cap).

# Findings

Severity scale: **Critical** (data loss / money loss / site down) · **High** (wrong orders, broken auth) · **Medium** (customer-visible malfunction, a11y/RTL defect) · **Low** (edge case, polish).

---

### QA-01 — Admin "Sign out" almost certainly leaves the session alive (cookie path mismatch)

- **Severity**: High — NEEDS MANUAL REPRO (high confidence from code)
- **Files**: `src/app/admin/actions.ts:19-25` (set: `path: "/admin"`), `src/app/admin/actions.ts:30-34` (delete: `store.delete(ADMIN_COOKIE)` with no path)
- **Repro**: Log in at `/admin` → click "Sign out" → navigate back to `/admin`.
- **Expected**: Login form is shown; the `lune_admin` cookie is gone.
- **Actual (per spec)**: `cookies().delete(name)` emits an expiring `Set-Cookie` with `Path=/`. Browsers treat same-name cookies with different `Path` as distinct cookies, so the original `Path=/admin` cookie survives. `revalidatePath` makes the page re-render, and since the cookie is still sent, the admin stays authenticated. Sign-out appears to work only because of the render flash.
- **Fix**: Delete with matching attributes: `store.set(ADMIN_COOKIE, "", { path: "/admin", maxAge: 0, httpOnly: true, sameSite: "lax", secure: … })` — or set the cookie with `path: "/"` in the first place and keep a symmetric delete.

### QA-02 — Checkout double-submit window can create duplicate orders

- **Severity**: High — NEEDS MANUAL REPRO
- **Files**: `src/components/checkout/checkout-form.tsx:81-111` (submit handler), `:284-290` (button `disabled={isPending}`)
- **Repro**: Fill the form validly. Trigger submit twice within the same frame/tick — e.g. press Enter and click "Place order" nearly simultaneously, or double-click faster than the re-render that applies `disabled`.
- **Expected**: Exactly one order.
- **Actual (per code)**: The only double-submit guard is `disabled={isPending}`, which takes effect on the *next* render. Two `onSubmit` invocations before that render each call `placeOrder`, and the server has no idempotency: each call generates its own order number, decrements stock again, inserts a second row, and sends a second receipt. The customer is redirected to whichever confirmation resolves last; the store ships twice.
- **Fix**: (a) Client: a synchronous `useRef` submitting-flag checked at the top of `onSubmit`; (b) Server (real fix): accept a client-generated idempotency key (uuid stored in the form once) and enforce uniqueness on it, or dedupe identical payloads within a short window.

### QA-03 — No cross-tab cart sync; second tab can re-order a cleared cart

- **Severity**: Medium
- **File**: `src/components/cart/cart-context.tsx:45-70` — hydrates once, writes on change, never listens for `storage` events.
- **Repro**: Open the site in tabs A and B, add items in A (B was opened after and shares the persisted cart). Place the order in tab A (cart cleared, localStorage overwritten with `[]`). Switch to tab B — its in-memory cart still shows the items; submit checkout again.
- **Expected**: Tab B reflects the cleared/changed cart; at minimum the order isn't silently duplicable.
- **Actual**: Tab B's state is stale; a second, fully valid order is placed (server accepts it — stock allows it). Conversely, edits in two tabs overwrite each other last-write-wins, so items added in one tab vanish.
- **Fix**: Add a `window.addEventListener("storage", …)` handler that re-reads `lune-cart` when another tab writes it (re-running the same prune/clamp logic).

### QA-04 — Server silently charges a total the customer never saw

- **Severity**: Medium
- **Files**: `src/app/[locale]/checkout/actions.ts:64-81` (fresh re-pricing), `src/components/checkout/checkout-form.tsx:90-98` (payload has no expected total)
- **Repro**: Customer opens checkout while a product shows 35 JD. Admin raises the base price to 45 JD (or the sale window lapses). Customer submits.
- **Expected**: Order blocked or customer warned: "prices changed, please review."
- **Actual**: `placeOrder` re-prices from `getStoreProductsFresh()` and records the order at the *new* price. The confirmation shows only the order number; the customer learns the real total from the courier. Server-authoritative pricing is correct per rule 14 — but silent divergence from the displayed total is a trust/business bug.
- **Fix**: Include the client-computed `expectedTotal` in the payload; if it differs from the server total, return a new `error: "priceChanged"` and `router.refresh()` so the UI re-renders with fresh prices. The server total remains authoritative — the client value is used only for the equality check.

### QA-05 — HTML injection into the receipt email (unescaped customer input)

- **Severity**: Medium (security overlap — flag to Security agent)
- **File**: `src/lib/email/receipt.ts:129` — `${order.customerName} — ${order.city}, ${order.address}` interpolated raw into HTML (name ≤120 chars, address ≤300 chars, no character restrictions).
- **Repro**: Place an order with address `<a href="https://evil.example">Click to reschedule delivery</a>` and any recipient email you control.
- **Expected**: Angle brackets rendered as text.
- **Actual**: Markup renders inside Lune's branded, legitimately-sent email — a phishing primitive that lets anyone send styled content from the store's sender identity to an arbitrary address (also affects any future admin order-detail view that renders these fields as HTML).
- **Fix**: HTML-escape `customerName`, `city`, `address` (and `item.name` defensively) in `buildReceiptHtml`.

### QA-06 — Locale switch drops the query string; order number vanishes from confirmation

- **Severity**: Medium
- **File**: `src/components/layout/locale-switcher.tsx:18` — `router.replace(pathname, { locale: other })`; `usePathname()` from `@/i18n/navigation` excludes search params.
- **Repro**: Place an order → land on `/en/confirmation?order=L-XXXXXX` → click the language switcher.
- **Expected**: `/ar/confirmation?order=L-XXXXXX` — order number still visible.
- **Actual**: Navigates to `/ar/confirmation`; the `order` param is discarded, and the customer's only record of the order number (emails are currently log-only — no `RESEND_API_KEY`) disappears from the success screen.
- **Fix**: `router.replace(pathname + (searchParams.size ? \`?\${searchParams}\` : ""), { locale: other })` using `useSearchParams()`.

### QA-07 — Synthetic italic applied to Arabic text despite documented prohibition

- **Severity**: Medium (RTL visual)
- **Files**: `src/components/product/product-card.tsx:61-63` and `src/app/[locale]/product/[slug]/page.tsx:74` — `font-display … italic` on `product.poetry[locale]`; no `[dir="rtl"] { font-style: normal }` reset anywhere in `src/app/globals.css` (grep for `font-style` returns nothing).
- **Repro**: Open `/ar/shop` or `/ar/product/apollo` and inspect the poetry line.
- **Expected**: Per the project's own design rule ("italic is English-only; synthetic italic distorts Arabic"), Arabic poetry renders upright in Amiri.
- **Actual**: The `.italic` utility applies `font-style: italic` unconditionally; Amiri has no italic face, so the browser obliques the glyphs — precisely the distortion the design doc forbids.
- **Fix**: Add `[dir="rtl"] .italic { font-style: normal; }` to globals (or conditionally apply the class only for `locale === "en"`).

### QA-08 — RTL cart drawer: title likely collides with the physical-right close button

- **Severity**: Medium — NEEDS MANUAL REPRO
- **Files**: `src/components/ui/sheet.tsx:68` (close button hardcoded `absolute top-3 right-3`), `src/components/cart/cart-drawer.tsx:42` (`SheetHeader` has only `px-6 py-5`)
- **Repro**: Open the cart drawer on `/ar` (drawer opens from the right; title "سلة التسوق" starts at the physical right edge).
- **Expected**: Title and close button never overlap.
- **Actual (per code)**: Title text begins 24 px from the right edge while the close button occupies roughly the 12–44 px band from that same edge → overlap. The feedback sheet self-patches with `pr-12` (`feedback-widget.tsx:92`) but the cart drawer does not.
- **Fix**: Add matching end-padding to the cart drawer header, or better, change the sheet close button to logical `end-3` (verify it then lands on the intended side per design in both directions).

### QA-09 — Client/server validation drift: server-only max-lengths yield a generic error

- **Severity**: Low-Medium
- **Files**: `src/components/checkout/checkout-form.tsx:66-79` (checks only minima + regexes), `src/app/[locale]/checkout/actions.ts:23-28` (also enforces `NAME_MAX` 120 / `EMAIL_MAX` 200 / `CITY_MAX` 80 / `ADDRESS_MAX` 300)
- **Repro**: Enter a 350-character address (plausible for a detailed Jordanian address + landmarks), submit.
- **Expected**: Field-level error under Address.
- **Actual**: Client validation passes; server returns `error: "validation"`, which the form's `else` branch maps to `setServerError("server")` → the generic "something went wrong" banner with no hint about which field or why. Note `result.error === "validation"` is never handled distinctly (`checkout-form.tsx:100-109`).
- **Fix**: Mirror the max-lengths in the client validator (constants are already shared) and/or add `maxLength` attributes; handle the `"validation"` result distinctly from `"server"`.

### QA-10 — Duplicate slugs in the items payload bypass MAX_QTY_PER_ITEM

- **Severity**: Low-Medium
- **File**: `src/app/[locale]/checkout/actions.ts:31-39` — items schema caps `qty ≤ 20` per entry and ≤ 10 entries, but does not require unique slugs.
- **Repro**: POST the server action directly with `items: [{slug:"apollo",qty:20} × 10]`.
- **Expected**: Rejected — the documented per-item cap is 20.
- **Actual**: Validates; each entry decrements stock independently (stock ≥ qty holds per step), producing one order for 200 units of one product. Pricing is still correct, so impact is business-rule bypass / stock drain, not money loss.
- **Fix**: `.refine(items => new Set(items.map(i => i.slug)).size === items.length)` on the array (or merge duplicates then re-check the cap).

### QA-11 — Order-number collision fails the whole order instead of retrying

- **Severity**: Low
- **Files**: `src/app/[locale]/checkout/actions.ts:48-55` (random `L-` + 6 chars, alphabet of 31), `src/lib/db/schema.ts:13` (`order_number` UNIQUE)
- **Repro**: Statistical — a collision on insert (birthday-paradox odds grow with order count; ~1 in 887M per pair).
- **Expected**: Regenerate and retry.
- **Actual**: `createOrder` throws on the unique violation → caught → stock restored → customer sees a generic server error for a transient, self-healing condition.
- **Fix**: On unique-violation, loop with a fresh `generateOrderNumber()` (2–3 attempts) before failing.

### QA-12 — Hero video ignores `prefers-reduced-motion` (rule 18)

- **Severity**: Medium (a11y)
- **File**: `src/components/home/hero-media.tsx:35-48` — `<video autoPlay …>` mounted on idle with no reduced-motion (or `saveData`) check.
- **Repro**: Enable "reduce motion" at the OS level; load the home page.
- **Expected**: The still marble image only; no auto-playing video (the rest of the site correctly suppresses motion via `MotionConfig` and explicit guards).
- **Actual**: The 3.8 MB video mounts, autoplays and crossfades regardless.
- **Fix**: Skip mounting when `matchMedia("(prefers-reduced-motion: reduce)").matches` (and ideally when `navigator.connection?.saveData`).

### QA-13 — Cart drawer quantity controls: no accessible names, silent clamp at stock limit

- **Severity**: Medium (a11y) + Low (UX)
- **File**: `src/components/cart/cart-drawer.tsx:100-135`
- **Details**:
  - The − and + buttons contain only `aria-hidden`-less icon glyphs and have **no `aria-label`**; the `aria-label={t("quantity")}` sits on the wrapping non-interactive `div` (invalid use — labels on a `div` without a role are ignored). Screen-reader users hear unnamed buttons.
  - When qty reaches `min(MAX_QTY_PER_ITEM, stock)`, "+" silently does nothing (`setQty` clamps in `cart-context.tsx:114-126`) — no disabled state, no "only N left" hint. Same silent no-op on `addItem` at the limit.
- **Expected**: Buttons named "Increase/Decrease quantity"; visual+programmatic disabled state at the limit.
- **Fix**: `aria-label` per button (add keys to both catalogs); `disabled={item.qty >= maxQty}` on "+"; consider a stock hint.

### QA-14 — Add-to-cart swallows rapid repeat clicks for 1.4 s

- **Severity**: Low — NEEDS MANUAL REPRO
- **File**: `src/components/product/add-to-cart-button.tsx:50-57` — `if (added) return;` then a 1.4 s timeout.
- **Repro**: On a product page click "Add to cart" twice quickly, then open the cart.
- **Expected**: Either qty 2, or a clearly disabled button during the confirmation state.
- **Actual**: The second click is silently discarded while the "Added" checkmark plays; the button looks fully active. Users wanting 2 items get 1 with no feedback.
- **Fix**: Let repeat clicks call `addItem` anyway (restart the timeout), or visually disable during the added state.

### QA-15 — Sold-out checkout result: items vanish from the cart without an itemized explanation

- **Severity**: Low
- **Files**: `src/components/checkout/checkout-form.tsx:103-107`, `src/components/cart/cart-context.tsx:74-83`
- **Repro**: Have 2 different items in the cart; another customer takes the last stock of one; submit.
- **Expected**: "Apollo is sold out and was removed" (or clamped-qty notice), then an easy re-submit.
- **Actual**: Generic `errSoldOut` banner + `router.refresh()`; the pruning effect silently deletes/clamps items. Which item changed — and the fact that the total just changed — is never stated. A qty *clamp* (still in stock but less than requested) shows the same "sold out" message, which is wrong wording, and the same applies on plain page load with a stale cart (no message at all).
- **Fix**: Return `soldOut: string[]` (the action already computes it in `decrementStock`) to the client and name the affected items; distinguish "removed" from "quantity reduced".

### QA-16 — Confirmation page renders full success UI for any/no `order` param

- **Severity**: Low
- **Files**: `src/app/[locale]/confirmation/page.tsx:25-31`, `src/components/confirmation/confirmation-reveal.tsx:96-105`
- **Repro**: Visit `/en/confirmation` directly, or `/en/confirmation?order=<2000 junk chars>`.
- **Expected**: Redirect home or a neutral "no order found" state; reflected param bounded.
- **Actual**: The celebratory page ("thank you", "check your email") renders with no order validation; arbitrary text is reflected inside the order-number box (React-escaped, so no XSS, but unbounded length breaks the layout and makes shareable fake-confirmation URLs). Refresh/back-forward otherwise behave correctly since the number lives in the URL.
- **Fix**: Validate the param shape (`/^L-[A-Z2-9]{6}$/`) and fall back to a neutral state; optionally verify existence server-side (dynamic route already).

### QA-17 — Admin order date filters compare in server timezone (UTC), not Amman

- **Severity**: Low
- **File**: `src/lib/orders.ts:109-127` — `new Date("yyyy-mm-ddT00:00:00")` parses in the server's local zone; on Vercel that's UTC while the business operates at UTC+3.
- **Repro**: Order placed 01:30 Amman on the 10th (22:30 UTC on the 9th); admin filters From=10th.
- **Expected**: Order included.
- **Actual**: Excluded — it belongs to the 9th in UTC. All night orders (00:00–03:00 Amman) land on the wrong filter day.
- **Fix**: Parse filter bounds with the Amman offset (`T00:00:00+03:00`), matching the `parseAmman` convention already used in `src/app/admin/products/actions.ts:30-35`.

### QA-18 — Admin `setOrderStatus` fails silently when the session has expired

- **Severity**: Low
- **Files**: `src/app/admin/actions.ts:36-44` (returns `void` on auth failure), `src/app/admin/_components/orders-table.tsx:31-53`
- **Repro**: Leave the orders page open >12 h (cookie maxAge) → click "Mark delivered".
- **Expected**: An error / redirect to login.
- **Actual**: Action returns without doing anything; spinner ends; the status pill stays unchanged with no explanation. (The products actions handle this correctly with an `UNAUTHORIZED` state — the pattern just wasn't applied here.)
- **Fix**: Return `AdminActionState` and surface it, mirroring `src/app/admin/products/actions.ts`.

### QA-19 — Shop filter uses `role="tablist"` without tab keyboard semantics

- **Severity**: Low (a11y)
- **File**: `src/components/product/shop-grid.tsx:30-61` — `role="tab"`/`aria-selected` but no `tabindex` roving, no arrow-key handling, no `tabpanel`.
- **Expected**: Either full tabs pattern or plain buttons with `aria-pressed`.
- **Actual**: Screen readers announce a tab widget whose keyboard contract is broken.
- **Fix**: Swap to `aria-pressed` toggle buttons (smallest change) — these are filters, not tabs.

### QA-20 — Resilience/security notes (overlap with other agents — listed for completeness, no dedicated repro)

- **Files**: `src/lib/admin-auth.ts`, `src/components/feedback/actions.ts`, `src/lib/products.ts:224-260`, `src/app/[locale]/[...rest]/page.tsx`
- (a) Admin login has no rate limiting and uses non-constant-time string comparison; the cookie token is a static unsalted hash of the password (valid forever until the password rotates). — Security agent's area.
- (b) Feedback endpoint has no rate limiting / honeypot → spam vector into the admin dashboard. — Security agent's area.
- (c) `decrementStock` on neon-http is non-transactional; the code documents and accepts this micro-race. Concur — acceptable at this scale; re-evaluate before adding a payment gateway.
- (d) A 404 inside the locale tree still renders the locale layout, which reads products (`layout.tsx:79`); with the DB down, 404s degrade into the error boundary. Consider a static fallback for the catalog read.
- (e) `PHONE_RE` (`^\+?[0-9\s-]{8,15}$`) accepts non-Jordanian numbers like `12345678`; fine if intentional (COD calls will catch it), but a `07…`/`+9627…` pattern would cut fake orders.

# Severity / Priority

| # | Finding | Severity | Area |
|---|---------|----------|------|
| QA-01 | Admin logout cookie path mismatch — session survives sign-out | High | Admin/auth |
| QA-02 | Double-submit window → duplicate orders (no idempotency) | High | Checkout |
| QA-03 | No cross-tab cart sync → stale carts, duplicate orders | Medium | Cart |
| QA-04 | Server re-price never checked against displayed total | Medium | Checkout |
| QA-05 | HTML injection in receipt email (unescaped fields) | Medium | Email/security |
| QA-06 | Locale switch drops query string (order number lost) | Medium | i18n/RTL |
| QA-07 | Synthetic italic on Arabic poetry text | Medium | RTL/design |
| QA-08 | RTL cart drawer title/close-button overlap | Medium* | RTL |
| QA-12 | Hero video ignores prefers-reduced-motion | Medium | A11y |
| QA-13 | Unlabeled qty buttons; silent clamp at stock limit | Medium | A11y/cart |
| QA-09 | Server-only max-lengths → generic error | Low-Med | Checkout |
| QA-10 | Duplicate slugs bypass MAX_QTY_PER_ITEM | Low-Med | Checkout |
| QA-11 | Order-number collision aborts order (no retry) | Low | Checkout |
| QA-14 | Rapid add-to-cart clicks swallowed for 1.4 s | Low | Product |
| QA-15 | Sold-out prune is silent / mislabeled for clamps | Low | Cart/checkout |
| QA-16 | Confirmation accepts any/no order param | Low | Confirmation |
| QA-17 | Admin date filters in UTC, not Amman | Low | Admin |
| QA-18 | setOrderStatus silent on expired session | Low | Admin |
| QA-19 | tablist role misuse in shop filter | Low | A11y |
| QA-20 | Rate limiting, timing-safe compare, 404 DB dependency, phone regex | Low/handoff | Cross-cutting |

\* = NEEDS MANUAL REPRO (QA-01, QA-02, QA-08, QA-14 primarily).

# Recommendations

Ordered for the rebuild (Phase A — report only; no code was changed):

1. **Fix auth/session bugs first** (QA-01): symmetric cookie set/delete. One-line class of fix, High impact.
2. **Make order placement idempotent** (QA-02, QA-11): client idempotency key + unique constraint, retry on order-number collision. This also neutralizes most of QA-03's damage.
3. **Add the `storage` listener to CartProvider** (QA-03) reusing the existing prune/clamp logic.
4. **Introduce `error: "priceChanged"`** in `placeOrder` with an `expectedTotal` equality check (QA-04) and handle `"validation"` distinctly in the form (QA-09).
5. **Escape all user-supplied strings in `buildReceiptHtml`** (QA-05) — do this before `RESEND_API_KEY` is ever set.
6. **RTL pass**: preserve search params in the locale switcher (QA-06), neutralize italics under `[dir="rtl"]` (QA-07), logical-position the sheet close button and pad the cart drawer header (QA-08).
7. **A11y pass**: labels + disabled states on qty controls (QA-13), reduced-motion guard on the hero video (QA-12), `aria-pressed` filters (QA-19).
8. Uniqueness refinement on checkout items (QA-10); itemized sold-out feedback using the `soldOut[]` the server already computes (QA-15); confirmation param validation (QA-16); Amman-offset date filters (QA-17); `AdminActionState` for `setOrderStatus` (QA-18).
9. Hand QA-20 (a)/(b) to the Security agent; keep (c) documented; consider (d)/(e) during the rebuild.

Nothing in this report requires deleting existing functionality; every fix is additive or corrective, and product data/pricing rules are untouched.

# Risks

- **Static-analysis limits**: QA-01, QA-02, QA-08 and QA-14 are code-derived predictions of runtime behavior (cookie semantics, React render timing, pixel overlap). Each is marked NEEDS MANUAL REPRO; treat severities as provisional until reproduced on the live site or `npm run dev`.
- **Framework drift**: Next.js 16 behavior was checked against `node_modules/next/dist/docs` where it mattered (`revalidateTag(tag, "max")` profile form is current API; proxy convention is correct). Remaining assumptions about `cookies().delete` default-path behavior follow the current Next/RFC 6265 semantics — verify during repro.
- **Duplicate-order risk is live today**: QA-02/QA-03 can be triggered by ordinary customers (impatient double-clicks, two tabs). With COD, the cost is wasted courier runs rather than charged money — but it erodes the tiny operation's trust and stock accuracy.
- **Email injection is dormant, not absent**: QA-05 has zero impact while emails are log-only, and becomes exploitable the day `RESEND_API_KEY` lands. Fix before enabling.
- **Interaction with the rebuild**: fixes to `sheet.tsx` (QA-08) and motion primitives touch the Design/Motion agents' areas — coordinate before changing shared components (global rule 2).

# Verification / Testing

Compile-level evidence already gathered (this machine): `npx tsc --noEmit` → 0 errors · `npm run build` → exit 0, 19/19 static pages · en/ar catalog keys identical.

## Manual test matrix (execute on the live site or `npm run dev`; every cell in BOTH `en` LTR and `ar` RTL)

### Viewports

| Check ↓ / Width → | 320 | 360 | 375 | 390 | 430 | 768 | 1024 | 1280 | 1440 | 1920 |
|---|---|---|---|---|---|---|---|---|---|---|
| Home: hero legible, no horizontal scroll, video fades in (and NOT under reduced motion — QA-12) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Header: correct logo/menu/cart arrangement per breakpoint; badge doesn't clip | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Shop grid: 2-col cards don't truncate names/prices at narrow widths; filter pill animation | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Product page: gallery + thumbnails, purchase panel, "what's inside" list | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Cart drawer: title vs close button (QA-08), qty controls tappable (≥40px on touch), totals | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Checkout: 2-col → 1-col collapse, sticky summary (lg), field errors unfold | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Confirmation: moon animation, order number box with long numbers | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Feedback tab (≥sm only) + sheet; mobile menu feedback entry (<sm) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 404 + error pages styled, correct dir | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Admin (1024+; English-only): sidebar/topbar collapse, orders table horizontal scroll | — | — | — | — | — | ☐ | ☐ | ☐ | ☐ | ☐ |

### Network & lifecycle (each × en/ar)

- ☐ **Slow 3G**: first load shows content by ≤2.5 s even if JS stalls (reveal-fallback); hero video never blocks paint; images progressive.
- ☐ **Offline after load**: add to cart (works — local state); submit checkout → graceful `errGeneric`, no stuck spinner, form re-submittable.
- ☐ **Offline first load**: browser offline page only (no SW — expected).
- ☐ **Refresh**: cart persists on every page; checkout mid-fill refresh keeps cart (fields cleared — accepted); confirmation refresh keeps order number.
- ☐ **Direct URL access**: `/en/checkout` with empty cart → CartEmpty; `/en/confirmation` bare and with junk param (QA-16); `/en/product/unknown` → styled 404; `/en/xyz/abc` → styled 404; bare `/checkout` → locale redirect by proxy.
- ☐ **Back/forward**: after order, Back from confirmation → checkout shows empty-cart state, no resubmit prompt; forward returns to confirmation intact.
- ☐ **Empty cart**: drawer empty state; checkout empty state; badge hidden at 0.
- ☐ **Invalid input**: each checkout field at min-1 chars; bad email/phone; 121-char name & 350-char address (QA-09 — expect field error after fix); whitespace-only fields.
- ☐ **Duplicate clicks**: double-click Place order + Enter+click race (QA-02) → verify exactly one order in admin; double-click Add to cart (QA-14); double-click qty +/- rapidly (QA-03 clamps).
- ☐ **Rapid quantity changes**: spam +/− 20×; verify count/badge/totals settle consistent with localStorage; qty can't exceed min(20, stock) or drop below removal.
- ☐ **Multiple tabs**: add in tab A → check tab B badge (QA-03); order in A → attempt order in B (expect: blocked after fix); admin in two tabs → status toggle consistency.
- ☐ **Locale switch**: on every page incl. `/confirmation?order=…` (QA-06) and mid-checkout (form values survive? cart survives?); dir flips; drawers open from correct side.
- ☐ **Sold-out flows**: admin sets stock 0 → shop badge + grayscale, product page disabled button, cart item pruned on next data refresh, checkout with stale cart → sold-out error + prune messaging (QA-15); stock 1 vs cart qty 3 → clamp wording.
- ☐ **Sale windows**: sale starting/ending while page open (client `effectivePrice` at view time); price changed between page load and submit (QA-04).
- ☐ **Admin**: login wrong/right password; rate of attempts (QA-20a); sign out then revisit `/admin` (QA-01 — must show login); status toggle after cookie expiry (QA-18); order filters spanning midnight Amman (QA-17); image upload of 5 MB file / GIF (expect rejection).
- ☐ **Reduced motion**: OS-level reduce → no hero video autoplay (QA-12), no reveals/floats/parallax, moon renders final state, content never hidden.
- ☐ **Keyboard & SR**: tab through shop filters (QA-19), cart drawer controls announce names (QA-13), focus trapped in sheets, focus-visible rings present, `aria-live` cart updates announced.
