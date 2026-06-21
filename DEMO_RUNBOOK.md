# OtterProof — Live Demo Runbook (mobile phone + laptop)

A ~3–4 minute **phone + laptop hybrid** demo. A consumer scans a **real paper
receipt with their phone** (mobile web, zkLogin — no wallet, no seed phrase, no
gas), which encrypts it and lists it on Sui. On the **laptop**, an autonomous
agent finds it, pays SUI, decrypts it, and decides — no human in the loop. The
**phone** then updates to show the payment + on-chain proof.

The on-chain steps are real testnet transactions. The OCR and the agent's
data-fetch have silent cached fallbacks, so a flaky network never breaks the flow.

---

## What runs where

| Device | Role | What it runs |
|---|---|---|
| 📱 Phone (mirrored to screen) | Seller | The mobile web app over HTTPS: sign in → scan → list → proof |
| 💻 Laptop | Agent + host | `npm run demo:serve` (HTTPS tunnel) and `npm run agent` |

---

## 0. One-time prep (before stage)

### a) Enoki zkLogin + sponsored gas (REQUIRED — do this once, well ahead)

Enoki has **two** API keys and they do different jobs (this trips people up):

| Key | Where it goes | Job |
|---|---|---|
| **Public** `enoki_public_…` | frontend (`VITE_ENOKI_API_KEY`) | zkLogin sign-in. **Cannot** sponsor gas. |
| **Secret** `enoki_private_…` | **server only** (`ENOKI_SECRET_KEY`) | Sponsored Transactions. **Never** ship to the browser. |

> The portal will say *"Sponsored transactions can not be enabled for public API
> keys"* — that's expected. Sponsorship lives on the **secret** key, used by our
> server function `frontend/api/sponsor.ts` (the production pattern: the user
> signs, the server pays gas, so the phone holds no SUI).

Steps:
1. Create an app at https://portal.enoki.mystenlabs.com.
2. **Google OAuth client** (Google Cloud Console → OAuth client ID, type Web).
   Authorized origin + redirect = your HTTPS demo URL (Vercel recommended).
3. Create a **Public** key → that's `VITE_ENOKI_API_KEY` (frontend).
4. Create a **Secret** key → **enable Sponsored Transactions**, network testnet,
   allowlist `…::identity::create_identity` and `…::marketplace::list_dataset`,
   and **fund the sponsor** with testnet SUI. That's `ENOKI_SECRET_KEY` (server).
5. Set vars:
   - `frontend/.env` (local) / Vercel **client** env: `VITE_PACKAGE_ID`,
     `VITE_ENOKI_API_KEY`, `VITE_GOOGLE_CLIENT_ID`.
   - Vercel **server** env (NOT prefixed VITE_): `ENOKI_SECRET_KEY`.

> Without the public key + Google client, the phone shows a "zkLogin not
> configured" notice. Without the secret key on the server, sign-in works but
> listing fails to sponsor. The Google OAuth origin/redirect MUST equal the exact
> HTTPS URL you demo on (register the Vercel URL).

> **Local sponsorship:** `vite dev` doesn't run the `/api` function. To test
> sponsorship locally use `vercel dev` (runs the serverless function), or just
> demo from the Vercel deployment.

### b) Install + vendor OCR assets + on-chain setup
```bash
export SELLER_PRIVATE_KEY=suiprivkey...     # funded testnet wallet (≥0.5 SUI)
npm install
(cd frontend && npm install)
npm run vendor:ocr        # self-host tesseract.js (OCR makes NO network call)
SKIP_TUNNEL=1 npm run demo:setup   # fund agent, create identities, seed caches
```

### c) Serve the phone app over HTTPS (camera needs a secure context)
A phone hitting a LAN IP is **not** a secure context — the camera is blocked.
Use one of:

- **Tunnel (default):** `npm run demo:serve` — starts Vite + a tunnel and prints
  the **HTTPS URL + a QR code**. (`npm run demo:setup` without `SKIP_TUNNEL` also
  starts the tunnel after on-chain setup.) Uses `cloudflared` if installed, else
  `localtunnel`. Scan the QR with the phone.
- **Vercel fallback (most reliable):** deploy `frontend/` to Vercel
  (`vercel --prod`, set the `VITE_*` env vars in the project). Open the phone at
  the stable `https://<app>.vercel.app` URL. Use this if the venue blocks tunnels.

> The Google OAuth origin/redirect must equal whichever HTTPS URL you use.

### d) Backup recording
Screen-record one full run (phone scan → `npm run agent` → phone proof). If the
live network dies, play it. `FORCE_FALLBACK=1 npm run agent` shows the agent
surviving a dead network; airplane-mode on the phone shows OCR falling back.

---

