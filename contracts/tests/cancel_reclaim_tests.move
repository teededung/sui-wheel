#[test_only]
module sui_wheel::cancel_reclaim_tests;

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
fun test_reclaim_pool_success() {
    let admin = @0x0;
    let organizer = @0xCAFE;

    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, admin);
    scenario.next_tx(organizer);

    // Create wheel with 1 prize, set delay and claim window for testing
    let entries = vector[@0xA, @0xB];
    let prize_amounts = vector[1000];
    let delay_ms: u64 = 3600000; // 1 hour
    let claim_window_ms: u64 = 86400000; // 24 hours
    let wheel = create_wheel<SUI>(entries, prize_amounts, delay_ms, claim_window_ms, &version, scenario.ctx());
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
    clock.set_for_testing(3600000); // Initial timestamp
    clock.share_for_testing();

    // Perform spin
    scenario.next_tx(organizer);
    let mut wheel = scenario.take_shared<Wheel<SUI>>();
    let clock_shared = scenario.take_shared<clock::Clock>();
    sui_wheel::spin_wheel(&mut wheel, &random_state, &clock_shared, &version, scenario.ctx());
    assert!(sui_wheel::spun_count(&wheel) == 1, 1);
    test_scenario::return_shared(wheel);
    test_scenario::return_shared(clock_shared);

    // Advance clock to after claim window (deadline = spin_time 1000 + delay 1000 + window 2000 = 4000)
    scenario.next_tx(admin);
    let mut clock_shared = scenario.take_shared<clock::Clock>();
    clock_shared.set_for_testing(3600000 + delay_ms + claim_window_ms);
    test_scenario::return_shared(clock_shared);

    // Reclaim pool as organizer (should succeed, reclaim 1000 since unclaimed)
    scenario.next_tx(organizer);
    let mut wheel = scenario.take_shared<Wheel<SUI>>();
    let clock_shared = scenario.take_shared<clock::Clock>();
    let reclaimed_coin = sui_wheel::reclaim_pool(&mut wheel, &clock_shared, &version, scenario.ctx());
    assert!(coin::value(&reclaimed_coin) == 1000, 2);
    assert!(sui_wheel::pool_value(&wheel) == 0, 3);
    // Destroy reclaimed coin for test cleanup
    let reclaimed_balance = coin::into_balance(reclaimed_coin);
    balance::destroy_for_testing(reclaimed_balance);
    test_scenario::return_shared(wheel);
    test_scenario::return_shared(clock_shared);

    // Cleanup
    scenario.next_tx(admin);
    test_scenario::return_shared(random_state);
    test_scenario::return_shared(version);

    scenario.end();
}

#[test]
fun test_cancel_wheel_success() {
    let organizer = @0xCAFE;

    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, organizer);
    scenario.next_tx(organizer);

    // Create wheel
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

    // Cancel wheel and reclaim (before any spins)
    scenario.next_tx(organizer);
    let mut wheel = scenario.take_shared<Wheel<SUI>>();
    let reclaimed_opt = sui_wheel::cancel_wheel_and_reclaim_pool(&mut wheel, &version, scenario.ctx());
    assert!(sui_wheel::is_cancelled(&wheel), 1);
    assert!(sui_wheel::pool_value(&wheel) == 0, 2);
    assert!(option::is_some(&reclaimed_opt), 3);
    let reclaimed_coin = option::destroy_some(reclaimed_opt);
    assert!(coin::value(&reclaimed_coin) == 1000, 4);
    // Destroy reclaimed coin for test cleanup
    let reclaimed_balance = coin::into_balance(reclaimed_coin);
    balance::destroy_for_testing(reclaimed_balance);
    test_scenario::return_shared(wheel);

    test_scenario::return_shared(version);

    scenario.end();
}

#[test]
#[expected_failure(abort_code = sui_wheel::EAlreadySpunMax)]
fun test_cancel_wheel_after_spin() {
    let admin = @0x0;
    let organizer = @0xCAFE;

    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, admin);
    scenario.next_tx(organizer);

    // Create wheel
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

    // Perform spin (spun_count becomes 1)
    scenario.next_tx(organizer);
    let mut wheel = scenario.take_shared<Wheel<SUI>>();
    let clock_shared = scenario.take_shared<clock::Clock>();
    sui_wheel::spin_wheel(&mut wheel, &random_state, &clock_shared, &version, scenario.ctx());
    assert!(sui_wheel::spun_count(&wheel) == 1, 1);
    test_scenario::return_shared(wheel);
    test_scenario::return_shared(clock_shared);

    // Attempt cancel after spin (should fail with EAlreadySpunMax)
    scenario.next_tx(organizer);
    let mut wheel = scenario.take_shared<Wheel<SUI>>();
    let _reclaimed_opt = sui_wheel::cancel_wheel_and_reclaim_pool(&mut wheel, &version, scenario.ctx()); // Aborts here
    abort 1337
}
