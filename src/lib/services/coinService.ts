/**
 * CoinService - Centralized service for coin-related operations
 * Handles metadata fetching, balance queries, and coin type management
 */

import { SuiClient } from '@mysten/sui/client';
import type {
	CoinType,
	CoinMetadata,
	CoinBalance
} from '$lib/utils/coinHelpers';
import {
	parseCoinType,
	formatCoinAmount,
	parseAmountToSmallestUnit,
	isValidCoinType,
	CoinError,
	CoinErrorType,
	DEFAULT_COIN_TYPE
} from '$lib/utils/coinHelpers';

/**
 * Configuration for CoinService
 */
export interface CoinServiceConfig {
	/** Sui RPC endpoint URL */
	rpcUrl: string;
	/** Network identifier (mainnet, testnet, devnet) */
	network?: string;
}

/**
 * CoinService class for managing coin operations
 */
export class CoinService {
	private client: SuiClient;
	private network: string;

	constructor(config: CoinServiceConfig) {
		this.client = new SuiClient({ url: config.rpcUrl });
		this.network = config.network || 'testnet';
	}

	// ========================================================================
	// Metadata Operations
	// ========================================================================

	/**
	 * Fetches coin metadata from the blockchain
	 * @param coinType - Full coin type string
	 * @returns CoinMetadata object
	 * @throws CoinError if metadata not found or network error
	 */
	async getCoinMetadata(coinType: string): Promise<CoinMetadata> {
		try {
			// Validate coin type format
			if (!isValidCoinType(coinType)) {
				throw new CoinError(
					CoinErrorType.INVALID_COIN_TYPE,
					`Invalid coin type format: ${coinType}`,
					coinType
				);
			}

			// Fetch metadata from blockchain
			const metadata = await this.client.getCoinMetadata({ coinType });

			if (!metadata) {
				// Shorten coin type for error message
				const shortCoinType = coinType.length > 30 
					? `${coinType.slice(0, 15)}...${coinType.slice(-12)}`
					: coinType;
				throw new CoinError(
					CoinErrorType.METADATA_NOT_FOUND,
					`Metadata not found for coin type: ${shortCoinType}`,
					coinType
				);
			}

			return {
				coinType,
				decimals: metadata.decimals,
				name: metadata.name,
				symbol: metadata.symbol,
				description: metadata.description || '',
				iconUrl: metadata.iconUrl || null,
				id: metadata.id || ''
			};
		} catch (error) {
			if (error instanceof CoinError) {
				throw error;
			}

			// Network or other errors
			throw new CoinError(
				CoinErrorType.NETWORK_ERROR,
				`Failed to fetch metadata for ${coinType}: ${error instanceof Error ? error.message : String(error)}`,
				coinType
			);
		}
	}

	/**
	 * Fetches metadata for multiple coin types in parallel
	 * @param coinTypes - Array of coin type strings
	 * @returns Map of coinType to CoinMetadata
	 */
	async getBatchCoinMetadata(coinTypes: string[]): Promise<Map<string, CoinMetadata>> {
		const results = new Map<string, CoinMetadata>();

		// Fetch all metadata in parallel
		const promises = coinTypes.map(async (coinType) => {
			try {
				const metadata = await this.getCoinMetadata(coinType);
				results.set(coinType, metadata);
			} catch (error) {
				console.error(`Failed to fetch metadata for ${coinType}:`, error);
				// Continue with other coins even if one fails
			}
		});

		await Promise.all(promises);
		return results;
	}

	// ========================================================================
	// Balance Operations
	// ========================================================================

