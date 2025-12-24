#[test_only]
module sui_wheel::claim_tests;

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
use sui::clock::{Self};
#[test_only]
use sui::random::{Self, update_randomness_state_for_testing, Random};
#[test_only]
use sui_wheel::helpers::{setup_version};

#[test]
fun test_claim_prize_success() {
    let admin = @0x0;
    let organizer = @0xCAFE;
    let winner_addr = @0xA;

    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, admin);
    scenario.next_tx(organizer);

    // Create wheel with 1 prize
    let entries = vector[@0xA, @0xB];
    let prize_amounts = vector[1000];
    let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, scenario.ctx());
    share_wheel(wheel);

    // Donate to pool
    scenario.next_tx(organizer);
    let mut wheel = scenario.take_shared<Wheel<SUI>>();
    let donate_balance = balance::create_for_testing<SUI>(1000);
    let donate_coin = coin::from_balance(donate_balance, scenario.ctx());
    sui_wheel::donate_to_pool(&mut wheel, donate_coin, scenario.ctx());
    assert!(sui_wheel::pool_value(&wheel) == 1000, 0);
    test_scenario::return_shared(wheel);

    // Setup randomness
    scenario.next_tx(admin);
    random::create_for_testing(scenario.ctx());

    scenario.next_tx(admin);
    let mut random_state = scenario.take_shared<Random>();
    random_state.update_randomness_state_for_testing(
        0,
        x"1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F",
        scenario.ctx(),
    );

    // Setup clock as shared for reuse across tx
    scenario.next_tx(admin);
    let mut clock = clock::create_for_testing(scenario.ctx());
    clock.set_for_testing(1000); // Initial timestamp
    clock.share_for_testing();

    // Perform spin (assume deterministic winner based on seed; adjust entries/seed if needed to ensure @0xA wins)
    scenario.next_tx(organizer);
    let mut wheel = scenario.take_shared<Wheel<SUI>>();
    let clock_shared = scenario.take_shared<clock::Clock>();
    sui_wheel::spin_wheel(&mut wheel, &random_state, &clock_shared, &version, scenario.ctx());
    assert!(sui_wheel::spun_count(&wheel) == 1, 1);

    // Assert winner is @0xA (based on fixed seed and entries order; test may need adjustment if different winner)
    let winners = sui_wheel::winners(&wheel);
    let winner = vector::borrow(winners, 0);
    assert!(sui_wheel::winner_addr(winner) == winner_addr, 2);
    test_scenario::return_shared(wheel);
    test_scenario::return_shared(clock_shared);

    // Claim prize as winner (time within window: after delay=0, before spin_time + window)
    scenario.next_tx(winner_addr);
    let mut wheel = scenario.take_shared<Wheel<SUI>>();
    let clock_shared = scenario.take_shared<clock::Clock>();
    let prize_coin = sui_wheel::claim_prize(&mut wheel, &clock_shared, &version, scenario.ctx());
    assert!(coin::value(&prize_coin) == 1000, 3);
    let winners = sui_wheel::winners(&wheel);
    let winner = vector::borrow(winners, 0);
    assert!(sui_wheel::claimed(winner), 4);
    assert!(sui_wheel::pool_value(&wheel) == 0, 5);
    // Destroy prize coin for test cleanup
    let prize_balance = coin::into_balance(prize_coin);
    balance::destroy_for_testing(prize_balance);
    test_scenario::return_shared(wheel);
    test_scenario::return_shared(clock_shared);

    // Cleanup
    scenario.next_tx(admin);
    test_scenario::return_shared(random_state);
    test_scenario::return_shared(version);

    scenario.end();
}

#[test]
#[expected_failure(abort_code = sui_wheel::EClaimTooEarly)]
fun test_claim_prize_too_early() {
    let admin = @0x0;
    let organizer = @0xCAFE;
    let winner_addr = @0xA;

    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, admin);
    scenario.next_tx(organizer);

    // Create wheel with delay_ms > 0
    let entries = vector[@0xA, @0xB];
    let prize_amounts = vector[1000];
    let wheel = create_wheel<SUI>(entries, prize_amounts, 1000, 86400000, &version, scenario.ctx()); // the user only claim after 86400000 + 1000 = 86401000
    share_wheel(wheel);

    // Donate to pool
    scenario.next_tx(organizer);
    let mut wheel = scenario.take_shared<Wheel<SUI>>();
    let donate_balance = balance::create_for_testing<SUI>(1000);
    let donate_coin = coin::from_balance(donate_balance, scenario.ctx());
    sui_wheel::donate_to_pool(&mut wheel, donate_coin, scenario.ctx());
    assert!(sui_wheel::pool_value(&wheel) == 1000, 0);
    test_scenario::return_shared(wheel);

    // Setup randomness
    scenario.next_tx(admin);
    random::create_for_testing(scenario.ctx());

    scenario.next_tx(admin);
    let mut random_state = scenario.take_shared<Random>();
    random_state.update_randomness_state_for_testing(
        0,
        x"1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F",
        scenario.ctx(),
    );

    // Setup clock for spin
    scenario.next_tx(admin);
    let mut clock = clock::create_for_testing(scenario.ctx());
    clock.set_for_testing(86400000); // Initial timestamp
    clock.share_for_testing();

    // Perform spin (spin_time will be 1000)
    scenario.next_tx(organizer);
    let mut wheel = scenario.take_shared<Wheel<SUI>>();
    let clock_shared = scenario.take_shared<clock::Clock>();
    sui_wheel::spin_wheel(&mut wheel, &random_state, &clock_shared, &version, scenario.ctx());
    test_scenario::return_shared(wheel);
    test_scenario::return_shared(clock_shared);

    // Setup clock for claim
    scenario.next_tx(admin);
    let mut clock = clock::create_for_testing(scenario.ctx());
    clock.set_for_testing(86400999); // the user claim at 86400999 (86401000 - 86400999 = 1ms, need to wait more than 1ms to claim)
    clock.share_for_testing();

    scenario.next_tx(winner_addr);
    let mut wheel = scenario.take_shared<Wheel<SUI>>();
    let clock_shared = scenario.take_shared<clock::Clock>();
    let _prize_coin = sui_wheel::claim_prize(&mut wheel, &clock_shared, &version, scenario.ctx()); // Should abort here
    abort 1337
}
