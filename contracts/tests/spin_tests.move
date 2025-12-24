#[test_only]
module sui_wheel::spin_tests;

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
fun test_2_spins_success() {
    let admin = @0x0;
    let organizer = @0xCAFE;

    // Create wheel
    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, admin);
    scenario.next_tx(organizer);
    {
        let entries = vector[@0xA, @0xB, @0xC];
        let prize_amounts = vector[1000, 500];
        let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, scenario.ctx());
        share_wheel(wheel);
    };

    // Donate initial amount
    scenario.next_tx(organizer);
    {
        let initial_donate: u64 = 1500;
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
        x"ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF01234567",
        scenario.ctx(),
    );

    // Spin 1 time
    scenario.next_tx(organizer);
    {
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let clock = setup_clock(&mut scenario);
        sui_wheel::spin_wheel(&mut wheel, &random_state, &clock, &version, scenario.ctx());

        assert!(sui_wheel::spun_count(&wheel) == 1, 0);
        assert!(vector::length(sui_wheel::winners(&wheel)) == 1, 0);
        assert!(vector::length(sui_wheel::remaining_entries(&wheel)) <= 2, 0);

        test_scenario::return_shared(wheel);
        clock.destroy_for_testing();
    };

    // Spin 2 times
    scenario.next_tx(organizer);
    {
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let clock = setup_clock(&mut scenario);
        sui_wheel::spin_wheel(&mut wheel, &random_state, &clock, &version, scenario.ctx());

        assert!(sui_wheel::spun_count(&wheel) == 2, 0);
        assert!(vector::length(sui_wheel::winners(&wheel)) == 2, 0);
        assert!(vector::length(sui_wheel::remaining_entries(&wheel)) <= 1, 0);

        test_scenario::return_shared(wheel);
        clock.destroy_for_testing();
    };

    scenario.next_tx(admin);
    test_scenario::return_shared(random_state);
    test_scenario::return_shared(version);

    scenario.end();
}

#[test]
fun test_spin_and_auto_assign() {
    let admin = @0x0;
    let organizer = @0xCAFE;

    // Create wheel with 2 unique entries and 2 prizes
    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, admin);
    scenario.next_tx(organizer);
    {
        let entries = vector[@0xA, @0xB];
        let prize_amounts = vector[1000, 500];
        let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, scenario.ctx());
        share_wheel(wheel);
    };

    // Donate initial amount
    scenario.next_tx(organizer);
    {
        let initial_donate: u64 = 1500;
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
        x"ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF01234567",
        scenario.ctx(),
    );

    // Spin 1 time using spin_wheel
    scenario.next_tx(organizer);
    {
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let clock = setup_clock(&mut scenario);
        sui_wheel::spin_wheel(&mut wheel, &random_state, &clock, &version, scenario.ctx());

        assert!(sui_wheel::spun_count(&wheel) == 1, 0);
        assert!(vector::length(sui_wheel::winners(&wheel)) == 1, 0);
        assert!(vector::length(sui_wheel::remaining_entries(&wheel)) == 1, 0); // After removing one unique winner

        test_scenario::return_shared(wheel);
        clock.destroy_for_testing();
    };

    // Spin again to assign the last prize
    scenario.next_tx(organizer);
    {
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let clock = setup_clock(&mut scenario);
        sui_wheel::spin_wheel(&mut wheel, &random_state, &clock, &version, scenario.ctx());

        assert!(sui_wheel::spun_count(&wheel) == 2, 0);
        assert!(vector::length(sui_wheel::winners(&wheel)) == 2, 0);
        assert!(vector::length(sui_wheel::remaining_entries(&wheel)) == 0, 0);

        test_scenario::return_shared(wheel);
        clock.destroy_for_testing();
    };

    scenario.next_tx(admin);
    test_scenario::return_shared(random_state);
    test_scenario::return_shared(version);

    scenario.end();
}

