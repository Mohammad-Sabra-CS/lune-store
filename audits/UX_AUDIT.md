# Executive Summary

LUNE's storefront is visually coherent and technically disciplined: a strong "Wear the Night" identity, correct RTL mirroring, server-side re-pricing, honest stock handling, and restrained motion with reduced-motion support. The bones of a luxury experience are present.

The conversion story, however, is incomplete. The site sells a 35 JD cash-on-delivery purchase to a Jordanian, Instagram-driven, Arabic-first audience while withholding exactly the facts that audience needs to commit: **no delivery promise anywhere on the site** (the "within 2 days" line exists only in a receipt email that is currently never sent), **no COD signal before the checkout payment step**, **no WhatsApp or phone contact**, **no return/exchange policy**, and a **mandatory email field** in a market where many COD shoppers do not use email. The homepage's four "chapter" sections — the primary discovery surface — show no product image and no price, forcing a click to learn what is actually being sold. The confirmation page tells every customer "a receipt has been sent to your email," which is presently untrue.

Priority order for the rebuild: (1) surface COD + 2-day delivery + contact trust signals pre-purchase, (2) make the homepage chapters show the product and the price, (3) lower checkout friction (email optional, city select, WhatsApp), (4) fix the false receipt claim, (5) close smaller loops — post-add-to-cart path, product cross-links, error announcement accessibility.

# Current State

## Pages and flow (reconstructed from code)

- **Home** (`src/app/[locale]/page.tsx`): full-viewport dark hero (kicker, two-line title, subtitle, single CTA "Begin the Night" → `/shop`; marble still + idle-loaded video) → ivory "Four Phases of One Moon" section: four text-only chapter blocks (moon glyph, name, poetry line, "Discover" button → product page; no image, no price) → dark "One box. Three acts." ritual grid (EDP / Body Mist / Perfume Oil) → dark story section with "Shop the Collections" CTA.
- **Shop** (`shop/page.tsx` + `components/product/shop-grid.tsx`): centered title "The Collections", client-side filter tabs (All / For Him / For Her, not URL-persisted), 2-col mobile / 4-col desktop card grid. Cards (`product-card.tsx`): image with tilt hover, audience badge with moon glyph, name, poetry line, price with sale strikethrough, sold-out state (grayscale + badge).
- **Product** (`product/[slug]/page.tsx`): gallery (main 4:5 image + 3 thumbnails) beside name, poetry, 3-word character line, description paragraph, "Inside the Box" list (EDP 120/100ml, body mist, perfume oil), price + Add to Cart (`purchase-panel.tsx`, `add-to-cart-button.tsx`). Add does **not** open the drawer (deliberate; header badge confirms). No quantity selector, no delivery/payment info, no related products — the page dead-ends after the CTA.
- **Cart** (`cart-drawer.tsx`): Sheet from the start side (left in EN, right in AR), line items with thumbnail, character line, qty stepper (min 44px targets on mobile), remove, animated totals (subtotal / 3 JD delivery / total), Checkout button. Cart persists in localStorage; sold-out items are pruned and quantities clamped to stock on hydrate and refresh.
- **Checkout** (`checkout/page.tsx` + `checkout-form.tsx`): single-page form — name, email, phone (LTR inputs, `07X XXX XXXX` placeholder), city + street address (free text), payment (COD pre-selected; Visa/card rendered disabled with "Coming soon" badge), sticky order summary with Place Order. Client validation on submit only; server action (`checkout/actions.ts`) re-validates with zod, re-prices from fresh stock, decrements stock conditionally, and returns `soldOut` errors that prune the cart.
- **Confirmation** (`confirmation-reveal.tsx`): waxing-moon animation, "The night is yours", order number, "A receipt has been sent to your email", back-home button.
- **Global**: fixed header (Home / Shop / locale switcher / cart with count badge; mobile: hamburger + cart at start, logo at end), footer (motto, Home/Shop, "Amman, Jordan", Instagram link), feedback tab (right edge desktop; via mobile menu on phones), bilingual EN/AR with full RTL, custom 404/error pages.

