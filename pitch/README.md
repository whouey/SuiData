# Pitch assets (static — NOT wired into the app)

This folder holds pitch-deck material only. Per scope discipline, none of this is
integrated into the product. Do not build LINE integration or the MOF / e-invoice
API — they live here as a slide / mockup.

---

## Title slide

# OtterProof
### The verified data marketplace for the agent economy

**The lead (say it in this order):**

1. **Identity for humans and agents.** Both get verifiable on-chain identities on
   Sui — the basis for trust and reputation.
2. **Agents are the buyers.** Autonomous agents discover, purchase, and decrypt
   datasets with no human in the loop, paying in SUI.
3. **It's a marketplace.** Anyone publishes verified datasets (stored on Walrus,
   gated by Seal); sellers earn SUI and build on-chain reputation.

**Two parts:**

- **Part 1 — the primitive:** a reusable, chain/use-case-agnostic identity +
  reputation + marketplace core.
- **Part 2 — the example:** receipts (everyday real-price data via on-device OCR)
  as the first vertical that proves the primitive live.

> Not a "data validation layer" or "data quality protocol" — OtterProof is a
> *marketplace* with on-chain identity and autonomous agent buyers.

---

## Go-to-market slide: Taiwan receipt lottery → data supply

**Insight.** Taiwan's *uniform-invoice lottery* trains the whole population to
keep and scan receipts (every receipt is a lottery ticket). That habit is a
ready-made, nationwide pipeline of structured consumer-purchase data.

**Wedge.** Meet users where they already are — a **LINE** mini-app that scans the
receipt they're already keeping, turns it into an OtterProof dataset, and pays them
when an agent buys it. Zero new behavior to learn.

**Flow (mockup only):**

```
LINE bot  →  scan receipt (OCR)  →  encrypt + list on OtterProof  →  agent buys  →  SUI to user
```

**Why now.** Autonomous agents need fresh, verifiable, real-world data and can
pay for it natively in SUI. Supply (receipt-scanning habit) meets demand
(agentic buyers).

> TODO(pitch): drop the LINE mini-app mockup PNG and the MOF e-invoice API
> architecture diagram here as static images for the deck. These are
> illustrative only and must not be wired into `frontend/` or `scripts/`.
