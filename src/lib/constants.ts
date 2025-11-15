export const NETWORK = 'sui:testnet';

/**
 * Mapping of all deployed package versions for backward compatibility.
 * Each key is the package ID, mapped to its metadata.
 */
export const PACKAGE_VERSIONS = {
	'0x932dc79b84e8909f0d31c90e8ee07bda3f7c9bf088b0f6a575be554428decab7': {
		version: 1,
		versionObjectId: '0xee441334f35535c4b05ccedf78fe8600a8140bb12c5c91a8a0539f7ef32b09dd',
		timestampMs: '1763211204295'
	}
} as const;

/**
 * Latest (active) package ID
 */
export const LATEST_PACKAGE_ID = Object.keys(PACKAGE_VERSIONS)[0] as string;

/**
 * All package IDs sorted from latest → oldest
 */
export const ALL_PACKAGE_IDS = Object.keys(PACKAGE_VERSIONS);

/**
 * Version object ID for the latest package
 * Used to validate transactions against the current contract version.
 * The Version object is a shared object on the blockchain that ensures
 * all transactions interact with the correct contract version.
 * 
 * Functions requiring version validation:
 * - create_wheel: (entries, prize_amounts, delay_ms, claim_window_ms, v, ctx)
 * - claim_prize: (wheel, clock, v, ctx)
 * - reclaim_pool: (wheel, clock, v, ctx)
 * - spin_wheel: (wheel, random, clock, v, ctx)
 * - spin_wheel_with_order: (wheel, entry_order, random, clock, v, ctx)
 * - spin_wheel_and_assign_last_prize: (wheel, random, clock, v, ctx)
 * - spin_wheel_and_assign_last_prize_with_order: (wheel, entry_order, random, clock, v, ctx)
 * - cancel_wheel_and_reclaim_pool: (wheel, v, ctx)
 */
export const VERSION_OBJECT_ID =
	PACKAGE_VERSIONS['0x932dc79b84e8909f0d31c90e8ee07bda3f7c9bf088b0f6a575be554428decab7']
		.versionObjectId;

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
