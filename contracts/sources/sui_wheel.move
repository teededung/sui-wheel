module sui_wheel::sui_wheel;

use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::event;
use sui::random::{Self, Random};
use sui_wheel::version::{Self, Version};
use sui_wheel::wheel_helpers::{count_unique, sum_prize_amounts, remove_all_occurrences};

// ============================================================================
// SECTION 1: CONSTANTS
// ============================================================================

const ENotOrganizer: u64 = 0;
const EAlreadySpunMax: u64 = 1;
const EClaimTooEarly: u64 = 2;
const EClaimWindowPassed: u64 = 3;
const ENotWinner: u64 = 4;
const EReclaimTooEarly: u64 = 5;
const ENoEntries: u64 = 6;
const EInsufficientPool: u64 = 7;
const EInvalidEntriesCount: u64 = 8;
const EInvalidPrizes: u64 = 9;
const ENoRemaining: u64 = 10;
const EAlreadyCancelled: u64 = 11;
const EWheelCancelled: u64 = 12;

const MIN_ENTRIES: u64 = 2;
const MAX_ENTRIES: u64 = 200;
const MIN_CLAIM_WINDOW_MS: u64 = 3600000; // 1 hour
const DEFAULT_CLAIM_WINDOW_MS: u64 = 86400000; // 24 hours

// ============================================================================
// SECTION 2: TYPES (Structs)
// ============================================================================

/// The main structure for the wheel game, managing entries, winners, prizes, and the prize pool.
public struct Wheel<phantom T> has key {
    /// Unique identifier for the wheel object.
    id: UID,
    /// Address of the organizer who created the wheel.
    organizer: address,
    /// List of remaining participant addresses eligible for spinning.
    remaining_entries: vector<address>,
    /// List of winners, each associated with a prize.
    winners: vector<Winner>,
    /// Amounts for each prize, predefined by the organizer.
    prize_amounts: vector<u64>,
    /// Number of spins performed so far.
    spun_count: u64,
    /// Timestamps for each spin.
    spin_times: vector<u64>,
    /// Delay in milliseconds before a winner can claim their prize.
    delay_ms: u64,
    /// Time window in milliseconds for claiming the prize after the delay.
    claim_window_ms: u64,
    /// Balance pool holding the token for prizes.
    pool: Balance<T>,
    /// Flag indicating if the wheel has been cancelled.
    is_cancelled: bool,
}

/// Structure representing a winner of a prize.
public struct Winner has drop, store {
    /// Address of the winner.
    addr: address,
    /// Index of the prize in the prize_amounts vector.
    prize_index: u64,
    /// Flag indicating if the prize has been claimed.
    claimed: bool,
}

// ============================================================================
// SECTION 3: EVENTS
// ============================================================================

/// Event emitted when a wheel is created.
public struct CreateEvent has copy, drop {
    wheel_id: ID,
    organizer: address,
}

/// Event emitted when a spin occurs, announcing the winner and prize index.
public struct SpinEvent has copy, drop {
    wheel_id: ID,
    winner: address,
    prize_index: u64,
}

/// Event emitted when a prize is claimed.
public struct ClaimEvent has copy, drop {
    wheel_id: ID,
    winner: address,
    amount: u64,
}

/// Event emitted when the organizer reclaims remaining funds from the pool.
public struct ReclaimEvent has copy, drop {
    wheel_id: ID,
    amount: u64,
}

// ============================================================================
// SECTION 4: ACCESSORS
// ============================================================================

public fun organizer<T>(self: &Wheel<T>): address { self.organizer }
public fun remaining_entries<T>(self: &Wheel<T>): &vector<address> { &self.remaining_entries }
public fun prize_amounts<T>(self: &Wheel<T>): &vector<u64> { &self.prize_amounts }
public fun winners<T>(self: &Wheel<T>): &vector<Winner> { &self.winners }
public fun winner_addr(winner: &Winner): address { winner.addr }
public fun spin_times<T>(self: &Wheel<T>): &vector<u64> { &self.spin_times }
public fun delay_ms<T>(self: &Wheel<T>): u64 { self.delay_ms }
public fun claim_window_ms<T>(self: &Wheel<T>): u64 { self.claim_window_ms }
public fun pool_value<T>(self: &Wheel<T>): u64 { balance::value(&self.pool) }
public fun is_cancelled<T>(self: &Wheel<T>): bool { self.is_cancelled }
public fun spun_count<T>(self: &Wheel<T>): u64 { self.spun_count }
public fun claimed(winner: &Winner): bool { winner.claimed }

