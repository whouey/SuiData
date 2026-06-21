# CLAUDE.md — OtterProof

**OtterProof — The verified data marketplace for the agent economy**

Guidance for Claude Code (and humans) working in this repo. Keep this file
authoritative so future sessions don't drift from the agreed design.

## Positioning (lead all copy with this)

OtterProof is a **verified data marketplace**. Lead every description with three
things, in this order:

1. **Identity for humans and agents** — both hold verifiable on-chain identities.
2. **Agents as autonomous buyers** — autonomous agents discover, buy, and decrypt
   datasets with no human in the loop, settled in SUI.
3. **A marketplace** — humans and agents publish verified datasets (stored on
   Walrus, gated by Seal) and sell access for SUI.

Do **NOT** describe OtterProof as a "data validation layer" or "data quality
protocol" — that is a different, existing project. Stay distinct: we are a
*marketplace* with *on-chain identity* and *agent buyers*.

## Project framing

- **Part 1 — Main implementation:** the reusable **identity + reputation +
  marketplace** primitive — the chain/use-case-agnostic core (Identity, Dataset,
  AccessGrant, Seal-gated decryption, SUI settlement).
- **Part 2 — Receipts as the example:** the first concrete vertical (everyday
  real-price data via receipt OCR) that proves Part 1 on stage. Receipts are the
  *example use case*, not the product.

## Project overview

**OtterProof** is a Sui-native decentralized identity + data marketplace. Humans and
AI agents hold verifiable on-chain identities and publish structured datasets that
are stored on **Walrus**, encrypted/gated by **Seal**, and sold for **SUI**.
Conceptually Ocean Protocol, rebuilt on Sui's object model and aimed at the
agentic web. Built for the **Sui Overflow 2026** hackathon.

## Scope discipline (READ THIS)

This is a hackathon MVP, judged on a clean end-to-end demo. The ONE demo we must
nail:

> An agent publishes a market survey → a buyer pays SUI → the buyer (and only the
> buyer) can decrypt and read it.

Everything else is roadmap. **Do not build:** reputation scoring, multi-chain,
token economics, search/discovery, or admin tooling. If a feature isn't on the
path to that one demo, leave a `TODO` and move on.

## Demo flow (mobile phone seller + laptop agent)

1. 📱 Seller signs in with Google (zkLogin/Enoki) on the phone — an `Identity` is
   created on first sign-in; gas is sponsored, so no wallet/seed/SUI is involved.
2. 📱 Seller photographs a receipt; `tesseract.js` OCRs it in-browser, it's
   encrypted client-side (Seal), the ciphertext is uploaded to Walrus → `walrus_blob_id`.
3. 📱 Seller's `marketplace::list_dataset(...)` creates a shared `Dataset` (metadata
   + `walrus_blob_id` + `seal_policy_id`), gas sponsored.
4. 💻 The autonomous agent (laptop CLI, its own funded wallet) finds the LATEST
   `Dataset` and calls `marketplace::purchase(dataset, coin)`. Payment goes to the
   publisher; an `AccessGrant` is minted to the agent atomically; `sales_count++`.
5. 💻 Agent requests decryption. Seal's on-chain policy checks it holds an
   `AccessGrant` for this dataset, releases keys, agent decrypts + decides.
6. 📱 The phone's proof screen polls on-chain and shows payment received,
   `sales_count`, and an explorer link.

(The CLI-only loop — `npm run demo:setup` + `npm run agent` — still works headless
for testing; see DEMO_RUNBOOK.md.)

## Tech stack + versions

- **Contracts:** Sui Move (Move 2024 edition). `sui` CLI 1.73.1 (testnet).
- **Storage:** Walrus (blob storage for dataset payloads).
- **Access control:** Seal (client-side encryption + on-chain decryption policy).
- **Frontend:** Vite + React + TypeScript + `@mysten/dapp-kit` + `@mysten/seal`.
  **Mobile web, mobile-first** (the seller scans a receipt on a phone), installable
  PWA (manifest + service worker) for fullscreen on stage.