#[test]
fun test_spin_wheel_and_assign_last_prize() {
    let admin = @0x0;
    let organizer = @0xCAFE;

    // Create wheel with 2 unique entries and 2 prizes
    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, admin);
    scenario.next_tx(organizer);
    {
        let entries = vector[@0xA, @0xB];
        let prize_amounts = vector[1000, 500];
        let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, scenario.ctx());
        share_wheel(wheel);
    };

    // Donate initial amount
    scenario.next_tx(organizer);
    {
        let initial_donate: u64 = 1500;
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
        x"ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF01234567",
        scenario.ctx(),
    );

    // Perform combined spin and auto-assign in one transaction
    scenario.next_tx(organizer);
    {
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let clock = setup_clock(&mut scenario);
        sui_wheel::spin_wheel_and_assign_last_prize(
            &mut wheel,
            &random_state,
            &clock,
            &version,
            scenario.ctx(),
        );

        // Verify final state after both actions
        assert!(sui_wheel::spun_count(&wheel) == 2, 0);
        assert!(vector::length(sui_wheel::winners(&wheel)) == 2, 0);
        assert!(vector::length(sui_wheel::remaining_entries(&wheel)) == 0, 0);

        // Optional: Check that winners are different addresses
        let winners_vec = sui_wheel::winners(&wheel);
        let winner1 = vector::borrow(winners_vec, 0);
        let winner2 = vector::borrow(winners_vec, 1);
        assert!(sui_wheel::winner_addr(winner1) != sui_wheel::winner_addr(winner2), 0);

        test_scenario::return_shared(wheel);
        clock.destroy_for_testing();
    };

    scenario.next_tx(admin);
    test_scenario::return_shared(random_state);
    test_scenario::return_shared(version);

    scenario.end();
}

#[test]
fun test_duplicate_pairs() {
    let admin = @0x0;
    let organizer = @0xCAFE;

    // Create wheel with 4 entries: two pairs of duplicates (A,A,B,B)
    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, admin);
    scenario.next_tx(organizer);
    {
        let entries = vector[@0xA, @0xA, @0xB, @0xB];
        let prize_amounts = vector[1000, 500];
        let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, scenario.ctx());
        share_wheel(wheel);
    };

    // Donate initial amount
    scenario.next_tx(organizer);
    {
        let initial_donate: u64 = 1500;
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
        x"ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF01234567",
        scenario.ctx(),
    );

    // Perform combined spin and auto-assign
    scenario.next_tx(organizer);
    {
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let clock = setup_clock(&mut scenario);
        sui_wheel::spin_wheel_and_assign_last_prize(
            &mut wheel,
            &random_state,
            &clock,
            &version,
            scenario.ctx(),
        );
        assert!(sui_wheel::spun_count(&wheel) == 2, 0);
        assert!(vector::length(sui_wheel::winners(&wheel)) == 2, 0);
        // After spin and auto-assign, remaining should be 0
        assert!(vector::length(sui_wheel::remaining_entries(&wheel)) == 0, 0);

        // Optional: Check that winners are different addresses
        let winners_vec = sui_wheel::winners(&wheel);
        let winner1 = vector::borrow(winners_vec, 0);
        let winner2 = vector::borrow(winners_vec, 1);
        assert!(sui_wheel::winner_addr(winner1) != sui_wheel::winner_addr(winner2), 0);

        test_scenario::return_shared(wheel);
        clock.destroy_for_testing();
    };

    scenario.next_tx(admin);
    test_scenario::return_shared(random_state);
    test_scenario::return_shared(version);

    scenario.end();
}

#[test]
#[expected_failure(abort_code = sui_wheel::EInsufficientPool)]
fun test_spin_wheel_insufficient_pool() {
    let admin = @0x0;
    let organizer = @0xCAFE;

    // Create wheel
    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, admin);
    scenario.next_tx(organizer);
    {
        let entries = vector[@0xA, @0xB, @0xC];
        let prize_amounts = vector[1000, 500];
        let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, scenario.ctx());
        share_wheel(wheel);
    };

    // Donate initial amount, not enough to spin
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
        let clock = setup_clock(&mut scenario);

        // fail here
        sui_wheel::spin_wheel(&mut wheel, &random_state, &clock, &version, scenario.ctx());

        test_scenario::return_shared(wheel);
        clock.destroy_for_testing();
    };

    scenario.next_tx(admin);
    test_scenario::return_shared(random_state);
    test_scenario::return_shared(version);

    scenario.end();
}

