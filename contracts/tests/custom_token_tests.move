#[test_only]
module sui_wheel::custom_token_tests;

#[test_only]
use sui::balance;
#[test_only]
use sui::coin;
#[test_only]
use sui::sui::SUI;
#[test_only]
use sui::test_scenario::{Self};
#[test_only]
use sui_wheel::sui_wheel::{Self, create_wheel, share_wheel};
#[test_only]
use sui::clock::{Self};
#[test_only]
use sui::random::{Self, update_randomness_state_for_testing, Random};
#[test_only]
use sui_wheel::helpers::{setup_version};

// Define a test token type
public struct TEST_TOKEN has drop {}

#[test]
fun test_create_wheel_with_custom_token() {
    let mut scenario = test_scenario::begin(@0xCAFE);
    let version = setup_version(&mut scenario, @0xCAFE);
    let entries = vector[@0xA, @0xB, @0xC];
    let prize_amounts = vector[1000, 500, 200];
    let delay_ms = 3600000;
    let claim_window_ms = 86400000;

    let wheel = create_wheel<TEST_TOKEN>(entries, prize_amounts, delay_ms, claim_window_ms, &version, scenario.ctx());
    share_wheel(wheel);

    scenario.next_tx(@0xCAFE);
    let wheel = scenario.take_shared<sui_wheel::Wheel<TEST_TOKEN>>();

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
fun test_donate_custom_token_to_pool() {
    let organizer = @0xCAFE;
    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, organizer);
    scenario.next_tx(organizer);
    let entries = vector[@0xA, @0xB];
    let prize_amounts = vector[500];

    // Create wheel with custom token
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let wheel = create_wheel<TEST_TOKEN>(entries, prize_amounts, 0, 0, &version, ctx);
        share_wheel(wheel);
    };

    // Donate custom token to pool
    scenario.next_tx(organizer);
    {
        let mut wheel = test_scenario::take_shared<sui_wheel::Wheel<TEST_TOKEN>>(&scenario);
        let donate_amount: u64 = 2000;
        let balance = balance::create_for_testing<TEST_TOKEN>(donate_amount);
        let coin = coin::from_balance(balance, scenario.ctx());
        sui_wheel::donate_to_pool(&mut wheel, coin, scenario.ctx());
        assert!(sui_wheel::pool_value(&wheel) == donate_amount, 0);
        test_scenario::return_shared(wheel);
    };
    test_scenario::return_shared(version);

    test_scenario::end(scenario);
}

#[test]
fun test_claim_prize_custom_token() {
    let admin = @0x0;
    let organizer = @0xCAFE;
    let winner_addr = @0xA;

    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, admin);
    scenario.next_tx(organizer);

    // Create wheel with custom token and 1 prize
    let entries = vector[@0xA, @0xB];
    let prize_amounts = vector[1000];
    let wheel = create_wheel<TEST_TOKEN>(entries, prize_amounts, 0, 0, &version, scenario.ctx());
    share_wheel(wheel);

    // Donate custom token to pool
    scenario.next_tx(organizer);
    let mut wheel = scenario.take_shared<sui_wheel::Wheel<TEST_TOKEN>>();
    let donate_balance = balance::create_for_testing<TEST_TOKEN>(1000);
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

    // Perform spin
    scenario.next_tx(organizer);
    let mut wheel = scenario.take_shared<sui_wheel::Wheel<TEST_TOKEN>>();
    let clock_shared = scenario.take_shared<clock::Clock>();
    sui_wheel::spin_wheel(&mut wheel, &random_state, &clock_shared, &version, scenario.ctx());
    assert!(sui_wheel::spun_count(&wheel) == 1, 1);

    // Assert winner is @0xA
    let winners = sui_wheel::winners(&wheel);
    let winner = vector::borrow(winners, 0);
    assert!(sui_wheel::winner_addr(winner) == winner_addr, 2);
    test_scenario::return_shared(wheel);
    test_scenario::return_shared(clock_shared);

    // Claim prize as winner
    scenario.next_tx(winner_addr);
    let mut wheel = scenario.take_shared<sui_wheel::Wheel<TEST_TOKEN>>();
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
fun test_multiple_wheels_different_tokens() {
    let organizer = @0xCAFE;
    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, organizer);
    scenario.next_tx(organizer);

    // Create wheel with SUI
    let entries_sui = vector[@0xA, @0xB];
    let prize_amounts_sui = vector[1000];
    let wheel_sui = create_wheel<SUI>(entries_sui, prize_amounts_sui, 0, 0, &version, scenario.ctx());
    share_wheel(wheel_sui);

    // Create wheel with TEST_TOKEN
    let entries_test = vector[@0xC, @0xD];
    let prize_amounts_test = vector[2000];
    let wheel_test = create_wheel<TEST_TOKEN>(entries_test, prize_amounts_test, 0, 0, &version, scenario.ctx());
    share_wheel(wheel_test);

    // Donate to SUI wheel
    scenario.next_tx(organizer);
    {
        let mut wheel = test_scenario::take_shared<sui_wheel::Wheel<SUI>>(&scenario);
        let balance = balance::create_for_testing<SUI>(1000);
        let coin = coin::from_balance(balance, scenario.ctx());
        sui_wheel::donate_to_pool(&mut wheel, coin, scenario.ctx());
        assert!(sui_wheel::pool_value(&wheel) == 1000, 0);
        test_scenario::return_shared(wheel);
    };

    // Donate to TEST_TOKEN wheel
    scenario.next_tx(organizer);
    {
        let mut wheel = test_scenario::take_shared<sui_wheel::Wheel<TEST_TOKEN>>(&scenario);
        let balance = balance::create_for_testing<TEST_TOKEN>(2000);
        let coin = coin::from_balance(balance, scenario.ctx());
        sui_wheel::donate_to_pool(&mut wheel, coin, scenario.ctx());
        assert!(sui_wheel::pool_value(&wheel) == 2000, 1);
        test_scenario::return_shared(wheel);
    };

    // Verify both wheels are independent
    scenario.next_tx(organizer);
    {
        let wheel_sui = test_scenario::take_shared<sui_wheel::Wheel<SUI>>(&scenario);
        let wheel_test = test_scenario::take_shared<sui_wheel::Wheel<TEST_TOKEN>>(&scenario);
        
        assert!(sui_wheel::pool_value(&wheel_sui) == 1000, 2);
        assert!(sui_wheel::pool_value(&wheel_test) == 2000, 3);
        assert!(vector::length(sui_wheel::remaining_entries(&wheel_sui)) == 2, 4);
        assert!(vector::length(sui_wheel::remaining_entries(&wheel_test)) == 2, 5);
        
        test_scenario::return_shared(wheel_sui);
        test_scenario::return_shared(wheel_test);
    };

    test_scenario::return_shared(version);
    test_scenario::end(scenario);
}
