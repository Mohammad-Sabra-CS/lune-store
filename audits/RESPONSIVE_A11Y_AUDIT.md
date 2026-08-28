# Executive Summary

Phase A code-level audit of the LUNE storefront (Next.js 16 / Tailwind v4 / next-intl, EN LTR + AR RTL) covering responsive behavior 320px→4K, overflow, touch targets, keyboard/focus, contrast, semantics, screen-reader behavior, RTL, and reduced motion. The live site is unreachable from this machine (TLS interception), so all findings are static-analysis of Tailwind classes, ARIA attributes, `globals.css`, and component structure.

Overall the foundation is unusually strong: logical properties (`start`/`end`, `ms-*`, `-end-0.5`) are used consistently in store components, `[dir="rtl"]` line-height/font-size compensation exists, a base-layer `:focus-visible` rule covers links/buttons/inputs, a no-JS reveal fallback exists, and reduced-motion is respected at three layers (CSS kill-switch, `MotionConfig reducedMotion="user"`, explicit `useReducedMotion` guards on scroll/SVG timelines).

The serious gaps are concentrated in **screen-reader interaction paths**: checkout validation errors are never announced or associated with their inputs (a blind user can fail checkout with no feedback), add-to-cart produces no announcement (the only cart live region lives inside the closed drawer and is unmounted), and two contrast rule violations (`text-gold` on light backgrounds) slipped past the documented `gold-deep` rule. On the RTL side, the biggest issue is heavy `tracking-[0.2–0.35em]` applied to translated Arabic strings at ~15 call sites — the `.eyebrow` RTL override exists but inline tracking utilities bypass it, visually breaking joined Arabic script.

Total: **24 findings** — 2 Critical, 6 High, 10 Medium, 6 Low. No finding requires deleting functionality; all are additive fixes. The site correctly uses a single responsive layout (no separate mobile site), and that must remain the strategy.

# Current State

## What exists and works (do not regress in the rebuild)

| Area | Evidence |
|---|---|
| Locale plumbing | `src/app/[locale]/layout.tsx` sets `lang` + `dir` on `<html>` (L82–91); admin root sets `lang="en"` (`src/app/admin/layout.tsx` L24) |
| Logical properties | Store components use `start`/`end`, `ms-*`, `me-*`, `-end-0.5` (header badge, product-card sale badge, footer). Physical `left/right` survives only in shadcn `src/components/ui/*` (see Finding R-3) |
| RTL typography | `globals.css` L240–267: taller `[dir="rtl"]` display line-heights (Amiri clipping), Arabic `.eyebrow` size/tracking override, Arabic body-size bumps for `text-xs/sm/base/xl` |
| RTL motion | `useDir()` in `src/components/motion/primitives.tsx` L32–35; reveals prefer y/opacity/clip (direction-neutral); `LineReveal` has Arabic-safe clip padding (L140–145) |
| Focus | Base-layer `:focus-visible` outline for `a, button, input, [role="tab"]` (`globals.css` L158–165); shadcn Input/Textarea/Button carry their own `focus-visible:ring` |
| Cursor | Base-layer `cursor: pointer` fix for Tailwind v4 preflight (`globals.css` L153–157) |
| Reduced motion | CSS kill-switch (`globals.css` L337–348), `MotionConfig reducedMotion="user"` in locale layout, explicit `useReducedMotion` guards in `Parallax`, `Float`, `LineReveal`, `ClipReveal`, `Spotlight`, `TiltCard`, `AnimatedNumber`, `WaxingMoon`, `AddToCartButton` |
| Touch devices | `Spotlight`/`TiltCard` go inert without `(hover: hover) and (pointer: fine)` |
| Forms | `fieldset`/`legend` structure, `Label htmlFor`, `autocomplete` on name/email/phone/address, `dir="ltr"` on email/phone/order-number, `type="email"`/`type="tel"`, 16px input text on mobile (`text-base md:text-sm`) so iOS doesn't zoom |
| Images | `next/image` with `fill` + `sizes` everywhere; alt text present on product imagery; decorative SVGs `aria-hidden` |
| Overflow discipline | Sections use `overflow-hidden`; admin orders table wrapped in `overflow-x-auto` (`orders-table.tsx` L81) |
| No-JS | `reveal-fallback` / `clip-reveal-fallback` animations force content visible at 2.5s (`globals.css` L287–310) |
| Fluid type | `display-xl/lg/md/chapter` use `clamp()` (`globals.css` L221–237) — scales 320px→4K without breakpoint jumps |
| Viewport | Next default viewport meta (no `maximum-scale`, no `user-scalable=no`) — pinch zoom allowed |

## Layout inventory

- Containers: `max-w-6xl` (1152px) storefront, `max-w-4xl` checkout, `max-w-xl` confirmation.
- Breakpoints in use: Tailwind defaults only — `sm:` 640, `md:` 768 (rare), `lg:` 1024, plus `data-[side=*]` sheet variants. Header collapses below `sm`; shop grid `grid-cols-2 → lg:grid-cols-4`; product page `lg:grid-cols-2`; checkout `lg:grid-cols-[1.2fr_0.8fr]` with sticky summary; admin sidebar collapses below `lg`.
- Drawers: Base UI Sheet, `w-full`/`w-3/4` mobile, `sm:max-w-sm/md` desktop; side chosen per locale in `cart-drawer.tsx` L39, `mobile-menu.tsx` L64, `feedback-widget.tsx` L89.

