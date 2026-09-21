# Lune storefront continuation — 21 September 2026

Base: `master` at `2c481d9d6006cf538696abe03cf7ad184673c745`.
Working branch: `codex/lune-store-completion`.

## Delivered in this change

- Rebuilt the Arabic/English homepage with the supplied photography, the original gold emblem, the four real collections, set contents, scent selection, and the brand story. The homepage no longer downloads the background video.
- Preserved the approved catalog: Apollo/Orion for men, Elysia/Aurora for women; 35 JD per set, 3 JD delivery, cash on delivery. Existing admin price/stock edits remain authoritative.
- Replaced legacy product images only when their exact original paths match. Custom uploaded URLs and per-language custom descriptions remain unchanged. The supplied Apollo and Orion reference cards inform their descriptions; no new women's fragrance notes were invented.
- Added product gallery selection, stock-aware quantity controls, post-add cart access, persistent/cross-tab cart state, resilient storage parsing, and shareable audience filters.
- Improved Arabic directionality, localized accessible controls, keyboard skip navigation, validation error focus/ARIA, touch targets, and checkout/header contrast.
- Made email optional at checkout. Fresh server prices must agree with the displayed total; stale totals, duplicate slugs, and unsupported payment methods are rejected. A client submission lock suppresses double-clicks.
- Escaped receipt HTML; moved optional delivery into `after()` with independent error handling. A saved order is no longer rolled back because an email/cache notification fails. Confirmation no longer claims that email was always sent.
- Fixed admin cookie removal to use `/admin`, used timing-safe digest comparisons, validated order-status changes, and exposed recoverable save errors.
- Memoized product seeding per server instance and stopped unnecessary Arabic font preloads.

## Asset mapping

These are the owner's original files, copied without generated alterations. The same set can appear in multiple views of its collection.

| Supplied image | Repository asset | Use |
| --- | --- | --- |
| `01-1000024521.png` | `public/products/lune-women-set-portrait.png` | Aurora and women's gallery |
| `02-1000024520.png` | `public/products/lune-women-set-wide.png` | Elysia, ritual and women's gallery |
| `03-1000024518.png` | `public/products/lune-men-set-lounge.png` | Hero, Apollo and men's gallery |
| `04-1000024519.png` | `public/products/lune-men-set-moonlight.png` | Orion and men's gallery |
| `06-1000024511.jpg` | `public/products/lune-emblem.jpg` | Brand emblem |

Phone/Instagram screenshots are copy references, not storefront photography.

## Verified locally

- `npm run lint`: passes.
- `npm run test`: **5/5** regression tests pass (cart validation, sale boundaries, receipt escaping, custom media/copy preservation).
- `npm run build`: passes, including TypeScript and all 19 static pages.
- `npm run test:e2e`: **9/9** browser scenarios pass against the local production server. Database and mail environment variables are explicitly disabled for the test server; test orders use local development storage only.
- Both languages: filtering, product galleries, cart quantity updates, navigation to checkout, validation focus, an email-less order, cart clearing in another tab, and confirmation rendering. A double-click writes exactly one local order at the expected 73 JD total for two sets.
- Both checkout locales: axe WCAG 2 A/AA reports zero violations in the validated error state. This is not a full-site accessibility certification.
- Server action requests with a stale total, duplicate line items or card payment produce an error and write no order.
- Admin login/logout removes the cookie at the correct path; the protected orders page again requires login.
- Home overflow checked in both languages at 320, 360, 390, 414, 640, 768, 820, 1024, 1280, 1536, 1920, 2560 and 3840 px. Desktop/mobile screenshots reviewed visually.

To reproduce: install with `npm ci`, run the build and unit checks without production environment variables, install Chromium with `npx playwright install chromium`, then run `npm run test:e2e`. An existing compatible Chromium executable can be selected using `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

## Cloudflare compatibility work

Next and eslint-config-next are pinned to **16.3.3**; OpenNext **1.20.6** and Wrangler **4.135.0** are pinned development dependencies. Config includes Node compatibility, static assets, the image binding, R2 incremental cache, the durable-object queue and sharded tag cache. The deployed-environment database guard now recognizes Cloudflare markers.

The local OpenNext build creates `.open-next/worker.js`. This proves compilation only. OpenNext warns that Node middleware support is experimental; `src/proxy.ts` is retained.

`wrangler deploy --dry-run` was blocked by automatic approval review because it could send the generated application bundle or metadata to Cloudflare without explicit authorization. It was not retried through another route. No Cloudflare resource provisioning, preview deployment, production deployment or DNS change was performed.

**CF-0 is not closed:** Workers locale routing (G1), real tag invalidation using an isolated Neon branch (G2), the Workers 404 (G3), and compressed deploy bundle size/reproducibility (G4) still need the approved runtime check and isolated database configuration. The local Next browser tests do not substitute for these gates.

## Remaining before a production launch

The existing audit roadmap remains open. This change is a reviewable storefront completion pass, not a declaration that every WP is complete. In particular:

- Random, revocable server-side admin sessions and durable login throttling (WP1).
- Durable server idempotency, atomic multi-item inventory/order handling and drift checks (WP2). The tested client lock does not prevent network replay.
- Public write abuse/rate limiting and the planned upload-token hardening (WP3).
- Bounded admin queries, remaining payload/performance work and the complete page/locale accessibility matrix.
- Confirmed contact/WhatsApp, delivery coverage/timing and customer-facing policies. No phone number or return policy was invented. The existing receipt's two-day delivery statement still needs owner verification.
- Live Neon, verified email sender, and hosting configuration must be checked in an authorized non-production environment before cutover. Production data was not accessed or migrated in this pass.

The confirmation page validates the order-reference shape and reveals no customer data. It intentionally does not query an order; a reference-shaped URL is not proof of a recorded order.