#[test]
fun test_spin_wheel_with_order_success() {
    let admin = @0x0;
    let organizer = @0xCAFE;

    // Create wheel with 3 entries and 2 prizes
    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, admin);
    scenario.next_tx(organizer);
    {
        let entries = vector[@0xA, @0xB, @0xC];
        let prize_amounts = vector[1000, 500];
        let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, scenario.ctx());
        share_wheel(wheel);
    };

    // Donate initial amount
    scenario.next_tx(organizer);
    {
        let initial_donate: u64 = 1500;
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let balance = balance::create_for_testing<SUI>(initial_donate);
        let coin = coin::from_balance(balance, scenario.ctx());
        sui_wheel::donate_to_pool(&mut wheel, coin, scenario.ctx());
        assert!(sui_wheel::pool_value(&wheel) == initial_donate, 0);
        test_scenario::return_shared(wheel);
    };

    // Setup randomness
    scenario.next_tx(admin);
    random::create_for_testing(scenario.ctx());

    scenario.next_tx(admin);
    let mut random_state = scenario.take_shared<Random>();
    random_state.update_randomness_state_for_testing(
        0,
        x"ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF01234567",
        scenario.ctx(),
    );

    // Spin with custom order [2, 0, 1] (shuffled index order)
    scenario.next_tx(organizer);
    {
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let clock = setup_clock(&mut scenario);
        let entry_order = vector[2u64, 0u64, 1u64]; // Shuffled index order
        sui_wheel::spin_wheel_with_order(
            &mut wheel,
            entry_order,
            &random_state,
            &clock,
            &version,
            scenario.ctx(),
        );

        assert!(sui_wheel::spun_count(&wheel) == 1, 0);
        assert!(vector::length(sui_wheel::winners(&wheel)) == 1, 0);
        assert!(vector::length(sui_wheel::remaining_entries(&wheel)) == 2, 0);

        test_scenario::return_shared(wheel);
        clock.destroy_for_testing();
    };

    scenario.next_tx(admin);
    test_scenario::return_shared(random_state);
    test_scenario::return_shared(version);

    scenario.end();
}

#[test]
#[expected_failure(abort_code = sui_wheel::EInvalidEntriesCount)]
fun test_spin_wheel_with_order_invalid_order_length() {
    let admin = @0x0;
    let organizer = @0xCAFE;

    // Create wheel with 3 entries and 1 prize
    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, admin);
    scenario.next_tx(organizer);
    {
        let entries = vector[@0xA, @0xB, @0xC];
        let prize_amounts = vector[1000];
        let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, scenario.ctx());
        share_wheel(wheel);
    };

    // Donate initial amount
    scenario.next_tx(organizer);
    {
        let initial_donate: u64 = 1000;
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let balance = balance::create_for_testing<SUI>(initial_donate);
        let coin = coin::from_balance(balance, scenario.ctx());
        sui_wheel::donate_to_pool(&mut wheel, coin, scenario.ctx());
        test_scenario::return_shared(wheel);
    };

    // Setup randomness
    scenario.next_tx(admin);
    random::create_for_testing(scenario.ctx());

    scenario.next_tx(admin);
    let mut random_state = scenario.take_shared<Random>();
    random_state.update_randomness_state_for_testing(
        0,
        x"ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF01234567",
        scenario.ctx(),
    );

    // Spin with invalid order length (should be 3, but provided 2)
    scenario.next_tx(organizer);
    {
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let clock = setup_clock(&mut scenario);
        let entry_order = vector[0u64, 1u64]; // Wrong length - should be 3 elements
        sui_wheel::spin_wheel_with_order(
            &mut wheel,
            entry_order,
            &random_state,
            &clock,
            &version,
            scenario.ctx(),
        );
        test_scenario::return_shared(wheel);
        clock.destroy_for_testing();
    };

    scenario.next_tx(admin);
    test_scenario::return_shared(random_state);
    test_scenario::return_shared(version);

    scenario.end();
}

