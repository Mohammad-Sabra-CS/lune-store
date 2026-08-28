# Executive Summary

This document defines the implementation-ready design system for the LUNE rebuild under the **Obsidian / Midnight Navy / Moon Silver / Lunar Champagne / Lunar Ivory** direction. It is a reconciliation, not a blank-slate redesign: every existing token in `src/app/globals.css` is mapped to the new palette with an explicit **keep / rename / retint / replace** decision, and every color pair states its measured WCAG contrast ratio (computed, not estimated).

Key decisions:

1. **The existing hex values are almost entirely kept.** The current palette already *is* the new direction under older names: `night #0b0e17` **is** Obsidian, the `night-soft/night-mist/navy-lune` ladder **is** Midnight Navy, `gold/gold-bright/gold-deep` **is** Lunar Champagne, `ivory/ivory-deep` **is** Lunar Ivory. Renaming happens at the token layer with legacy aliases so no big-bang class rename is required.
2. **Moon Silver is the only genuinely new family** — a cool silver ramp (`#e6e9f0 / #c8cede / #9aa3b8`) for secondary text, hairlines, and metallic detail on dark surfaces, replacing ad-hoc `moon/xx` opacity text. All three steps pass AA on Obsidian (15.86:1, 12.24:1, 7.62:1).
3. **The `gold-deep` contrast lesson is preserved and generalized**: champagne `#c4a15e` is a dark-surface color only (2.18:1 on ivory — hard fail); `champagne-700 #7c6132` (5.20:1 on ivory) is the mandatory champagne for light surfaces. This rule is extended to the focus ring, which currently fails non-text contrast on ivory (2.18:1 < 3:1).
4. **Arabic is first-class, codified**: the existing `[dir="rtl"]` compensations (taller display leading, optical size bumps, reduced eyebrow tracking) become documented type-scale rows, plus new binding rules — no synthetic italic on Arabic, Western digits with `tabular-nums` for all prices, letter-spacing ≤ 0.12em on Arabic script, and a `.label-caps` utility so inline `tracking-[0.2–0.35em]` labels stop leaking un-mirrored tracking into RTL.
5. **No new fonts, no new dependencies, no new network requests.** Playfair Display + Jost + Amiri + IBM Plex Sans Arabic stay exactly as loaded today; sharp radius (`0.25rem`) stays; the Motion primitives in `src/components/motion/` stay the motion foundation.

# Current State

## Token inventory (`src/app/globals.css`)

**Brand colors** (Tailwind v4 `@theme inline`): `night #0b0e17`, `night-soft #131727`, `night-mist #1d2236`, `moon #f4eedf`, `gold #c4a15e`, `gold-bright #ebd9a8`, `gold-deep #7c6132` (exists specifically because plain gold fails AA on ivory), `ivory #f6f2e9`, `ivory-deep #ece5d4`, `wine #6e2735` (women), `navy-lune #27334f` (men).

**Semantic layer**: shadcn variables in `:root` (ivory/light) and `.dark` (night). Light: `background #f6f2e9`, `card #fbf8f1`, `muted-foreground #6b6553`, `destructive #9d2f2f`, `border #0b0e171f`, `ring #c4a15e`, `radius 0.25rem`. Dark: `background #0b0e17`, `card #131727`, `muted-foreground #a89f8a`, `destructive #d05353`, `border #f4eedf1a`, `ring #c4a15e`. `color-scheme: only light` opts out of Android auto-darkening.

**Typography**: `--font-display: Playfair Display (400/500/600 + italic, latin) → Amiri (400/700, arabic) → serif`; `--font-sans: Jost → IBM Plex Sans Arabic (300–600) → sans-serif`. Arabic falls through the stack — no per-locale switching. Display utilities: `.display-xl` `clamp(3rem, 6vw+1.5rem, 7rem)/1.02`, `.display-lg` `clamp(2.25rem, 3.5vw+1rem, 4.25rem)/1.08`, `.display-md` `clamp(1.75rem, 2vw+1rem, 2.75rem)/1.15`, `.display-chapter` `clamp(1.875rem, 3.5vw+0.75rem, 4.25rem)/1.1`. `[dir="rtl"]` overrides: display line-heights 1.2/1.25/1.3; `.eyebrow` grows to 0.95rem / tracking 0.12em; `text-xs/sm/base/xl` get optical bumps (0.8125 / 0.9375 / 1.0625 / 1.375rem).

**Radii**: `--radius: 0.25rem` with derived sm…4xl steps — intentionally sharp.

**Motion**: `EASE = [0.22, 1, 0.36, 1]` in `src/components/motion/primitives.tsx`; primitives Reveal/RevealItem (0.7s), HeroReveal, LineReveal (0.9s, Arabic-safe clip padding), FadeUp (0.8s), Float, Parallax, ClipReveal (1.1s); `MotionConfig reducedMotion="user"` in the locale layout; CSS no-JS reveal fallback at 2.5s; global `prefers-reduced-motion` kill switch in CSS. Aurora backdrop = transform-only blurred blobs + starfield. Admin uses no Motion by design.

## Component inventory (`src/components/`)

