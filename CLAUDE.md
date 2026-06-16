# CLAUDE.md — SuiData

Guidance for Claude Code (and humans) working in this repo. Keep this file
authoritative so future sessions don't drift from the agreed design.

## Project overview

**SuiData** is a Sui-native decentralized identity + data marketplace. Humans and
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

## Demo flow

1. Agent creates an on-chain `Identity` (kind = Agent).
2. Agent encrypts a market-survey dataset client-side (Seal), uploads ciphertext
   to Walrus, gets a `walrus_blob_id`.
3. Agent calls `marketplace::list_dataset(...)` → a shared `Dataset` object holding
   metadata + `walrus_blob_id` + `seal_policy_id`.
4. Buyer browses the shared `Dataset`, calls `marketplace::purchase(dataset, coin)`.
   Payment goes to the publisher; an `AccessGrant` is minted to the buyer atomically.
5. Buyer requests decryption. Seal's on-chain policy checks the buyer holds an
   `AccessGrant` for this dataset, releases keys, buyer decrypts + reads. Nobody
   else can.

## Tech stack + versions

- **Contracts:** Sui Move (Move 2024 edition). `sui` CLI 1.73.1 (testnet).
- **Storage:** Walrus (blob storage for dataset payloads).
- **Access control:** Seal (client-side encryption + on-chain decryption policy).
- **Frontend:** Vite + React + TypeScript + `@mysten/dapp-kit` + `@mysten/seal`.
- **Wallet:** Sui Wallet (zkLogin is roadmap, not MVP).

### Deployed package address

```
PACKAGE_ID = 0x52f348bce82689a8145279794ee705f829cdd47a8330e68fb8318140e6bb0914  # testnet
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
frontend/             Vite + React + TS dapp
  src/App.tsx
  src/components/
  src/hooks/useSuiData.ts
  src/lib/walrus.ts
  src/lib/seal.ts
scripts/
  publish.sh          publishes the Move package
  e2e_demo.mjs        headless full-loop test on testnet (encrypt→buy→decrypt)
```

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
      `0x47981789d0f53f0960a5ce54c147f39060cc2b115f4dd13cad71ddaf98dfc2a0`.
- [x] Frontend: identity creation, listing form, browse + purchase, decrypt + read.