#[test]
#[expected_failure(abort_code = sui_wheel::EInvalidEntriesCount)]
fun test_spin_wheel_with_order_invalid_index() {
    let admin = @0x0;
    let organizer = @0xCAFE;

    // Create wheel with 3 entries and 1 prize
    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, admin);
    scenario.next_tx(organizer);
    {
        let entries = vector[@0xA, @0xB, @0xC];
        let prize_amounts = vector[1000];
        let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, scenario.ctx());
        share_wheel(wheel);
    };

    // Donate initial amount
    scenario.next_tx(organizer);
    {
        let initial_donate: u64 = 1000;
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let balance = balance::create_for_testing<SUI>(initial_donate);
        let coin = coin::from_balance(balance, scenario.ctx());
        sui_wheel::donate_to_pool(&mut wheel, coin, scenario.ctx());
        test_scenario::return_shared(wheel);
    };

    // Setup randomness
    scenario.next_tx(admin);
    random::create_for_testing(scenario.ctx());

    scenario.next_tx(admin);
    let mut random_state = scenario.take_shared<Random>();
    random_state.update_randomness_state_for_testing(
        0,
        x"ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF01234567",
        scenario.ctx(),
    );

    // Spin with invalid index (3 is out of bounds for 3 entries)
    scenario.next_tx(organizer);
    {
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let clock = setup_clock(&mut scenario);
        let entry_order = vector[0u64, 1u64, 3u64]; // Invalid index 3
        sui_wheel::spin_wheel_with_order(
            &mut wheel,
            entry_order,
            &random_state,
            &clock,
            &version,
            scenario.ctx(),
        );
        test_scenario::return_shared(wheel);
        clock.destroy_for_testing();
    };

    scenario.next_tx(admin);
    test_scenario::return_shared(random_state);
    test_scenario::return_shared(version);

    scenario.end();
}

#[test]
#[expected_failure(abort_code = sui_wheel::ENotOrganizer)]
fun test_spin_wheel_with_order_not_organizer() {
    let admin = @0x0;
    let organizer = @0xCAFE;
    let non_organizer = @0xBEEF;

    // Create wheel
    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, admin);
    scenario.next_tx(organizer);
    {
        let entries = vector[@0xA, @0xB, @0xC];
        let prize_amounts = vector[1000];
        let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, scenario.ctx());
        share_wheel(wheel);
    };

    // Donate initial amount
    scenario.next_tx(organizer);
    {
        let initial_donate: u64 = 1000;
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let balance = balance::create_for_testing<SUI>(initial_donate);
        let coin = coin::from_balance(balance, scenario.ctx());
        sui_wheel::donate_to_pool(&mut wheel, coin, scenario.ctx());
        test_scenario::return_shared(wheel);
    };

    // Setup randomness
    scenario.next_tx(admin);
    random::create_for_testing(scenario.ctx());

    scenario.next_tx(admin);
    let mut random_state = scenario.take_shared<Random>();
    random_state.update_randomness_state_for_testing(
        0,
        x"ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF01234567",
        scenario.ctx(),
    );

    // Non-organizer tries to spin
    scenario.next_tx(non_organizer);
    {
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let clock = setup_clock(&mut scenario);
        let entry_order = vector[0u64, 1u64, 2u64];
        sui_wheel::spin_wheel_with_order(
            &mut wheel,
            entry_order,
            &random_state,
            &clock,
            &version,
            scenario.ctx(),
        );
        test_scenario::return_shared(wheel);
        clock.destroy_for_testing();
    };

    scenario.next_tx(admin);
    test_scenario::return_shared(random_state);
    test_scenario::return_shared(version);

    scenario.end();
}

