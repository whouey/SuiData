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
scripts/     publish.sh (deploy) + demo_publish.ts (scripted publisher demo)
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

The app wires up `@mysten/dapp-kit` providers (testnet by default) and a wallet
connect button. The marketplace UI, Walrus upload/download (`src/lib/walrus.ts`),
and Seal encrypt/decrypt (`src/lib/seal.ts`) are stubbed with `TODO`s — see the
"current status" checklist in `CLAUDE.md`.

## Status

This is an early scaffold: contracts compile, the frontend builds, and the
storage/encryption/payment wiring is stubbed. Track progress in
[`CLAUDE.md`](./CLAUDE.md#current-status).
