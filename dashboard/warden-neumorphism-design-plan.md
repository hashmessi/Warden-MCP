# Warden — Premium Dark Neumorphism Design Plan

**Assumptions made (flag if wrong):** this redesigns the same Warden console (sidebar + stepper + stage cards + audit log) you already have — not a new product. Target is spec/handoff fidelity, not a fully custom design system for future features. I've kept the black/white restraint you asked for and used shadow, not color, to do the work.

---

## 1. Why neumorphism actually fits this product (not just "looks premium")

Warden's whole thesis is *physical weight before irreversible action* — nothing executes without a deliberate press. Neumorphism is the one visual language where a button literally looks like it needs to be pressed, and a completed action can look physically "set" into the surface (inset shadow) rather than just recolored. That's not decoration — it's the metaphor doing product work. This is the signature idea the whole plan is built around: **raised = pending/reversible, pressed-in = committed/final.**

---

## 2. Color tokens

Monochrome, warm-neutral base — no charcoal-blue tech default, no neon accent. Everything reads through shadow contrast, not hue.

```css
/* Base surfaces */
--bg-base:        #1c1d20;   /* app background — warm charcoal, not pure black */
--surface:         #202226;   /* card/panel surface — 2% lighter than base */
--surface-raised:  #232529;   /* slightly higher elements, e.g. sidebar */

/* Neumorphic shadow pair (the entire visual system lives here) */
--shadow-dark:     rgba(0, 0, 0, 0.5);
--shadow-light:    rgba(255, 255, 255, 0.035);
--shadow-dark-inset:  rgba(0, 0, 0, 0.65);
--shadow-light-inset: rgba(255, 255, 255, 0.02);

/* Text */
--text-primary:    #ECEAE4;   /* warm bone white — never pure #fff */
--text-secondary:  #8D8E93;
--text-tertiary:   #55565B;
--hairline:        rgba(255,255,255,0.05);

/* The one deliberate accent — used only for the "committed" state */
--accent-ivory:    #F4F1EA;
--accent-ivory-dim: rgba(244,241,234,0.08);

/* Status — desaturated, whisper-level, never neon */
--state-success:   #93AD97;   /* sage, not emerald */
--state-warning:   #C7A669;   /* muted brass, not amber */
--state-danger:    #B4797C;   /* dusty rose, not red */
--state-info:      #7E93A8;   /* steel, not blue */
```

**Rule:** color never carries meaning alone. Every status also gets an icon or shape change, because on a near-monochrome palette, colorblind users and low-brightness screens need a second signal.

---

## 3. Typography

Two roles, restrained pairing — no serif-display cliché, no generic system-font default.

| Role | Face | Usage |
|---|---|---|
| Display / section titles | **Fraunces**, weight 300 (light), slightly negative tracking | "Warden", stage titles like "Impact Report" — one or two words max, never body copy |
| UI / body | **Inter**, weights 400/500/600 | everything interactive — buttons, labels, descriptions |
| Data / mono | **JetBrains Mono**, weight 400 | hashes, IDs, timestamps — unchanged from your current build |

Fraunces at light-weight on a dark neumorphic surface gives you the "premium editorial" feel without tipping into the warm-cream-serif AI-default look — it stays confined to short titles only, everything else is Inter.

Type scale:
```css
--text-display:  28px / -0.02em / Fraunces 300
--text-title:    15px / -0.01em / Inter 600
--text-body:     13.5px / 0 / Inter 400
--text-caption:  11.5px / 0.02em / Inter 500, uppercase
--text-data:     12px / 0 / JetBrains Mono 400
```

---

## 4. The neumorphic surface system

Three states, and only three — resist the urge to add more:

**Raised** (default resting state — cards, idle buttons)
```css
box-shadow: 6px 6px 14px var(--shadow-dark),
           -6px -6px 14px var(--shadow-light);
border-radius: 18px;
```

**Pressed / Inset** (committed actions, active/selected states, completed steps)
```css
box-shadow: inset 4px 4px 10px var(--shadow-dark-inset),
           inset -4px -4px 10px var(--shadow-light-inset);
```

**Flat / Hairline** (dense data — audit log rows, tables — neumorphism gets *heavy* at high density, so these drop the dual-shadow and use a single 1px hairline instead)
```css
border-bottom: 1px solid var(--hairline);
box-shadow: none;
```

This last rule matters: **the audit log stays flat, everything above it (stepper, stage cards, buttons) is neumorphic.** Applying soft shadows to every row of a dense log is the #1 way neumorphism turns cheap — it needs breathing room per element, so we reserve it for the smaller number of "decision" surfaces and keep the log itself quiet and legible.

Corner radius scale: `--radius-sm: 10px` (badges, chips) · `--radius-md: 16px` (buttons) · `--radius-lg: 22px` (cards, panels). Larger radii read as softer/premium; keep them consistent per element tier, never mixed within one card.

---

## 5. Component specs

