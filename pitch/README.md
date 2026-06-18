# Pitch assets (static — NOT wired into the app)

This folder holds pitch-deck material only. Per scope discipline, none of this is
integrated into the product. Do not build LINE integration or the MOF / e-invoice
API — they live here as a slide / mockup.

## Go-to-market slide: Taiwan receipt lottery → data supply

**Insight.** Taiwan's *uniform-invoice lottery* trains the whole population to
keep and scan receipts (every receipt is a lottery ticket). That habit is a
ready-made, nationwide pipeline of structured consumer-purchase data.

**Wedge.** Meet users where they already are — a **LINE** mini-app that scans the
receipt they're already keeping, turns it into a SuiData dataset, and pays them
when an agent buys it. Zero new behavior to learn.

**Flow (mockup only):**

```
LINE bot  →  scan receipt (OCR)  →  encrypt + list on SuiData  →  agent buys  →  SUI to user
```

**Why now.** Autonomous agents need fresh, verifiable, real-world data and can
pay for it natively in SUI. Supply (receipt-scanning habit) meets demand
(agentic buyers).

> TODO(pitch): drop the LINE mini-app mockup PNG and the MOF e-invoice API
> architecture diagram here as static images for the deck. These are
> illustrative only and must not be wired into `frontend/` or `scripts/`.
