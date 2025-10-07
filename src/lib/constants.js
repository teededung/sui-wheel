/**
 * Current package id after upgrade
 */
export const PACKAGE_ID = '0x62b9100755f45fbe0fe8a07c3bfb6c67bc7bdf0913ead684ca20582fe406f6a8'; // 07.10.2025 UTC 06:02

/**
 * Maximum number of entries allowed per wheel
 */
export const MAX_ENTRIES = 200;

/**
 * Number of MIST per 1 SUI
 */
export const MIST_PER_SUI = 1_000_000_000;

/**
 * Minimum prize amount settings
 */
export const MINIMUM_PRIZE_AMOUNT = {
	/** Minimum prize amount in SUI (decimal) */
	SUI: 0.01,
	/** Minimum prize amount in MIST */
	MIST: 10000000n
};

/**
 * Module and struct names for the wheel contract
 */
export const WHEEL_MODULE = 'sui_wheel';
export const WHEEL_STRUCT = 'Wheel';

export const WHEEL_FUNCTIONS = {
	CREATE: 'create_wheel',
	DONATE: 'donate_to_pool',
	SPIN: 'spin_wheel',
	SPIN_WITH_ORDER: 'spin_wheel_with_order',
	SPIN_AND_ASSIGN_LAST: 'spin_wheel_and_assign_last_prize',
	CANCEL: 'cancel_wheel_and_reclaim_pool',
	CLAIM: 'claim_prize',
	RECLAIM: 'reclaim_pool'
};

export const WHEEL_EVENTS = {
	CREATE: 'CreateEvent',
	SPIN: 'SpinEvent',
	CLAIM: 'ClaimEvent',
	RECLAIM: 'ReclaimEvent'
};

// Shared object ids (placeholders). Replace with your deployment values
export const CLOCK_OBJECT_ID = '0x6';
export const RANDOM_OBJECT_ID = '0x8';