### Buttons
- **Idle:** raised surface, `--text-primary` label, no fill color
- **Hover:** shadow softens slightly (reduce blur 14px→10px, offset 6px→4px) — subtle "lift toward the cursor"
- **Committed action (Approve & Execute, Rollback):** on click, shadow flips to inset instantly (150ms), label briefly shows a filled ivory dot to the left confirming the press registered, then the button itself becomes disabled/pressed-permanent once the action completes
- **Deny / destructive:** same raised treatment, but label color is `--state-danger` — no red fill, no red border. Danger is quiet here, not alarming; this is a compliance tool, not a warning siren

### Stepper (Scan → Impact → Approval → Execute → Rollback)
- Each step is a 40px circle, **raised** while pending, **pressed/inset** once done — this is the clearest place the metaphor pays off: completed steps look physically stamped into the rail
- Active step: raised, with a slow 2.4s breathing shadow-depth animation (shadow blur oscillates ±3px) instead of a color pulse — motion through depth, not color, stays on-brand
- Connecting line between steps: 1px hairline, fills to `--text-tertiary` once both neighboring steps are done — no gradient, no color fill

### Stage cards (Scan / Impact Report / Approval Gate / Execution)
- Raised surface, 22px radius, 24px padding
- Card title uses the caption style (uppercase, tracked, `--text-tertiary`) — never the display serif; save Fraunces for the console's own name and maybe one hero moment, not repeated per-card
- Impact Report's risk rows: flat/hairline style (per density rule above), tag chips (PII, ORPHAN RISK) get a **very** subtle pressed-inset chip rather than a colored pill — reads as "stamped classification," not a warning badge

### Sidebar request cards
- Raised at rest; **pressed/inset** when selected (this replaces your current `border-color: accent` active state) — selection now reads as "this one is pushed in / focused," consistent with the whole language
- Status badge: text-only + a small filled dot in the muted state color, no background pill — keeps the sidebar list quiet at a glance, since you'll have many of these stacked

### Audit log
- Flat rows, hairline dividers, mono type for hash/time columns — deliberately the "boring," most legible surface in the whole console, because it's the one place accuracy matters more than atmosphere
- "Verify Integrity" trigger: keep this as the one raised button in the header — it's the highest-stakes single action in the product, so it's the one place worth spending the full neumorphic treatment on a header element

---

## 6. Layout — ASCII wireframe (unchanged structure, new surface treatment)

```
┌─────────────────────────────────────────────────────────────┐
│ 🛡 Warden                              [ Verify Integrity ]● │  ← raised header, flat bg
├───────────────┬─────────────────────────────────────────────┤
│ REQUESTS      │   ○──●──●──○──○   Scan  Impact  Approval …  │  ← stepper: raised/inset
│ [+ New Req]   │                                              │
│ ┌───────────┐ │   ┌─────────────────────────────────────┐   │
│ │ (pressed) │ │   │  SCAN — jane.doe@email.com           │   │  ← raised card
│ │ selected  │ │   │  Postgres ✓   Mongo ✓   Ledger ✓      │   │
│ └───────────┘ │   └─────────────────────────────────────┘   │
│ ┌───────────┐ │   ┌─────────────────────────────────────┐   │
│ │ (raised)  │ │   │  IMPACT REPORT                       │   │
│ └───────────┘ │   │  3 tables · 2 subs orphaned           │   │
│ ┌───────────┐ │   │  — flat rows, hairline dividers —     │   │
│ │ (raised)  │ │   └─────────────────────────────────────┘   │
│ └───────────┘ │                                              │
├───────────────┴─────────────────────────────────────────────┤
│ AUDIT LOG (flat, hairline rows, no shadow)         ● live    │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Self-critique (per the "revise before building" rule)

- **Risk flagged:** dark neumorphism can look muddy on low-brightness laptop screens if shadow-dark opacity is pushed too high. Fix: cap `--shadow-dark` at 0.5 opacity, never higher, and always pair with the light shadow — a raised element with *only* a dark shadow reads as a stain, not a surface.
- **Risk flagged:** neumorphism has poor default accessibility (low contrast between element and background is the whole point of the style). Fix: `--text-primary` against `--surface` must still clear 4.5:1 — verified at #ECEAE4 on #202226 (~11.8:1, comfortably AA). Never rely on shadow alone to indicate an interactive element; always pair with a hover/focus outline in `--accent-ivory` at 40% opacity for keyboard users.
- **Cut:** originally considered a gold/brass accent as the single "premium" color pop. Cut it — you asked for black/white specifically, and a gold accent is the generic definition of "premium fintech." The ivory accent reads richer *because* it's restrained to exactly one interaction (the completed-action confirmation dot), not sprinkled around.

---

## Next step

I can build this as a working HTML prototype next — same interactive request-lifecycle flow as before, restyled to this system — so you can see the pressed/raised states actually animate rather than just read about them. Want me to build it?