## Business reality embedded in the code

4 packages (Apollo, Orion — men; Elysia, Aurora — women) at 35 JD (`PACKAGE_PRICE`), delivery 3 JD flat (`DELIVERY_FEE`), COD only (`z.literal("cod")`), max 20 per item, DB-driven stock and sale windows (`lib/pricing.ts`), delivery "within 2 days" stated **only** in `src/lib/email/receipt.ts` (lines 32/53) — and `RESEND_API_KEY` is unset, so that email currently logs instead of sending.

# Findings

Each finding: **[ID] Area — problem — evidence — shopper impact.**

## First impression & trust

- **[F1] No pre-purchase trust signals anywhere.** Nothing on home, shop, product, or cart mentions Cash on Delivery, the 2-day delivery promise, or the 3 JD flat fee (the fee first appears inside the cart totals). Evidence: the strings exist only in `checkout.cod` (payment step) and `receipt.ts` (post-purchase email). Impact: in the Jordanian COD market, "can I pay on delivery?" and "when will it arrive?" are the two questions that decide the purchase; the site answers both only after the shopper has already committed — most will not get that far.
- **[F2] Delivery promise is invisible.** "Your order will be delivered within 2 days" / "سيصل طلبك خلال يومين" exists solely in the receipt email — which is never sent (no `RESEND_API_KEY`). Impact: the store's strongest operational selling point is currently communicated to zero customers.
- **[F3] Confirmation page makes a false claim.** `confirmation.emailNote` — "A receipt has been sent to your email." — is shown unconditionally (`confirmation-reveal.tsx` line 107) while email sending is log-only. Impact: customers checking their inbox find nothing; for a COD brand still earning trust, a broken promise on the *success* screen is corrosive.
- **[F4] No human contact channel for a COD store.** Footer contact = "Amman, Jordan" + Instagram link only (`footer.tsx`). No phone, no WhatsApp — the default commerce channel in Jordan. Confirmation says "We will be in touch" but gives the shopper no way to reach the store about their order. Impact: hesitant COD buyers (and anyone with an order issue) have no path but Instagram DMs.
- **[F5] No policies at all.** No return/exchange policy, no shipping/coverage-area info (does 3 JD cover all governorates?), no terms or privacy pages, and no order-tracking use for the order number the customer is given. Impact: unanswered "what if the perfume isn't what I expected?" suppresses first-time COD orders; the order number is a souvenir, not a tool.

## Homepage & discovery

- **[F6] Chapter sections sell blind.** The four homepage chapters (`page.tsx` lines 98–168) render glyph + name + one poetry line + "Discover" — **no product image, no price, no character keywords**. Impact: the shopper's primary discovery surface asks for a click on a name and a metaphor; on mobile this is 4 long text-only scrolls (space-y-24/36) before anything purchasable is visible. Instagram visitors who came from a product photo see less on the site than they saw in the post.
- **[F7] Value proposition (3-piece set at 35 JD) is under-communicated at decision points.** The "EDP + mist + oil" bundle story lives in the hero subtitle and the ritual section, but shop cards and homepage chapters never say "3-piece set" and homepage never shows a price. Impact: 35 JD reads as a lot for "a perfume" and as excellent value for "parfum + mist + oil" — the framing that justifies the price is missing exactly where the price appears (cards) and where interest forms (home).
- **[F8] Orphaned "Our Story" nav item.** `nav.about` ("Our Story" / "قصتنا") exists in both message files but no about page or nav link exists. The brand-story content is a homepage section only. Impact: none today (unused key), but signals an intended page the rebuild should either ship or drop; a story page is a meaningful trust asset for a new local brand.
- **[F9] Shop filter state is not shareable or persistent.** `shop-grid.tsx` holds the All/Him/Her filter in `useState` only. Impact: no `/shop?audience=women` deep link for Instagram bio/ads ("For Her" campaigns), and the filter resets on back-navigation from a product. With 4 products this is minor today but becomes structural as the catalog grows.

## Product page

