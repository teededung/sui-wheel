/**
 * Type definitions for Wheel and related entities
 */

import type { CoinMetadata } from '$lib/utils/coinHelpers';

/**
 * Wheel object from database
 */
export interface Wheel {
	/** Unique identifier (UUID) */
	id: string;
	/** On-chain wheel object ID */
	wheel_id: string;
	/** Creation transaction digest */
	tx_digest: string;
	/** Move package ID */
	package_id: string;
	/** Wallet address that created the wheel */
	organizer_address: string;
	/** Array of prize amounts in smallest unit (e.g., MIST for SUI, smallest unit for other coins) */
	prizes: string[];
	/** Total donation amount in smallest unit */
	total_donation: string | null;
	/** Network identifier (mainnet, testnet, devnet) */
	network: string;
	/** Coin type for prizes (e.g., "0x2::sui::SUI") */
	coin_type: string;
	/** Timestamp when wheel was created */
	created_at: string;
	/** Optional cached coin metadata */
	coinMetadata?: CoinMetadata;
}

/**
 * Wheel entry from database
 */
export interface WheelEntry {
	/** Unique identifier */
	id: number;
	/** On-chain wheel object ID */
	wheel_id: string;
	/** Participant wallet address */
	entry_address: string;
	/** Entry position/index */
	entry_index: number;
	/** Timestamp when entry was created */
	created_at: string;
}

/**
 * Wheel winner from database
 */
export interface WheelWinner {
	/** On-chain wheel object ID */
	wheel_id: string;
	/** Winner wallet address */
	winner_address: string;
	/** Prize index/position */
	prize_index: number;
	/** Spin transaction digest */
	spin_tx_digest: string;
	/** Timestamp when prize was won */
	spin_time: string | null;
	/** Whether prize has been claimed */
	claimed: boolean;
	/** Claim transaction digest */
	claim_tx_digest: string | null;
	/** Timestamp when prize was claimed */
	claim_time: string | null;
}

/**
 * Wheel creation parameters
 */
export interface CreateWheelParams {
	/** Coin type for prizes */
	coinType: string;
	/** Array of participant addresses */
	entries: string[];
	/** Array of prize amounts in smallest unit */
	prizeAmounts: string[];
	/** Delay in milliseconds before wheel can be spun */
	delayMs: number;
	/** Time window in milliseconds for winners to claim prizes */
	claimWindowMs: number;
}

/**
 * Wheel with entries (joined data)
 */
export interface WheelWithEntries extends Wheel {
	/** Array of wheel entries */
	entries: WheelEntry[];
}

/**
 * Wheel with winners (joined data)
 */
export interface WheelWithWinners extends Wheel {
	/** Array of wheel winners */
	winners: WheelWinner[];
}

/**
 * Complete wheel data with all related information
 */
export interface WheelComplete extends Wheel {
	/** Array of wheel entries */
	entries: WheelEntry[];
	/** Array of wheel winners */
	winners: WheelWinner[];
	/** Cached coin metadata */
	coinMetadata: CoinMetadata;
}
