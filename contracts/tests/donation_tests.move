#[test_only]
module sui_wheel::donation_tests;

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
use sui_wheel::helpers::{setup_version};

#[test]
fun test_donate_to_pool_success() {
    let organizer = @0xCAFE;
    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, organizer);
    scenario.next_tx(organizer);
    let entries = vector[@0xA, @0xB];
    let prize_amounts = vector[500];

    // Create wheel
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, ctx);
        share_wheel(wheel);
    };

    // Donate to pool
    scenario.next_tx(organizer);
    {
        let mut wheel = test_scenario::take_shared<Wheel<SUI>>(&scenario);
        let donate_amount: u64 = 2000;
        let balance = balance::create_for_testing<SUI>(donate_amount);
        let coin = coin::from_balance(balance, scenario.ctx());
        sui_wheel::donate_to_pool(&mut wheel, coin, scenario.ctx());
        assert!(sui_wheel::pool_value(&wheel) == donate_amount, 0);
        test_scenario::return_shared(wheel);
    };
    test_scenario::return_shared(version);

    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = sui_wheel::EWheelCancelled)]
fun test_donate_to_pool_cancelled() {
    let organizer = @0xCAFE;
    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, organizer);
    scenario.next_tx(organizer);

    // Create wheel
    let entries = vector[@0x1, @0x2];
    {
        let prize_amounts = vector[10000];
        let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, scenario.ctx());
        share_wheel(wheel);
    };

    // Cancel wheel
    scenario.next_tx(organizer);
    {
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let reclaim_opt = sui_wheel::cancel_wheel_and_reclaim_pool(&mut wheel, &version, scenario.ctx());
        if (option::is_some(&reclaim_opt)) {
            let reclaim_coin = option::destroy_some(reclaim_opt);
            coin::destroy_zero(reclaim_coin);
        } else {
            option::destroy_none(reclaim_opt);
        };
        test_scenario::return_shared(wheel);
    };

    // Donate to pool
    // This should fail because the wheel is cancelled
    scenario.next_tx(organizer);
    {
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let donate_amount: u64 = 2000;
        let balance = balance::create_for_testing<SUI>(donate_amount);
        let coin = coin::from_balance(balance, scenario.ctx());
        // fail here
        sui_wheel::donate_to_pool(&mut wheel, coin, scenario.ctx());
        test_scenario::return_shared(wheel);
    };
    test_scenario::return_shared(version);

    scenario.end();
}
