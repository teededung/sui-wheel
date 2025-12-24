#[test_only]
module sui_wheel::wheel_creation_tests;

#[test_only]
use sui::balance;
#[test_only]
use sui::coin;
#[test_only]
use sui::sui::SUI;
#[test_only]
use sui::test_scenario::{Self};
#[test_only]
use sui_wheel::sui_wheel::{Self, Wheel, create_wheel, share_wheel};
#[test_only]
use sui::random::{Self, update_randomness_state_for_testing, Random};
#[test_only]
use sui_wheel::helpers::{setup_clock, setup_version};

#[test]
fun test_create_wheel_success() {
    let mut scenario = test_scenario::begin(@0xCAFE);
    let version = setup_version(&mut scenario, @0xCAFE);
    let entries = vector[@0xA, @0xB, @0xC];
    let prize_amounts = vector[1000, 500, 200];
    let delay_ms = 3600000;
    let claim_window_ms = 86400000;

    let wheel = create_wheel<SUI>(entries, prize_amounts, delay_ms, claim_window_ms, &version, scenario.ctx());
    share_wheel(wheel);

    scenario.next_tx(@0xCAFE);
    let wheel: Wheel<SUI> = scenario.take_shared<Wheel<SUI>>();

    assert!(sui_wheel::organizer(&wheel) == @0xCAFE, 0);
    assert!(vector::length(sui_wheel::remaining_entries(&wheel)) == 3, 0);
    assert!(vector::length(sui_wheel::prize_amounts(&wheel)) == 3, 0);
    assert!(sui_wheel::delay_ms(&wheel) == delay_ms, 0);
    assert!(sui_wheel::claim_window_ms(&wheel) == claim_window_ms, 0);
    assert!(sui_wheel::pool_value(&wheel) == 0, 0);
    assert!(!sui_wheel::is_cancelled(&wheel), 0);

    test_scenario::return_shared(wheel);
    test_scenario::return_shared(version);

    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = sui_wheel::EInvalidEntriesCount)]
fun test_create_wheel_invalid_entries_min() {
    let mut scenario = test_scenario::begin(@0xCAFE);
    let version = setup_version(&mut scenario, @0xCAFE);
    let ctx = scenario.ctx();
    let entries = vector[@0xA];
    let prize_amounts = vector[1000];

    let _wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, ctx); //fail here
    abort 1337
}

#[test]
#[expected_failure(abort_code = sui_wheel::EInvalidPrizes)]
fun test_create_wheel_invalid_prizes_entries_less_than_prizes() {
    let mut scenario = test_scenario::begin(@0xCAFE);
    let version = setup_version(&mut scenario, @0xCAFE);
    let ctx = scenario.ctx();
    let entries = vector[@0xA, @0xB];
    let prize_amounts = vector[1000, 500, 300];

    let _wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, ctx);
    abort 1337
}

#[test]
fun test_update_entries_and_prize_amounts_with_donate() {
    let organizer = @0xCAFE;
    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, organizer);
    scenario.next_tx(organizer);
    let entries = vector[@0xA, @0xB];
    let prize_amounts = vector[1000];

    // First transaction: Create wheel
    let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, scenario.ctx());
    share_wheel(wheel);

    // Second transaction: Donate initial amount
    scenario.next_tx(organizer);
    {
        let initial_donate: u64 = 1000;
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let balance = balance::create_for_testing<SUI>(initial_donate);
        let coin = coin::from_balance(balance, scenario.ctx());
        sui_wheel::donate_to_pool(&mut wheel, coin, scenario.ctx());
        assert!(sui_wheel::pool_value(&wheel) == initial_donate, 0);
        test_scenario::return_shared(wheel);
    };

    // Third transaction: Donate additional, update entries and prizes
    scenario.next_tx(organizer);
    {
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        // Additional donate for new prizes
        let additional_donate: u64 = 1500; // For new total 2500
        let balance = balance::create_for_testing<SUI>(additional_donate);
        let coin = coin::from_balance(balance, scenario.ctx());
        sui_wheel::donate_to_pool(&mut wheel, coin, scenario.ctx());

        // Update entries (new entries with more)
        let new_entries = vector[@0x1, @0x2, @0x3];
        sui_wheel::update_entries(&mut wheel, new_entries, scenario.ctx());
        // Update prizes (new prizes requiring more pool)
        let new_prize_amounts = vector[1000u64, 500u64, 1000u64]; // Total 2500
        sui_wheel::update_prize_amounts(&mut wheel, new_prize_amounts, scenario.ctx());

        // Verify
        assert!(vector::length(sui_wheel::remaining_entries(&wheel)) == 3, 1);
        assert!(vector::length(sui_wheel::prize_amounts(&wheel)) == 3, 2);
        assert!(sui_wheel::pool_value(&wheel) == 2500, 3);
        test_scenario::return_shared(wheel);
    };
    test_scenario::return_shared(version);

    scenario.end();
}

