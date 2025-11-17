/**
 * Transaction Builders for Sui Wheel Contract
 * Handles building transactions with multi-coin support
 */

import { Transaction, type TransactionObjectArgument } from '@mysten/sui/transactions';
import {
	LATEST_PACKAGE_ID,
	VERSION_OBJECT_ID,
	WHEEL_MODULE,
	WHEEL_FUNCTIONS,
	CLOCK_OBJECT_ID,
	RANDOM_OBJECT_ID,
	DEFAULT_COIN_TYPE
} from '$lib/constants';
import { isValidCoinType } from './coinHelpers';
import { createTestnetCoinService } from '$lib/services/coinService';

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
 * Builds a transaction to create a new wheel and fund it with prizes
 * @param tx - Transaction to add operations to
 * @param coinType - The coin type to use for prizes (e.g., "0x2::sui::SUI")
 * @param entries - Array of participant addresses
 * @param prizeAmounts - Array of prize amounts in smallest unit (e.g., MIST for SUI)
 * @param delayMs - Delay in milliseconds before wheel can be spun
 * @param claimWindowMs - Time window in milliseconds for winners to claim prizes
 * @param donationCoin - Pre-prepared coin object for funding the wheel
 * @returns Transaction object ready to be signed and executed
 * @throws Error if coin type is invalid
 * @example
 * const tx = new Transaction();
 * const coin = await prepareDonationCoin(tx, "0x2::sui::SUI", totalAmount, walletAddress);
 * buildCreateWheelAndFundTx(
 *   tx,
 *   "0x2::sui::SUI",
 *   ["0x123...", "0x456..."],
 *   [1000000000n, 500000000n],
 *   0n,
 *   86400000n,
 *   coin
 * );
 */