# Findings

IDs: **A-x** accessibility, **C-x** contrast, **R-x** RTL/i18n, **V-x** responsive/viewport, **M-x** motion.

## Accessibility — screen readers, keyboard, semantics

**A-1 — Checkout validation errors are invisible to assistive technology.** `src/components/checkout/checkout-form.tsx`: `FieldError` (L33–49) renders plain `<motion.p>` with no `id`; inputs (L131, L139, L153, L177, L184) never receive `aria-invalid` or `aria-describedby`; on failed submit (L87) focus is not moved and nothing is announced (no `role="alert"`/live region). The server error banner (L266–278) also has no `role="alert"`. A screen-reader user who submits an incomplete form hears nothing and cannot find which field failed. All viewports, both locales. Expected after fix: each error `<p>` gets an `id`, its input gets `aria-invalid={true}` + `aria-describedby`, focus moves to the first invalid field on submit, and the server error carries `role="alert"`.

**A-2 — Add-to-cart is never announced; the cart live region is unmounted while the drawer is closed.** The only `aria-live` region is inside `SheetContent` (`src/components/cart/cart-drawer.tsx` L48–50); Base UI Dialog portals mount content on open, so when a user presses "Add to Cart" (`add-to-cart-button.tsx` L50–57 — deliberately no auto-open) the live region does not exist and the add is conveyed only visually (button swap + badge pulse). Expected after fix: a persistent `aria-live="polite"` region in the locale layout (outside the Sheet) announcing "Added — cart: N items"; the in-drawer region can then be removed.

**A-3 — Cart button accessible name omits the count.** `src/components/layout/header.tsx` L43 and L88: `aria-label={t("openCart")}` is static "Open cart"; the count badge (L47–57) is a bare number a SR reads as "Open cart" then possibly "3" with no context. Expected: `aria-label` interpolating the count (new message key, e.g. `openCartWithCount`), badge marked `aria-hidden`.

**A-4 — Quantity stepper: icon-only buttons unlabeled, invalid ARIA on wrapper.** `src/components/cart/cart-drawer.tsx`: `aria-label={t("quantity")}` sits on a plain `<div>` (L101–104) — `aria-label` on a generic div is ignored/invalid without a role; the −/+ buttons (L105–111, L127–134) have no accessible name at all (Lucide icons only), and the − button at qty 1 silently removes the item. Expected: wrapper `role="group"` + label, buttons get `aria-label` ("Decrease quantity"/"Increase quantity" message keys), and quantity changes announced via the A-2 live region.

**A-5 — Sheet's built-in close button is hardcoded English and physically positioned.** `src/components/ui/sheet.tsx` L62–77: `<span className="sr-only">Close</span>` (untranslated — read as "Close" to Arabic SR users) and `absolute top-3 right-3` (physical). It renders in the cart drawer and feedback sheet (neither passes `showCloseButton={false}`). In AR the drawer opens from the right and the title starts at the physical right — the close button sits on top of the title's start edge (crowding/overlap risk at `sm:max-w-md` and below). Same hardcoded "Close" in `src/components/ui/dialog.tsx` L68/75. Expected: localized label (accept a `closeLabel` prop or message), `end-3` instead of `right-3`.

**A-6 — Mobile-menu close button mislabeled.** `src/components/layout/mobile-menu.tsx` L80: `aria-label={t("menu")}` → "Menu"/"القائمة" on the X button — announces as if it opens a menu. Expected: a dedicated `closeMenu` message ("Close menu"/"إغلاق القائمة").

**A-7 — Shop filters misuse the tabs pattern.** `src/components/product/shop-grid.tsx` L30–49: `role="tablist"`/`role="tab"` + `aria-selected` without `tabpanel`, `aria-controls`, or roving-tabindex/arrow-key behavior — SRs announce "tab 1 of 3" and users expect arrow-key switching that doesn't exist. Expected: drop the tab roles; use plain buttons with `aria-pressed` (or a `radiogroup`), keeping the existing `[role="tab"]:focus-visible` CSS harmless. All viewports, both locales.

**A-8 — No skip link.** `src/app/[locale]/layout.tsx` L98–100: fixed header precedes `<main>` with no "skip to content" link, so keyboard users tab through menu/cart/logo/nav/locale on every page. Expected: visually-hidden-until-focused skip link targeting `<main id="main">`, translated in both locales.

**A-9 — Feedback widget: error/success not announced, required field unmarked.** `src/components/feedback/feedback-widget.tsx`: error `<p>` (L148–152) has no `role="alert"` and isn't associated with the textarea (no `aria-describedby`/`aria-invalid`); the message field is effectively required (L47) but not marked (`required`/`aria-required`, and the label doesn't say so while name/email say "optional"); the "thanks" success view (L101–106) replaces the form without moving focus or announcing. Expected: `role="alert"` on error, `aria-required` on the textarea, focus moved to the thanks heading on success.

**A-10 — Sale price semantics.** `src/components/product/product-card.tsx` L70–74 and `purchase-panel.tsx` L26–29 use `<s>` for the old price; most SRs don't convey strikethrough, so users hear two prices ("35 JD 28 JD") with no relationship. Expected: sr-only prefixes ("Original price:", "Current price:") via message keys. Low effort, both locales.

**A-11 — Admin spinners announce nothing.** `src/app/admin/_components/orders-table.tsx` L44–47 (and `form-bits.tsx`, `image-uploader.tsx`): `aria-label="Saving"` on a `<span>` with no role is not exposed. Expected: `role="status"` on the span (English-only admin is fine). Low.

