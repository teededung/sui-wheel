/**
 * Transaction Builders for Sui Wheel Contract
 * Handles building transactions with multi-coin support
 */

import { Transaction } from '@mysten/sui/transactions';
import {
	LATEST_PACKAGE_ID,
	VERSION_OBJECT_ID,
	WHEEL_MODULE,
	WHEEL_FUNCTIONS,
	CLOCK_OBJECT_ID,
	RANDOM_OBJECT_ID
} from '$lib/constants';
import { isValidCoinType } from './coinHelpers';

/**
 * Validates coin type before building transaction
 * @throws Error if coin type is invalid
 */
function validateCoinTypeForTransaction(coinType: string): void {
	if (!isValidCoinType(coinType)) {
		throw new Error(`Invalid coin type format: ${coinType}`);
	}
}

/**
 * Builds a transaction to create a new wheel
 * @param coinType - The coin type to use for prizes (e.g., "0x2::sui::SUI")
 * @param entries - Array of participant addresses
 * @param prizeAmounts - Array of prize amounts in smallest unit (e.g., MIST for SUI)
 * @param delayMs - Delay in milliseconds before wheel can be spun
 * @param claimWindowMs - Time window in milliseconds for winners to claim prizes
 * @returns Transaction object ready to be signed and executed
 * @throws Error if coin type is invalid
 * @example
 * const tx = buildCreateWheelTransaction(
 *   "0x2::sui::SUI",
 *   ["0x123...", "0x456..."],
 *   ["1000000000", "500000000"],
 *   0,
 *   86400000
 * );
 */
export function buildCreateWheelTransaction(
	coinType: string,
	entries: string[],
	prizeAmounts: string[],
	delayMs: number,
	claimWindowMs: number
): Transaction {
	validateCoinTypeForTransaction(coinType);

	const tx = new Transaction();

	tx.moveCall({
		target: `${LATEST_PACKAGE_ID}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.CREATE}`,
		typeArguments: [coinType],
		arguments: [
			tx.pure.vector('address', entries),
			tx.pure.vector('u64', prizeAmounts),
			tx.pure.u64(delayMs),
			tx.pure.u64(claimWindowMs),
			tx.object(VERSION_OBJECT_ID)
		]
	});

	return tx;
}

/**
 * Builds a transaction to donate coins to a wheel's prize pool
 * @param coinType - The coin type of the wheel
 * @param wheelId - The object ID of the wheel
 * @param coinObjectId - The object ID of the coin to donate
 * @returns Transaction object ready to be signed and executed
 * @throws Error if coin type is invalid
 * @example
 * const tx = buildDonateToPoolTransaction(
 *   "0x2::sui::SUI",
 *   "0xwheel123...",
 *   "0xcoin456..."
 * );
 */
export function buildDonateToPoolTransaction(
	coinType: string,
	wheelId: string,
	coinObjectId: string
): Transaction {
	validateCoinTypeForTransaction(coinType);

	const tx = new Transaction();

	tx.moveCall({
		target: `${LATEST_PACKAGE_ID}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.DONATE}`,
		typeArguments: [coinType],
		arguments: [tx.object(wheelId), tx.object(coinObjectId)]
	});

	return tx;
}

/**
 * Builds a transaction to spin the wheel
 * @param coinType - The coin type of the wheel
 * @param wheelId - The object ID of the wheel
 * @returns Transaction object ready to be signed and executed
 * @throws Error if coin type is invalid
 * @example
 * const tx = buildSpinWheelTransaction("0x2::sui::SUI", "0xwheel123...");
 */
export function buildSpinWheelTransaction(coinType: string, wheelId: string): Transaction {
	validateCoinTypeForTransaction(coinType);

	const tx = new Transaction();

	tx.moveCall({
		target: `${LATEST_PACKAGE_ID}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.SPIN}`,
		typeArguments: [coinType],
		arguments: [
			tx.object(wheelId),
			tx.object(RANDOM_OBJECT_ID),
			tx.object(CLOCK_OBJECT_ID),
			tx.object(VERSION_OBJECT_ID)
		]
	});

	return tx;
}

/**
 * Builds a transaction to spin the wheel with a specific entry order
 * @param coinType - The coin type of the wheel
 * @param wheelId - The object ID of the wheel
 * @param entryOrder - Array of indices specifying the order of entries
 * @returns Transaction object ready to be signed and executed
 * @throws Error if coin type is invalid
 * @example
 * const tx = buildSpinWheelWithOrderTransaction(
 *   "0x2::sui::SUI",
 *   "0xwheel123...",
 *   [0, 2, 1, 3]
 * );
 */
export function buildSpinWheelWithOrderTransaction(
	coinType: string,
	wheelId: string,
	entryOrder: number[]
): Transaction {
	validateCoinTypeForTransaction(coinType);

	const tx = new Transaction();

	tx.moveCall({
		target: `${LATEST_PACKAGE_ID}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.SPIN_WITH_ORDER}`,
		typeArguments: [coinType],
		arguments: [
			tx.object(wheelId),
			tx.pure.vector('u64', entryOrder),
			tx.object(RANDOM_OBJECT_ID),
			tx.object(CLOCK_OBJECT_ID),
			tx.object(VERSION_OBJECT_ID)
		]
	});

	return tx;
}