#[test]
fun test_spin_wheel_with_order_deterministic_selection() {
    let admin = @0x0;
    let organizer = @0xCAFE;

    // Create wheel with 3 entries and 1 prize
    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, admin);
    scenario.next_tx(organizer);
    {
        let entries = vector[@0xA, @0xB, @0xC];
        let prize_amounts = vector[1000];
        let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, scenario.ctx());
        share_wheel(wheel);
    };

    // Donate initial amount
    scenario.next_tx(organizer);
    {
        let initial_donate: u64 = 1000;
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let balance = balance::create_for_testing<SUI>(initial_donate);
        let coin = coin::from_balance(balance, scenario.ctx());
        sui_wheel::donate_to_pool(&mut wheel, coin, scenario.ctx());
        test_scenario::return_shared(wheel);
    };

    // Setup randomness with fixed seed
    scenario.next_tx(admin);
    random::create_for_testing(scenario.ctx());

    scenario.next_tx(admin);
    let mut random_state = scenario.take_shared<Random>();
    random_state.update_randomness_state_for_testing(
        0,
        x"0000000000000000000000000000000000000000000000000000000000000000", // Fixed seed
        scenario.ctx(),
    );

    // Spin with specific order [1, 0, 2] - should select index 1 from this order
    scenario.next_tx(organizer);
    {
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let clock = setup_clock(&mut scenario);
        let entry_order = vector[1u64, 0u64, 2u64]; // Shuffled order
        sui_wheel::spin_wheel_with_order(
            &mut wheel,
            entry_order,
            &random_state,
            &clock,
            &version,
            scenario.ctx(),
        );

        assert!(sui_wheel::spun_count(&wheel) == 1, 0);
        assert!(vector::length(sui_wheel::winners(&wheel)) == 1, 0);
        assert!(vector::length(sui_wheel::remaining_entries(&wheel)) == 2, 0);

        // Verify the winner is removed from remaining entries
        let remaining = sui_wheel::remaining_entries(&wheel);
        let winner = vector::borrow(sui_wheel::winners(&wheel), 0);
        let winner_addr = sui_wheel::winner_addr(winner);

        // Check that winner is not in remaining entries
        let mut found = false;
        let mut i = 0;
        while (i < vector::length(remaining)) {
            if (*vector::borrow(remaining, i) == winner_addr) {
                found = true;
                break
            };
            i = i + 1;
        };
        assert!(!found, 1); // Winner should not be in remaining entries

        test_scenario::return_shared(wheel);
        clock.destroy_for_testing();
    };

    scenario.next_tx(admin);
    test_scenario::return_shared(random_state);
    test_scenario::return_shared(version);

    scenario.end();
}

#[test]
fun test_spin_wheel_and_assign_last_prize_with_order_success() {
    let admin = @0x0;
    let organizer = @0xCAFE;

    // Create wheel with 2 unique entries and 2 prizes
    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, admin);
    scenario.next_tx(organizer);
    {
        let entries = vector[@0xA, @0xB];
        let prize_amounts = vector[1000, 500];
        let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, scenario.ctx());
        share_wheel(wheel);
    };

    // Donate initial amount
    scenario.next_tx(organizer);
    {
        let initial_donate: u64 = 1500;
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let balance = balance::create_for_testing<SUI>(initial_donate);
        let coin = coin::from_balance(balance, scenario.ctx());
        sui_wheel::donate_to_pool(&mut wheel, coin, scenario.ctx());
        assert!(sui_wheel::pool_value(&wheel) == initial_donate, 0);
        test_scenario::return_shared(wheel);
    };

    // Setup randomness
    scenario.next_tx(admin);
    random::create_for_testing(scenario.ctx());

    scenario.next_tx(admin);
    let mut random_state = scenario.take_shared<Random>();
    random_state.update_randomness_state_for_testing(
        0,
        x"ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF01234567",
        scenario.ctx(),
    );

    // Perform combined spin and auto-assign with custom order [1, 0]
    scenario.next_tx(organizer);
    {
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let clock = setup_clock(&mut scenario);
        let entry_order = vector[1u64, 0u64]; // Shuffled order
        sui_wheel::spin_wheel_and_assign_last_prize_with_order(
            &mut wheel,
            entry_order,
            &random_state,
            &clock,
            &version,
            scenario.ctx(),
        );

        // Verify final state after both actions
        assert!(sui_wheel::spun_count(&wheel) == 2, 0);
        assert!(vector::length(sui_wheel::winners(&wheel)) == 2, 0);
        assert!(vector::length(sui_wheel::remaining_entries(&wheel)) == 0, 0);

        // Verify that winners are different addresses
        let winners_vec = sui_wheel::winners(&wheel);
        let winner1 = vector::borrow(winners_vec, 0);
        let winner2 = vector::borrow(winners_vec, 1);
        assert!(sui_wheel::winner_addr(winner1) != sui_wheel::winner_addr(winner2), 1);

        test_scenario::return_shared(wheel);
        clock.destroy_for_testing();
    };

    scenario.next_tx(admin);
    test_scenario::return_shared(random_state);
    test_scenario::return_shared(version);

    scenario.end();
}

