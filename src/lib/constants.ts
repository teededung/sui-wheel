export const NETWORK = 'sui:testnet';

/**
 * Mapping of all deployed package versions for backward compatibility.
 * Each key is the package ID, mapped to its metadata.
 */
export const PACKAGE_VERSIONS = {
	'0x205430cca7290f23a16e7002457965af9902c2090074f55de4c3469dc220486f': {
		version: 1,
		versionObjectId: '0x6e8e0e3c3ec506d18c2eb4dffc6298c89e150d39150ab4118b0c27972e5b9b59',
		timestampMs: '1763272227557'
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
	PACKAGE_VERSIONS['0x205430cca7290f23a16e7002457965af9902c2090074f55de4c3469dc220486f']
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
 * Reserved gas fee for transactions (in MIST)
 * This amount is reserved from the wallet balance to ensure sufficient gas for transactions
 */
export const RESERVED_GAS_FEE_MIST = 100_000_000n; // 0.1 SUI

/**
 * Reserved gas fee for transactions (in SUI)
 */
export const RESERVED_GAS_FEE_SUI = 0.1;

/**
 * Minimum prize amount settings
 * Note: For multi-coin support, minimum amounts should be calculated based on coin decimals
 */
export const MINIMUM_PRIZE_AMOUNT = {
	/** Minimum prize amount in SUI (decimal) */
	SUI: 0.01,
	/** Minimum prize amount in MIST */
	MIST: 10000000n
};

/**
 * Default minimum prize amount in smallest unit (applies to all coins)
 * This is a reasonable minimum to prevent dust amounts
 */
export const DEFAULT_MINIMUM_PRIZE_SMALLEST_UNIT = 10000000n; // 0.01 for 9 decimal coins

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

/**
 * Coin-related constants for multi-coin support
 */

/** Default coin type (SUI) */
export const DEFAULT_COIN_TYPE = '0x2::sui::SUI';

/** Cache TTL for coin metadata in milliseconds (1 hour) */
export const COIN_METADATA_CACHE_TTL = 1000 * 60 * 60;

/** Regex pattern for validating coin type format */
export const COIN_TYPE_REGEX = /^0x[a-fA-F0-9]+::[a-zA-Z_][a-zA-Z0-9_]*::[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Helper function to get coin type from wheel or default to SUI
 * @param wheel - Wheel object that may have a coinType property
 * @returns Coin type string
 */
export function getWheelCoinType(wheel: { coinType?: string } | null | undefined): string {
	return wheel?.coinType || DEFAULT_COIN_TYPE;
}

import * as coinIcons from '$lib/assets/coin';

/**
 * Common coin metadata type
 */
export interface CommonCoinMetadata {
	coinType: string;
	symbol: string;
	name: string;
	decimals: number;
	iconUrl: string;
}

/**
 * Common coin types on Sui blockchain with metadata
 * These coins will always be shown in the coin selector, even with 0 balance
 */
export const COMMON_COINS: CommonCoinMetadata[] = [
	{
		coinType: '0x2::sui::SUI',
		symbol: 'SUI',
		name: 'Sui',
		decimals: 9,
		iconUrl: coinIcons.SUI
	},
	{
		// Testnet USDC
		coinType: '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC',
		symbol: 'USDC',
		name: 'USD Coin',
		decimals: 6,
		iconUrl: coinIcons.USDC
	},
	{
		// Testnet WAL
		coinType: '0x8270feb7375eee355e64fdb69c50abb6b5f9393a722883c1cf45f8e26048810a::wal::WAL',
		symbol: 'WAL',
		name: 'Walrus Coin',
		decimals: 9,
		iconUrl: coinIcons.WAL
	},
	// Note: Other coins below are mainnet addresses and may not exist on testnet
	// Uncomment and update with testnet addresses when available
	// {
	// 	coinType: '0xd0e89b2af5e4910726fbcd8b8dd37bb79b29e5f83f7491bca830e94f7f226d29::eth::ETH',
	// 	symbol: 'ETH',
	// 	name: 'Ethereum',
	// 	decimals: 8,
	// 	iconUrl: coinIcons.ETH
	// },
	// {
	// 	coinType: '0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL',
	// 	symbol: 'WAL',
	// 	name: 'Walrus',
	// 	decimals: 9,
	// 	iconUrl: coinIcons.WAL
	// },
	// {
	// 	coinType: '0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP',
	// 	symbol: 'DEEP',
	// 	name: 'DeepBook',
	// 	decimals: 6,
	// 	iconUrl: coinIcons.DEEP
	// },
	// {
	// 	coinType: '0x5145494a5f5100e645e4b0aa950fa6b68f614e8c59e17bc5ded3495123a79178::ns::NS',
	// 	symbol: 'NS',
	// 	name: 'NS',
	// 	decimals: 6,
	// 	iconUrl: coinIcons.NS
	// },
	// {
	// 	coinType: '0x7262fb2f7a3a14c888c438a3cd9b912469a58cf60f367352c46584262e8299aa::ika::IKA',
	// 	symbol: 'IKA',
	// 	name: 'IKA',
	// 	decimals: 9,
	// 	iconUrl: coinIcons.IKA
	// },
	// {
	// 	coinType: '0x04deb377c33bfced1ab81cde96918e2538fe78735777150b0064ccf7df5e1c81::tato::TATO',
	// 	symbol: 'TATO',
	// 	name: 'TATO',
	// 	decimals: 9,
	// 	iconUrl: coinIcons.TATO
	// },
	// {
	// 	coinType: '0x8574383098c964bf0b95b16f3f4f6d7e94d35680264fb5210d4977a97b85aca7::pawtato_coin_crystal::PAWTATO_COIN_CRYSTAL',
	// 	symbol: 'CRYSTAL',
	// 	name: 'Pawtato Crystal',
	// 	decimals: 9,
	// 	iconUrl: coinIcons.CRYSTAL
	// }
];

/**
 * Checks if a coin type is SUI
 * @param coinType - Coin type to check
 * @returns True if the coin type is SUI
 */
export function isSuiCoinType(coinType: string): boolean {
	return coinType === DEFAULT_COIN_TYPE;
}