	/**
	 * Fetches coin balance for a specific address and coin type
	 * @param address - Wallet address
	 * @param coinType - Coin type to query
	 * @returns CoinBalance object
	 * @throws CoinError if balance query fails
	 */
	async getCoinBalance(address: string, coinType: string): Promise<CoinBalance> {
		try {
			// Validate coin type
			if (!isValidCoinType(coinType)) {
				throw new CoinError(
					CoinErrorType.INVALID_COIN_TYPE,
					`Invalid coin type format: ${coinType}`,
					coinType
				);
			}

			// Fetch balance from blockchain
			const balance = await this.client.getBalance({
				owner: address,
				coinType
			});

			// Get metadata for formatting
			const metadata = await this.getCoinMetadata(coinType);

			// Format balance for display
			const formattedBalance = formatCoinAmount(
				balance.totalBalance,
				metadata.decimals,
				{ compact: true, maxDecimals: 6 }
			);

			return {
				coinType,
				totalBalance: balance.totalBalance,
				coinObjectCount: balance.coinObjectCount,
				formattedBalance
			};
		} catch (error) {
			if (error instanceof CoinError) {
				throw error;
			}

			throw new CoinError(
				CoinErrorType.NETWORK_ERROR,
				`Failed to fetch balance for ${coinType}: ${error instanceof Error ? error.message : String(error)}`,
				coinType
			);
		}
	}