#[test]
fun test_spin_wheel_and_assign_last_prize_with_order_duplicate_pairs() {
    let admin = @0x0;
    let organizer = @0xCAFE;

    // Create wheel with 4 entries: two pairs of duplicates (A,A,B,B) and 2 prizes
    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, admin);
    scenario.next_tx(organizer);
    {
        let entries = vector[@0xA, @0xA, @0xB, @0xB];
        let prize_amounts = vector[1000, 500];
        let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, scenario.ctx());
        share_wheel(wheel);
    };

    // Donate initial amount
    scenario.next_tx(organizer);
    {
        let initial_donate: u64 = 1500;
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let balance = balance::create_for_testing<SUI>(initial_donate);
        let coin = coin::from_balance(balance, scenario.ctx());
        sui_wheel::donate_to_pool(&mut wheel, coin, scenario.ctx());
        assert!(sui_wheel::pool_value(&wheel) == initial_donate, 0);
        test_scenario::return_shared(wheel);
    };

    // Setup randomness
    scenario.next_tx(admin);
    random::create_for_testing(scenario.ctx());

    scenario.next_tx(admin);
    let mut random_state = scenario.take_shared<Random>();
    random_state.update_randomness_state_for_testing(
        0,
        x"ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF01234567",
        scenario.ctx(),
    );

    // Perform combined spin and auto-assign with custom order [3, 0, 1, 2]
    scenario.next_tx(organizer);
    {
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let clock = setup_clock(&mut scenario);
        let entry_order = vector[3u64, 0u64, 1u64, 2u64]; // Shuffled order
        sui_wheel::spin_wheel_and_assign_last_prize_with_order(
            &mut wheel,
            entry_order,
            &random_state,
            &clock,
            &version,
            scenario.ctx(),
        );

        // Verify final state after both actions
        assert!(sui_wheel::spun_count(&wheel) == 2, 0);
        assert!(vector::length(sui_wheel::winners(&wheel)) == 2, 0);
        assert!(vector::length(sui_wheel::remaining_entries(&wheel)) == 0, 0);

        // Verify that winners are different addresses
        let winners_vec = sui_wheel::winners(&wheel);
        let winner1 = vector::borrow(winners_vec, 0);
        let winner2 = vector::borrow(winners_vec, 1);
        assert!(sui_wheel::winner_addr(winner1) != sui_wheel::winner_addr(winner2), 1);

        test_scenario::return_shared(wheel);
        clock.destroy_for_testing();
    };

    scenario.next_tx(admin);
    test_scenario::return_shared(random_state);
    test_scenario::return_shared(version);

    scenario.end();
}

#[test]
#[expected_failure(abort_code = sui_wheel::EInvalidEntriesCount)]
fun test_spin_wheel_and_assign_last_prize_with_order_invalid_length() {
    let admin = @0x0;
    let organizer = @0xCAFE;

    // Create wheel with 2 entries and 2 prizes
    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, admin);
    scenario.next_tx(organizer);
    {
        let entries = vector[@0xA, @0xB];
        let prize_amounts = vector[1000, 500];
        let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, scenario.ctx());
        share_wheel(wheel);
    };

    // Donate initial amount
    scenario.next_tx(organizer);
    {
        let initial_donate: u64 = 1500;
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let balance = balance::create_for_testing<SUI>(initial_donate);
        let coin = coin::from_balance(balance, scenario.ctx());
        sui_wheel::donate_to_pool(&mut wheel, coin, scenario.ctx());
        test_scenario::return_shared(wheel);
    };

    // Setup randomness
    scenario.next_tx(admin);
    random::create_for_testing(scenario.ctx());

    scenario.next_tx(admin);
    let mut random_state = scenario.take_shared<Random>();
    random_state.update_randomness_state_for_testing(
        0,
        x"ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF01234567",
        scenario.ctx(),
    );

    // Spin with invalid order length (should be 2, but provided 1)
    scenario.next_tx(organizer);
    {
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let clock = setup_clock(&mut scenario);
        let entry_order = vector[0u64]; // Wrong length - should be 2 elements
        sui_wheel::spin_wheel_and_assign_last_prize_with_order(
            &mut wheel,
            entry_order,
            &random_state,
            &clock,
            &version,
            scenario.ctx(),
        );
        test_scenario::return_shared(wheel);
        clock.destroy_for_testing();
    };

    scenario.next_tx(admin);
    test_scenario::return_shared(random_state);
    test_scenario::return_shared(version);

    scenario.end();
}

