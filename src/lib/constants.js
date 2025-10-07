/**
 * Current package id after upgrade
 */
export const PACKAGE_ID = '0x62b9100755f45fbe0fe8a07c3bfb6c67bc7bdf0913ead684ca20582fe406f6a8'; // 07.10.2025 UTC 06:02

/**
 * Legacy package id for backward compatibility
 */
export const LEGACY_PACKAGE_ID =
	'0xf6d761634d4665b5186c48795343a7acc4badd1904e9e3c0df1db81baa4744b5'; // 29.08.2025 UTC 16:11

/**
 * Legacy package IDs that are allowed to be loaded
 */
export const ALL_PACKAGE_IDS = [
	// insert new package IDs here, sorted by timestamp
	'0x62b9100755f45fbe0fe8a07c3bfb6c67bc7bdf0913ead684ca20582fe406f6a8', // 07.10.2025 UTC 06:02
	'0x595f04e2071bc039d06561e331f95e262ccca3e34baecad3883e476ab507b0ed', // 07.10.2025 UTC 04:55
	'0x63f33b3a73432b1ecd625cdb5827376d9a58c7130aab56ea7c89a83a9f3671c0', // 01.09.2025 UTC 11:54
	'0x70b44c598b4bffa29dc75e99fb03ebeee93bfbd3ef34066086a57d1b524a7f09', // 30.08.2025 UTC 07:06
	LEGACY_PACKAGE_ID
];

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
 * Helper function to check if a package ID is allowed
 * @param {string} packageId - Package ID to check
 * @returns {boolean} - True if package ID is allowed
 */
export function isPackageIdAllowed(packageId) {
	return packageId === PACKAGE_ID || ALL_PACKAGE_IDS.includes(packageId);
}

/**
 * Helper function to get package ID type for display purposes
 * @param {string} packageId - Package ID to check
 * @returns {string} - 'current', 'legacy', or 'unknown'
 */
export function getPackageIdType(packageId) {
	if (packageId === PACKAGE_ID) return 'current';
	if (ALL_PACKAGE_IDS.includes(packageId)) return 'legacy';
	return 'unknown';
}

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
