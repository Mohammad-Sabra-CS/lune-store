@AGENTS.md

# Lune — Online Perfume Store

Bilingual (English/Arabic RTL) e-commerce site for **Lune (Lunar Allure)**, a Jordanian perfume brand. Live at https://lune-store-ten.vercel.app.

## Business facts (do not invent products)

- Exactly **4 packages** defined in `src/data/products.ts`: Apollo & Orion (men), Elysia & Aurora (women). Each = Eau de Parfum (120ml men / 100ml women) + body mist + perfume oil.
- Price: **35 JD** per package (`PACKAGE_PRICE`), delivery **3 JD** flat (`DELIVERY_FEE`) — both in `src/lib/constants.ts`. Currency shown as "JD" / "د.أ".
- Payment: **Cash on Delivery only**. The Visa/card option is rendered disabled ("coming soon"); a Jordan gateway (PayTabs/HyperPay/Tap) is planned but NOT wired — the server action only accepts `paymentMethod: "cod"`.
- Delivery promise: "within 2 days" — currently only stated in the receipt email.

## Commands

```bash
npm run dev          # dev server (localhost:3000)
npm run build        # production build + type check
npx drizzle-kit push # apply src/lib/db/schema.ts to Neon (needs DATABASE_URL in env)
vercel deploy --prod # deploy (project: lune-store, team: mo-cd60)
```

## Architecture

- **Next.js 16 App Router** (Turbopack) + Tailwind v4 + shadcn built on **@base-ui** — Button has NO `asChild`; use `render={<Link href=... />}` instead.
- **i18n**: next-intl v4. Locale routing lives in `src/proxy.ts` (Next 16 convention — NOT middleware.ts; config export is named `config`). `/admin` and `/api` are excluded from locale routing. All user-facing strings go through `messages/en.json` + `messages/ar.json` — never hardcode UI text. Use `Link`/`useRouter`/`usePathname` from `@/i18n/navigation`, and logical properties (`start`/`end`, `ms-*`, `-end-0.5`) so RTL mirrors correctly.
- **Pages**: `src/app/[locale]/` → home, `shop`, `product/[slug]`, `checkout`, `confirmation`. `src/app/admin/` is its own root layout (English-only, `robots: noindex`).
- **Cart**: React context + localStorage (`src/components/cart/cart-context.tsx`), drawer via shadcn Sheet (side flips for RTL).
- **Orders**: `src/lib/orders.ts` — Neon Postgres via Drizzle when `DATABASE_URL` is set, else `.orders.dev.json` local fallback (gitignored). Checkout server action (`src/app/[locale]/checkout/actions.ts`) re-prices everything server-side; never trust client totals.
- **Receipt email**: `src/lib/email/receipt.ts` — bilingual branded HTML via Resend. Without `RESEND_API_KEY` it logs instead of sending, and email failure must never fail the order.
- **Admin**: `/admin`, cookie gate hashed from `ADMIN_PASSWORD` (`src/lib/admin-auth.ts`).

## Design system

- Tokens in `src/app/globals.css`: night `#0b0e17`, night-soft, gold `#c4a15e`, gold-bright, **gold-deep `#7c6132`** (gold text on light backgrounds — plain gold fails WCAG AA on ivory), moon `#f4eedf`, ivory `#f6f2e9`, wine (women's accent), navy-lune (men's accent). Radius is intentionally sharp (0.25rem) — luxury aesthetic.
- Fonts: Playfair Display (display, 400–600 + italic — italic is English-only; synthetic italic distorts Arabic) + Jost (body); Arabic falls through to Amiri + IBM Plex Sans Arabic via the font stack — no per-locale font switching needed. `[dir="rtl"]` display utilities get taller line-heights so Amiri glyphs don't clip.
- Aurora backdrop (`src/components/aurora.tsx` + `.aurora-*` utilities): drifting blurred color curtains + starfield on dark sections; `.aurora-wash` puts a faint tint on ivory sections; `.tint-wine`/`.tint-navy` add per-audience whispers.
- Motion: the `motion` package (`import ... from "motion/react"` — framer-motion is uninstalled). Foundation in `src/components/motion/`: `primitives.tsx` (Reveal/RevealItem/HeroReveal variants + stagger, LineReveal with Arabic-safe clip padding, Float, Parallax, ClipReveal, `useDir()` for RTL-safe x-motion), plus `tilt-card`, `spotlight`, `animated-number`, and a `MotionConfig reducedMotion="user"` provider in the locale layout. Scroll-linked styles and SVG attribute timelines still need explicit `useReducedMotion` guards. The `.eyebrow` utility sets no color — call sites add `text-gold` (dark bg) or `text-gold-deep` (light bg). Admin (`src/app/admin/`) deliberately imports no Motion — CSS + tw-animate-css only.

### Hard-won gotchas

- Decorative overlay utilities MUST use `background-image:`, never the `background:` shorthand — the shorthand resets `background-color` and once made entire dark sections render light (unreadable).
- Tailwind v4 preflight leaves buttons `cursor: default`; a base-layer rule adds `cursor-pointer` and visible `:focus-visible` outlines — don't remove it.
- Base UI Sheet (cart drawer) owns its mount/unmount via `data-starting-style`/`data-ending-style` CSS — never wrap `SheetContent` in `AnimatePresence`; Motion animates only the drawer's contents.
- Directory name `Lune` is uppercase; npm package name is `lune` and the Vercel project is `lune-store` (npm/Vercel reject capitals).

## Environment

| Var | Purpose |
|---|---|
| `ADMIN_PASSWORD` | `/admin` login (set locally and in Vercel prod/preview) |
| `DATABASE_URL` | Neon Postgres (provisioned via Vercel Marketplace integration) |
| `RESEND_API_KEY` | Receipt emails — currently NOT set, so emails are log-only |
| `EMAIL_FROM` | Sender address once a domain is verified in Resend |

## Deployment notes

- Vercel project `lune-store`, team `mo-cd60`; production alias **lune-store-ten.vercel.app**.
- This dev machine cannot reach `*.vercel.app` from curl/PowerShell (local TLS interception) — verify deploys with `vercel inspect <url> --wait`, not HTTP requests, and let the user check the site in their own browser.