## Contrast (tokens: gold `#c4a15e`, gold-deep `#7c6132`, night `#0b0e17`, ivory `#f6f2e9`, moon `#f4eedf`)

**C-1 — `text-gold` on a light background in checkout ("Coming soon" badge).** `src/components/checkout/checkout-form.tsx` L230–232: gold on the light `bg-card` computes ≈2.3:1, further degraded by the parent's `opacity-60` (L224). This violates the project's own documented rule (gold on ivory fails AA; use `gold-deep`). Affects both locales, all viewports, on the money path. Expected: `text-gold-deep` + `border-gold-deep/60` (and consider not inheriting the parent opacity for the badge), ≥4.5:1.

**C-2 — Sold-out status text fails AA.** `src/components/product/product-card.tsx` L64–67: `text-night/50` at `text-xs` on ivory ≈3.5:1 — this is status text, not a disabled control, so the disabled-exemption does not apply. Same tone on the disabled sold-out button (`add-to-cart-button.tsx` L27, technically exempt but barely legible). Expected: `text-night/70`+ (≥4.5:1) for the card status; darken the disabled button text for usability.

**C-3 — Struck-through original price ≈2.6:1.** `text-night/40` in `product-card.tsx` L71 and `purchase-panel.tsx` L27. Decorative-ish but it carries information (the discount). Expected: `text-night/55`+ reaches ~3:1 at the `text-xl` size in the purchase panel; the `text-sm` card instance needs ~4.5:1 → `text-night/60`.

**C-4 — Ritual card body copy borderline.** `src/app/[locale]/page.tsx` L206: `text-moon/50` on night ≈4.6:1 at `text-sm` — passes by a hair only after the hover state (`group-hover:text-moon/80`); on touch devices the resting state is what users read. Expected: rest at `text-moon/65`+. Low-risk polish.

**C-5 — Header over hero before scroll.** `header.tsx` L31–32: pre-scroll background is `from-night/70 to-transparent`; nav links `text-moon/80` sit over the animated aurora — normally fine (aurora stays dark) but worth a contrast spot-check at the brightest blob positions in Phase B browser testing. Informational.

## RTL / i18n

**R-1 — Letter-spacing applied to Arabic strings at ~15 call sites.** `globals.css` L249–254 fixes `.eyebrow` for RTL, but inline `tracking-[0.2em]`–`tracking-[0.35em]` utilities on **translated** text bypass it and visually fracture joined Arabic script. Affected (AR locale, all viewports): hero/story CTAs (`page.tsx` L62, L236), chapter CTA (L158), chapter kicker (L133), mobile-menu rows (`mobile-menu.tsx` L23 `tracking-[0.25em]`), cart title (`cart-drawer.tsx` L43), cart checkout button (L154), add-to-cart / sold-out buttons (`add-to-cart-button.tsx` L27, L49), checkout submit (`checkout-form.tsx` L287), "Coming soon" badge (L230), sale/sold-out badges (`product-card.tsx` L33/L38/L48/L65), confirmation order box + button (`confirmation-reveal.tsx` L98, L113), product audience kicker (`product/[slug]/page.tsx` L63). The feedback tab already does per-locale tracking (`feedback-widget.tsx` L81–83) — proof the team knows the issue; it just isn't systematic. Expected: a global `[dir="rtl"]` override (e.g. `[dir="rtl"] [class*="tracking-"] { letter-spacing: 0.02em }`) or a shared `.tracked` utility with an RTL reset, so Arabic renders with near-normal spacing while EN keeps the luxury tracking. Note: product names (Apollo/Orion/Elysia/Aurora) and "Lune" are Latin even in AR, and tracking on those is fine.

**R-2 — Cart drawer opens on the side opposite the cart icon.** `cart-drawer.tsx` L39: EN → `side="left"` while the desktop cart button sits at the inline end (right); AR → right, mirrored likewise. The mobile menu intentionally matches its trigger's side (`mobile-menu.tsx` L47–48 comment) — the cart does the opposite with no comment. Not a defect per se, but an inconsistency to confirm with the owner before the rebuild locks it in. If unintentional, expected: EN cart from the right, AR from the left (matching the icon), which also resolves the A-5 close-button collision differently.

**R-3 — Physical properties inside shared shadcn primitives.** `ui/sheet.tsx` L56 (`left-0/right-0/border-l/border-r` — acceptable since `side` is chosen per locale, but close button `right-3` is not), `ui/dialog.tsx` L68 (`right-2`), `ui/select.tsx` L120/130 (`pr-8 pl-1.5`, chevron `right-2`), `ui/table.tsx` L73 (`text-left`). Select and table are currently admin-only (English LTR) so no user-visible bug today, but any future RTL usage inherits broken alignment. Expected: convert to `end-*`, `ps-*/pe-*`, `text-start` — behavior identical in LTR.

**R-4 — Latin brand/product names in AR pages lack `lang` markup.** Product names, "Lune", "Instagram", "Amman, Jordan" (`footer.tsx` L47 correctly gets `dir="ltr"` but no `lang="en"`) are read by Arabic TTS with Arabic phonetics. Expected: `lang="en"` on Latin-only spans in AR context. Low.

**R-5 — Untranslated hero image alt.** `hero-media.tsx` L29: `alt="Lune Eau de Parfum"` hardcoded English (the only user-facing string outside the catalogs found in the store). Expected: message key, or `alt=""` + `aria-hidden` if treated as decorative alongside H1.

