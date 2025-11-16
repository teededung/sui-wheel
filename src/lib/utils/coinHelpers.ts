/**
 * Coin utility functions for multi-coin support
 * Handles coin type parsing, amount formatting, and validation
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Represents a parsed coin type with its components
 */
export interface CoinType {
	/** Full type identifier (e.g., "0x2::sui::SUI") */
	type: string;
	/** Package ID extracted from type */
	packageId: string;
	/** Module name (e.g., "sui") */
	module: string;
	/** Struct name (e.g., "SUI") */
	struct: string;
}

/**
 * Metadata for a coin type from the blockchain
 */
export interface CoinMetadata {
	/** Coin type identifier */
	coinType: string;
	/** Decimal places for the coin */
	decimals: number;
	/** Display name (e.g., "Sui") */
	name: string;
	/** Symbol (e.g., "SUI") */
	symbol: string;
	/** Description of the coin */
	description: string;
	/** Icon URL (if available) */
	iconUrl: string | null;
	/** Object ID of the CoinMetadata on-chain */
	id: string;
}

/**
 * Balance information for a specific coin type
 */
export interface CoinBalance {
	/** Coin type identifier */
	coinType: string;
	/** Total balance in smallest unit */
	totalBalance: string;
	/** Number of coin objects */
	coinObjectCount: number;
	/** Formatted balance for display */
	formattedBalance: string;
}

/**
 * Error types for coin operations
 */
export enum CoinErrorType {
	METADATA_NOT_FOUND = 'METADATA_NOT_FOUND',
	INVALID_COIN_TYPE = 'INVALID_COIN_TYPE',
	INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
	NETWORK_ERROR = 'NETWORK_ERROR',
	TYPE_MISMATCH = 'TYPE_MISMATCH',
	PARSE_ERROR = 'PARSE_ERROR'
}

/**
 * Custom error class for coin operations
 */
export class CoinError extends Error {
	constructor(
		public type: CoinErrorType,
		message: string,
		public coinType?: string
	) {
		super(message);
		this.name = 'CoinError';
	}
}

// ============================================================================
// Constants
// ============================================================================

/** Default coin type (SUI) */
export const DEFAULT_COIN_TYPE = '0x2::sui::SUI';

