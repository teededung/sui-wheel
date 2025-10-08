/**
 * Mapping of all deployed package versions for backward compatibility.
 * Each key is the package ID, mapped to its metadata.
 */
export const PACKAGE_VERSIONS = {
	'0x75239d71f7fd99bed2619ed7a72f9f29408718f8b6a9f7bdd14339e2efc6ae69': {
		version: 1,
		timestamp: '2025-10-08T04:08:00Z',
		comment: 'Deployed on 08.10.2025 UTC 04:08 (first deployment)'
	}
};

/**
 * Latest (active) package ID
 */
export const LATEST_PACKAGE_ID = Object.keys(PACKAGE_VERSIONS)[0];

/**
 * All package IDs sorted from latest → oldest
 */
export const ALL_PACKAGE_IDS = Object.keys(PACKAGE_VERSIONS);

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
	SPIN_AND_ASSIGN_LAST: 'spin_wheel_and_assign_last_prize',
	SPIN_WITH_ORDER: 'spin_wheel_with_order',
	SPIN_AND_ASSIGN_LAST_WITH_ORDER: 'spin_wheel_and_assign_last_prize_with_order',
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