## Responsive / viewport

**V-1 — Shop filter row can overflow at 320px (EN).** `shop-grid.tsx` L30–61: three buttons `px-6 py-2` + `gap-2`, no wrap — EN "All / For Him / For Her" totals ≈300–315px; with the RTL `text-xs` bump (13px) AR is safe (short labels) but EN at 320px is at the edge, and any longer future label overflows. Expected: add `flex-wrap` (harmless at all sizes) or reduce to `px-4` below `sm`.

**V-2 — Admin orders table on phones.** `orders-table.tsx` L80–93: 8 columns behind `overflow-x-auto` — functional but requires long horizontal scrolling on a phone with sticky context lost. Admin is desktop-first by nature; acceptable now, but the rebuild should consider a stacked card layout `<md` or column-priority hiding. Low (internal tool).

**V-3 — Large screens (≥1536px→4K).** All storefront sections cap at `max-w-6xl` (1152px); `display-xl` caps at 7rem; the aurora blobs are percentage-sized so they scale. Nothing breaks at 4K, but at 2560px+ the page is ~55% empty margin. Expected (rebuild recommendation, not a defect): add a `2xl:` tier (`2xl:max-w-7xl`, slightly larger body sizes) — see Breakpoint Recommendations.

**V-4 — Mobile landscape.** Hero uses `min-h-svh` + `pt-28 pb-24` (`page.tsx` L39) — on ~375px-tall landscape the section simply grows and scrolls (correct behavior; `svh` avoids the URL-bar jump). Cart/feedback sheets are `h-full` with internal `overflow-y-auto` lists — checkout button remains pinned in the footer block. No code defect found; keep as an explicit test case since fixed 144px feedback tab + `top-1/2` could collide with OS UI in short landscape (`feedback-widget.tsx` L80, desktop-only `sm:flex` so mostly moot).

**V-5 — Touch target inventory (mostly passing).** Header icons 40px, mobile-menu rows ~64px, qty buttons 40px mobile / 32px `sm:` (pointer contexts — fine), gallery thumbs 80×64, filter buttons ~33px tall (≥24px, passes WCAG 2.5.8), footer links are ~20px-tall inline text links (exempt as inline, but spacing `space-y-2` keeps them separated). Remove-item button 16px icon with `-m-2 p-2` → 32px hit area — acceptable; consider 40px on touch. Informational.

**V-6 — `truncate` on cart item names.** `cart-drawer.tsx` L83: product names truncate rather than wrap. Names are short Latin words today (Apollo…), so no real loss; if names ever localize/lengthen, switch to `line-clamp-2`. Low.

## Motion / reduced motion

**M-1 — Hero video ignores `prefers-reduced-motion` and lacks decorative marking.** `hero-media.tsx` L36–47: `<video autoPlay muted>` mounts on idle and plays regardless of the user's motion preference (`MotionConfig` doesn't govern native video), and has no `aria-hidden` — SRs may expose an unlabeled video element. Expected: skip mounting when `matchMedia("(prefers-reduced-motion: reduce)")` matches (still image remains — already the fallback), add `aria-hidden="true"` + `disablePictureInPicture`/`disableRemotePlayback` niceties.

**M-2 — Reduced-motion coverage is otherwise complete (verified).** CSS kill-switch (`globals.css` L337–348) neutralizes aurora drift, starfield is static, `scroll-smooth` is reset; `Parallax` (primitives.tsx L214–237 — the load-bearing guard called out in the brief is present), `Spotlight`, `TiltCard`, `Float`, `LineReveal`, `ClipReveal`, `AnimatedNumber`, `WaxingMoon` SVG attribute timeline (confirmation-reveal.tsx L25–35, L54–57), and `AddToCartButton` path-draw (L74) all check `useReducedMotion`. One nit: the no-JS `reveal-fallback` under reduced motion still works (duration forced to 0.01ms but the 2.5s delay is preserved, then content snaps visible) — no action needed.

**M-3 — `AnimatedNumber` totals during animation.** `animated-number.tsx` L32–35 mutates text imperatively; SRs read whatever value is current when focused — final value is correct, and the reduced-motion branch renders plain text. Acceptable; the checkout summary (source of truth) uses the same component — ensure the A-2 live region announces the settled total, not intermediate frames. Informational.

# Severity / Priority