#[test]
#[expected_failure(abort_code = sui_wheel::EInvalidEntriesCount)]
fun test_spin_wheel_and_assign_last_prize_with_order_invalid_index() {
    let admin = @0x0;
    let organizer = @0xCAFE;

    // Create wheel with 2 entries and 2 prizes
    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, admin);
    scenario.next_tx(organizer);
    {
        let entries = vector[@0xA, @0xB];
        let prize_amounts = vector[1000, 500];
        let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, scenario.ctx());
        share_wheel(wheel);
    };

    // Donate initial amount
    scenario.next_tx(organizer);
    {
        let initial_donate: u64 = 1500;
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let balance = balance::create_for_testing<SUI>(initial_donate);
        let coin = coin::from_balance(balance, scenario.ctx());
        sui_wheel::donate_to_pool(&mut wheel, coin, scenario.ctx());
        test_scenario::return_shared(wheel);
    };

    // Setup randomness
    scenario.next_tx(admin);
    random::create_for_testing(scenario.ctx());

    scenario.next_tx(admin);
    let mut random_state = scenario.take_shared<Random>();
    random_state.update_randomness_state_for_testing(
        0,
        x"ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF01234567",
        scenario.ctx(),
    );

    // Spin with invalid index (2 is out of bounds for 2 entries)
    scenario.next_tx(organizer);
    {
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let clock = setup_clock(&mut scenario);
        let entry_order = vector[0u64, 2u64]; // Invalid index 2
        sui_wheel::spin_wheel_and_assign_last_prize_with_order(
            &mut wheel,
            entry_order,
            &random_state,
            &clock,
            &version,
            scenario.ctx(),
        );
        test_scenario::return_shared(wheel);
        clock.destroy_for_testing();
    };

    scenario.next_tx(admin);
    test_scenario::return_shared(random_state);
    test_scenario::return_shared(version);

    scenario.end();
}

#[test]
#[expected_failure(abort_code = sui_wheel::ENotOrganizer)]
fun test_spin_wheel_and_assign_last_prize_with_order_not_organizer() {
    let admin = @0x0;
    let organizer = @0xCAFE;
    let non_organizer = @0xBEEF;

    // Create wheel
    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, admin);
    scenario.next_tx(organizer);
    {
        let entries = vector[@0xA, @0xB];
        let prize_amounts = vector[1000, 500];
        let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, scenario.ctx());
        share_wheel(wheel);
    };

    // Donate initial amount
    scenario.next_tx(organizer);
    {
        let initial_donate: u64 = 1500;
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let balance = balance::create_for_testing<SUI>(initial_donate);
        let coin = coin::from_balance(balance, scenario.ctx());
        sui_wheel::donate_to_pool(&mut wheel, coin, scenario.ctx());
        test_scenario::return_shared(wheel);
    };

    // Setup randomness
    scenario.next_tx(admin);
    random::create_for_testing(scenario.ctx());

    scenario.next_tx(admin);
    let mut random_state = scenario.take_shared<Random>();
    random_state.update_randomness_state_for_testing(
        0,
        x"ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF01234567",
        scenario.ctx(),
    );

    // Non-organizer tries to spin
    scenario.next_tx(non_organizer);
    {
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let clock = setup_clock(&mut scenario);
        let entry_order = vector[0u64, 1u64];
        sui_wheel::spin_wheel_and_assign_last_prize_with_order(
            &mut wheel,
            entry_order,
            &random_state,
            &clock,
            &version,
            scenario.ctx(),
        );
        test_scenario::return_shared(wheel);
        clock.destroy_for_testing();
    };

    scenario.next_tx(admin);
    test_scenario::return_shared(random_state);
    test_scenario::return_shared(version);

    scenario.end();
}