// ============================================================================
// SECTION 5: INTERNAL HELPERS (use wheel_helpers for pure functions)
// ============================================================================

public fun share_wheel<T>(wheel: Wheel<T>) {
    transfer::share_object(wheel);
}

public fun transfer_optional_reclaim<T>(mut opt: Option<Coin<T>>, recipient: address) {
    if (option::is_some(&opt)) {
        let coin = option::extract(&mut opt);
        transfer::public_transfer(coin, recipient);
    };
    option::destroy_none(opt);
}

/// Selects a winner address, either randomly or by popping if only one entry.
fun select_winner(
    remaining_entries: &mut vector<address>,
    random: &Random,
    ctx: &mut TxContext,
    num_entries: u64,
): address {
    let unique = count_unique(remaining_entries, ctx);
    let winner_addr: address;
    if (num_entries == 1 || unique == 1) {
        winner_addr = vector::pop_back(remaining_entries);
        remove_all_occurrences(remaining_entries, winner_addr);
    } else {
        let mut generator = random::new_generator(random, ctx);
        let rand_index = generator.generate_u64_in_range(0, num_entries - 1);
        winner_addr = vector::swap_remove(remaining_entries, rand_index);
        remove_all_occurrences(remaining_entries, winner_addr);
    };
    winner_addr
}

/// Adds the winner to the list, records spin time, increments spun_count, and emits the event.
fun add_winner_and_emit<T>(wheel: &mut Wheel<T>, winner_addr: address, clock: &Clock) {
    let prize_index = wheel.spun_count;
    vector::push_back(&mut wheel.winners, Winner { addr: winner_addr, prize_index, claimed: false });
    vector::push_back(&mut wheel.spin_times, clock::timestamp_ms(clock));
    wheel.spun_count = wheel.spun_count + 1;
    event::emit(SpinEvent { wheel_id: object::id(wheel), winner: winner_addr, prize_index });
}

/// Validates common preconditions for spin operations
fun validate_spin_preconditions<T>(wheel: &Wheel<T>, ctx: &TxContext) {
    assert!(!wheel.is_cancelled, EWheelCancelled);
    assert!(tx_context::sender(ctx) == wheel.organizer, ENotOrganizer);
    assert!(wheel.spun_count < vector::length(&wheel.prize_amounts), EAlreadySpunMax);
    assert!(vector::length(&wheel.remaining_entries) > 0, ENoEntries);
}

/// Checks if the pool has sufficient funds for all prizes
fun check_pool_sufficiency<T>(wheel: &Wheel<T>) {
    let total_prizes = sum_prize_amounts(&wheel.prize_amounts);
    assert!(balance::value(&wheel.pool) >= total_prizes, EInsufficientPool);
}

/// Validates entry order vector for spin_with_order functions
fun validate_entry_order(entry_order: &vector<u64>, num_entries: u64) {
    assert!(vector::length(entry_order) == num_entries, EInvalidEntriesCount);
    let mut i = 0;
    while (i < vector::length(entry_order)) {
        let idx = *vector::borrow(entry_order, i);
        assert!(idx < num_entries, EInvalidEntriesCount);
        i = i + 1;
    };
}

/// Attempts to auto-assign the last prize if conditions are met
fun try_auto_assign_last_prize<T>(wheel: &mut Wheel<T>, clock: &Clock, ctx: &mut TxContext) {
    let num_prizes = vector::length(&wheel.prize_amounts);
    let num_remaining = vector::length(&wheel.remaining_entries);
    if (num_remaining == 0) { return };
    let unique = count_unique(&wheel.remaining_entries, ctx);
    if (wheel.spun_count + 1 == num_prizes && unique == 1) {
        let last_winner = vector::pop_back(&mut wheel.remaining_entries);
        remove_all_occurrences(&mut wheel.remaining_entries, last_winner);
        add_winner_and_emit(wheel, last_winner, clock);
    };
}