| # | Finding | Severity | Where | Locale/Dir | Viewports |
|---|---|---|---|---|---|
| A-1 | Checkout errors not announced/associated | **Critical** | checkout-form.tsx | both | all |
| A-2 | Add-to-cart silent; live region unmounted | **Critical** | cart-drawer.tsx, add-to-cart-button.tsx, layout.tsx | both | all |
| C-1 | `text-gold` on light card (Coming soon) | **High** | checkout-form.tsx L230 | both | all |
| R-1 | Tracking breaks Arabic joining (~15 sites) | **High** | page.tsx, mobile-menu, buttons, badges | AR/RTL | all |
| A-5 | Hardcoded "Close" + physical `right-3` in Sheet | **High** | ui/sheet.tsx, ui/dialog.tsx | AR worst | all |
| A-7 | Fake tabs pattern on shop filters | **High** | shop-grid.tsx | both | all |
| A-8 | No skip link | **High** | [locale]/layout.tsx | both | all |
| M-1 | Hero video ignores reduced motion, unmarked | **High** | hero-media.tsx | both | all |
| A-3 | Cart count not in button name | Medium | header.tsx | both | all |
| A-4 | Qty stepper unlabeled / invalid ARIA | Medium | cart-drawer.tsx | both | all |
| A-6 | Menu close button mislabeled | Medium | mobile-menu.tsx | both | <640px |
| A-9 | Feedback error/success not announced | Medium | feedback-widget.tsx | both | all |
| C-2 | Sold-out status text ~3.5:1 | Medium | product-card.tsx | both | all |
| C-3 | Struck price ~2.6:1 | Medium | product-card, purchase-panel | both | all |
| R-2 | Cart drawer side vs icon side (verify intent) | Medium | cart-drawer.tsx | both | ≥640px |
| R-3 | Physical props in shadcn primitives | Medium | ui/select, ui/table, ui/dialog | future RTL | all |
| V-1 | Filter row edge overflow at 320px | Medium | shop-grid.tsx | EN worst | 320–360px |
| A-10 | `<s>` price semantics | Medium | product-card, purchase-panel | both | all |
| C-4 | Ritual copy `moon/50` borderline | Low | page.tsx L206 | both | touch esp. |
| R-4 | Latin text lacks `lang` in AR | Low | footer, product names | AR | all |
| R-5 | Hardcoded hero alt | Low | hero-media.tsx | AR | all |
| A-11 | Admin spinners no `role="status"` | Low | admin components | EN | all |
| V-2 | Admin table on phones | Low | orders-table.tsx | EN | <768px |
| V-6 | Cart name `truncate` | Low | cart-drawer.tsx | both | <400px |

# Recommendations

## Responsive strategy (rebuild)

1. **Keep the single responsive site** — one codebase, mobile-first, fluid `clamp()` display type (already in place). Do **not** split desktop/mobile.
2. **Target range 320px → 4K.** Everything must lay out at 320px with zero horizontal scroll on `<body>`; wide content (admin tables) scrolls inside its own `overflow-x-auto` container (already the pattern — preserve it).
3. **Container strategy:** keep `max-w-6xl` as the default measure; add a `2xl:` enhancement tier for ≥1536px (V-3) rather than uncapping widths — luxury layouts benefit from generous margins, but hero and chapter spreads can grow one step.
4. **Preserve the fluid-type utilities** (`display-*` clamps) and the `[dir="rtl"]` line-height/size compensation verbatim — they are load-bearing for Arabic.

## Breakpoint recommendations

Keep Tailwind defaults; assign explicit roles and test at these widths:

| Token | Width | Role |
|---|---|---|
| (base) | 320–639 | Single column, hamburger + cart in header, 2-col product grid, full-width sheets |
| `sm:` | 640 | Full header nav, sheets cap at `max-w-sm/md`, ritual 3-col, feedback tab appears |
| `md:` | 768 | (currently near-unused in store) reserve for tablet refinements — e.g. admin card→table switch (V-2) |
| `lg:` | 1024 | 2-col product page, 4-col shop grid, checkout 2-col + sticky summary, chapter flip layout, admin sidebar |
| `xl:` | 1280 | no change (fine) |
| `2xl:` | 1536+ | new: `2xl:max-w-7xl` containers, +1 step body sizes (V-3) |

Also honor non-width media: `(hover)(pointer)` (already used), `prefers-reduced-motion` (close the M-1 gap), and test `svh` behavior on iOS Safari.

## Accessibility fixes (ordered)

1. **Checkout (A-1):** wire `aria-invalid` + `aria-describedby` to `FieldError` ids; focus first invalid field on submit; `role="alert"` on the server-error banner. Add `autoComplete="address-level2"` to the city input while there.
2. **Cart announcements (A-2/A-3/A-4):** one persistent polite live region in the locale layout; announce add/remove/qty/total; interpolated `openCartWithCount` label; `role="group"` + labeled stepper buttons (4 new message keys in `en.json`/`ar.json`).
3. **Sheet close (A-5/A-6):** localized close labels, `end-3` positioning; give the mobile menu a real `closeMenu` key.
4. **Shop filters (A-7):** replace tab roles with `aria-pressed` buttons (keeps existing focus CSS working).
5. **Skip link (A-8):** first child of `<body>`, translated, `focus:not-sr-only` pattern, target `<main id="main">`.
6. **Contrast (C-1..C-4):** `text-gold-deep` for the Coming-soon badge; raise sold-out/struck-price/ritual opacities as specified. Re-validate every `text-gold` call site sits on a dark background (grep `text-gold[^-]` and audit backgrounds) — this is the exact failure mode the design system documents.
7. **Feedback (A-9), price semantics (A-10), admin spinners (A-11)** as described.

## RTL fixes

1. **Tracking (R-1):** single `[dir="rtl"]` letter-spacing normalization (utility or attribute-selector rule) instead of 15 per-site fixes; verify with an Arabic reader that CTAs render as connected script.
2. **Decide R-2** (cart side) with the owner before rebuild; document the decision in CLAUDE.md either way.
3. **Logical-property pass on `src/components/ui/*`** (R-3) — mechanical, zero visual change in LTR.
4. `lang="en"` on Latin runs in AR (R-4); translate/empty the hero alt (R-5).

## Motion

- Gate the hero video mount on `prefers-reduced-motion` and mark it `aria-hidden` (M-1). Everything else verified compliant (M-2) — carry the same three-layer pattern (CSS kill-switch + MotionConfig + explicit guards for scroll-linked/SVG timelines) into the rebuild.