/**
 * Builds a transaction to spin the wheel and assign the last prize
 * @param coinType - The coin type of the wheel
 * @param wheelId - The object ID of the wheel
 * @returns Transaction object ready to be signed and executed
 * @throws Error if coin type is invalid
 * @example
 * const tx = buildSpinWheelAndAssignLastPrizeTransaction(
 *   "0x2::sui::SUI",
 *   "0xwheel123..."
 * );
 */
export function buildSpinWheelAndAssignLastPrizeTransaction(
	coinType: string,
	wheelId: string
): Transaction {
	validateCoinTypeForTransaction(coinType);

	const tx = new Transaction();

	tx.moveCall({
		target: `${LATEST_PACKAGE_ID}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.SPIN_AND_ASSIGN_LAST}`,
		typeArguments: [coinType],
		arguments: [
			tx.object(wheelId),
			tx.object(RANDOM_OBJECT_ID),
			tx.object(CLOCK_OBJECT_ID),
			tx.object(VERSION_OBJECT_ID)
		]
	});

	return tx;
}

/**
 * Builds a transaction to spin the wheel with order and assign the last prize
 * @param coinType - The coin type of the wheel
 * @param wheelId - The object ID of the wheel
 * @param entryOrder - Array of indices specifying the order of entries
 * @returns Transaction object ready to be signed and executed
 * @throws Error if coin type is invalid
 * @example
 * const tx = buildSpinWheelAndAssignLastPrizeWithOrderTransaction(
 *   "0x2::sui::SUI",
 *   "0xwheel123...",
 *   [0, 2, 1, 3]
 * );
 */
export function buildSpinWheelAndAssignLastPrizeWithOrderTransaction(
	coinType: string,
	wheelId: string,
	entryOrder: number[]
): Transaction {
	validateCoinTypeForTransaction(coinType);

	const tx = new Transaction();

	tx.moveCall({
		target: `${LATEST_PACKAGE_ID}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.SPIN_AND_ASSIGN_LAST_WITH_ORDER}`,
		typeArguments: [coinType],
		arguments: [
			tx.object(wheelId),
			tx.pure.vector('u64', entryOrder),
			tx.object(RANDOM_OBJECT_ID),
			tx.object(CLOCK_OBJECT_ID),
			tx.object(VERSION_OBJECT_ID)
		]
	});

	return tx;
}

/**
 * Builds a transaction to claim a prize from the wheel
 * @param coinType - The coin type of the wheel
 * @param wheelId - The object ID of the wheel
 * @returns Transaction object ready to be signed and executed
 * @throws Error if coin type is invalid
 * @example
 * const tx = buildClaimPrizeTransaction("0x2::sui::SUI", "0xwheel123...");
 */
export function buildClaimPrizeTransaction(coinType: string, wheelId: string): Transaction {
	validateCoinTypeForTransaction(coinType);

	const tx = new Transaction();

	tx.moveCall({
		target: `${LATEST_PACKAGE_ID}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.CLAIM}`,
		typeArguments: [coinType],
		arguments: [tx.object(wheelId), tx.object(CLOCK_OBJECT_ID), tx.object(VERSION_OBJECT_ID)]
	});

	return tx;
}

/**
 * Builds a transaction to reclaim the prize pool after the claim window
 * @param coinType - The coin type of the wheel
 * @param wheelId - The object ID of the wheel
 * @returns Transaction object ready to be signed and executed
 * @throws Error if coin type is invalid
 * @example
 * const tx = buildReclaimPoolTransaction("0x2::sui::SUI", "0xwheel123...");
 */
export function buildReclaimPoolTransaction(coinType: string, wheelId: string): Transaction {
	validateCoinTypeForTransaction(coinType);

	const tx = new Transaction();

	tx.moveCall({
		target: `${LATEST_PACKAGE_ID}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.RECLAIM}`,
		typeArguments: [coinType],
		arguments: [tx.object(wheelId), tx.object(CLOCK_OBJECT_ID), tx.object(VERSION_OBJECT_ID)]
	});

	return tx;
}

/**
 * Builds a transaction to cancel the wheel and reclaim the pool
 * @param coinType - The coin type of the wheel
 * @param wheelId - The object ID of the wheel
 * @returns Transaction object ready to be signed and executed
 * @throws Error if coin type is invalid
 * @example
 * const tx = buildCancelWheelAndReclaimPoolTransaction(
 *   "0x2::sui::SUI",
 *   "0xwheel123..."
 * );
 */
export function buildCancelWheelAndReclaimPoolTransaction(
	coinType: string,
	wheelId: string
): Transaction {
	validateCoinTypeForTransaction(coinType);

	const tx = new Transaction();

	tx.moveCall({
		target: `${LATEST_PACKAGE_ID}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.CANCEL}`,
		typeArguments: [coinType],
		arguments: [tx.object(wheelId), tx.object(VERSION_OBJECT_ID)]
	});

	return tx;
}
