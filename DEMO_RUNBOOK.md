# SuiData — Live Demo Runbook

A ~3–4 minute stage flow: a seller turns a **paper receipt** into an encrypted,
for-sale dataset; an **autonomous agent** finds it, pays SUI, decrypts it, and
decides — no human in the loop; then we show the **on-chain proof**.

Everything below is rehearsed and has a fallback. The on-chain steps are real
testnet transactions; only the OCR and the agent's data-fetch have silent
cached fallbacks if the network misbehaves.

---

## 0. One-time prep (before you walk on stage)

```bash
# from repo root
export SELLER_PRIVATE_KEY=suiprivkey...        # a funded testnet wallet (≥0.5 SUI)
export ANTHROPIC_API_KEY=sk-ant-...            # optional: enables LIVE OCR
npm install            # root scripts deps
(cd frontend && npm install)
npm run demo:setup     # funds the agent wallet, creates identities, lists a dataset
(cd frontend && npm run dev)   # marketplace UI on http://localhost:5173
```

`demo:setup` prints the seller address, the agent address + balance, and the
dataset's explorer link. If it ends with "Ready. Known-good state", you're set.

> **Capture a backup recording now**: run `npm run demo:setup` then `npm run agent`
> once end-to-end and screen-record it. If the live network fails on stage, play
> the recording. (`FORCE_FALLBACK=1 npm run agent` also proves it survives a dead
> network — useful as a backup clip.)

---

## Beat 1 — Seller: receipt → encrypted dataset  (~60s)

**Do:** in the UI (or narrate the `demo:setup` output), show the receipt photo,
then the listing that appeared in the Marketplace with its **public preview**.

**Say:**
> "Here's a paper receipt. We run OCR to extract structured JSON — store, date,
> line items, total. We encrypt it *in the browser* with Seal, upload only the
> ciphertext to Walrus, and list it on-chain. Buyers see a free preview; the
> actual data is encrypted."

**What's real:** OCR (live if `ANTHROPIC_API_KEY` is set), Seal encryption,
Walrus upload, and the `list_dataset` transaction.

**Failure points & fallback:**
- *OCR misreads / API down* → it **silently** uses the cached known-good JSON
  (`scripts/fixtures/receipt.json`). No visible difference.
- *Walrus upload slow* → `demo:setup` already uploaded during prep; the listing
  is up. Just show the existing card.

---

## Beat 2 — Agent: find → pay → decrypt → decide  (~90s, the money moment)

**Do:** in a terminal:

```bash
npm run agent
```

**Say (read the lines as they print):**
> "This is an autonomous agent with its own wallet — no human approving anything.
> It finds the listing… pays 0.05 SUI from its own wallet… gets an access grant…
> pulls the ciphertext from Walrus… decrypts via Seal because it now holds the
> grant… and makes a decision on the data."

Expected output (each line appears as it happens):

```
Agent online: 0x… (identity 0x…)
Wallet balance: 0.19 SUI
Scanning marketplace…
Found dataset: "Receipt · Daylight Coffee Roasters" — 0.0500 SUI from seller 0x…
Paying 0.0500 SUI…
Received access grant 0x…  (tx https://suiscan.xyz/testnet/tx/…)
Seller reputation: sales_count now 1
Fetching from Walrus…
Decrypting via Seal…
Prices: Pour-over (Ethiopia) 180, Almond croissant 95, Cold brew 500ml 130
Decision: approved — 405 TWD is within per-receipt policy; logged to expense report.

✓ Agent run complete.
```

**What's real:** the `purchase` transaction (SUI actually moves; AccessGrant is
minted), the Walrus fetch, and the Seal decryption gated on the grant.

**Failure points & fallback:**
- *Walrus fetch fails* → silent fallback to cached ciphertext (note on stderr only).
- *Seal decrypt fails* → silent fallback to cached plaintext.
- *Anything hangs* → a 150s watchdog aborts; just re-run `npm run agent`.
- The **payment is always real** even when data fetch falls back, so the proof
  in Beat 3 still holds.

---

## Beat 3 — Proof  (~45s)

**Do:** switch to the Marketplace UI and **refresh**. On the dataset card show:
- **seller reputation**: `sales` and `datasets published` ticked up,
- the listing's **`X sold`** counter,
- click the **payment tx** link (printed by the agent / shown after a UI buy) to
  open Suiscan and show SUI landed in the seller's wallet.

**Say:**
> "On-chain proof: the sale counter incremented, and here's the payment to the
> seller on the explorer. The agent paid, got cryptographic access, and acted —
> fully autonomously."

---

## Reset / re-run

```bash
npm run demo:reset     # clears the prepared listing + caches (keeps wallet)
npm run demo:setup     # publishes a FRESH dataset (sales_count back to 0)
```

To simply run the agent again against the same listing, just `npm run agent`
again (each run is a new purchase; `sales_count` keeps climbing).

---

## Quick reference

| Command | What it does |
|---|---|
| `npm run demo:setup` | Fund agent, create identities, publish a receipt dataset |
| `npm run agent` | Autonomous find → pay → fetch → decrypt → decide |
| `FORCE_FALLBACK=1 npm run agent` | Same, but proves offline fallbacks work |
| `npm run ocr [img]` | Print the OCR JSON (live if key set, else cached) |
| `npm run demo:reset` | Clear listing + caches for a clean re-run |
| `npm run e2e` | Headless full-loop self-test (encrypt→buy→decrypt) |

**Scope note:** the Taiwan go-to-market (receipt-lottery habit + LINE
distribution) is a pitch slide only — see `/pitch`, it is intentionally not
wired into the app.