- **Wallet:** **zkLogin via `@mysten/enoki`** (sign in with Google). No browser
  extension (phones have none), no seed phrase; **gas is sponsored** so the user
  never holds SUI. The extension/`ConnectButton` path is removed.
  - Enoki **public** key (`VITE_ENOKI_API_KEY`) = frontend zkLogin only.
  - Enoki **secret** key (`ENOKI_SECRET_KEY`, server-only) sponsors gas via the
    serverless function `frontend/api/sponsor.ts` (create→user signs→execute).
    `src/lib/sponsor.ts` drives it; `useOtterProof().run()` uses it for
    `create_identity`/`list_dataset` when zkLogin is configured. The agent's
    `purchase` is NOT sponsored (it has its own funded wallet).
- **OCR:** **`tesseract.js` in-browser** (keyless, client-side; assets self-hosted
  under `frontend/public/tesseract` via `npm run vendor:ocr` so OCR makes no
  network call). Falls back to a cached known-good receipt if it's slow/misreads.
- **Stage serving:** camera APIs need a secure context, so the phone hits the app
  over **real HTTPS** — a tunnel (`npm run demo:serve`, cloudflared/localtunnel,
  prints URL + QR) or a Vercel deploy. A LAN IP will NOT work.
- **Demo shape:** deliberate **phone (seller) + laptop (agent)** hybrid.

### Deployed package address

```
PACKAGE_ID = 0xc7bc64fe3eb7d93cfcd45949f6816f7a351789aa813e13457a3d1b6d5077cabf  # testnet
```

### Walrus

- Testnet publisher: `https://publisher.walrus-testnet.walrus.space`
- Testnet aggregator: `https://aggregator.walrus-testnet.walrus.space`
- Upload returns a `blobId`; store it on the `Dataset` object. See `frontend/src/lib/walrus.ts`.

### Seal

- Import from `@mysten/seal`. Encrypt client-side BEFORE the Walrus upload; plaintext
  never leaves the client.
- Policy = "caller holds an `AccessGrant` for this dataset." Decryption is gated on
  that on-chain check. See `frontend/src/lib/seal.ts`.

## Move object model (locked — do not re-litigate)

- **Identity** — an OWNED object. Fields: `id`, `owner`, `kind` (Human | Agent),
  `display_name`, `created_at`. Owned (not shared) so it composes into other
  objects and txns.
- **Dataset** — a SHARED object so anyone can read its metadata to browse. Fields:
  `id`, `publisher` (address), `title`, `description`, `category`, `preview`
  (public unencrypted teaser), `price` (u64, in MIST), `walrus_blob_id`,
  `seal_policy_id`, `created_at`.
- **AccessGrant** — an OWNED object minted to the buyer on purchase. Proves payment
  and is the on-chain condition Seal checks before allowing decryption.

## Module APIs

`identity.move`:
- `public fun create_identity(kind, name, ctx)` — transfers `Identity` to sender.
- `public fun update_name(identity, new_name)`.

`marketplace.move`:
- `public fun list_dataset(identity, title, desc, category, preview, price, blob_id, policy_id, ctx)`
  — creates shared `Dataset`, asserts caller owns an `Identity`.
- `public fun purchase(dataset, payment: Coin<SUI>, ctx)` — asserts
  `payment >= price`, sends payment to publisher, mints `AccessGrant` to buyer,
  emits `PurchaseEvent`.
- Events: `DatasetListed`, `PurchaseEvent`.

## Key design decisions (don't re-litigate)

- Encryption is client-side, before the Walrus upload. Plaintext never leaves the client.
- Seal policy = "caller holds an `AccessGrant` for this dataset." Decryption is gated on that.
- Payment flows through `purchase()`, never a raw transfer, so we can mint the grant atomically.
- Walrus `blob_id` and Seal `policy_id` are stored on the `Dataset` object as references.

## Repo layout