	/**
	 * Fetches all coin balances for an address
	 * @param address - Wallet address
	 * @returns Array of CoinBalance objects
	 */
	async getAllCoinBalances(address: string): Promise<CoinBalance[]> {
		try {
			// Get all coins owned by the address
			const allBalances = await this.client.getAllBalances({ owner: address });

			// Fetch metadata for each coin type and format balances
			const balances = await Promise.all(
				allBalances.map(async (balance) => {
					try {
						const metadata = await this.getCoinMetadata(balance.coinType);
						const formattedBalance = formatCoinAmount(
							balance.totalBalance,
							metadata.decimals,
							{ compact: true, maxDecimals: 6 }
						);

						return {
							coinType: balance.coinType,
							totalBalance: balance.totalBalance,
							coinObjectCount: balance.coinObjectCount,
							formattedBalance
						};
					} catch (error) {
						console.error(`Failed to process balance for ${balance.coinType}:`, error);
						// Return balance with minimal info if metadata fetch fails
						return {
							coinType: balance.coinType,
							totalBalance: balance.totalBalance,
							coinObjectCount: balance.coinObjectCount,
							formattedBalance: balance.totalBalance
						};
					}
				})
			);

			// Filter out coins with zero balance
			return balances.filter((b) => BigInt(b.totalBalance) > 0n);
		} catch (error) {
			throw new CoinError(
				CoinErrorType.NETWORK_ERROR,
				`Failed to fetch all balances: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	// ========================================================================
	// Wallet Coin Discovery
	// ========================================================================

	/**
	 * Fetches all available coin types from a wallet
	 * @param address - Wallet address
	 * @returns Array of CoinType objects
	 */
	async getWalletCoins(address: string): Promise<CoinType[]> {
		try {
			const balances = await this.getAllCoinBalances(address);

			// Parse each coin type
			const coinTypes = balances.map((balance) => {
				try {
					return parseCoinType(balance.coinType);
				} catch (error) {
					console.error(`Failed to parse coin type ${balance.coinType}:`, error);
					return null;
				}
			});

			// Filter out null values and return
			return coinTypes.filter((ct): ct is CoinType => ct !== null);
		} catch (error) {
			throw new CoinError(
				CoinErrorType.NETWORK_ERROR,
				`Failed to fetch wallet coins: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	// ========================================================================
	// Coin Selection for Transactions
	// ========================================================================

	/**
	 * Selects coin objects to cover a specific amount
	 * @param address - Wallet address
	 * @param coinType - Coin type to select
	 * @param amount - Amount needed in smallest unit
	 * @returns Array of coin objects with sufficient balance
	 * @throws CoinError if insufficient balance
	 */
	async selectCoins(
		address: string,
		coinType: string,
		amount: bigint
	): Promise<Array<{ coinObjectId: string; balance: bigint }>> {
		try {
			// Validate coin type
			if (!isValidCoinType(coinType)) {
				throw new CoinError(
					CoinErrorType.INVALID_COIN_TYPE,
					`Invalid coin type format: ${coinType}`,
					coinType
				);
			}

			// Get all coins of this type
			const coins = await this.client.getCoins({
				owner: address,
				coinType
			});

			if (!coins.data || coins.data.length === 0) {
				throw new CoinError(
					CoinErrorType.INSUFFICIENT_BALANCE,
					`No coins found for type: ${coinType}`,
					coinType
				);
			}

			// Sort coins by balance (largest first) for efficiency
			const sortedCoins = coins.data
				.map((coin) => ({
					coinObjectId: coin.coinObjectId,
					balance: BigInt(coin.balance)
				}))
				.sort((a, b) => (a.balance > b.balance ? -1 : 1));

			// Select coins until we have enough
			const selectedCoins: Array<{ coinObjectId: string; balance: bigint }> = [];
			let totalSelected = 0n;

			for (const coin of sortedCoins) {
				selectedCoins.push(coin);
				totalSelected += coin.balance;

				if (totalSelected >= amount) {
					break;
				}
			}

			// Check if we have enough
			if (totalSelected < amount) {
				throw new CoinError(
					CoinErrorType.INSUFFICIENT_BALANCE,
					`Insufficient balance. Need ${amount}, have ${totalSelected}`,
					coinType
				);
			}

			return selectedCoins;
		} catch (error) {
			if (error instanceof CoinError) {
				throw error;
			}

			throw new CoinError(
				CoinErrorType.NETWORK_ERROR,
				`Failed to select coins: ${error instanceof Error ? error.message : String(error)}`,
				coinType
			);
		}
	}

	// ========================================================================
	// Utility Methods
	// ========================================================================

	/**
	 * Parses a coin type string into components
	 * @param coinType - Full coin type string
	 * @returns CoinType object
	 */
	parseCoinType(coinType: string): CoinType {
		return parseCoinType(coinType);
	}

	/**
	 * Formats a coin amount for display
	 * @param amount - Amount in smallest unit
	 * @param decimals - Number of decimal places
	 * @param options - Formatting options
	 * @returns Formatted amount string
	 */
	formatCoinAmount(
		amount: string | bigint | number,
		decimals: number,
		options?: {
			compact?: boolean;
			maxDecimals?: number;
			minDecimals?: number;
		}
	): string {
		return formatCoinAmount(amount, decimals, options);
	}

	/**
	 * Parses a display amount to smallest unit
	 * @param input - Display amount string
	 * @param decimals - Number of decimal places
	 * @returns Amount in smallest unit as bigint
	 */
	parseAmountToSmallestUnit(
		input: string | number | null | undefined,
		decimals: number
	): bigint {
		return parseAmountToSmallestUnit(input, decimals);
	}

	/**
	 * Gets the default coin type (SUI)
	 * @returns Default coin type string
	 */
	getDefaultCoinType(): string {
		return DEFAULT_COIN_TYPE;
	}

	/**
	 * Validates if a coin type string is valid
	 * @param coinType - Coin type to validate
	 * @returns True if valid
	 */
	isValidCoinType(coinType: string): boolean {
		return isValidCoinType(coinType);
	}

	/**
	 * Gets the SuiClient instance
	 * @returns SuiClient instance
	 */
	getClient(): SuiClient {
		return this.client;
	}

	/**
	 * Gets the network identifier
	 * @returns Network string
	 */
	getNetwork(): string {
		return this.network;
	}
}

// ========================================================================
// Factory Functions
// ========================================================================

/**
 * Creates a CoinService instance for testnet
 * @returns CoinService instance
 */
export function createTestnetCoinService(): CoinService {
	return new CoinService({
		rpcUrl: 'https://fullnode.testnet.sui.io',
		network: 'testnet'
	});
}

/**
 * Creates a CoinService instance for mainnet
 * @returns CoinService instance
 */
export function createMainnetCoinService(): CoinService {
	return new CoinService({
		rpcUrl: 'https://fullnode.mainnet.sui.io',
		network: 'mainnet'
	});
}

/**
 * Creates a CoinService instance for devnet
 * @returns CoinService instance
 */
export function createDevnetCoinService(): CoinService {
	return new CoinService({
		rpcUrl: 'https://fullnode.devnet.sui.io',
		network: 'devnet'
	});
}

/**
 * Creates a CoinService instance based on network string
 * @param network - Network identifier
 * @returns CoinService instance
 */
export function createCoinService(network: string = 'testnet'): CoinService {
	switch (network.toLowerCase()) {
		case 'mainnet':
			return createMainnetCoinService();
		case 'devnet':
			return createDevnetCoinService();
		case 'testnet':
		default:
			return createTestnetCoinService();
	}
}
