# SuiData

A Sui-native decentralized identity + data marketplace. Humans and AI agents hold
verifiable on-chain identities and publish structured datasets that are stored on
**Walrus**, encrypted/gated by **Seal**, and sold for **SUI**. Conceptually Ocean
Protocol, rebuilt on Sui's object model and aimed at the agentic web.

> Built for the **Sui Overflow 2026** hackathon. See [`CLAUDE.md`](./CLAUDE.md) for
> the full design + scope discipline.

## The demo

The one flow this MVP nails:

> An **agent publishes** a market survey → a **buyer pays SUI** → the buyer (and
> only the buyer) can **decrypt and read** it.

1. Agent creates an on-chain `Identity`.
2. Agent encrypts a dataset client-side (Seal), uploads ciphertext to Walrus.
3. Agent calls `marketplace::list_dataset` → a shared, browsable `Dataset`.
4. Buyer calls `marketplace::purchase` → pays the publisher, gets an `AccessGrant`.
5. Buyer decrypts via Seal (gated on holding the `AccessGrant`) and reads.

## Layout

```
move/        Sui Move package (identity + marketplace modules)
frontend/    Vite + React + TS dapp (@mysten/dapp-kit, @mysten/seal, @mysten/walrus)
scripts/     publish.sh (deploy) + e2e_demo.mjs (headless full-loop test)
```

## Prerequisites

- [`sui` CLI](https://docs.sui.io/guides/developer/getting-started/sui-install)
  (this scaffold was built against **1.73.1**, testnet).
- Node.js 20+ and npm.
- A Sui Wallet browser extension for the frontend.

## Contracts

```bash
cd move
sui move build          # compile
sui move test           # (no tests yet)
```

Publish to the active network (configure + fund an address first with
`sui client faucet`):

```bash
./scripts/publish.sh
```

Then copy the printed package id into `CLAUDE.md` (`PACKAGE_ID`) and into
`frontend/.env`:

```
VITE_PACKAGE_ID=0x<your-package-id>
```

### Modules

- `identity.move` — `create_identity(kind, name)`, `update_name(identity, name)`.
- `marketplace.move` — `list_dataset(...)`, `purchase(dataset, payment)`; emits
  `DatasetListed` and `PurchaseEvent`.

## Frontend

```bash
cd frontend
npm install
npm run dev      # local dev server
npm run build    # type-check + production build
```

The app wires up `@mysten/dapp-kit` providers (testnet by default) and walks the
full demo: create an identity, publish (encrypt via Seal → upload to Walrus →
`list_dataset`), browse/buy, and decrypt + read. See `src/components/` and
`src/hooks/useSuiData.ts`.

## Tests

```bash
cd frontend && npm run test:smoke          # Playwright: app renders, no errors
SUI_PRIVATE_KEY=suiprivkey... node scripts/e2e_demo.mjs   # full loop on testnet
```

`e2e_demo.mjs` runs the whole path headlessly (encrypt → Walrus → list →
purchase → `seal_approve` → decrypt) and asserts the plaintext round-trips and
that an unauthorized grant is denied.

## Deploy the frontend (Vercel)

The frontend is a static SPA — point Vercel at the `frontend/` subdirectory:

1. Push to GitHub and "Add New Project" in Vercel, importing this repo.
2. Set **Root Directory** = `frontend` (Framework auto-detects as Vite:
   build `npm run build`, output `dist`).
3. (Optional) add env var `VITE_PACKAGE_ID` — otherwise the published testnet
   id in `src/lib/network.ts` is used.
4. Deploy. Users need a Sui Wallet with a little testnet SUI to transact.

CLI alternative: `npm i -g vercel && cd frontend && vercel`.

## Status

End-to-end demo path is implemented: contracts are published to testnet, the
frontend builds and drives identity → publish → purchase → decrypt. Datasets
carry a public `preview` so buyers can evaluate before paying. Track remaining
polish in [`CLAUDE.md`](./CLAUDE.md#current-status).

## Roadmap (deliberately out of the MVP)

Kept out of scope to protect the one clean demo, but designed-for:

- **Verified-purchaser reviews.** A small `Review` object whose creation asserts
  the author holds an `AccessGrant` for the dataset, so only real buyers can
  rate. Honest framing required: this alone is **gameable by wash trading**
  (a seller buying their own dataset from a second account costs only gas, since
  the payment returns to them), so present it as "verified purchaser" feedback,
  not absolute trust.
- **Stake-backed reputation.** Make faking expensive: sellers stake SUI that can
  be slashed, and/or fees are burned/escrowed so wash trading has real cost.
  This is the prerequisite that turns review counts into meaningful reputation.
- **Sybil-resistant / verified identity.** Today an `Identity` only proves
  control of an address (self-asserted name + Human/Agent flag). Real seller
  *eligibility* needs zkLogin or on-chain attestations/credentials so one human
  ≠ many free identities.
- **Data bounties (demand side).** A `Bounty` object where a buyer escrows SUI
  for a described dataset and a seller fulfils it — very on-theme for agents
  posting and filling data requests.
- **Discovery.** Category/keyword filtering and sorting over listed datasets
  (the marketplace currently shows the full list from `DatasetListed` events).
