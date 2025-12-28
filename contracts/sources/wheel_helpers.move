module sui_wheel::wheel_helpers;

use sui::table::{Self, Table};

// ============================================================================
// PURE HELPER FUNCTIONS (No events, no struct access)
// ============================================================================

/// Counts the number of unique addresses in the entries vector.
public(package) fun count_unique(entries: &vector<address>, ctx: &mut TxContext): u64 {
    let mut unique: Table<address, bool> = table::new(ctx);
    let mut keys: vector<address> = vector::empty();
    let len = vector::length(entries);
    let mut i = 0;
    while (i < len) {
        let addr = *vector::borrow(entries, i);
        if (!table::contains(&unique, addr)) {
            table::add(&mut unique, addr, true);
            vector::push_back(&mut keys, addr);
        };
        i = i + 1;
    };
    let count = vector::length(&keys);
    // Empty the table
    i = 0;
    while (i < vector::length(&keys)) {
        let k = *vector::borrow(&keys, i);
        let _v = table::remove(&mut unique, k);
        i = i + 1;
    };
    table::destroy_empty(unique);
    count
}

/// Computes the sum of all prize amounts.
public(package) fun sum_prize_amounts(prize_amounts: &vector<u64>): u64 {
    let mut total: u64 = 0;
    let mut i = 0;
    let len = vector::length(prize_amounts);
    while (i < len) {
        total = total + *vector::borrow(prize_amounts, i);
        i = i + 1;
    };
    total
}

/// Removes all occurrences of the given address from the vector.
public(package) fun remove_all_occurrences(entries: &mut vector<address>, addr: address) {
    let mut i = 0;
    while (i < vector::length(entries)) {
        if (*vector::borrow(entries, i) == addr) {
            vector::swap_remove(entries, i);
        } else {
            i = i + 1;
        };
    };
}