# Risks

1. **RTL tracking normalization (R-1)** changes the visual rhythm of every Arabic CTA — the EN luxury tracking must remain untouched; a blanket selector could catch Latin product names inside AR pages (where tracking is *fine*). Mitigate: scope the reset to elements whose content is translated (utility class opt-in), and review AR pages visually with a native reader.
2. **Live-region tuning (A-2)** can over-announce (every qty tick). Mitigate: debounce announcements; announce the settled total once per interaction.
3. **Focus management in checkout (A-1)** interacts with Motion's height-unfold error animation — moving focus into a still-animating region is fine, but test with NVDA/VoiceOver to ensure the error text is read after focus lands.
4. **Sheet primitive edits (A-5, R-3)** touch shared shadcn files used by the admin too — regression-test admin dialogs/sheets after converting to logical properties. Coordinate with whichever agent owns the component library in the rebuild.
5. **Contrast raises (C-2..C-4)** slightly lighten the "quiet luxury" grays; keep changes to the minimum opacity step that passes, and re-check against `aurora-wash`-tinted ivory, not plain ivory.
6. **Cart drawer side change (R-2), if made,** flips a behavior users may have learned and interacts with the A-5 close-button position — do both together.
7. This is a **code-level audit**: computed contrast ratios assume no additional overlays, and layout conclusions at 320px/4K are derived from classes, not rendered pixels. Every High+ finding needs browser confirmation in Phase B (the user's own browser, since this machine cannot reach the deployment).

# Verification / Testing

## Per-fix acceptance checks

- **A-1:** with NVDA (Firefox) and VoiceOver (Safari iOS): submit empty checkout → first invalid field receives focus, error text is read; each field announces "invalid" + its message on focus.
- **A-2/A-3/A-4:** SR on product page: activate Add to Cart → hear confirmation with new count; open cart → stepper buttons announce names; header cart button announces count.
- **A-5/A-6:** AR locale: close buttons announce Arabic labels; drawer title never overlaps the close button at 360px and at `sm:max-w-md`.
- **A-7:** filters reachable by Tab, state announced as pressed/not pressed; no "tab" role announced.
- **A-8:** first Tab press on any page reveals the skip link; Enter lands focus in `<main>`.
- **C-1..C-4:** re-measure with a contrast tool against the actual rendered backgrounds (including `aurora-wash`/`tint-*`): all body text ≥4.5:1, large display text ≥3:1, non-text UI ≥3:1.
- **R-1:** native Arabic review of hero CTA, mobile menu, checkout submit — script joins correctly, no fractured letters.
- **M-1:** with OS reduced-motion on: hero shows only the still image; aurora static; no scroll-linked parallax anywhere (scroll the full home page).

## Standing test matrix (every rebuild milestone)

**Viewports:** 320, 360, 390, 414, 640, 768, 820 (portrait tablet), 1024, 1280, 1536, 1920, 2560, 3840 — plus 667×375 and 844×390 landscape.
**Per viewport × locale (EN-LTR, AR-RTL):**
1. No horizontal scroll on `<body>` on home / shop / product / checkout / confirmation / 404 / error pages.
2. Header: correct collapse at 640px; badge doesn't clip; fixed header never covers page H1s (`pt-28+` offsets intact).
3. Shop: filter row fits at 320px both locales; 2→4 column grid; card text never overflows.
4. Product: gallery thumbs wrap if >4 images; sticky nothing overlaps; sold-out state legible.
5. Cart drawer and feedback sheet: full-height, internal scroll only, footer CTA always visible, opens from the documented side per locale, focus trapped, Esc closes, focus returns to trigger.
6. Checkout: 2-col ≥1024px with sticky summary; single column below; error unfold doesn't shift focus context; keyboard-only full purchase completes.
7. Arabic-specific: Amiri headlines don't clip (LineReveal + display line-heights), diacritics intact, numbers/phone/order-number render LTR inside RTL, eyebrow sizes legible.
8. Zoom: 200% browser zoom and 320px-equivalent reflow (WCAG 1.4.10) — no loss of content/function; pinch-zoom not blocked.
9. Keyboard: visible focus on every interactive element (spot-check custom buttons: feedback tab, filter pills, gallery thumbs, qty steppers).
10. Screen reader smoke: page title/landmarks (`header`/`nav`/`main`/`footer`), one H1 per page, heading order, image alts, both locales.
11. Reduced motion sweep per M-1 check; no-JS load shows content within ~3s (reveal fallback).
12. Admin at 375px and 1440px: nav scrolls horizontally, orders table scrolls inside its container, actions reachable.

**Tooling for Phase B:** axe-core or Lighthouse a11y pass per page per locale; a contrast script over the token pairs actually used; Playwright viewport matrix for the overflow checks (runnable against `npm run dev` locally — the production URL is unreachable from this machine, so CI or the user's browser must cover the deployed site).

# Phase D — UI System Consistency Check

Cross-check of `DESIGN_SYSTEM.md`, `UX_AUDIT.md`, and `ARCHITECTURE_REPORT.md` § "Phase B — Consolidated Target Architecture" (WP8/WP9/WP10) against this report's findings. Phase A sections above are unchanged.

## Verdict

**Consistent, with three scheduling corrections and two internal contradictions to resolve.** The design system supplies the systematic mechanisms this report's findings asked for (ring token fix, opacity floors, `.label-caps` RTL tracking reset, h-12/44px control sizes, error-state spec), the UX recommendations do not conflict with any a11y/RTL requirement, and WP9's scope is complete — every A/C/R/M finding of mine is claimed by exactly one work package. The problems are sequencing: the plan's Phase 3 text wires the a11y foundation "per screen" during the WP10 rebuild, which would leave both of my Critical findings unfixed until owner-blocked screen work happens, and one owner decision (drawer side) is currently coupled to a WCAG fix that must not wait for it.

## Per-finding coverage — Critical/High items

| My finding | Resolved by | Status |
|---|---|---|
| A-1 checkout error ARIA (Critical) | DESIGN §5.2 (aria-invalid drives styles, `aria-describedby`, text-not-color, destructive 6.52:1) + UX R5 (adds `role="alert"` + focus-to-first-invalid) + WP9 | **Covered** — the three sources compose cleanly; DESIGN alone omits focus management, UX R5 supplies it. Must be implemented once (see corrections) |
| A-2 global cart live region (Critical) | Phase B §3 `[locale]/layout.tsx` "persistent aria-live region" + WP9 "live region + announcements" | **Covered** — correctly placed outside the Sheet portal, exactly the fix specified |
| Focus ring 2.18:1 on ivory (DESIGN F2; my base-layer `outline: var(--ring)` rule inherits it) | DESIGN §1.3 `--ring: #7c6132` light / `#c4a15e` dark + WP8 | **Covered** — my `globals.css` L158–165 outline rule picks the new value up automatically; no extra change needed |
| C-1 `text-gold` "Coming soon" badge on light card | DESIGN binding rule "champagne = dark only" + WP8 (cites RESP C-1…C-4) | **Covered with residual**: the badge sits inside the disabled row's `opacity-60` subtree (`checkout-form.tsx` L224) — even `champagne-700` drops below AA at 60% opacity. DESIGN §5.7 ("disabled options get explanatory text, not opacity alone") points the right way, but WP8's implementer must explicitly lift the badge out of the dimmed subtree or drop the row opacity |
| R-1 Arabic tracking (~15 sites) | DESIGN F4 + §2.2 `.label-caps` (RTL 0.06em) + ≤0.12em binding rule + `tracking-normal` resets on translatable display text; WP8 delivers the utility, WP9 cites R-1 | **Covered** — DESIGN's per-component migration (its Risk 4) matches my warning about Latin product names keeping their tracking in AR. Note the dependency: WP9's R-1 fix consumes WP8's utility (see corrections) |
| A-5 Sheet close button (hardcoded "Close", physical `right-3`) | WP9 "localized/logical sheet close" + Phase B §3 `components/ui` | **Covered**, but currently coupled to the T6 owner decision (see corrections) |
| Touch targets (V-5 / DESIGN F5) | DESIGN §5.1 size `xl` h-12, §5.2 h-12 checkout inputs, verification gate "≥44×44 at 360px" + WP8 | **Covered** — the 44px gate also catches the 40px header icons and `sm:h-8` steppers this report rated "acceptable"; the gate is stricter than my finding, which is fine |
| A-8 skip link | Phase B §3 layout.tsx + WP9 | **Covered** (DESIGN doesn't style it — trivial; use the existing focus-ring token) |
| A-7 fake tabs → `aria-pressed` | WP9 + UX F20/R8 | **Covered** — but WP10's `?audience=` URL refactor (UX R8) rewrites the same component; sequence together (see corrections) |
| M-1 hero video reduced-motion gate | WP7 (P1) — scheduled *before* WP8–10 | **Covered, correctly early** |
| A-3/A-4/A-6/A-9/A-10/A-11, R-3/R-4/R-5 | WP9 cites RESP A-1…A-11 + R-1/R-3/R-4/R-5 wholesale | **Covered** |
| C-2/C-3/C-4 opacity text | DESIGN opacity floors (`obsidian/65` floor, `text-night/50` → `text-taupe`, strike price → `text-taupe`) + WP8 | **Covered** — DESIGN §5.4 resolves C-2/C-3 with named replacements |
| R-2 drawer side | T6 ruling → owner-decision list | **Covered as a decision** — but see the DESIGN contradiction below |
| V-1 filter overflow at 320px | WP10 (cites RESP V-1) | **Covered, wrongly placed** (see corrections) |
| V-3 2xl tier | WP10 | Covered |

**GAPs found: none outright.** Every Critical/High item has an owner in the plan. The issues are placement/sequencing plus these internal inconsistencies:

1. **DESIGN §5.6 pre-empts T6.** DESIGN specs the cart drawer as `side = end` ("flips automatically in RTL") as if decided, while the consolidated plan's T6 ruling explicitly reserves the side for the owner. The plan's T6 governs; DESIGN §5.6 should be read as the *recommended* option, not a settled spec.
2. **DESIGN's test-width floor is 360px; the binding requirement (and this report) is 320px.** DESIGN §3 mandatory widths start at 360 and stop at 1920; my V-1 is a real 320px risk and the requirement is 320→4K. WP11's viewport matrix must use this report's list (320…3840), not DESIGN's.
3. Minor factual drift: UX's current-state notes call the cart steppers "min 44px targets on mobile" — they are `h-10` (40px). Harmless since DESIGN's ≥44 gate supersedes, but the rebuild should not treat 40px as an existing standard to preserve.

## New responsive/a11y risks introduced by UX recommendations

- **R1 trust strip at 320px (UX R1):** three icon+label items in a row will not fit at 320px in EN ("Cash on Delivery · Delivery within 2 days · Flat 3 JD delivery"). Require stack-then-row (`grid gap-2 sm:grid-cols-3` or `flex-wrap`), icons `aria-hidden` with meaning fully in text, and `gold-deep`/`champagne-700` on ivory per the token rule. UX's own verification ("visible without scrolling past the primary CTA at 390×844") must be satisfied by *placement*, not by making the strip fixed/sticky — a sticky strip would stack with the fixed header and the `right-0` feedback tab and eat vertical space on short landscape viewports.
- **Sticky mobile CTA:** no report actually proposes one; WP10's "mobile hero CTA" is the `order-first` reordering (UX F19/R8). If a sticky CTA is ever added during WP10, it must respect `env(safe-area-inset-bottom)`, use `svh`-safe positioning, not overlap the feedback tab or the cart drawer footer, and remain in DOM order for SR users. Record this as a guardrail, not a current defect. Note the F19 fix itself is an a11y *improvement*: removing `order-first` on mobile aligns visual order with DOM/reading order (today media renders first visually but second in DOM).
- **Governorate select (UX R5) depends on WP9's R-3 pass.** `src/components/ui/select.tsx` carries physical properties (`pr-8 pl-1.5`, chevron `right-2` — my R-3) and is admin-only/LTR today. Using it in the RTL checkout before the logical-properties pass ships a visibly broken AR select. Either sequence WP9 R-3 before WP10 R5, or use a styled native `<select>` (better mobile UX anyway, zero new surface). The select must also inherit the new light-surface ring and the h-12 checkout input size.
- **Optional email (UX R5/T9):** flipping email to optional must not leave required-ness implicit — phone gets `aria-required` plus DESIGN §5.2's text marker ("required"/"مطلوب"), and the "(optional) — for your receipt" hint must be linked via `aria-describedby`, not placeholder-only.
- **Post-add inline row (UX R6):** content appearing under the CTA after add must be announced through the A-2 live region (one announcement — don't double-fire "Added" + row insertion), must not steal focus, needs ≥44px targets, and its height animation needs a reduced-motion guard (it will be a new insertion outside the existing primitives). "Other phases" strip: 3 cards in the 2-col mobile grid leaves an orphan cell — accept or use horizontal scroll with visible affordance; keep heading hierarchy (h2) intact.
- **Chapter images + prices on home (UX R4):** images need `alt={product.name}` (not empty — they become the discovery surface), no `priority` below the fold, and prices must use the A-10 sr-only "original/current price" pattern once sales apply. Ghost numerals stay `aria-hidden`.
- **WhatsApp links (UX R3):** accessible name must include "WhatsApp" in text (not icon-only), number rendered `dir="ltr"` inside AR, and the confirmation-page prefilled-message URL must not encode customer PII beyond the order number.
- **`?audience=` deep links (UX R8):** keep `aria-pressed` state derived from the URL param so back/forward restores both state and announcement; filter changes should politely announce the result count via the A-2 live region (enhancement, not blocker).
- **Truthful confirmation via `&receipt=1` (T2):** the email line becomes client-conditional — render it in the initial client pass (the param is available synchronously) so SR users get one stable message, not a late DOM insertion.

## Scheduling corrections

1. **Promote the Critical ARIA work out of the WP9/Phase-3 "per screen" wiring.** Phase 3's text wires "form-error ARIA, live region, skip link, labeled steppers…" *as each screen is rebuilt*, and WP10 is explicitly blocked on the owner-decision list. If the owner stalls, checkout stays inaccessible indefinitely. A-1 (checkout error ARIA + focus) and A-2 (persistent live region + announcements), plus the cheap A-3/A-4 labels, are **zero-visual-change** edits that meet Phase 1's own definition ("the storefront looks identical") — ship them as a standalone WP9a during the Phase 1/2 window, before any WP10 screen work. WP9's remaining items (skip link, `aria-pressed`, close-button localization, ui/* logical pass, `lang` markup) can stay P2 but must complete **before** each corresponding WP10 screen rebuild, never after.
2. **Decouple A-5 from the T6 owner decision.** T6 says to implement the drawer-side change "together with A-5's logical `end-3` close button in one change." The coupling is backwards: A-5 (localized label + `end-3`) is a WCAG/i18n fix with no owner dependency — ship it in WP9 unconditionally; the side flip, if approved, is then a one-line follow-up. An owner delay must not hold a conformance fix.
3. **Move V-1 (filter-row 320px wrap) from WP10 to WP9.** It is a one-class fix (`flex-wrap`) on the same lines WP9 already edits for the `aria-pressed` conversion (`shop-grid.tsx` L30–61), and it has no owner dependency. Doing both in one touch also avoids WP10's `?audience=` refactor re-breaking it.
4. **Make WP8 → WP9 ordering explicit.** The plan marks WP8 as "prerequisite for WP10" but not for WP9 — yet WP9's R-1 fix consumes WP8's `.label-caps` utility, and WP9's checkout error styling consumes WP8's ring/destructive tokens. Either land WP8's token/utility layer first, or let WP9a (correction 1) use current class names via the deprecated aliases — which T7's alias mechanism explicitly permits. No hard conflict; just state the order.
5. **WP11 viewport matrix: adopt 320px→3840px** (this report's list), superseding DESIGN §3's 360–1920 range, and run it per WP10 screen in both locales as already planned.