#[test]
#[expected_failure(abort_code = sui_wheel::ENotOrganizer)]
fun test_update_entries_not_organizer() {
    let mut scenario = test_scenario::begin(@0xCAFE);
    let version = setup_version(&mut scenario, @0xCAFE);
    let ctx = scenario.ctx();
    let entries = vector[@0xA, @0xB];
    let prize_amounts = vector[1000];

    let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, ctx);
    share_wheel(wheel);

    scenario.next_tx(@0xA);
    let mut wheel = scenario.take_shared<Wheel<SUI>>();

    // fail here
    sui_wheel::update_entries(&mut wheel, vector[@0x1], scenario.ctx());

    test_scenario::return_shared(wheel);
    test_scenario::return_shared(version);

    scenario.end();
}

#[test]
fun test_update_prize_amounts_success() {
    let organizer = @0xCAFE;
    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, organizer);
    scenario.next_tx(organizer);
    let entries = vector[@0xA, @0xB, @0xC];
    let prize_amounts = vector[1000, 200];

    let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, scenario.ctx());
    share_wheel(wheel);

    // donate to pool
    scenario.next_tx(organizer);
    let mut wheel: Wheel<SUI> = scenario.take_shared<Wheel<SUI>>();
    let coin = coin::mint_for_testing<SUI>(1500, scenario.ctx());
    sui_wheel::donate_to_pool(&mut wheel, coin, scenario.ctx());

    // only update prize amounts
    let new_prize_amounts = vector[1000, 400];
    sui_wheel::update_prize_amounts(&mut wheel, new_prize_amounts, scenario.ctx());
    assert!(vector::length(sui_wheel::prize_amounts(&wheel)) == 2, 0);
    assert!(vector::length(sui_wheel::winners(&wheel)) == 0, 0);
    assert!(vector::length(sui_wheel::spin_times(&wheel)) == 0, 0);

    test_scenario::return_shared(wheel);
    test_scenario::return_shared(version);

    scenario.end();
}

#[test]
#[expected_failure(abort_code = sui_wheel::EInsufficientPool)]
fun test_update_prize_amounts_insufficient_pool() {
    let mut scenario = test_scenario::begin(@0xCAFE);
    let version = setup_version(&mut scenario, @0xCAFE);
    {
        let entries = vector[@0xA, @0xB];
        let prize_amounts = vector[1000];
        let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, scenario.ctx());
        share_wheel(wheel);
    };

    scenario.next_tx(@0xCAFE);
    // skip donate to pool
    {
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let new_prize_amounts = vector[2000];
        // fail here
        sui_wheel::update_prize_amounts(&mut wheel, new_prize_amounts, scenario.ctx());
        test_scenario::return_shared(wheel);
    };

    test_scenario::return_shared(version);

    scenario.end();
}

#[test]
#[expected_failure(abort_code = sui_wheel::EAlreadySpunMax)]
fun test_update_entries_after_spin() {
    let admin = @0x0;
    let organizer = @0xCAFE;
    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, admin);
    scenario.next_tx(organizer);

    let entries = vector[@0xA, @0xB];
    let prize_amounts = vector[1000];
    let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, scenario.ctx());
    share_wheel(wheel);

    // Donate initial amount
    scenario.next_tx(organizer);
    {
        let initial_donate: u64 = 1000;
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let balance = balance::create_for_testing<SUI>(initial_donate);
        let coin = coin::from_balance(balance, scenario.ctx());
        sui_wheel::donate_to_pool(&mut wheel, coin, scenario.ctx());
        assert!(sui_wheel::pool_value(&wheel) == initial_donate, 0);
        test_scenario::return_shared(wheel);
    };

    // Setup randomness in a separate tx to create the Random object
    scenario.next_tx(admin);
    random::create_for_testing(scenario.ctx());

    // Now in a new tx, take and update the Random object (must be after creation tx)
    scenario.next_tx(admin);
    let mut random_state = scenario.take_shared<Random>();
    random_state.update_randomness_state_for_testing(
        0,
        x"1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F",
        scenario.ctx(),
    );

    // Spin
    scenario.next_tx(organizer);
    {
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        // Perform the spin to reach max spun_count (1 prize, so 1 spin)
        let clock = setup_clock(&mut scenario);
        sui_wheel::spin_wheel(&mut wheel, &random_state, &clock, &version, scenario.ctx());
        test_scenario::return_shared(wheel);
        clock.destroy_for_testing();
    };

    scenario.next_tx(admin);
    test_scenario::return_shared(random_state);

    // Attempt update_entries, which should fail (EAlreadySpunMax)
    scenario.next_tx(organizer);
    {
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        sui_wheel::update_entries(&mut wheel, vector[@0xC, @0xD], scenario.ctx());
        test_scenario::return_shared(wheel);
    };

    test_scenario::return_shared(version);

    scenario.end();
}