export function buildCreateWheelAndFundTx(
	tx: Transaction,
	coinType: string,
	entries: string[],
	prizeAmounts: bigint[],
	delayMs: bigint,
	claimWindowMs: bigint,
	donationCoin: TransactionObjectArgument
): void {
	validateCoinTypeForTransaction(coinType);

	// Call create_wheel and capture the returned Wheel
	const wheel = tx.moveCall({
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

	// Call donate_to_pool (mutates wheel, doesn't return anything)
	tx.moveCall({
		target: `${LATEST_PACKAGE_ID}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.DONATE}`,
		typeArguments: [coinType],
		arguments: [wheel, donationCoin]
	});

	// Share the wheel object using the contract's share_wheel function
	tx.moveCall({
		target: `${LATEST_PACKAGE_ID}::${WHEEL_MODULE}::share_wheel`,
		typeArguments: [coinType],
		arguments: [wheel]
	});
}

/**
 * Builds a transaction to donate coins to a wheel's prize pool
 * @param tx - Transaction to add operations to
 * @param coinType - The coin type of the wheel
 * @param wheelId - The object ID of the wheel
 * @param donationCoin - Pre-prepared coin object to donate
 * @throws Error if coin type is invalid
 * @example
 * const tx = new Transaction();
 * const coin = await prepareDonationCoin(tx, "0x2::sui::SUI", amount, walletAddress);
 * buildDonateToPoolTx(tx, "0x2::sui::SUI", "0xwheel123...", coin);
 */
export function buildDonateToPoolTx(
	tx: Transaction,
	coinType: string,
	wheelId: string,
	donationCoin: TransactionObjectArgument
): void {
	validateCoinTypeForTransaction(coinType);

	tx.moveCall({
		target: `${LATEST_PACKAGE_ID}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.DONATE}`,
		typeArguments: [coinType],
		arguments: [tx.object(wheelId), donationCoin]
	});
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
 * @param tx - Transaction to add operations to
 * @param coinType - The coin type of the wheel
 * @param wheelId - The object ID of the wheel
 * @param recipientAddress - Address to receive the claimed prize
 * @throws Error if coin type is invalid
 * @example
 * const tx = new Transaction();
 * buildClaimPrizeTx(tx, "0x2::sui::SUI", "0xwheel123...", "0xrecipient...");
 */
export function buildClaimPrizeTx(
	tx: Transaction,
	coinType: string,
	wheelId: string,
	recipientAddress: string
): void {
	validateCoinTypeForTransaction(coinType);

	// Call claim to get a Coin back in the PTB
	const claimedCoin = tx.moveCall({
		target: `${LATEST_PACKAGE_ID}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.CLAIM}`,
		typeArguments: [coinType],
		arguments: [tx.object(wheelId), tx.object(CLOCK_OBJECT_ID), tx.object(VERSION_OBJECT_ID)]
	});

	// Transfer the returned coin to the recipient's address
	tx.transferObjects([claimedCoin], tx.pure.address(recipientAddress));
}

/**
 * Builds a transaction to reclaim the prize pool after the claim window
 * @param tx - Transaction to add operations to
 * @param coinType - The coin type of the wheel
 * @param wheelId - The object ID of the wheel
 * @param recipientAddress - Address to receive the reclaimed funds (organizer)
 * @throws Error if coin type is invalid
 * @example
 * const tx = new Transaction();
 * buildReclaimPoolTx(tx, "0x2::sui::SUI", "0xwheel123...", "0xorganizer...");
 */
export function buildReclaimPoolTx(
	tx: Transaction,
	coinType: string,
	wheelId: string,
	recipientAddress: string
): void {
	validateCoinTypeForTransaction(coinType);

	// Call reclaim_pool to get Coin and transfer to organizer (sender)
	const coin = tx.moveCall({
		target: `${LATEST_PACKAGE_ID}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.RECLAIM}`,
		typeArguments: [coinType],
		arguments: [tx.object(wheelId), tx.object(CLOCK_OBJECT_ID), tx.object(VERSION_OBJECT_ID)]
	});

	tx.transferObjects([coin], tx.pure.address(recipientAddress));
}

/**
 * Builds a transaction to cancel the wheel and reclaim the pool
 * @param tx - Transaction to add operations to
 * @param coinType - The coin type of the wheel
 * @param wheelId - The object ID of the wheel
 * @param recipientAddress - Address to receive the reclaimed funds (organizer)
 * @throws Error if coin type is invalid
 * @example
 * const tx = new Transaction();
 * buildCancelWheelTx(tx, "0x2::sui::SUI", "0xwheel123...", "0xorganizer...");
 */
export function buildCancelWheelTx(
	tx: Transaction,
	coinType: string,
	wheelId: string,
	recipientAddress: string
): void {
	validateCoinTypeForTransaction(coinType);

	// Get mutable ref to Wheel
	const wheelRef = tx.object(wheelId);

	// Call cancel_wheel_and_reclaim_pool and capture the optional Coin
	const optCoin = tx.moveCall({
		target: `${LATEST_PACKAGE_ID}::${WHEEL_MODULE}::cancel_wheel_and_reclaim_pool`,
		typeArguments: [coinType],
		arguments: [wheelRef, tx.object(VERSION_OBJECT_ID)]
	});

	// Handle the optional reclaim by transferring to sender if present
	tx.moveCall({
		target: `${LATEST_PACKAGE_ID}::${WHEEL_MODULE}::transfer_optional_reclaim`,
		typeArguments: [coinType],
		arguments: [optCoin, tx.pure.address(recipientAddress)]
	});
}

/**
 * Prepares a coin for donation by splitting from gas (SUI) or selecting from wallet (other coins)
 * @param tx - Transaction to add operations to
 * @param coinType - The coin type
 * @param amount - Amount in smallest unit
 * @param walletAddress - Wallet address for coin selection
 * @returns TransactionObjectArgument representing the prepared coin
 * @throws Error if insufficient balance or coin selection fails
 * @example
 * const tx = new Transaction();
 * const coin = await prepareDonationCoin(tx, "0x2::sui::SUI", 1000000000n, "0xwallet...");
 */
export async function prepareDonationCoin(
	tx: Transaction,
	coinType: string,
	amount: bigint,
	walletAddress: string
): Promise<TransactionObjectArgument> {
	validateCoinTypeForTransaction(coinType);

	if (amount <= 0n) {
		throw new Error('Amount must be greater than 0');
	}

	// For SUI, split from gas
	if (coinType === DEFAULT_COIN_TYPE) {
		const [coin] = tx.splitCoins(tx.gas, [amount]);
		return coin;
	}

	// For other coins, get from user's wallet
	const coinService = createTestnetCoinService();
	const coins = await coinService.selectCoins(walletAddress, coinType, amount);

	if (coins.length === 0) {
		throw new Error(`Insufficient balance for coin type: ${coinType}`);
	}

	// Merge all coins into one if multiple
	if (coins.length > 1) {
		tx.mergeCoins(
			tx.object(coins[0].coinObjectId),
			coins.slice(1).map((c) => tx.object(c.coinObjectId))
		);
	}

	// Split the exact amount needed
	const [coin] = tx.splitCoins(tx.object(coins[0].coinObjectId), [amount]);
	return coin;
}