- **[F10] Highest-intent page has zero purchase-logistics info.** The product page shows composition and price but nothing about payment method, delivery time, delivery fee, or returns. Impact: the shopper must add to cart and reach checkout to discover COD exists — the reassurance arrives after the decision point instead of feeding it.
- **[F11] Post-add dead end.** After "Add to Cart," the button flips to "Added" for 1.4s and the header badge ticks up; the drawer stays closed (documented decision in `add-to-cart-button.tsx`) and no "View cart / Checkout" affordance appears. The page below the CTA simply ends — no other-chapters cross-links. Impact: the not-auto-opening drawer is a defensible luxury choice, but combined with no inline next-step and no cross-sell, the shopper is left to invent the path to checkout; on mobile the cart icon is a small top-corner target they may not have registered.
- **[F12] Thin, partially shared product imagery.** Galleries reuse generic set shots: Apollo and Orion share `set-men.jpg` + `bottle-men.jpg`; Aurora's gallery includes `hero-marble.jpg`, the site-wide hero image (`data/products.ts` line 99). Impact: for a scent that can't be smelled online, near-identical photo sets across "different" 35 JD packages undermine differentiation and the perception of four distinct compositions. (Product info beyond the 3-word character line is intentionally sparse — do not fabricate notes; keep the fields editable per the admin products system.)

## Cart & checkout

- **[F13] Mandatory email in a COD market.** `checkout-validation.ts` + zod require a valid email; many Jordanian COD shoppers are phone/WhatsApp-first and either lack or won't share email. The only email benefit today is a receipt that isn't sent (F3). Impact: a hard validation wall on the one field least relevant to fulfilling a COD order — a classic silent-abandonment point.
- **[F14] Free-text city field.** City is an unconstrained input. Impact: typos and Arabic/English variants ("عمان", "Amman", "amman") complicate fulfillment, block any future per-governorate delivery pricing/ETA, and make the shopper type what a 12-option select could offer in one tap.
- **[F15] Errors surface only on submit, without screen-reader announcement.** Validation runs in `onSubmit`; `FieldError` renders plain `<p>` with no `aria-live`, inputs get no `aria-invalid`/`aria-describedby`, and focus is not moved to the first invalid field. Name/city/address all share the generic "This field is required." Impact: sighted users must hunt for small red text after scrolling to the bottom button; screen-reader users hear nothing at all.
- **[F16] Checkout summary is read-only and delivery expectations are absent.** No qty edit/remove at checkout (must reopen the drawer), and nothing at checkout or on the confirmation page states the 2-day delivery window or that the store will call to confirm — the confirmation's "we will be in touch" is the only hint. Impact: minor friction plus a missed moment to set the COD expectation ("we'll call you to confirm — delivery within 2 days, pay 38 JD cash").
- **[F17] Desktop cart drawer opens opposite its trigger.** `cart-drawer.tsx` opens from the left in EN (`side={locale === "ar" ? "right" : "left"}`) while the desktop cart button sits at the header's end (right in LTR). Mobile is consistent (cart icon is at the start). Impact: on desktop the panel animates in from the far side of the screen relative to the click — a small spatial-model break from the near-universal end-side cart convention.

## Mobile

- **[F18] Mobile add-to-cart confirmation is easy to miss.** On phones the cart icon + badge sits top-start next to the hamburger while the thumb and eye are on the CTA at mid/bottom screen; the only confirmations are the 1.4s label swap and that distant badge. Compounds F11.
- **[F19] Mobile hero pushes the CTA low.** `order-first` places the 3:4 media block above the headline inside a `min-h-svh` hero, so kicker + two display lines + subtitle + CTA stack below it — on short viewports "Begin the Night" and possibly the subtitle sit at or below the fold. Impact: the first screen is beautiful but actionless.
- Positives worth preserving: 44px quantity targets (`h-10 w-10` on mobile), start/end logical properties throughout, drawer side flips for RTL, feedback reachable from the mobile menu, no horizontal-scroll risks observed.

## Accessibility & bilingual quality (UX-facing)