// ============================================================================
// SECTION 6: WHEEL CREATION
// ============================================================================

public fun create_wheel<T>(
    entries: vector<address>,
    prize_amounts: vector<u64>,
    delay_ms: u64,
    claim_window_ms: u64,
    v: &Version,
    ctx: &mut TxContext,
): Wheel<T> {
    version::check_is_valid(v);
    let num_entries = vector::length(&entries);
    let num_prizes = vector::length(&prize_amounts);
    assert!(num_entries >= MIN_ENTRIES && num_entries <= MAX_ENTRIES, EInvalidEntriesCount);
    assert!(num_prizes > 0 && num_entries >= num_prizes, EInvalidPrizes);
    let unique_count = count_unique(&entries, ctx);
    assert!(unique_count >= num_prizes, EInvalidPrizes);
    let claim_window = if (claim_window_ms == 0) { DEFAULT_CLAIM_WINDOW_MS }
                       else if (claim_window_ms < MIN_CLAIM_WINDOW_MS) { MIN_CLAIM_WINDOW_MS }
                       else { claim_window_ms };
    let organizer = tx_context::sender(ctx);
    let wheel = Wheel {
        id: object::new(ctx),
        organizer,
        remaining_entries: entries,
        winners: vector::empty(),
        prize_amounts,
        spun_count: 0,
        spin_times: vector::empty(),
        delay_ms,
        claim_window_ms: claim_window,
        pool: balance::zero<T>(),
        is_cancelled: false,
    };
    event::emit(CreateEvent { wheel_id: object::id(&wheel), organizer });
    wheel
}

// ============================================================================
// SECTION 7: POOL MANAGEMENT & DONATIONS
// ============================================================================

public fun donate_to_pool<T>(wheel: &mut Wheel<T>, coin: Coin<T>, ctx: &mut TxContext) {
    assert!(!wheel.is_cancelled, EWheelCancelled);
    assert!(tx_context::sender(ctx) == wheel.organizer, ENotOrganizer);
    balance::join(&mut wheel.pool, coin::into_balance(coin));
}

// ============================================================================
// SECTION 8: UPDATE FUNCTIONS
// ============================================================================

public fun update_entries<T>(wheel: &mut Wheel<T>, new_entries: vector<address>, ctx: &mut TxContext) {
    assert!(!wheel.is_cancelled, EWheelCancelled);
    assert!(tx_context::sender(ctx) == wheel.organizer, ENotOrganizer);
    assert!(wheel.spun_count == 0, EAlreadySpunMax);
    let num_entries = vector::length(&new_entries);
    assert!(num_entries >= MIN_ENTRIES && num_entries <= MAX_ENTRIES, EInvalidEntriesCount);
    let num_prizes = vector::length(&wheel.prize_amounts);
    assert!(num_entries >= num_prizes, EInvalidPrizes);
    let unique_count = count_unique(&new_entries, ctx);
    assert!(unique_count >= num_prizes, EInvalidPrizes);
    wheel.remaining_entries = new_entries;
}

public fun update_prize_amounts<T>(wheel: &mut Wheel<T>, new_prize_amounts: vector<u64>, ctx: &mut TxContext) {
    assert!(!wheel.is_cancelled, EWheelCancelled);
    assert!(tx_context::sender(ctx) == wheel.organizer, ENotOrganizer);
    assert!(wheel.spun_count == 0, EAlreadySpunMax);
    let num_prizes = vector::length(&new_prize_amounts);
    let num_entries = vector::length(&wheel.remaining_entries);
    assert!(num_prizes > 0 && num_entries >= num_prizes, EInvalidPrizes);
    let unique_count = count_unique(&wheel.remaining_entries, ctx);
    assert!(unique_count >= num_prizes, EInvalidPrizes);
    wheel.prize_amounts = new_prize_amounts;
    wheel.winners = vector::empty();
    wheel.spin_times = vector::empty();
    let total_prizes = sum_prize_amounts(&wheel.prize_amounts);
    assert!(balance::value(&wheel.pool) >= total_prizes, EInsufficientPool);
}

