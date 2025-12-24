#[test_only]
module sui_wheel::helpers;

#[test_only]
use sui::test_scenario::{Scenario};
#[test_only]
use sui::clock::{Self, Clock};
#[test_only]
use sui_wheel::version::{Self, Version};

// Helper to setup clock in tests
public fun setup_clock(scenario: &mut Scenario): Clock {
    let mut clock = clock::create_for_testing(scenario.ctx());
    clock.set_for_testing(50); // Or any initial time
    clock
}

// Helper to setup version in tests - must be called with admin address
// Returns the version object that must be returned at the end of the test
public fun setup_version(scenario: &mut Scenario, admin: address): Version {
    scenario.next_tx(admin);
    version::init_for_testing(scenario.ctx());
    scenario.next_tx(admin);
    scenario.take_shared<Version>()
}
