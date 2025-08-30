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
 * Default package id placeholder. Replace with your actual package id on testnet.
 */
export const PACKAGE_ID = '0x8f398c524771a67e4ef2fd60ccb985463ea506387af39365f6a11075c5840cd4';

/**
 * Module and struct names for the wheel contract
 */
export const WHEEL_MODULE = 'sui_wheel';
export const WHEEL_STRUCT = 'Wheel';

export const WHEEL_FUNCTIONS = {
	CREATE: 'create_wheel',
	DONATE: 'donate_to_pool',
	SPIN: 'spin_wheel',
	CANCEL: 'cancel_wheel_and_reclaim_pool',
	CLAIM: 'claim_prize',
	RECLAIM: 'reclaim_pool'
};

// Shared object ids (placeholders). Replace with your deployment values
export const CLOCK_OBJECT_ID = '0x6';
export const RANDOM_OBJECT_ID = '0x8';