#[test]
fun test_spin_wheel_and_assign_last_prize_with_order_no_auto_assign() {
    let admin = @0x0;
    let organizer = @0xCAFE;

    // Create wheel with 3 entries and 1 prize (no auto-assign should happen)
    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, admin);
    scenario.next_tx(organizer);
    {
        let entries = vector[@0xA, @0xB, @0xC];
        let prize_amounts = vector[1000];
        let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, scenario.ctx());
        share_wheel(wheel);
    };

    // Donate initial amount
    scenario.next_tx(organizer);
    {
        let initial_donate: u64 = 1000;
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let balance = balance::create_for_testing<SUI>(initial_donate);
        let coin = coin::from_balance(balance, scenario.ctx());
        sui_wheel::donate_to_pool(&mut wheel, coin, scenario.ctx());
        test_scenario::return_shared(wheel);
    };

    // Setup randomness
    scenario.next_tx(admin);
    random::create_for_testing(scenario.ctx());

    scenario.next_tx(admin);
    let mut random_state = scenario.take_shared<Random>();
    random_state.update_randomness_state_for_testing(
        0,
        x"ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF01234567",
        scenario.ctx(),
    );

    // Spin with custom order [2, 0, 1] - should only spin once (no auto-assign)
    scenario.next_tx(organizer);
    {
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let clock = setup_clock(&mut scenario);
        let entry_order = vector[2u64, 0u64, 1u64]; // Shuffled order
        sui_wheel::spin_wheel_and_assign_last_prize_with_order(
            &mut wheel,
            entry_order,
            &random_state,
            &clock,
            &version,
            scenario.ctx(),
        );

        // Verify only one spin occurred (no auto-assign)
        assert!(sui_wheel::spun_count(&wheel) == 1, 0);
        assert!(vector::length(sui_wheel::winners(&wheel)) == 1, 0);
        assert!(vector::length(sui_wheel::remaining_entries(&wheel)) == 2, 0);

        test_scenario::return_shared(wheel);
        clock.destroy_for_testing();
    };

    scenario.next_tx(admin);
    test_scenario::return_shared(random_state);
    test_scenario::return_shared(version);

    scenario.end();
}

#[test]
fun test_spin_wheel_and_assign_last_prize_with_order_duplicate_entries() {
    let admin = @0x0;
    let organizer = @0xCAFE;

    // Create wheel with 4 entries: two pairs of duplicates (A,A,B,B) and 2 prizes
    let mut scenario = test_scenario::begin(organizer);
    let version = setup_version(&mut scenario, admin);
    scenario.next_tx(organizer);
    {
        let entries = vector[@0xA, @0xA, @0xB, @0xB];
        let prize_amounts = vector[1000, 500];
        let wheel = create_wheel<SUI>(entries, prize_amounts, 0, 0, &version, scenario.ctx());
        share_wheel(wheel);
    };

    // Donate initial amount
    scenario.next_tx(organizer);
    {
        let initial_donate: u64 = 1500;
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let balance = balance::create_for_testing<SUI>(initial_donate);
        let coin = coin::from_balance(balance, scenario.ctx());
        sui_wheel::donate_to_pool(&mut wheel, coin, scenario.ctx());
        test_scenario::return_shared(wheel);
    };

    // Setup randomness
    scenario.next_tx(admin);
    random::create_for_testing(scenario.ctx());

    scenario.next_tx(admin);
    let mut random_state = scenario.take_shared<Random>();
    random_state.update_randomness_state_for_testing(
        0,
        x"ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF01234567",
        scenario.ctx(),
    );

    // Spin with custom order [3, 0, 1, 2] - should spin and auto-assign since after spin unique==1 for last prize
    scenario.next_tx(organizer);
    {
        let mut wheel = scenario.take_shared<Wheel<SUI>>();
        let clock = setup_clock(&mut scenario);
        let entry_order = vector[3u64, 0u64, 1u64, 2u64]; // Shuffled order
        sui_wheel::spin_wheel_and_assign_last_prize_with_order(
            &mut wheel,
            entry_order,
            &random_state,
            &clock,
            &version,
            scenario.ctx(),
        );

        // Verify spin and auto-assign occurred
        assert!(sui_wheel::spun_count(&wheel) == 2, 0);
        assert!(vector::length(sui_wheel::winners(&wheel)) == 2, 0);
        assert!(vector::length(sui_wheel::remaining_entries(&wheel)) == 0, 0);

        // Additional checks: winners should be different addresses
        let winners_vec = sui_wheel::winners(&wheel);
        let winner1 = vector::borrow(winners_vec, 0);
        let winner2 = vector::borrow(winners_vec, 1);
        assert!(sui_wheel::winner_addr(winner1) != sui_wheel::winner_addr(winner2), 1);

        test_scenario::return_shared(wheel);
        clock.destroy_for_testing();
    };

    scenario.next_tx(admin);
    test_scenario::return_shared(random_state);
    test_scenario::return_shared(version);

    scenario.end();
}