/** Regex pattern for validating coin type format */
export const COIN_TYPE_REGEX = /^0x[a-fA-F0-9]+::[a-zA-Z_][a-zA-Z0-9_]*::[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Cache TTL for coin metadata (1 hour) */
export const COIN_METADATA_CACHE_TTL = 1000 * 60 * 60;

// ============================================================================
// Coin Type Parsing
// ============================================================================

/**
 * Parses a coin type string into its components
 * @param coinType - Full coin type string (e.g., "0x2::sui::SUI")
 * @returns Parsed CoinType object
 * @throws CoinError if the coin type format is invalid
 * @example
 * parseCoinType("0x2::sui::SUI")
 * // returns { type: "0x2::sui::SUI", packageId: "0x2", module: "sui", struct: "SUI" }
 */
export function parseCoinType(coinType: string): CoinType {
	if (!coinType || typeof coinType !== 'string') {
		throw new CoinError(
			CoinErrorType.INVALID_COIN_TYPE,
			'Coin type must be a non-empty string',
			coinType
		);
	}

	const trimmed = coinType.trim();

	if (!COIN_TYPE_REGEX.test(trimmed)) {
		throw new CoinError(
			CoinErrorType.INVALID_COIN_TYPE,
			`Invalid coin type format: ${trimmed}. Expected format: 0x{package}::{module}::{struct}`,
			trimmed
		);
	}

	const parts = trimmed.split('::');

	if (parts.length !== 3) {
		throw new CoinError(
			CoinErrorType.INVALID_COIN_TYPE,
			`Invalid coin type format: ${trimmed}. Must have exactly 3 parts separated by ::`,
			trimmed
		);
	}

	return {
		type: trimmed,
		packageId: parts[0],
		module: parts[1],
		struct: parts[2]
	};
}

/**
 * Validates if a string is a valid coin type format
 * @param coinType - Coin type string to validate
 * @returns True if valid, false otherwise
 * @example
 * isValidCoinType("0x2::sui::SUI") // returns true
 * isValidCoinType("invalid") // returns false
 */
export function isValidCoinType(coinType: string): boolean {
	try {
		parseCoinType(coinType);
		return true;
	} catch {
		return false;
	}
}

// ============================================================================
// Amount Formatting
// ============================================================================

/**
 * Formats a coin amount from smallest unit to display format
 * @param amount - Amount in smallest unit (as string or bigint)
 * @param decimals - Number of decimal places for the coin
 * @param options - Formatting options
 * @returns Formatted amount string
 * @example
 * formatCoinAmount("1500000000", 9) // returns "1.500000000"
 * formatCoinAmount("1500000000", 9, { compact: true }) // returns "1.5"
 * formatCoinAmount("1500000", 6) // returns "1.500000"
 */
export function formatCoinAmount(
	amount: string | bigint | number,
	decimals: number,
	options: {
		compact?: boolean;
		maxDecimals?: number;
		minDecimals?: number;
	} = {}
): string {
	try {
		const { compact = false, maxDecimals, minDecimals = 0 } = options;

		// Convert to number for calculation
		const amountNum = typeof amount === 'bigint' ? Number(amount) : Number(amount);

		if (!Number.isFinite(amountNum) || amountNum < 0) {
			return '0';
		}

		// Calculate the display value
		const divisor = Math.pow(10, decimals);
		const displayValue = amountNum / divisor;

		// Determine decimal places to show
		let decimalPlaces = decimals;
		if (maxDecimals !== undefined) {
			decimalPlaces = Math.min(decimalPlaces, maxDecimals);
		}

		// Format the number
		let formatted = displayValue.toFixed(decimalPlaces);

		// Compact mode: remove trailing zeros
		if (compact) {
			formatted = formatted.replace(/\.?0+$/, '');
			// Ensure minimum decimals
			if (minDecimals > 0) {
				const currentDecimals = (formatted.split('.')[1] || '').length;
				if (currentDecimals < minDecimals) {
					const zerosNeeded = minDecimals - currentDecimals;
					if (!formatted.includes('.')) {
						formatted += '.';
					}
					formatted += '0'.repeat(zerosNeeded);
				}
			}
		}

		return formatted;
	} catch (error) {
		console.error('Error formatting coin amount:', error);
		return '0';
	}
}

/**
 * Formats a coin amount with locale-specific formatting
 * @param amount - Amount in smallest unit
 * @param decimals - Number of decimal places
 * @param locale - Locale string (default: 'en-US')
 * @returns Formatted amount with thousand separators
 * @example
 * formatCoinAmountLocale("1500000000", 9) // returns "1.5"
 * formatCoinAmountLocale("1234567890000", 9) // returns "1,234.567890"
 */
export function formatCoinAmountLocale(
	amount: string | bigint | number,
	decimals: number,
	locale: string = 'en-US'
): string {
	try {
		const amountNum = typeof amount === 'bigint' ? Number(amount) : Number(amount);
		const divisor = Math.pow(10, decimals);
		const displayValue = amountNum / divisor;

		return displayValue.toLocaleString(locale, {
			minimumFractionDigits: 0,
			maximumFractionDigits: Math.min(decimals, 9)
		});
	} catch {
		return '0';
	}
}

// ============================================================================
// Amount Parsing
// ============================================================================

/**
 * Parses a display amount to smallest unit
 * @param input - Display amount as string (supports comma/dot separators)
 * @param decimals - Number of decimal places for the coin
 * @returns Amount in smallest unit as bigint
 * @throws CoinError if parsing fails
 * @example
 * parseAmountToSmallestUnit("1.5", 9) // returns 1500000000n
 * parseAmountToSmallestUnit("1,5", 6) // returns 1500000n (comma separator)
 * parseAmountToSmallestUnit("2", 9) // returns 2000000000n
 */
export function parseAmountToSmallestUnit(
	input: string | number | null | undefined,
	decimals: number
): bigint {
	try {
		// Normalize input
		let str = String(input ?? '').trim();

		// Replace comma with dot for decimal separator
		str = str.replace(/,/g, '.').replace(/\s+/g, '');

		if (!str || str === '0') return 0n;

		// Validate format
		if (!/^[0-9]*\.?[0-9]*$/.test(str)) {
			throw new CoinError(
				CoinErrorType.PARSE_ERROR,
				`Invalid amount format: ${str}. Only numbers and decimal point allowed.`
			);
		}

		// Split into integer and fractional parts
		const [intPart = '0', fracPart = ''] = str.split('.');

		// Pad or truncate fractional part to match decimals
		const paddedFrac = (fracPart + '0'.repeat(decimals)).slice(0, decimals);

		// Calculate smallest unit
		const multiplier = BigInt(Math.pow(10, decimals));
		const result = BigInt(intPart) * multiplier + BigInt(paddedFrac || '0');

		return result < 0n ? 0n : result;
	} catch (error) {
		if (error instanceof CoinError) {
			throw error;
		}
		throw new CoinError(
			CoinErrorType.PARSE_ERROR,
			`Failed to parse amount: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Validates if an amount string is valid for parsing
 * @param input - Amount string to validate
 * @returns True if valid, false otherwise
 * @example
 * isValidAmount("1.5") // returns true
 * isValidAmount("1,5") // returns true
 * isValidAmount("abc") // returns false
 */
export function isValidAmount(input: string): boolean {
	try {
		const normalized = input.trim().replace(/,/g, '.').replace(/\s+/g, '');
		return /^[0-9]*\.?[0-9]*$/.test(normalized) && normalized !== '';
	} catch {
		return false;
	}
}

// ============================================================================
// Coin Type Helpers
// ============================================================================

/**
 * Gets the coin type for a wheel, defaulting to SUI if not specified
 * @param wheel - Wheel object that may have a coinType property
 * @returns Coin type string
 * @example
 * getWheelCoinType({ coinType: "0x2::sui::SUI" }) // returns "0x2::sui::SUI"
 * getWheelCoinType({}) // returns "0x2::sui::SUI" (default)
 */
export function getWheelCoinType(wheel: { coinType?: string }): string {
	return wheel.coinType || DEFAULT_COIN_TYPE;
}

/**
 * Checks if a coin type is the default SUI type
 * @param coinType - Coin type to check
 * @returns True if it's SUI, false otherwise
 * @example
 * isSuiCoinType("0x2::sui::SUI") // returns true
 * isSuiCoinType("0x123::usdc::USDC") // returns false
 */
export function isSuiCoinType(coinType: string): boolean {
	return coinType === DEFAULT_COIN_TYPE;
}

/**
 * Extracts a short display name from coin type
 * @param coinType - Full coin type string
 * @returns Short name (struct name)
 * @example
 * getCoinShortName("0x2::sui::SUI") // returns "SUI"
 * getCoinShortName("0x123::usdc::USDC") // returns "USDC"
 */
export function getCoinShortName(coinType: string): string {
	try {
		const parsed = parseCoinType(coinType);
		return parsed.struct;
	} catch {
		return 'Unknown';
	}
}

// ============================================================================
// Comparison and Validation
// ============================================================================

/**
 * Compares two coin amounts
 * @param amount1 - First amount in smallest unit
 * @param amount2 - Second amount in smallest unit
 * @returns -1 if amount1 < amount2, 0 if equal, 1 if amount1 > amount2
 */
export function compareCoinAmounts(
	amount1: string | bigint,
	amount2: string | bigint
): number {
	const a1 = typeof amount1 === 'string' ? BigInt(amount1) : amount1;
	const a2 = typeof amount2 === 'string' ? BigInt(amount2) : amount2;

	if (a1 < a2) return -1;
	if (a1 > a2) return 1;
	return 0;
}

/**
 * Checks if an amount is sufficient for a required amount
 * @param available - Available amount in smallest unit
 * @param required - Required amount in smallest unit
 * @returns True if available >= required
 */
export function hasSufficientBalance(
	available: string | bigint,
	required: string | bigint
): boolean {
	return compareCoinAmounts(available, required) >= 0;
}
