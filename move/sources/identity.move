/// On-chain identity for humans and AI agents.
///
/// `Identity` is an OWNED object so it composes into other objects and
/// transactions (e.g. asserting a caller owns one before listing a dataset).
module cuttle::identity;

use std::string::String;

// === Errors ===

/// `kind` was not one of the known kinds.
const EInvalidKind: u64 = 0;

// === Identity kinds ===

const KIND_HUMAN: u8 = 0;
const KIND_AGENT: u8 = 1;

// === Structs ===

/// A verifiable on-chain identity. OWNED by `owner`.
public struct Identity has key, store {
    id: UID,
    owner: address,
    /// 0 = Human, 1 = Agent. See `KIND_*`.
    kind: u8,
    display_name: String,
    created_at: u64,
}

// === Public API ===

/// Create an `Identity` and transfer it to the sender.
#[allow(lint(self_transfer))]
public fun create_identity(kind: u8, name: String, ctx: &mut TxContext) {
    assert!(kind == KIND_HUMAN || kind == KIND_AGENT, EInvalidKind);
    let sender = ctx.sender();
    let identity = Identity {
        id: object::new(ctx),
        owner: sender,
        kind,
        display_name: name,
        // TODO: use Clock for a real timestamp; epoch is a placeholder.
        created_at: ctx.epoch(),
    };
    transfer::transfer(identity, sender);
}

/// Rename an identity. Caller must own `identity` (enforced by Move's
/// ownership model since it's passed by mutable reference from an owned object).
public fun update_name(identity: &mut Identity, new_name: String) {
    identity.display_name = new_name;
}

// === Accessors ===

public fun owner(identity: &Identity): address { identity.owner }

public fun kind(identity: &Identity): u8 { identity.kind }

public fun display_name(identity: &Identity): String { identity.display_name }

// === Kind helpers ===

public fun kind_human(): u8 { KIND_HUMAN }

public fun kind_agent(): u8 { KIND_AGENT }
