// SUI blockchain constants
// NOTE: Fill in PACKAGE_ID after publishing your package on devnet

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
 * Maximum number of entries allowed per wheel
 */
export const MAX_ENTRIES = 200;

/**
 * Default package id placeholder. Replace with your actual package id on testnet.
 */
export const PACKAGE_ID = '0x63f33b3a73432b1ecd625cdb5827376d9a58c7130aab56ea7c89a83a9f3671c0';

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
	CANCEL: 'cancel_wheel_and_reclaim_pool',
	CLAIM: 'claim_prize',
	RECLAIM: 'reclaim_pool'
};

// Shared object ids (placeholders). Replace with your deployment values
export const CLOCK_OBJECT_ID = '0x6';
export const RANDOM_OBJECT_ID = '0x8';
