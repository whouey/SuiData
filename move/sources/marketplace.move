/// Dataset marketplace: list datasets for sale and purchase access to them.
///
/// A `Dataset` is a SHARED object so anyone can read its metadata to browse.
/// Buying calls `purchase`, which routes payment to the publisher and mints an
/// `AccessGrant` (OWNED by the buyer) atomically. Seal gates decryption on the
/// buyer holding an `AccessGrant` for the dataset.
module suidata::marketplace;

use std::string::String;
use sui::coin::{Self, Coin};
use sui::event;
use sui::sui::SUI;
use suidata::identity::{Self, Identity};

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
    /// Price in MIST (1 SUI = 1_000_000_000 MIST).
    price: u64,
    /// Walrus blob id of the encrypted payload.
    walrus_blob_id: String,
    /// Seal policy id gating decryption.
    seal_policy_id: String,
    created_at: u64,
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
    price: u64,
    walrus_blob_id: String,
    seal_policy_id: String,
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
        price,
        walrus_blob_id,
        seal_policy_id,
        // TODO: use Clock for a real timestamp; epoch is a placeholder.
        created_at: ctx.epoch(),
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
public fun purchase(dataset: &Dataset, mut payment: Coin<SUI>, ctx: &mut TxContext) {
    let buyer = ctx.sender();
    assert!(coin::value(&payment) >= dataset.price, EInsufficientPayment);

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
/// The encryption identity (`id`) is the dataset's object id bytes. Access is
/// allowed iff the caller supplies an `AccessGrant` minted for that same
/// dataset (which `purchase` is the only way to obtain).
///
/// `id` must be the first parameter — Seal passes the key identity there.
entry fun seal_approve(id: vector<u8>, grant: &AccessGrant, dataset: &Dataset) {
    // The grant must be for this dataset...
    assert!(grant.dataset_id == object::id(dataset), ENoAccess);
    // ...and the requested key identity must match this dataset.
    assert!(id == object::id_to_bytes(&object::id(dataset)), ENoAccess);
}

// === Accessors ===

public fun price(dataset: &Dataset): u64 { dataset.price }

public fun publisher(dataset: &Dataset): address { dataset.publisher }

public fun walrus_blob_id(dataset: &Dataset): String { dataset.walrus_blob_id }

public fun seal_policy_id(dataset: &Dataset): String { dataset.seal_policy_id }

public fun grant_dataset_id(grant: &AccessGrant): ID { grant.dataset_id }

public fun grant_buyer(grant: &AccessGrant): address { grant.buyer }