public fun update_delay_ms<T>(wheel: &mut Wheel<T>, new_delay_ms: u64, ctx: &mut TxContext) {
    assert!(!wheel.is_cancelled, EWheelCancelled);
    assert!(tx_context::sender(ctx) == wheel.organizer, ENotOrganizer);
    assert!(wheel.spun_count == 0, EAlreadySpunMax);
    wheel.delay_ms = new_delay_ms;
}

public fun update_claim_window_ms<T>(wheel: &mut Wheel<T>, new_claim_window_ms: u64, ctx: &mut TxContext) {
    assert!(!wheel.is_cancelled, EWheelCancelled);
    assert!(tx_context::sender(ctx) == wheel.organizer, ENotOrganizer);
    assert!(wheel.spun_count == 0, EAlreadySpunMax);
    let claim_window = if (new_claim_window_ms == 0) { DEFAULT_CLAIM_WINDOW_MS }
                       else if (new_claim_window_ms < MIN_CLAIM_WINDOW_MS) { MIN_CLAIM_WINDOW_MS }
                       else { new_claim_window_ms };
    wheel.claim_window_ms = claim_window;
}

// ============================================================================
// SECTION 9: CLAIM & RECLAIM
// ============================================================================

public fun claim_prize<T>(wheel: &mut Wheel<T>, clock: &Clock, v: &Version, ctx: &mut TxContext): Coin<T> {
    version::check_is_valid(v);
    assert!(!wheel.is_cancelled, EWheelCancelled);
    let sender = tx_context::sender(ctx);
    let mut i = 0;
    let mut found = false;
    let mut prize_index = 0;
    while (i < vector::length(&wheel.winners)) {
        let winner = vector::borrow_mut(&mut wheel.winners, i);
        if (winner.addr == sender && !winner.claimed) {
            found = true;
            prize_index = winner.prize_index;
            winner.claimed = true;
            break
        };
        i = i + 1;
    };
    assert!(found, ENotWinner);
    let spin_time = *vector::borrow(&wheel.spin_times, prize_index);
    let current_time = clock::timestamp_ms(clock);
    let deadline = spin_time + wheel.delay_ms + wheel.claim_window_ms;
    assert!(current_time >= spin_time + wheel.delay_ms, EClaimTooEarly);
    assert!(current_time < deadline, EClaimWindowPassed);
    let amount = *vector::borrow(&wheel.prize_amounts, prize_index);
    let reward = balance::split(&mut wheel.pool, amount);
    let coin = coin::from_balance(reward, ctx);
    event::emit(ClaimEvent { wheel_id: object::id(wheel), winner: sender, amount });
    coin
}

public fun reclaim_pool<T>(wheel: &mut Wheel<T>, clock: &Clock, v: &Version, ctx: &mut TxContext): Coin<T> {
    version::check_is_valid(v);
    assert!(!wheel.is_cancelled, EWheelCancelled);
    assert!(tx_context::sender(ctx) == wheel.organizer, ENotOrganizer);
    assert!(wheel.spun_count == vector::length(&wheel.prize_amounts), EAlreadySpunMax);
    let current_time = clock::timestamp_ms(clock);
    let mut max_spin_time = 0;
    let mut i = 0;
    while (i < vector::length(&wheel.spin_times)) {
        let t = *vector::borrow(&wheel.spin_times, i);
        if (t > max_spin_time) { max_spin_time = t; };
        i = i + 1;
    };
    let deadline = max_spin_time + wheel.delay_ms + wheel.claim_window_ms;
    assert!(current_time >= deadline, EReclaimTooEarly);
    let remaining = balance::value(&wheel.pool);
    assert!(remaining > 0, ENoRemaining);
    let reclaim = balance::split(&mut wheel.pool, remaining);
    let coin = coin::from_balance(reclaim, ctx);
    event::emit(ReclaimEvent { wheel_id: object::id(wheel), amount: remaining });
    coin
}

// ============================================================================
// SECTION 10: SPIN OPERATIONS
// ============================================================================

entry fun spin_wheel<T>(wheel: &mut Wheel<T>, random: &Random, clock: &Clock, v: &Version, ctx: &mut TxContext) {
    version::check_is_valid(v);
    validate_spin_preconditions(wheel, ctx);
    check_pool_sufficiency(wheel);
    let num_entries = vector::length(&wheel.remaining_entries);
    let winner_addr = select_winner(&mut wheel.remaining_entries, random, ctx, num_entries);
    add_winner_and_emit(wheel, winner_addr, clock);
}

