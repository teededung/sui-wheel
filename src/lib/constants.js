// SUI blockchain constants
// NOTE: Fill in DEFAULT_PACKAGE_ID after publishing your package on devnet

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
export const DEFAULT_PACKAGE_ID =
	'0xa70ede3c3965a34915564c61944005ef8b0fb6695df5b88510d43c410a8cd122';

/**
 * Module and struct names for the wheel contract
 */
export const WHEEL_MODULE = 'sui_wheel';
export const WHEEL_STRUCT = 'Wheel';

export const WHEEL_FUNCTIONS = {
	CREATE: 'create_wheel',
	DONATE: 'donate_to_pool',
	SPIN: 'spin_wheel',
	CANCEL: 'cancel_wheel_and_reclaim_pool'
};