- **ui/** (shadcn on @base-ui): `button` (default/outline/secondary/ghost/destructive/link; sizes xs–lg h-6…h-9 + icon sizes), `input` (h-8), `textarea`, `select`, `label`, `badge`, `radio-group`, `separator`, `table`, `sheet` (cart drawer, side flips for RTL), `dialog`.
- **product/**: `product-card` (4:5 TiltCard image, audience chip in wine/navy, gold underline grow on hover, sale/sold-out badges, tabular price), `gallery`, `purchase-panel`, `add-to-cart-button` (overrides Button with `py-7 rounded-none bg-gold tracking-[0.3em]` — the brand CTA exists only as an inline override today), `shop-grid`.
- **layout/**: `header` (max-w-6xl), `footer`, `mobile-menu`, `locale-switcher`.
- **cart/**: context + drawer (Sheet) + totals + empty state.
- **checkout/**: `checkout-form`; **feedback/**: fixed-size widget; **brand/**: logo, moon-phase glyphs.

**Containers**: `max-w-6xl` (1152px) everywhere except checkout `max-w-4xl` (896px). **Breakpoints**: Tailwind v4 defaults (no overrides found).

# Findings

**F1 — The palette maps 1:1 onto the new naming; only Moon Silver is missing.** There is no cool silver anywhere in the system: secondary text on dark is done with warm `moon` at opacities (`text-moon/70` etc.) or `muted-foreground #a89f8a` (warm taupe). The "Moon Silver" pillar of the direction has no token.

**F2 — Focus ring fails non-text contrast on light surfaces.** `--ring: #c4a15e` on ivory `#f6f2e9` = **2.18:1**, below the 3:1 WCAG 1.4.11 minimum for focus indicators. The same lesson already learned for gold *text* on ivory (`gold-deep`) was never applied to the ring. On dark surfaces the gold ring is fine (7.90:1).

**F3 — Opacity-derived text drops below AA on ivory.** `text-night/50` (sold-out price label, `product-card.tsx`) composites to ≈`#808080` on ivory = **≈3.5:1**, failing AA for small text. `text-night/65` (≈6.2:1) and `/70` pass. There is no documented floor for opacity text.

**F4 — The primary commerce CTA is an ad-hoc override, and its tracking breaks Arabic.** `add-to-cart-button.tsx` builds the brand CTA by overriding `size="lg"` (h-9) with `py-7 rounded-none bg-gold tracking-[0.3em] uppercase`. Two problems: (a) no tokenized "hero CTA" button size/variant exists — every CTA re-invents it; (b) `tracking-[0.3em]` is applied inline with no `[dir="rtl"]` compensation — wide letter-spacing visually disconnects joined Arabic script (the `.eyebrow` utility already fixes this for itself, but inline tracked labels throughout product-card, badges, and CTAs do not).

**F5 — Default control sizes are below comfortable touch targets for commerce.** Button default h-8 (32px), lg h-9 (36px), Input h-8 (32px). Fine for admin; below the 44px mobile touch-target guideline for the storefront's checkout inputs and CTAs (currently patched per-call-site with `py-7` overrides).

**F6 — No shadow/elevation scale exists.** The site uses borders and background steps (correctly — luxury aesthetic), but drawer/dialog/dropdown elevation is whatever shadcn shipped. An explicit, restrained elevation policy is needed so the rebuild doesn't accumulate random `shadow-*` classes.

**F7 — Numerals and price typography are un-specified.** Prices render with `tabular-nums` in product-card but nothing states the policy (Western vs Eastern Arabic digits, currency placement in RTL). Currently Western digits are used in both locales; this works but is undocumented, and any drift (e.g. `٣٥`) would break admin/order consistency.

**F8 — Component states are partially implicit.** Hover/focus/disabled exist via shadcn defaults; loading, error, and empty states are hand-rolled per feature (cart-empty, checkout errors, sold-out) without a shared spec. Good implementations exist to canonize; nothing to invent.

# Severity / Priority

| # | Finding | Severity | Priority | Rationale |
|---|---------|----------|----------|-----------|
| F2 | Focus ring 2.18:1 on ivory (WCAG 1.4.11 fail) | **High** | P0 | Accessibility conformance failure on every light-surface interactive element |
| F3 | `night/50` text ≈3.5:1 on ivory (AA fail) | **High** | P0 | Real text users must read (sold-out state) |
| F4 | CTA not tokenized + inline tracking un-mirrored in RTL | Medium | P1 | Arabic-first-class violation; consistency debt compounds during rebuild |
| F1 | Moon Silver family missing | Medium | P1 | Blocks the stated brand direction; cheap to add |
| F5 | Touch targets < 44px on storefront controls | Medium | P1 | Mobile commerce UX; conversion-adjacent |
| F7 | Numeral/price policy undocumented | Low | P2 | Works today; document to prevent drift |
| F6 | No elevation scale | Low | P2 | Prevent future inconsistency |
| F8 | State specs implicit | Low | P2 | Canonize existing good patterns |

# Recommendations

Everything below is the design system itself — implementation-ready. Token names are Tailwind v4 `@theme` names (usable as `bg-obsidian`, `text-silver-300`, etc.).

## 1. Color tokens

### 1.1 Brand palette (primitive layer)

Decision legend: **keep** = same hex, same name · **rename** = same hex, new canonical name (old name kept as deprecated alias) · **retint** = adjusted hex · **new** = did not exist. Nothing is removed; no existing hex changes.

| New token (Tailwind v4) | Hex | Old token | Decision | Role |
|---|---|---|---|---|
| `--color-obsidian` | `#0b0e17` | `night` | **rename** | Base dark surface; primary text on light |
| `--color-midnight-800` | `#131727` | `night-soft` | **rename** | Raised dark surface (cards, drawer, popover) |
| `--color-midnight-700` | `#1d2236` | `night-mist` | **rename** | Highest dark surface (muted, hover fills) |
| `--color-midnight-500` | `#27334f` | `navy-lune` | **rename** | Midnight Navy proper — men's accent, dark chips |
| `--color-silver-100` | `#e6e9f0` | — | **new** | Moon Silver: brightest — headings/metallic detail on dark |
| `--color-silver-300` | `#c8cede` | — | **new** | Moon Silver: secondary body text on dark |
| `--color-silver-500` | `#9aa3b8` | — | **new** | Moon Silver: tertiary text, hairlines, icons on dark |
| `--color-champagne` | `#c4a15e` | `gold` | **rename** | Lunar Champagne — accent on DARK surfaces only |
| `--color-champagne-200` | `#ebd9a8` | `gold-bright` | **rename** | Champagne hover/highlight on dark |
| `--color-champagne-700` | `#7c6132` | `gold-deep` | **rename** | Champagne on LIGHT surfaces (the preserved contrast lesson) |
| `--color-ivory` | `#f6f2e9` | `ivory` | **keep** | Lunar Ivory — base light surface |
| `--color-ivory-bright` | `#fbf8f1` | (card value) | **new name for existing value** | Raised light surface (cards) |
| `--color-ivory-deep` | `#ece5d4` | `ivory-deep` | **keep** | Recessed light surface (muted, secondary) |
| `--color-moon` | `#f4eedf` | `moon` | **keep** | Warm off-white text on dark (body on Obsidian) |
| `--color-wine` | `#6e2735` | `wine` | **keep** | Women's accent |
| `--color-taupe` | `#6b6553` | (muted-fg value) | **new name for existing value** | Muted text on light |
| `--color-taupe-bright` | `#a89f8a` | (dark muted-fg) | **new name for existing value** | Warm muted text on dark (prefer silver-500 for cool contexts) |

**Deprecated aliases (keep during migration, remove after rebuild):** `--color-night: var(--color-obsidian)`, `--color-night-soft: var(--color-midnight-800)`, `--color-night-mist: var(--color-midnight-700)`, `--color-navy-lune: var(--color-midnight-500)`, `--color-gold: var(--color-champagne)`, `--color-gold-bright: var(--color-champagne-200)`, `--color-gold-deep: var(--color-champagne-700)`. This lets the rebuild proceed screen-by-screen without a repo-wide rename commit.

**Moon Silver usage rule:** silver is *cool* and belongs on dark (Obsidian/Midnight) surfaces only — silver text on ivory is muddy and unmeasured; use `taupe`/`obsidian` on light. Moon (`#f4eedf`, warm) remains the default long-form body color on dark; silver is for secondary/UI text, hairline borders (`silver-500/25`), icons, and metallic detail where the warm moon tone would read as cream.

### 1.2 Measured contrast (WCAG 2.1, computed)

AA thresholds: 4.5:1 normal text, 3:1 large text (≥24px or ≥18.66px bold) and non-text UI.

**On dark surfaces:**

| Foreground | Background | Ratio | Verdict |
|---|---|---|---|
| moon `#f4eedf` | obsidian `#0b0e17` | **16.65** | AAA |
| moon | midnight-800 `#131727` | **15.38** | AAA |
| moon | midnight-700 `#1d2236` | **13.60** | AAA |
| moon | midnight-500 `#27334f` | **10.85** | AAA |
| moon | wine `#6e2735` | **9.05** | AAA |
| silver-100 `#e6e9f0` | obsidian | **15.86** | AAA |
| silver-300 `#c8cede` | obsidian / midnight-800 / midnight-700 | **12.24 / 11.31 / 10.00** | AAA |
| silver-500 `#9aa3b8` | obsidian / midnight-800 | **7.62 / 7.04** | AAA |
| champagne `#c4a15e` | obsidian / midnight-800 / midnight-700 | **7.90 / 7.30 / 6.45** | AA (AAA on obsidian for large) |
| champagne-200 `#ebd9a8` | obsidian | **13.79** | AAA |
| taupe-bright `#a89f8a` | obsidian / midnight-800 | **7.34 / 6.77** | AA+ |
| destructive-dark `#d05353` | obsidian | **4.63** | AA (normal text — do not use below 14px) |
| obsidian on champagne (primary button) | — | **7.90** | AAA |
| obsidian on champagne-200 (button hover) | — | **13.79** | AAA |

**On light surfaces:**

| Foreground | Background | Ratio | Verdict |
|---|---|---|---|
| obsidian | ivory / ivory-bright / ivory-deep | **17.25 / 18.17 / 15.35** | AAA |
| champagne-700 `#7c6132` | ivory / ivory-bright | **5.20 / 5.48** | AA |
| champagne-700 | ivory-deep `#ece5d4` | **4.63** | AA (normal text only — fine) |
| champagne `#c4a15e` | ivory | **2.18** | **FAIL — never use as text/ring on light** |
| wine | ivory | **9.38** | AAA |
| midnight-500 | ivory | **11.24** | AAA |
| taupe `#6b6553` | ivory / ivory-bright | **5.20 / 5.48** | AA |
| destructive-light `#9d2f2f` | ivory | **6.52** | AA+ |

**Binding rules derived from the table:**

- Champagne `#c4a15e` = dark surfaces only. On ivory, always `champagne-700`. (This is the existing `gold-deep` lesson, now a named system rule.)
- **Opacity floor:** derived text on ivory must not go below `obsidian/65` (≈6.2:1). `obsidian/50` (≈3.5:1) is banned for text; replace existing `text-night/50` with `text-taupe`. On dark, floor is `moon/60`.
- Decorative elements (aurora, starfield, ghost numerals, hairline dividers) are exempt from contrast requirements but must never carry information alone.

### 1.3 Semantic layer (shadcn variables)

Keep the existing two-mode structure. Changes only:

| Variable | Light (`:root`) | Dark (`.dark`) | Change |
|---|---|---|---|
| `--ring` | **`#7c6132`** (was `#c4a15e`) | `#c4a15e` (keep) | **F2 fix**: light ring 5.20:1 on ivory vs 2.18:1 — passes 1.4.11 |
| `--sidebar-ring` | **`#7c6132`** | keep | same fix |
| `--muted-foreground` | `#6b6553` keep (5.20:1) | `#a89f8a` keep (7.34:1) | none — both pass |
| everything else | keep | keep | none |

Dark-section theming on the storefront continues via explicit brand classes (`bg-obsidian text-moon`) rather than `.dark` scoping — the storefront is a single light theme with dark *sections*, and `color-scheme: only light` stays.

## 2. Typography

### 2.1 Families (keep — zero new font requests)

| Token | Stack | Weights loaded | Use |
|---|---|---|---|
| `--font-display` | Playfair Display → Amiri → serif | 400/500/600 + italic (Playfair); 400/700 (Amiri) | Headlines, product names, poetry, prices in hero contexts |
| `--font-sans` | Jost → IBM Plex Sans Arabic → sans-serif | Jost variable; Plex Arabic 300–600 | Body, UI, labels, forms, admin |

**Italic policy (binding):** italic is **English-only**. Amiri has no italic and synthetic slanting distorts Arabic. Implementation rule: any `italic` class on translatable display text must be paired with `[dir="rtl"]:not-italic` (or use a `.display-italic` utility that includes the RTL reset). Arabic gets emphasis through Amiri 700, `champagne`/`champagne-700` color, or size — never slant.

### 2.2 Type scale

Base 16px = 1rem. Latin column is the CSS value; Arabic column is the effective `[dir="rtl"]` value (existing optical bumps, now canonical).

| Step | Latin size / line-height | Arabic size / line-height | Use |
|---|---|---|---|
| `display-xl` | `clamp(3rem, 6vw + 1.5rem, 7rem)` / 1.02 | same / **1.2** | Home hero only |
| `display-lg` | `clamp(2.25rem, 3.5vw + 1rem, 4.25rem)` / 1.08 | same / **1.25** | Section titles, product page H1 |
| `display-chapter` | `clamp(1.875rem, 3.5vw + 0.75rem, 4.25rem)` / 1.1 | same / **1.3** | Package chapter names |
| `display-md` | `clamp(1.75rem, 2vw + 1rem, 2.75rem)` / 1.15 | same / 1.3 *(add — currently missing an RTL override)* | Shop H1, checkout H1 |
| `text-2xl` | 1.5rem / 2rem | 1.5rem / 2.1rem | Card titles (large) |
| `text-xl` | 1.25rem / 1.75rem | **1.375rem** / 1.9rem | Product card names, poetry lines |
| `text-lg` | 1.125rem / 1.75rem | 1.125rem / 1.85rem | Lead paragraphs |
| `text-base` | 1rem / 1.5rem | **1.0625rem** / 1.7rem | Body |
| `text-sm` | 0.875rem / 1.25rem | **0.9375rem** / 1.5rem | Secondary body, buttons |
| `text-xs` | 0.75rem / 1rem | **0.8125rem** / 1.3rem | Meta, badges |
| `eyebrow` | 0.7rem / 1 / tracking 0.35em / uppercase / 500 | **0.95rem** / tracking **0.12em** | Section eyebrows (color at call site: `champagne` on dark, `champagne-700` on light) |

**Letter-spacing rules (binding, F4):**

- Arabic joined script tolerates at most **0.12em** tracking; 0 is preferred for anything below 0.95rem.
- Introduce a **`.label-caps`** utility — `font-sans text-xs font-medium uppercase tracking-[0.2em]`, with `[dir="rtl"] & { letter-spacing: 0.06em; font-size: 0.8125rem }` — and migrate all inline `uppercase tracking-[0.15–0.3em]` labels (badges, audience chips, CTA text, sold-out tags) to it. Latin display headlines may keep `tracking-[0.06–0.08em]`; add `[dir="rtl"]` resets to `tracking-normal` where those utilities appear on translatable text.

**Numerals & prices (F7, binding):** Western Arabic digits (0-9) in **both** locales — matches current behavior, keeps parity between storefront, receipt email, and admin. All prices set `tabular-nums`. Price pattern: `{amount} {currency-label}` where currency is the translated string ("JD" / "د.أ") — order handled naturally by RTL text flow, no manual reordering. Struck-through sale price precedes the live price with logical margin (`me-2`). Do not introduce Eastern Arabic numerals (٠-٩) anywhere.

## 3. Spacing, containers, breakpoints

- **Spacing:** Tailwind default 4px scale — keep. Canonical rhythm: section padding `py-20 md:py-28` (dark feature sections may go `py-24 md:py-32`); intra-section gaps `gap-8 md:gap-12`; card grid gaps `gap-x-4 gap-y-10 sm:gap-x-6`; stack spacing inside cards `space-y-1.5`/`space-y-2`. Always logical properties (`ps/pe/ms/me/start/end`) — never `left/right/pl/pr` on directional layout.
- **Containers:** default `mx-auto max-w-6xl px-4 sm:px-6 lg:px-8` (1152px). Narrow (checkout, long-form) `max-w-4xl` (896px). Prose `max-w-2xl` (672px). Full-bleed sections wrap an inner default container.
- **Breakpoints:** Tailwind v4 defaults — `sm 640` / `md 768` / `lg 1024` / `xl 1280` / `2xl 1536`. No custom breakpoints. Mandatory test widths: 360 (small phone), 390, 768, 1024, 1440, 1920. Product grid: 2 columns < `sm`, 4 columns ≥ `sm` (current `sizes="(max-width:640px) 50vw, 25vw"` stays truthful).

## 4. Radii, borders, shadows

- **Radius:** `--radius: 0.25rem` — **keep** (sharp = brand). Derived steps stay. Brand-level surfaces (product images, hero media, chapter imagery, primary CTA) are `rounded-none` — square-cut is the luxury signature; shadcn controls keep their small radii for affordance.
- **Borders:** hairlines only. Light surfaces `border-obsidian/12` (`#0b0e171f` — keep as `--border`); dark surfaces `border-moon/10` (`#f4eedf1a`) or, new, `border-silver-500/25` for cool metallic hairlines. Accent borders: `champagne/40` (dark) / `champagne-700/30` (light). Audience chips: `wine/30` and `midnight-500/30` at `/[0.06]` fills — keep exactly.
- **Shadows (F6):** the system is **border-and-surface driven, not shadow driven.** Only three sanctioned elevations:
  - `elevation-0`: none — default for everything on the storefront.
  - `elevation-overlay`: drawer/dialog/popover — `shadow-xl` equivalent `0 20px 50px -12px rgb(11 14 23 / 0.35)` plus its border; nothing else may use it.
  - `elevation-glow` (decorative, dark only): `0 0 60px -20px rgb(196 161 94 / 0.25)` champagne halo for hero bottle imagery — never on text or controls.

## 5. Components

All specs use token names from §1. States listed per component; anything unlisted inherits the shadcn/@base-ui behavior already in `src/components/ui/`.

### 5.1 Buttons (`src/components/ui/button.tsx` — extend, don't rewrite)

Keep the six existing variants and sizes for admin/UI chrome. **Add** one brand variant and one size so the storefront CTA stops being an inline override (F4):

- **New size `xl`:** `h-12 px-8 text-sm tracking-[0.2em] uppercase sm:px-14` → 48px height (≥44px touch target, F5). RTL: tracking drops to `0.06em` via `.label-caps` composition.
- **New variant `luxe`:** `rounded-none bg-champagne text-obsidian hover:bg-champagne-200 transition-colors duration-300` (7.90:1 → 13.79:1). This is Add-to-Cart / Checkout / hero CTA: `<Button variant="luxe" size="xl">`.
- **Variant `luxe-outline`** (secondary CTA on dark): `rounded-none border-moon/30 text-moon hover:border-champagne hover:text-champagne-200 bg-transparent`.

States (all button variants):

| State | Spec |
|---|---|
| Hover | Color shift only (bg or border), 300ms; no scale/shadow on the button itself |
| Focus | `focus-visible:ring-3 ring-ring/50 border-ring` (ring now passes 1.4.11 on both surfaces per §1.3) |
| Active | Existing `translate-y-px`; luxe CTAs additionally get Motion `whileTap scale 0.97` (spring 400/17 — current add-to-cart behavior, canonized) |
| Disabled | `opacity-50 pointer-events-none`; sold-out CTA style: `bg-obsidian/10 text-taupe` (replaces failing `text-night/50`, F3) |
| Loading | Spinner (`size-4 animate-spin`) replaces the leading icon slot; label stays visible; `aria-busy="true"`; min-width preserved so the button doesn't jump |

**Base UI note:** Button has no `asChild` — links use `render={<Link href=... />}` (existing convention, binding).

### 5.2 Inputs / forms (`input.tsx`, `textarea.tsx`, `select.tsx`, `label.tsx`, `radio-group.tsx`)

- Storefront checkout inputs: `h-12 px-4 text-base` (F5); admin keeps `h-8`. Implement as a `size` prop or a `.input-luxe` class — do not fork the component.
- Surface: `bg-transparent border-input` on ivory; on dark panels `bg-moon/5 border-moon/20 text-moon placeholder:text-silver-500`.
- Focus: `border-ring ring-3 ring-ring/50` (champagne-700 ring on light — §1.3).
- Error: `aria-invalid` drives `border-destructive ring-destructive/20`; message below in `text-sm text-destructive` (`#9d2f2f`, 6.52:1) with the field's `aria-describedby`; never color-only — include text.
- Labels: `.label-caps` styling, `text-taupe` on light; required marker is text ("required"/"مطلوب") not `*`-only.
- RTL: text fields inherit direction automatically; phone/number inputs set `dir="ltr"` with `text-align: end` inside RTL layouts so digits don't reorder.

### 5.3 Cards

- **Standard card (light):** `bg-ivory-bright border border-obsidian/12 rounded-lg p-6`; heading `font-display text-2xl text-obsidian`; body `text-sm text-taupe`. No shadow (elevation-0).
- **Dark panel:** `bg-midnight-800 border border-moon/10 rounded-lg p-6`; heading `text-moon`; body `text-silver-300`.
- Hover (linked cards only): border shifts to `champagne-700/40` (light) / `champagne/40` (dark), 300ms; no lift.

### 5.4 Product card (canonize `product-card.tsx` — it is already the spec)

- Image: `aspect-[4/5]`, `rounded-none`, `bg-obsidian` behind, inside `TiltCard`; image `scale-105` over 700ms on hover; obsidian gradient scrim fades in from bottom (`from-obsidian/40`).
- Badges (top-start, logical `start-3 top-3`): sale = `bg-champagne text-obsidian`, sold-out = `bg-obsidian/85 text-moon`; both `.label-caps`.
- Sold-out image treatment: `opacity-60 grayscale` — keep.
- Audience chip: moon-phase glyph + label, wine (women) / midnight-500 (men) at `/30` border, `/[0.06]` fill — keep.
- Name: `font-display text-xl uppercase tracking-[0.08em] text-obsidian` (RTL: `tracking-normal`), with the growing champagne underline (`h-px max-w-0 → max-w-full`, 500ms) — keep.
- Poetry: `font-display text-sm italic text-obsidian/65` — **RTL: `not-italic`** (F italic policy) — 6.2:1, passes.
- Price: `text-sm font-medium tabular-nums text-obsidian`; sale strike `text-obsidian/40` is decorative-adjacent but should move to `text-taupe` (5.20:1) since it carries the "was" price.
- Sold-out label under card: `text-taupe` (replaces `text-night/50`, F3).
- Empty grid state: centered `font-display text-lg text-taupe` message + `luxe-outline` link to home — pattern shared with cart-empty.

### 5.5 Navigation (header / footer / mobile menu)

- Header: `max-w-6xl` container; on dark hero pages transparent over Obsidian, `bg-obsidian/80 backdrop-blur` once scrolled; on light pages `bg-ivory/90 backdrop-blur border-b border-obsidian/12`.
- Nav links: `.label-caps text-moon/80 hover:text-champagne-200` (dark) / `text-obsidian/70 hover:text-champagne-700` (light); active page: full-opacity text + 1px champagne underline offset 6px. Focus per global ring.
- Cart badge: `bg-champagne text-obsidian` count bubble, `tabular-nums`, min 20px hit-adjacent (button target ≥44px).
- Mobile menu: full-screen Obsidian overlay, moon text, staggered RevealItem entries; locale switcher and cart reachable within it. All logical positioning so RTL mirrors (existing crescent-logo corner rule stays).
- Footer: `bg-obsidian text-silver-300`; headings `.label-caps text-champagne`; links `hover:text-moon`.

### 5.6 Modal / drawer

- **Cart drawer:** Base UI Sheet, side = `end` (flips automatically in RTL). Panel `bg-ivory` (or `bg-midnight-800 text-moon` if the rebuild goes dark-cart) with `elevation-overlay`; backdrop `bg-obsidian/60`. **Never wrap `SheetContent` in `AnimatePresence`** — Sheet owns mount/unmount via `data-starting-style`/`data-ending-style`; Motion animates only the drawer's contents (binding, existing gotcha).
- **Dialog:** centered, `max-w-[calc(100%-2rem)] sm:max-w-lg`, same backdrop/elevation; title `font-display text-2xl`.
- Both: focus trapped, Escape closes, focus returns to trigger (Base UI default — do not disable); first focus on the close button, not a destructive action.

### 5.7 Global state patterns (F8)

| State | Spec |
|---|---|
| Hover | Color/border shifts 300ms; images `scale-105` 700ms; never move layout |
| Focus | 2px outline or 3px ring in `--ring`, offset 2px; visible on every interactive element (existing base-layer rule — keep, binding) |
| Active | `translate-y-px` (controls) or tap-scale 0.97 (luxe CTAs) |
| Disabled | `opacity-50`, no pointer events; disabled-but-visible commerce options (card payment "coming soon") also get explanatory text, not opacity alone |
| Loading | Buttons per §5.1; page-level: skeleton blocks `bg-ivory-deep animate-pulse` (light) / `bg-midnight-700` (dark), radius matching the loaded content; respect reduced motion (pulse → static) |
| Error | Field-level per §5.2; page/section-level: bordered `border-destructive/30 bg-destructive/5 text-destructive` note with retry action; never toast-only for checkout failures |
| Empty | `font-display` sentence in `text-taupe` + one `luxe`/`luxe-outline` action; moon-phase glyph as decoration (cart-empty is the reference) |

## 6. Motion

Foundation is `src/components/motion/` — keep wholesale. Codified system:

- **Easing:** brand ease `cubic-bezier(0.22, 1, 0.36, 1)` (`EASE`) for all entrances/reveals; `ease-in-out` for perpetual loops (Float, aurora); spring `stiffness 400, damping 17` for tap feedback only.
- **Duration scale:** 150ms (micro state), 300ms (color/hover), 500ms (underlines, scrims), 700ms (RevealItem), 800ms (FadeUp), 900ms (LineReveal), 1100ms (ClipReveal); stagger 90ms, delay-children 100ms. Nothing between 1.2s and perpetual loops.
- **Vocabulary:** entrances = fade + rise (24–28px) or clip reveals; imagery = parallax ≤36px and slow float; no bounces, no spins, no neon pulses (direction rule 20: moonlight, not sci-fi).
- **RTL:** horizontal motion only via `useDir().dx()`; prefer y/opacity/scale/clip which need no flip. `LineReveal`'s clip padding (`pt-[0.12em] pb-[0.18em]` + negative margins) is load-bearing for Arabic glyphs — keep.
- **Reduced motion:** `MotionConfig reducedMotion="user"` + explicit `useReducedMotion` guards on scroll-linked `useTransform` styles and SVG attribute timelines (they bypass MotionConfig) + the global CSS kill switch. All three layers stay.
- **No-JS fallback:** `reveal-fallback`/`clip-reveal-fallback` 2.5s CSS force-reveal — keep; any new hidden-by-inline-style primitive must join this contract.
- **Admin:** no Motion imports — CSS + tw-animate-css only (keep).

# Risks

1. **Rename churn.** A hard rename of `night/gold/*` utilities would touch nearly every component. Mitigated by the deprecated-alias layer (§1.1): both names resolve to the same hex during the rebuild; aliases are deleted only when grep shows zero remaining uses.
2. **Ring-color change is user-visible.** Light-surface focus rings turn from bright gold to deep champagne. This is the compliant option; verify it reads as brand (it is the same hue family) rather than "brown" on the checkout form before rollout.
3. **Moon Silver drift.** Adding a cool family to a warm palette risks muddy mixing. Contained by the binding rule: silver on dark only, never on ivory, and never mixed with `taupe-bright` in the same text block.
4. **Tracking migration can regress Latin styling.** Moving inline tracked labels to `.label-caps` changes specificity; do it per-component with EN/AR visual checks, not via find-and-replace.
5. **CTA size change (h-9+py-7 override → tokenized h-12)** alters exact CTA heights by a few px; screenshot-diff product and checkout pages in both locales.
6. **Contrast figures assume opaque backgrounds.** Text over the aurora/starfield or imagery needs its scrim (e.g. `from-obsidian/40` gradients) verified per-instance — ratios in §1.2 don't transfer to photographic backgrounds.

# Verification / Testing

1. **Contrast (automated):** re-run the ratio computation for every pair in §1.2 (WCAG relative-luminance formula) in CI or as a one-off script whenever a hex changes; additionally run axe-core on home, shop, product, checkout, confirmation in both locales — expect zero `color-contrast` violations after the F2/F3 fixes.
2. **Focus:** keyboard-walk every page; every interactive element shows the ring; ring ≥3:1 against its surface (light: 5.20, dark: 7.90). Drawer/dialog: trap, Escape, focus return.
3. **RTL/Arabic:** for each rebuilt screen, side-by-side EN/AR screenshots at 360/768/1440 checking — no clipped Arabic ascenders/diacritics in display text and LineReveals; no synthetic italic in AR; no tracking >0.12em on Arabic; drawer opens from the correct side; audience chips, badges, and cart badge mirrored via logical properties; prices render `35 JD` / `35 د.أ` with Western digits.
4. **Touch targets:** on 360px viewport, every storefront control (CTA, quantity, nav, close buttons) hits ≥44×44px effective target.
5. **Motion:** with `prefers-reduced-motion: reduce` — no parallax, no float, no aurora drift, reveals collapse to opacity; with JS disabled — all content visible by ~3s via the CSS fallback.
6. **Regression guardrails:** grep gate before deleting aliases (`night|gold-|navy-lune` must be zero in `src/`); `npm run build` type check; screenshot diff of product card, add-to-cart, checkout form in both locales after the button/input size tokenization.
7. **Real-device check:** Android Chrome with Auto Dark Theme enabled — palette must render unchanged (`color-scheme: only light` intact).

# Phase D — UI System Consistency Check

Cross-check of this spec against `audits/UX_AUDIT.md`, `audits/RESPONSIVE_A11Y_AUDIT.md`, and `audits/ARCHITECTURE_REPORT.md` "# Phase B — Consolidated Target Architecture" (WP8–WP10, rulings T6/T7).

## Verdict

**Consistent, with six gaps in this spec (now closed below), one self-correction, and two scheduling/spec conflicts with proposed resolutions.** Phase B's T7 ruling adopts the deprecated-alias migration exactly as designed here (aliases first, either name valid, grep-gated deletion — no distortion), and WP8's scope list (palette + aliases, ring fix, silver family, opacity floors, `.label-caps`, italic policy, `luxe`/`xl` controls, elevation scale) is a faithful enumeration of §1–§5. RESP's contrast findings (C-1…C-4) all resolve under rules already in §1.2 (champagne-700-on-light, opacity floors); UX's sold-out and checkout error/success requirements are covered by §5.1/§5.2/§5.7. The remaining holes are components UX/RESP require that WP9–WP10 would otherwise have to improvise.

## Gaps in this spec — closed here (additions to §5)

**G1 — Trust strip (UX R1; required on home, product, cart drawer).** New component spec:
- Layout: full-width row, `flex flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-4`; three items = icon (lucide, `size-4`) + label. Wraps to a vertical stack naturally at 320px — no breakpoint needed.
- Light variant (ivory sections, product page, drawer): `border-y border-obsidian/12`; icon `text-champagne-700`; label `.label-caps text-obsidian/70` (≈6.6:1 — passes AA at label size).
- Dark variant (home, footer-adjacent): `border-y border-moon/10`; icon `text-champagne` (7.90:1); label `text-silver-300` (12.24:1).
- Content from tokens/constants only: COD, 2-day, and the fee interpolated from `DELIVERY_FEE` — never hardcoded; all three strings owner-confirmed per UX's risk note. One component reused in all three placements (UX's "one restrained component" risk mitigation), semantically a `<ul>` with three `<li>`.

**G2 — Skip link (RESP A-8, WP9).** First child of `<body>`: `sr-only focus-visible:not-sr-only` pattern; when focused: `fixed top-3 start-3 z-[100] bg-obsidian text-moon px-5 py-3 rounded-lg .label-caps` + standard ring. Obsidian-on-anything works on both page themes (16.65:1 on its own surface); translated key in both message files; target `<main id="main">`.

**G3 — Post-add confirmation row (UX R6/F11/F18).** Rendered beneath the `luxe` CTA after a successful add: `mt-3 flex items-center gap-4 text-sm text-taupe` — leading check icon `text-champagne-700 size-4`, text "In your cart", then two links `text-champagne-700 underline underline-offset-4 hover:text-obsidian` (5.20:1) with `py-2.5` (≥44px effective target with line box). Entrance: RevealItem-style fade+rise 0.25s `EASE`; static under reduced motion. Announcement handled by the global live region (RESP A-2) — the row itself is not `aria-live` (avoids double announcement).

**G4 — Filter pills, pressed state (RESP A-7, UX F20 → `aria-pressed` buttons).** Un-pressed: `border border-obsidian/20 text-obsidian/70 hover:border-champagne-700/40`; pressed (`aria-pressed="true"`): `bg-obsidian text-ivory border-obsidian` (17.25:1); focus per global ring; `flex-wrap` on the row + `px-4` below `sm` (RESP V-1 320px fix). No `role="tab"`.

**G5 — Storefront governorate select (UX R5).** The existing `ui/select.tsx` is admin-only and carries physical properties (RESP R-3). Checkout usage requires: `h-12 px-4 text-base` (matches §5.2 checkout inputs), chevron at `end-3` (logical — depends on WP9's `ui/*` logical-properties pass), popup `bg-ivory-bright border-obsidian/12 elevation-overlay`, item hover `bg-ivory-deep`, selected item `text-champagne-700 font-medium`, bilingual labels with a stable value key. Field itself is normal `dir` (Arabic labels flow RTL) — unlike phone/email which stay `dir="ltr"`.

**G6 — Homepage chapter price/contents line (UX R4).** When chapters gain image + price: price `font-sans text-sm font-medium tabular-nums text-obsidian` via `effectivePrice` (sale strike per §5.4 rules — `text-taupe`, never `/40`); set-contents line ("Eau de Parfum · Body Mist · Perfume Oil") `.label-caps text-obsidian/70`; chapter image reuses the §5.4 image treatment (4:5, `rounded-none`, ClipReveal) inside the existing alternating layout. WhatsApp affordances (UX R3) need no new component: footer link per §5.5 footer link spec; confirmation-page CTA = `luxe-outline` button (dark) with the wa.me href — flagging here that both render only owner-provided numbers.

## Self-correction

**§5.4 product-card name "RTL: `tracking-normal`" is wrong as written.** RESP R-1 correctly notes product names (Apollo/Orion/Elysia/Aurora) and "Lune" are **Latin even in AR** — luxury tracking on Latin runs inside RTL pages is fine and should be kept. Corrected rule: the RTL tracking reset (≤0.12em / `tracking-normal`) applies to **translated Arabic strings only**; Latin brand/product-name runs keep their EN tracking in both locales and additionally get `lang="en"` (RESP R-4). This also confirms the §2.2 choice of an **opt-in** `.label-caps` utility over RESP R-1's alternative blanket `[dir="rtl"] [class*="tracking-"]` selector — the blanket selector would strip tracking from exactly these Latin runs; RESP's own Risks section concedes this. Ruling: opt-in utility wins; RESP's global-selector option is rejected.

## Conflicts and resolutions

**X1 — Container spec vs RESP V-3 large-screen tier.** §3 says "max-w-6xl default, no custom breakpoints"; RESP recommends a `2xl:` enhancement (`2xl:max-w-7xl`, +1 body size step) for ≥1536px, and Phase B carries it into WP10 (RESP V-3). **Resolution: adopt RESP's tier — §3 is amended**: default container becomes `mx-auto max-w-6xl 2xl:max-w-7xl px-4 sm:px-6 lg:px-8`; narrow/prose containers unchanged; `2xl` remains a Tailwind default breakpoint so "no custom breakpoints" still holds. Display clamps already cap gracefully; no type change required beyond the optional +1 body step on `2xl` hero/lead text.

**X2 — P0 accessibility fixes scheduled at P2 inside WP8.** This spec rates the focus-ring failure (F2, 2.18:1) and sold-out text (F3) **P0**; RESP rates C-1 (gold "Coming soon" on the money path) **High**. Phase B folds all of them into WP8 ("Design-token layer… P2 — prerequisite for WP10"), because Phase 1 is defined as "no visual change." **Resolution: split, don't wait.** The three are one-line, alias-independent changes — light-mode `--ring`/`--sidebar-ring` → `#7c6132` in `globals.css`, `text-night/50` → `text-night/70` (or `#6b6553`), `text-gold` → `text-gold-deep` on the Coming-soon badge — all expressible in *current* token names, needing nothing from the WP8 token layer. Recommend a "WP8-lite" slice riding with the WP1-era P0 work: ships the AA conformance fixes months before the Phase 3 rebuild reaches those screens, changes nothing else visually. The full rename/alias layer stays P2 as ruled.

**X3 — Cart drawer side (T6) — alignment note, not a conflict.** §5.6 specifies `side = end`; Phase B's T6 ruling recommends exactly that (end-side, matching the desktop trigger) but defers to the owner and requires bundling with the sheet close-button fix (RESP A-5: localized label + `end-3`). §5.6 is therefore the *recommended* spec pending the owner decision; if the owner keeps start-side, only the `side` value changes — the close-button spec (localized, `end-3 top-3`, 44px target) applies either way and is hereby added to §5.6.

**Minor floor reconciliation (no conflict):** RESP C-4 asks `text-moon/65+` for ritual copy; §1.2's dark floor is `moon/60` (≈6.4:1 composite on obsidian — passes AA). Both are satisfied by any value ≥ the floor; per-instance recommendations above the floor (like /65 or /80-on-hover) are welcome. RESP C-3's purchase-panel struck price (`text-night/40`) is caught by the §1.2 light floor (`obsidian/65` minimum) — same remedy as the card instance: `text-taupe`.

## Remaining items WP9–WP10 need that are intentionally out of design-system scope

Live-region markup/debounce (RESP A-2 — invisible, no tokens), checkout focus management (behavioral), governorate list content and all trust-strip/policy/WhatsApp copy (owner-confirmed content, binding rules 4/6), and the mobile hero reorder (UX F19 — page layout, uses existing tokens). No further unspecified component or state was found against the UX target journey (arrive → discover → evaluate → add → cart → checkout → confirm) or the WP8–WP10 scope lists.