```
move/                 Sui Move package
  Move.toml
  sources/identity.move
  sources/marketplace.move
frontend/             Vite + React + TS mobile dapp (PWA)
  index.html          PWA meta (manifest, apple/standalone, theme-color)
  public/manifest.webmanifest, public/sw.js, public/icons/
  public/tesseract/   self-hosted OCR assets (gitignored; `npm run vendor:ocr`)
  src/App.tsx         routes: Login (zkLogin) → SellerFlow
  api/sponsor.ts      server sponsor (Enoki SECRET key): create + execute
  src/auth/enoki.ts   register Enoki Google wallet (public key, zkLogin)
  src/lib/sponsor.ts  client side of sponsored-tx flow (build→sign→execute)
  src/components/Login.tsx        Google sign-in (zkLogin), extension excluded
  src/components/SellerFlow.tsx   wizard: scan → publish → proof
  src/components/ScanReceipt.tsx  camera capture + tesseract OCR + fallback
  src/lib/ocr.ts      tesseract.js wrapper (progress, timeout, cached fallback)
  src/lib/receipt.ts  Receipt shape + cached known-good + toDataset()
  src/hooks/useOtterProof.ts  on-chain reads/writes incl. usePurchaseProof (polls)
  src/lib/walrus.ts, src/lib/seal.ts
scripts/
  publish.sh          publishes the Move package
  e2e_demo.mjs        headless full-loop test on testnet (encrypt→buy→decrypt)
  ocr.mjs             receipt photo → strict JSON (Anthropic vision, cached fallback)
  demo_setup.mjs      fund agent, create identities, publish a receipt dataset,
                      then start the HTTPS tunnel + QR (SKIP_TUNNEL=1 to skip)
  serve.mjs           Vite dev + HTTPS tunnel + QR (npm run demo:serve)
  vendor_tesseract.mjs  self-host tesseract.js assets (npm run vendor:ocr)
  agent.mjs           autonomous buyer: find LATEST→pay→fetch→decrypt→decide
  demo_reset.mjs      clear prepared listing + caches for a clean re-run
  lib/common.mjs      shared client/seal/walrus helpers (timeouts + fallbacks)
  lib/tunnel.mjs      cloudflared/localtunnel + QR (startTunnel)
  fixtures/           receipt.png + known-good receipt.json (OCR cache)
pitch/                static GTM slide material (NOT wired into the app)
DEMO_RUNBOOK.md       stage runbook: commands, script, failure fallbacks
```

Demo orchestration (root `package.json`): `npm run demo:setup`, `npm run agent`,
`npm run demo:reset`, `npm run ocr`. See `DEMO_RUNBOOK.md`.

## Verification (how to self-check)

- After Move changes: `cd move && sui move build` — must compile.
- After frontend changes: `cd frontend && npm run build` — must build.
- Report both results before moving on.

## Current status

- [x] CLAUDE.md created from brief.
- [x] `move/Move.toml` + stubbed `identity.move` and `marketplace.move` (signatures,
      structs, asserts; complex bodies are `TODO`).
- [x] `sui move build` compiles.
- [x] Vite React-TS frontend initialized; `@mysten/dapp-kit` + `@mysten/seal` installed.
- [x] README.md with setup steps + demo flow.
- [x] `purchase` splits exact `price` to publisher and returns change to buyer.
- [x] On-chain Seal policy `marketplace::seal_approve(id, grant, dataset)` added.
      Gate = caller holds an `AccessGrant` for the dataset AND `id` matches the
      dataset's `seal_policy_id` (a client-generated per-dataset id, stored as
      `vector<u8>`). This binding lets us encrypt BEFORE the dataset object
      exists and stops one dataset's grant decrypting another's.
- [x] `lib/seal.ts`: concrete encrypt/decrypt, `seal_approve` PTB builder,
      SessionKey helper, `getAllowlistedKeyServers` drop-in. `KEY_SERVERS`
      configured with Mysten's testnet key server (threshold 1).
- [x] `lib/walrus.ts`: HTTP publisher/aggregator upload+download.
- [x] Published package to testnet; `PACKAGE_ID` filled in (see above). UpgradeCap
      `0x3c91dfce9344b75153c475c117eb55255b878364772633a0876d925abae0b538`.
- [x] Frontend: identity creation, listing form, browse + purchase, decrypt + read.
- [x] **Mobile pivot**: zkLogin via Enoki (Google, sponsored gas) replaces the
      extension wallet; phone camera capture; in-browser tesseract.js OCR with
      cached fallback; mobile-first responsive UI; installable PWA.
- [x] Phone+laptop hybrid: `SellerFlow` (scan→publish→proof) on the phone,
      `npm run agent` on the laptop (now buys the LATEST listing).
- [x] Stage serving: `npm run demo:serve` / `demo:setup` start an HTTPS tunnel +
      QR; Vercel documented as the fallback. `npm run vendor:ocr` self-hosts OCR.
- [ ] zkLogin login, phone camera, and the HTTPS tunnel can only be fully verified
      on a real device/network (Enoki keys + hotspot) — not in CI. Build, 380px
      render, smoke test, and the laptop agent loop are verified.
