/// Dataset marketplace: list datasets for sale and purchase access to them.
///
/// A `Dataset` is a SHARED object so anyone can read its metadata to browse.
/// Buying calls `purchase`, which routes payment to the publisher and mints an
/// `AccessGrant` (OWNED by the buyer) atomically. Seal gates decryption on the
/// buyer holding an `AccessGrant` for the dataset.
module otterproof::marketplace;

use std::string::String;
use sui::coin::{Self, Coin};
use sui::event;
use sui::sui::SUI;
use otterproof::identity::{Self, Identity};

// === Errors ===

/// Payment coin value is less than the dataset price.
const EInsufficientPayment: u64 = 0;
/// Caller's `Identity` is not the one that published this dataset.
const ENotPublisher: u64 = 1;
/// Seal policy check failed: caller does not hold a matching `AccessGrant`.
const ENoAccess: u64 = 2;

// === Structs ===

/// A dataset listed for sale. SHARED so it is browsable by anyone.
public struct Dataset has key {
    id: UID,
    publisher: address,
    title: String,
    description: String,
    category: String,
    /// Public, UNencrypted teaser shown to buyers before purchase (e.g. a
    /// sample row, schema, or summary stats). The full payload stays encrypted.
    preview: String,
    /// Price in MIST (1 SUI = 1_000_000_000 MIST).
    price: u64,
    /// Walrus blob id of the encrypted payload.
    walrus_blob_id: String,
    /// Seal encryption identity (the policy id) the payload was encrypted under.
    /// This is the `id` Seal passes to `seal_approve`; binding decryption to a
    /// per-dataset id is what stops one dataset's grant decrypting another's.
    seal_policy_id: vector<u8>,
    created_at: u64,
    /// Number of times this dataset has been purchased. Bumped in `purchase`;
    /// the seller's on-chain reputation signal.
    sales_count: u64,
}

/// Proof of purchase, OWNED by the buyer. Seal checks for this before
/// releasing decryption keys.
public struct AccessGrant has key, store {
    id: UID,
    dataset_id: ID,
    buyer: address,
    created_at: u64,
}

// === Events ===

public struct DatasetListed has copy, drop {
    dataset_id: ID,
    publisher: address,
    title: String,
    category: String,
    price: u64,
}

public struct PurchaseEvent has copy, drop {
    dataset_id: ID,
    buyer: address,
    publisher: address,
    price: u64,
}

// === Public API ===

/// List a new dataset for sale. Creates and shares a `Dataset`. Asserts the
/// caller owns the provided `Identity` (passing it by reference proves
/// ownership) and records its address as publisher.
public fun list_dataset(
    identity: &Identity,
    title: String,
    description: String,
    category: String,
    preview: String,
    price: u64,
    walrus_blob_id: String,
    seal_policy_id: vector<u8>,
    ctx: &mut TxContext,
) {
    let publisher = ctx.sender();
    // The Identity must belong to the caller.
    assert!(identity::owner(identity) == publisher, ENotPublisher);

    let dataset = Dataset {
        id: object::new(ctx),
        publisher,
        title,
        description,
        category,
        preview,
        price,
        walrus_blob_id,
        seal_policy_id,
        // TODO: use Clock for a real timestamp; epoch is a placeholder.
        created_at: ctx.epoch(),
        sales_count: 0,
    };

    event::emit(DatasetListed {
        dataset_id: object::id(&dataset),
        publisher,
        title: dataset.title,
        category: dataset.category,
        price: dataset.price,
    });

    transfer::share_object(dataset);
}

/// Purchase access to a dataset. Asserts `payment >= price`, forwards payment
/// to the publisher, mints an `AccessGrant` to the buyer, and emits a
/// `PurchaseEvent`. Splits the exact `price` to the publisher and returns any
/// change to the buyer, so the caller need not pass an exact coin.
#[allow(lint(self_transfer))]
public fun purchase(dataset: &mut Dataset, mut payment: Coin<SUI>, ctx: &mut TxContext) {
    let buyer = ctx.sender();
    assert!(coin::value(&payment) >= dataset.price, EInsufficientPayment);

    // Bump the seller's on-chain reputation counter.
    dataset.sales_count = dataset.sales_count + 1;

    // Split exactly `price` for the publisher; the remainder stays in `payment`
    // and is returned to the buyer as change.
    let paid = coin::split(&mut payment, dataset.price, ctx);
    transfer::public_transfer(paid, dataset.publisher);
    transfer::public_transfer(payment, buyer);

    let grant = AccessGrant {
        id: object::new(ctx),
        dataset_id: object::id(dataset),
        buyer,
        created_at: ctx.epoch(),
    };

    event::emit(PurchaseEvent {
        dataset_id: object::id(dataset),
        buyer,
        publisher: dataset.publisher,
        price: dataset.price,
    });

    transfer::transfer(grant, buyer);
}

// === Seal policy ===

/// Seal access policy. Seal runs this in a dry-run PTB before releasing
/// decryption keys; if it does NOT abort, access is granted.
///
/// Access is allowed iff (a) the caller supplies an `AccessGrant` minted for
/// this dataset (which `purchase` is the only way to obtain), and (b) the
/// requested key identity matches the dataset's `seal_policy_id`. The latter
/// binds the key to this specific dataset, so a grant for one dataset can't be
/// used to fetch another dataset's key.
///
/// `id` must be the first parameter — Seal passes the key identity there.
entry fun seal_approve(id: vector<u8>, grant: &AccessGrant, dataset: &Dataset) {
    assert!(grant.dataset_id == object::id(dataset), ENoAccess);
    assert!(id == dataset.seal_policy_id, ENoAccess);
}

// === Accessors ===

public fun price(dataset: &Dataset): u64 { dataset.price }

public fun publisher(dataset: &Dataset): address { dataset.publisher }

public fun walrus_blob_id(dataset: &Dataset): String { dataset.walrus_blob_id }

public fun seal_policy_id(dataset: &Dataset): vector<u8> { dataset.seal_policy_id }

public fun sales_count(dataset: &Dataset): u64 { dataset.sales_count }

public fun grant_dataset_id(grant: &AccessGrant): ID { grant.dataset_id }

public fun grant_buyer(grant: &AccessGrant): address { grant.buyer }