entry fun spin_wheel_with_order<T>(
    wheel: &mut Wheel<T>,
    entry_order: vector<u64>,
    random: &Random,
    clock: &Clock,
    v: &Version,
    ctx: &mut TxContext,
) {
    version::check_is_valid(v);
    validate_spin_preconditions(wheel, ctx);
    check_pool_sufficiency(wheel);
    let num_entries = vector::length(&wheel.remaining_entries);
    validate_entry_order(&entry_order, num_entries);
    let unique = count_unique(&wheel.remaining_entries, ctx);
    let winner_addr: address;
    if (unique == 1) {
        winner_addr = vector::pop_back(&mut wheel.remaining_entries);
        remove_all_occurrences(&mut wheel.remaining_entries, winner_addr);
    } else {
        let mut generator = random::new_generator(random, ctx);
        let rand_index = generator.generate_u64_in_range(0, num_entries - 1);
        let shuffled_idx = *vector::borrow(&entry_order, rand_index);
        winner_addr = *vector::borrow(&wheel.remaining_entries, shuffled_idx);
        vector::swap_remove(&mut wheel.remaining_entries, shuffled_idx);
        remove_all_occurrences(&mut wheel.remaining_entries, winner_addr);
    };
    add_winner_and_emit(wheel, winner_addr, clock);
}

entry fun spin_wheel_and_assign_last_prize<T>(
    wheel: &mut Wheel<T>,
    random: &Random,
    clock: &Clock,
    v: &Version,
    ctx: &mut TxContext,
) {
    version::check_is_valid(v);
    validate_spin_preconditions(wheel, ctx);
    check_pool_sufficiency(wheel);
    let num_entries = vector::length(&wheel.remaining_entries);
    let winner_addr = select_winner(&mut wheel.remaining_entries, random, ctx, num_entries);
    add_winner_and_emit(wheel, winner_addr, clock);
    try_auto_assign_last_prize(wheel, clock, ctx);
}

entry fun spin_wheel_and_assign_last_prize_with_order<T>(
    wheel: &mut Wheel<T>,
    entry_order: vector<u64>,
    random: &Random,
    clock: &Clock,
    v: &Version,
    ctx: &mut TxContext,
) {
    version::check_is_valid(v);
    validate_spin_preconditions(wheel, ctx);
    check_pool_sufficiency(wheel);
    let num_entries = vector::length(&wheel.remaining_entries);
    validate_entry_order(&entry_order, num_entries);
    let unique = count_unique(&wheel.remaining_entries, ctx);
    let winner_addr: address;
    if (unique == 1) {
        winner_addr = vector::pop_back(&mut wheel.remaining_entries);
        remove_all_occurrences(&mut wheel.remaining_entries, winner_addr);
    } else {
        let mut generator = random::new_generator(random, ctx);
        let rand_index = generator.generate_u64_in_range(0, num_entries - 1);
        let shuffled_idx = *vector::borrow(&entry_order, rand_index);
        winner_addr = *vector::borrow(&wheel.remaining_entries, shuffled_idx);
        vector::swap_remove(&mut wheel.remaining_entries, shuffled_idx);
        remove_all_occurrences(&mut wheel.remaining_entries, winner_addr);
    };
    add_winner_and_emit(wheel, winner_addr, clock);
    try_auto_assign_last_prize(wheel, clock, ctx);
}

// ============================================================================
// SECTION 11: CANCEL OPERATIONS
// ============================================================================

public fun cancel_wheel_and_reclaim_pool<T>(wheel: &mut Wheel<T>, v: &Version, ctx: &mut TxContext): Option<Coin<T>> {
    version::check_is_valid(v);
    assert!(tx_context::sender(ctx) == wheel.organizer, ENotOrganizer);
    assert!(wheel.spun_count == 0, EAlreadySpunMax);
    assert!(!wheel.is_cancelled, EAlreadyCancelled);
    wheel.is_cancelled = true;
    let remaining = balance::value(&wheel.pool);
    if (remaining > 0) {
        let reclaim = balance::split(&mut wheel.pool, remaining);
        option::some(coin::from_balance(reclaim, ctx))
    } else {
        option::none()
    }
}
