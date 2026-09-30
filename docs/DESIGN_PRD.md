# VillageStock — Design PRD

**Product:** Offline-first business OS for electronics and gadget retailers (Computer Village–style multi-counter shops). Inventory, sales, repairs, credits, stock sessions, reports.

**Surfaces this system owns:** marketing site, auth, and authenticated app chrome. Component behavior stays shadcn/ui (New York, Radix, Lucide).

---

## Brand identity

| | |
|---|---|
| **Name** | VillageStock |
| **Positioning** | The counter OS for gadget shops — not generic inventory SaaS. |
| **Personality** | Fast at the till. Warm like a stall. Precise like an IMEI. |
| **Voice** | Direct, shop-floor English. No “unlock insights.” Prices and serials are first-class. |
| **Accent (pinned)** | `#00b398` — enamel teal on wood. Already on receipts and trial UI; do not quietly darken it. |
| **On-accent** | `#01201a` — teal fails white text (2.66:1). Dark ink on the fill. |
| **Accent text on paper** | `#017462` (accent-700, 5.31:1 on `#fbf6ee`). |

**Thesis:** A shop counter, not a SaaS dashboard.

---

## Inspiration (what we took)

### Pinterest — POS / till layouts
- Split catalog + receipt column (Winkel, Loyverse, Vend boards).
- Large tap targets, product tiles, a persistent cart.
- Hardware-counter energy: the UI should feel like it lives next to a card terminal.

### Are.na — restraint
- Chrome recedes; content is the color.
- One family per role, hierarchy from size/weight, not extra typefaces.
- Paper texture and warm neutrals over glow meshes and grid overlays.
- Editorial headlines (Fraunces italic) instead of Inter-800 gradient type.

### Mobbin — retail inventory
- Shopify inventory detail: photo + serial/status chips, scanner-first mobile.
- Live dashboard: a few honest numbers, not a widget wall.
- Square / Toast: low-stock and money glance stay one tap from the till.

**Rejected:** cool navy + cyan aurora (every fintech), purple leftover shadows, Inter for everything, white text on teal.

---

## Visual system

### Type
| Role | Face | Use |
|---|---|---|
| Display | **Fraunces** 500–700, italic allowed | Landing H1/H2, marketing emphasis |
| UI / body | **Geist** 400–700 | App, forms, nav, buttons |
| Numeric | **Geist Mono** + `tabular-nums` | Prices, IMEI, qty, timers |

Max three families. UI text ≥400 below 18px. Headings `text-wrap: balance`, descriptions `pretty`. Inputs 16px on coarse pointers (already enforced).

### Color (primitives → semantics)

Warm umber neutrals. Teal accent ramp pinned at 500. Status hues sit ≥15° from teal (~177).

| Ramp | 50 | 500 | 950 |
|---|---|---|---|
| Neutral | `#fbf6ee` | `#7a736a` | `#0f0c07` |
| Accent | `#e5fbf5` | `#00b398` | `#01201a` |
| Danger | `#fff0ee` | `#c53637` | `#370406` |
| Warning | `#fff3df` | `#e2a000` | `#3d2200` |
| Success | `#ebfaeb` | `#38853e` | `#09200b` |

Light page = paper `#fbf6ee`. Dark page = umber `#0f0c07`. No cool `#0b0f1a` navy.

### Radius (concentric)
`sm 6` / `md 10` / `lg 16` / `xl 24`. Outer = inner + padding when layers nest inside ~24px.

### Motion
`cubic-bezier(0.2, 0, 0, 1)`. Press `scale(0.96)`. High-frequency ≤150ms, named properties only. Motion wrapped in `prefers-reduced-motion: no-preference`. Theme switch: no color transitions.

### Layout
Group with space (2× inter vs intra). One filled primary action per view. Controls distinct from content. Dense professional tool — 14px UI is allowed.

---

## Skills applied

- **shadcn:** semantic tokens, existing components, no raw form controls.
- **better-colors:** ramps via culori/OKLCH, pinned brand, measured contrast.
- **better-typography:** scale, wrap, tabular nums, no 300-weight UI.
- **better-layout:** space-first grouping, logical edges, late collapse.
- **better-ui:** concentric radius, shadows for elevation, interruptible motion.
- **better-accessibility:** `:focus-visible`, 44px touch, no color-only status, reduced motion.

---

## Out of scope (follow-up)

Rewriting every `zinc-*` utility in leaf pages. New till split-pane IA. Custom Figma file.