- **[F20] Filter tabs misuse the tab pattern.** `role="tab"`/`aria-selected` without a managed `tablist` (no arrow-key navigation, no `tabindex` roving) — should be a plain group of toggle buttons with `aria-pressed`, which matches actual behavior.
- **[F21] Quantity stepper buttons are unlabeled.** The +/− buttons in the cart drawer render only icons; `aria-label={t("quantity")}` sits on the wrapper `div`, not the buttons. Screen-reader output: "button, button."
- Positives: sold-out states are consistent end-to-end (card badge, disabled CTA, cart pruning, server `soldOut` error with cart refresh); Arabic copy is written, not machine-translated (e.g., product descriptions differ in voice per locale — Apollo's Arabic line even carries local humor); phone/email inputs correctly forced `dir="ltr"`; `noValidate` + custom messages keeps validation bilingual; sr-only live region for cart count exists; empty-cart states everywhere route back to shop.

# Severity / Priority

| ID | Finding | Severity | Priority |
|----|---------|----------|----------|
| F1 | No COD/delivery trust signals pre-checkout | Critical (conversion) | P0 |
| F3 | Confirmation falsely claims receipt email sent | Critical (trust) | P0 |
| F2 | 2-day delivery promise invisible | High | P0 |
| F4 | No phone/WhatsApp contact | High | P0 |
| F6 | Homepage chapters: no image, no price | High | P1 |
| F13 | Mandatory email at checkout | High | P1 |
| F5 | No return/shipping policy content | High | P1 |
| F10 | Product page lacks purchase-logistics info | High | P1 |
| F7 | 3-piece value prop missing at price points | Medium | P1 |
| F11/F18 | Post-add dead end; missable confirmation on mobile | Medium | P1 |
| F15 | Submit-only, unannounced validation errors | Medium (a11y) | P1 |
| F14 | Free-text city | Medium | P2 |
| F12 | Shared/generic gallery imagery | Medium (content task) | P2 |
| F16 | Read-only checkout summary; no ETA at checkout/confirmation | Medium | P2 |
| F19 | Mobile hero CTA below fold | Medium | P2 |
| F9 | Filter not URL-persisted | Low | P2 |
| F17 | Desktop drawer side vs trigger | Low | P3 |
| F20/F21 | Tab-role misuse; unlabeled steppers | Low (a11y hygiene) | P3 |
| F8 | Orphaned "Our Story" key | Low (decision needed) | P3 |

# Recommendations

Every recommendation names the surface, the change, the reason, and the expected shopper effect. All copy must be added to **both** `messages/en.json` and `messages/ar.json`; all layout must use logical properties for RTL.

## R1 — Trust strip, site-wide (fixes F1, F2) — P0
Add a slim reassurance row rendered on home (below hero or above footer), product page (under the Add to Cart panel), and cart drawer (above the Checkout button): three icon+label items — "Cash on Delivery" / "الدفع عند الاستلام", "Delivery within 2 days" / "توصيل خلال يومين", "Flat 3 JD delivery" / "توصيل بـ 3 د.أ" (source the fee from `DELIVERY_FEE`, never hardcode). Style it in the existing token language (gold-deep on ivory, gold on night). Reason: answers the two COD-market deal-breaker questions before commitment. Expected effect: fewer drop-offs between product view and checkout; the delivery promise finally does selling work. Note: confirm the 2-day promise with the owner before publishing it site-wide — it is currently an email-only claim.

## R2 — Truthful confirmation page (fixes F3, F16) — P0
In `confirmation-reveal.tsx` / `confirmation` messages: replace the unconditional "A receipt has been sent to your email" with copy that is true today — e.g., "We will call you to confirm your order — delivery within 2 days." / "سنتصل بك لتأكيد طلبك — التوصيل خلال يومين." Reinstate the email line only when `RESEND_API_KEY` ships (gate it on a server-passed flag, since the page is server-rendered and the action already knows whether sending occurred). Reason: never lie on the success screen. Expected effect: expectations set correctly; support DMs asking "where's my receipt?" avoided.

## R3 — WhatsApp/phone contact (fixes F4) — P0
Footer (`footer.tsx`) contact column and the confirmation page: add the store's WhatsApp number as a `wa.me` link (number must come from the owner — do not invent). On confirmation, offer "Questions about your order? Message us on WhatsApp" with the order number pre-fillable in the message text. Reason: WhatsApp is the trust channel for Jordanian COD commerce. Expected effect: hesitant buyers gain a human fallback; order-issue resolution moves off Instagram DMs.

## R4 — Homepage chapters show the product (fixes F6, F7) — P1
In `page.tsx` chapter blocks: add the package image (`product.image`, already available — the alternating flip layout has an empty half on `lg` to receive it), the character line (`product.character[locale]`, already themed wine/navy on the product page), and the price via `effectivePrice` (respects sales — reuse rather than printing `PACKAGE_PRICE`). Add a one-line "Eau de Parfum · Body Mist · Perfume Oil" set indicator (reuse `product.*` message keys). Keep the poetry and the Discover CTA. Reason: the discovery surface must show what is sold and what it costs. Expected effect: higher chapter→product click-through with qualified intent; fewer pogo-sticks back from the product page.

## R5 — Checkout friction pass (fixes F13, F14, F15) — P1
`checkout-form.tsx`, `checkout-validation.ts`, `checkout/actions.ts`, both message files:
- Make **email optional** (label "(optional)"; accept empty string server-side, keep format check when present; skip receipt email when absent). Phone remains the required contact.
- Replace the free-text **city** input with a select of the 12 Jordanian governorates (bilingual labels; store a stable key). Server-side: validate against the same list.
- Announce errors: `aria-invalid` + `aria-describedby` on failing inputs, `role="alert"` (or `aria-live="assertive"`) on `FieldError` and the server-error banner, and move focus to the first invalid field on failed submit.
Reason: each field of friction on a COD form is measurable abandonment; a11y errors are silent abandonment for assistive-tech users. Expected effect: faster completion, cleaner fulfillment data, WCAG-conformant error handling.

## R6 — Post-add next step (fixes F11, F18) — P1
In `add-to-cart-button.tsx` (or `purchase-panel.tsx`): after a successful add, render a quiet inline confirmation row beneath the CTA — "In your cart — View cart / Checkout" (links: open drawer via `cart.openCart()`, and `/checkout`). Keep the no-auto-open drawer decision (documented in-code) — this adds a path without hijacking the shopper. Also add a "The other phases" strip of the remaining 3 `ProductCard`s at the page bottom. Reason: the product page currently ends after the CTA with no forward path. Expected effect: shorter add→checkout time on mobile; cross-package discovery for the 4-item catalog.

## R7 — Delivery & returns content page (fixes F5, F10 partially, F8) — P1
Create one lightweight bilingual info page (e.g. `/[locale]/delivery` or fold into an "Our Story" page, resolving the orphaned `nav.about` key either way) covering: COD process (order → confirmation call → 2-day delivery → pay 38 JD cash), coverage area, and the return/exchange policy **as defined by the owner — the policy content must come from the business, not be invented**. Link it from the footer and from the product-page trust strip (R1). Reason: policy pages are the trust floor for first-time COD purchases. Expected effect: removes the "what if?" objection; gives ads/DMs a link to answer logistics questions.

## R8 — Small structural fixes — P2/P3
- **Shop filter → URL** (`shop-grid.tsx` + `shop/page.tsx`): drive the filter from a `?audience=` search param (shallow routing) so Instagram can link to For Her/For Him and back-navigation preserves state (F9).
- **Checkout ETA line** (R1's strip or a one-liner under Place Order): "We'll call to confirm — delivery within 2 days" (F16).
- **Desktop drawer side** (`cart-drawer.tsx`): open from the end side (right in LTR, left in RTL) to match the desktop trigger position; verify against the mobile-trigger-at-start tradeoff before changing — pick one consistent model (F17).
- **Filter tab semantics** (`shop-grid.tsx`): drop `role="tab"`/`aria-selected` for `aria-pressed` toggle buttons (F20).
- **Stepper labels** (`cart-drawer.tsx`): `aria-label` on the +/− buttons ("Increase quantity", "Decrease quantity", bilingual) (F21).
- **Mobile hero**: on short viewports let the headline+CTA lead (drop `order-first` below a height/width breakpoint, or reduce the media block's mobile height) so "Begin the Night" is on the first screen (F19).
- **Photography brief** (content, not code): per-package gallery shots to replace the shared `set-men.jpg`/`set-women.jpg`/`hero-marble.jpg` reuse; keep slots editable via the existing admin image uploader (F12).

## Recommended user journey (target state)

1. **Arrive** (Instagram → home or deep link `/shop?audience=women`): hero states brand + "3-piece set" value; trust strip answers COD + 2-day immediately.
2. **Discover** (home chapters or shop grid): image, name, character, price, set contents visible without a click; filter shareable.
3. **Evaluate** (product page): gallery, poetry, character, description, Inside the Box, price, trust strip, Add to Cart; other phases below.
4. **Add**: quiet inline "View cart / Checkout" appears; badge ticks; shopper stays in control.
5. **Cart** (drawer): edit quantities, see 3 JD delivery and total, trust strip, Checkout.
6. **Checkout** (one page, kept): name, phone, optional email, governorate select, address, COD pre-selected, summary with "we'll call to confirm — 2 days" line, Place Order.
7. **Confirm**: moon reveal, order number, truthful next-steps copy, WhatsApp link, back home.

## Page structures (target)

- **Homepage**: Hero (value prop + CTA) → trust strip → four chapters (image + name + character + poetry + price + Discover) → ritual (keep) → story (keep, link to story/delivery page) → footer (with WhatsApp + policy links).
- **Shop**: title + subtitle → URL-driven filter → grid of 4 cards (add "3-piece set" microcopy line) → trust strip.
- **Product**: gallery | name/poetry/character/description → Inside the Box → price + Add to Cart + inline post-add actions → trust strip → other phases.
- **Checkout**: contact (phone-first) → delivery (governorate select + address) → payment (unchanged) → summary + ETA + Place Order.

# Risks

- **Business facts must be owner-confirmed before surfacing**: the 2-day promise site-wide, WhatsApp number, return policy, and delivery coverage. Publishing invented policy copy would be worse than the current silence. (Binding rule 4/6.)
- **Making email optional** removes the receipt-email path for those shoppers permanently; when Resend goes live, receipts will reach only customers who opted in. Mitigation: keep the field visible with "(optional) — for your receipt" framing.
- **Governorate select** constrains input; must include all 12 governorates and correct bilingual labels, and existing free-text orders in the DB remain as-is (display layer must tolerate both).
- **Auto-showing more on the homepage chapters** (image + price) lengthens an already-long page; keep the added elements inside the existing alternating layout rather than adding new sections, and verify LCP/CLS on mobile (performance is first-class).
- **Changing drawer side on desktop** while mobile trigger sits at the start could trade one inconsistency for another — prototype both before committing.
- **Trust strip repetition** risks visual noise on a minimal luxury design; one restrained component reused (not three bespoke banners), typographically consistent with the `.eyebrow` language.
- The chapters currently render from `getStoreProducts()` — any homepage price display must go through `effectivePrice` client- or request-time consistently with the product page, or sale windows will show stale prices on the static home.

# Verification / Testing

- **Copy audit**: grep both message files to confirm new keys exist in EN and AR and no user-facing string is hardcoded; render each page in `ar` and confirm RTL mirroring of the trust strip, select, and inline post-add row (logical properties only).
- **Trust visibility check**: from a cold visit, confirm COD + delivery time are visible on home, product, and cart **without scrolling past the primary CTA** at 390×844 (iPhone-class) and 1440×900.
- **Checkout flows**: (a) happy path with email empty → order succeeds, no receipt attempted; (b) invalid phone → error announced by screen reader (NVDA/VoiceOver), focus moves to field; (c) sold-out race → `soldOut` banner + cart pruned (existing behavior must not regress); (d) governorate select value arrives server-side and is rejected if tampered (rule 14/15).
- **Confirmation truthfulness**: with `RESEND_API_KEY` unset, the email line must not appear; with it set (staging), the line appears and the email arrives in the order's locale.
- **Filter deep link**: `/en/shop?audience=women` and `/ar/shop?audience=men` land pre-filtered; back from a product restores the filter.
- **Post-add**: after Add to Cart on mobile, the inline View cart/Checkout row is tappable (≥44px targets) and the drawer still does not auto-open.
- **Reduced motion**: all added elements static under `prefers-reduced-motion` (MotionConfig covers Motion components; any new CSS transitions need their own guard).
- **Performance**: Lighthouse mobile on home before/after R4 — LCP must not regress from adding chapter images (use `next/image` with proper `sizes`, no priority on below-fold images).
- **Regression**: `npm run build` clean; cart persistence, sold-out pruning, RTL drawer sides, and admin surfaces untouched.

# Phase D — UI System Consistency Check

Cross-check of this report against `DESIGN_SYSTEM.md`, `RESPONSIVE_A11Y_AUDIT.md`, and `ARCHITECTURE_REPORT.md` § "Phase B — Consolidated Target Architecture" (WP8–WP10, tension rulings T2/T6/T7/T9, owner-decision checklist).

## Verdict

**Consistent — no hard conflicts.** The three UI-facing reports triangulate rather than contradict: DESIGN supplies the tokens/components my journey needs, RESP supplies the a11y mechanics for the same defects (its A-1 = my F15, A-7 = F20, A-4 = F21, R-2 = F17, C-2 = the sold-out legibility concern behind F-series), and Phase B's rulings resolve the two places where reports genuinely diverged (T2, T6) in ways I endorse. Remaining issues are coverage gaps and one gating error, listed below.

## Design-system coverage of the recommended journey

| Journey element (this report) | Design-system coverage | Status |
|---|---|---|
| Trust strip (R1) | Tokens + `.label-caps` (RTL-safe tracking) + champagne-on-dark / champagne-700-on-light rules cover it, but **no component spec exists** — DESIGN §5 specs buttons/cards/nav/states only; no icon guidance either (lucide `Banknote` is already the de-facto COD icon in checkout) | **Gap (minor)** — add a trust-strip spec to WP10's first screen: `.label-caps` labels, lucide or moon-phase glyph icons, elevation-0, both-surface variants |
| Contact channel / WhatsApp (R3) | Footer link style §5.5; a confirmation-page WhatsApp CTA maps to `luxe-outline` §5.1 | Covered |
| Post-add path (R6) | State table §5.7 has loading/error/empty but **no post-action inline-confirmation pattern**; RESP A-2's persistent live region (WP9) is the announcement half of the same fix — the visible row and the live region must ship as one interaction | **Gap (minor)** — spec the row (44px targets per DESIGN F5; "View cart" is a `button` opening the drawer, not a link); entrance animation must respect reduced motion per §6 |
| Checkout error states (R5) | Fully specified: §5.2 error spec (`aria-invalid` → `border-destructive`, `aria-describedby`, `#9d2f2f` at 6.52:1) = RESP A-1 = my F15. One alignment item: current `FieldError` uses `text-wine`; DESIGN canonizes `text-destructive` — migrate when WP9 touches the form | Covered |
| Stock / sold-out presentation | Fully specified: §5.4 badge + grayscale treatment, `text-taupe` status (fixes RESP C-2 / DESIGN F3), disabled-CTA spec §5.1; QA's itemized-soldOut feedback is in the Phase B target | Covered |
| Governorate select (R5) | `ui/select` exists but §5.2's h-12 storefront sizing names inputs only, and RESP R-3 shows select still has **physical properties** (`pr-8`, chevron `right-2`) — it has never been used in RTL | **Sequencing dependency** — WP9's logical-properties pass on `ui/select` (+ extending the storefront size treatment to Select) is a hard prerequisite for WP10's checkout friction item; WP order already puts WP9 first, but the dependency should be explicit |
| Homepage chapters w/ image+price (R4) | Product imagery specs are dark-surface (`bg-obsidian`, `elevation-glow` is dark-only §4); chapters sit on ivory — no light-surface imagery spec. Pricing: Phase B freezes client-side sale-window evaluation, which matches my R4 requirement (render chapter price in a client leaf via `effectivePrice`, as `PurchasePanel` does) | Covered, one **gap (minor)**: define chapter-image treatment on ivory (borders/scrim) when WP10 reaches the home screen |

## Conflict checks requested

- **Drawer side (T6 vs my F17/R8):** aligned — I flagged it as "prototype both / pick one model"; T6's ruling (recommend end-side, owner decides, bundle with RESP A-5's close-button fix, record in CLAUDE.md) is exactly right. No change requested.
- **CTA prominence vs reduced motion:** no conflict. My CTA recommendations are static-layout (fold position, inline row, 44px targets); DESIGN's `luxe`/`xl` button (48px) satisfies them, and its only motion (tap-scale) is spring-guarded. My F19 mobile-hero reorder is a layout change, not motion — RESP V-4 found no hero defect and none of my changes touch `svh` behavior.
- **Arabic tracking vs my typography suggestions:** no conflict — this report proposed no new tracked text; every new label I recommend (trust strip, set-contents line, post-add row) must use `.label-caps`/eyebrow utilities, which carry the ≤0.12em RTL reset that fixes RESP R-1. My R1 wording "typographically consistent with the `.eyebrow` language" should be read as *binding* use of those utilities, never inline `tracking-[…]`.
- **Confirmation mechanism (T2 vs my R2):** my "server-passed flag" suggestion is **superseded** by T2's better ruling (SSG + client param-shape validation + non-sensitive `&receipt=1`). Intent (truthful copy) fully preserved; treat R2's mechanism as amended.
- **Email optional (T9 vs my R5):** adopted as written, including the "(optional) — for your receipt" framing and skip-send guard. Consistent.
- **Token renames (T7):** none of my recommendations depend on old or new class names; the alias layer means WP10 screens can be built directly in canonical tokens. No conflict.

## Phase B order — gating errors and omissions

1. **WP10's blanket gate over-blocks (the one real error).** WP10 is marked "blocked on owner-decision list," but only *part* of its contents appear on that list. **Not owner-blocked and should proceed:** chapters w/ image+price (all inputs exist in code), checkout friction pass (email-optional is already ruled in T9; the 12 governorates are public administrative fact, not a business rule), post-add path, `?audience=` deep links, mobile hero CTA, the COD and 3 JD-fee trust-strip items (both are shipped code facts — `checkout.cod`, `DELIVERY_FEE`), and the "EDP · Mist · Oil" set-contents microcopy (existing `product.*` message keys). **Genuinely owner-blocked:** the 2-day promise as site-wide copy, WhatsApp number, return/exchange policy text, delivery coverage-area claims, drawer side, "Our Story" fate. Recommend splitting WP10 → WP10a (unblocked, can start with WP8/WP9 outputs) and WP10b (owner-gated) so the owner checklist doesn't stall the majority of the conversion work.
2. **Owner checklist omission: per-package photography (my F12).** Replacing the shared `set-men.jpg`/`set-women.jpg`/`hero-marble.jpg` gallery shots requires owner-supplied assets — it appears in no WP and not on the checklist. Add it to the owner-decision list (asset request, not a decision per se); the admin image uploader already provides the ingestion path.
3. **Minor wording nuance for the trust strip:** the fee line must present the fee as charged today ("Delivery 3 JD" from `DELIVERY_FEE`) without implying nationwide coverage — coverage claims stay behind the owner's coverage-area answer. This lets the strip ship in WP10a with two items (COD + fee) and gain the 2-day line in WP10b.
4. Everything else in my recommended journey is correctly placed: R2→WP4, F15/F20/F21 mechanics→WP9, R1/R4/R5/R6/R7/R8→WP10, contrast/typography foundations→WP8. Nothing from the journey is missing from the plan once the three items above are addressed.