## Stage reliability checklist
- **Cellular hotspot, never conference WiFi** — for BOTH phone and laptop. (Tunnels
  and Walrus/Seal/RPC all need stable outbound.)
- **Phone screen-mirroring — test on the venue rig:**
  - iPhone: Lightning/USB-C cable → Mac → QuickTime "Movie Recording" → select the
    phone as camera/source; or AirPlay to the Mac if the network allows.
  - Android: `scrcpy` over USB (`brew install scrcpy`, enable USB debugging).
- **Verify the camera opens** on the phone before the talk (secure-context check).
- **Airplane-mode test**: with the phone offline, "Extract data" still yields the
  dataset via the cached fallback (OCR assets + data are local/cached).
- Pre-open: phone on the sign-in screen, laptop terminal ready with `npm run agent`.

---

## Beat 1 — 📱 Phone: scan the receipt  (~75s)

**Switch the screen mirror to the PHONE.**

**Do:** Sign in with Google (zkLogin — first time only). Tap **Open camera**,
photograph the receipt, tap **Extract data** (watch "Scanning… %"). The parsed
items appear; tap to list. The app encrypts (Seal), uploads to Walrus, and lists
on-chain — **gas is sponsored**, so no wallet prompt ever appears.

**Say:**
> "I'm a normal consumer. I sign in with Google — no wallet, no seed phrase. I
> photograph my receipt; OCR runs *on the phone*. It's encrypted in the browser,
> the ciphertext goes to Walrus, and it's listed on Sui. I never saw a gas fee or
> a private key — that's zkLogin and sponsored transactions."

**Fallbacks:** OCR slow/garbled/offline → silently uses the cached receipt (no
visible difference). Walrus slow → the listing still completes; if it errors,
re-tap (caches are warm from prep).

---

## Beat 2 — 💻 Laptop: the agent buys + decrypts  (~75s)

**Switch the screen mirror to the LAPTOP terminal.**

```bash
npm run agent
```

The agent targets the **latest** listing — the one the phone just made.

**Say (read the lines as they print):**
> "Now an autonomous agent — its own wallet, no human approving anything. It
> finds the listing my phone just posted… pays 0.05 SUI… gets an access grant…
> pulls the ciphertext from Walrus… decrypts via Seal because it holds the
> grant… and decides on the data."

Expected:
```
Found dataset: "Receipt · Daylight Coffee Roasters" — 0.0500 SUI from seller 0x…
Paying 0.0500 SUI…
Received access grant 0x…  (tx https://suiscan.xyz/testnet/tx/…)
Seller reputation: sales_count now 1
Fetching from Walrus… / Decrypting via Seal…
Prices: Pour-over (Ethiopia) 180, Almond croissant 95, Cold brew 500ml 130
Decision: approved — 405 TWD is within per-receipt policy; logged to expense report.
```

**Fallbacks:** Walrus/Seal failure → silent cached fallback (same receipt data);
the **payment is always real**, so Beat 3 still holds. 150s watchdog prevents
any hang; just re-run `npm run agent`.

---

## Beat 3 — 📱 Phone: proof  (~40s)

**Switch the screen mirror back to the PHONE.**

The seller's proof screen polls on-chain and updates by itself: **"Payment
received +0.05 SUI"**, **sales_count now 1**, and a **View payment on explorer**
link.

**Say:**
> "Back on my phone — payment received, the sale counter incremented on-chain,
> and here's the transaction on the explorer. A real-world receipt, sold to an
> AI agent, paid in SUI — and I only ever signed in with Google."

---

## Reset / re-run
```bash
npm run demo:reset      # clears the prepared listing + caches (keeps wallet)
SKIP_TUNNEL=1 npm run demo:setup
```
To re-run quickly, just scan again on the phone, then `npm run agent` again
(each run is a fresh purchase; `sales_count` keeps climbing).

---

## Quick reference

| Command | What it does |
|---|---|
| `npm run vendor:ocr` | Self-host tesseract.js assets (OCR makes no network call) |
| `npm run demo:setup` | On-chain prep, then start the HTTPS tunnel + QR |
| `SKIP_TUNNEL=1 npm run demo:setup` | On-chain prep only (no tunnel) |
| `npm run demo:serve` | Vite dev + HTTPS tunnel + QR (serve the phone app) |
| `npm run tunnel` | Tunnel an already-running dev server (prints URL + QR) |
| `npm run agent` | Laptop agent: find latest listing → pay → decrypt → decide |
| `FORCE_FALLBACK=1 npm run agent` | Same, but proves offline fallbacks work |
| `npm run demo:reset` | Clear listing + caches for a clean re-run |

**Scope note:** the Taiwan go-to-market (receipt-lottery habit + LINE
distribution) is a pitch slide only — see `/pitch`, intentionally not in the app.
