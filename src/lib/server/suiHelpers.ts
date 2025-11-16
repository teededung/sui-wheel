import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiClient } from '@mysten/sui/client';

export function createKeypairFromPrivateKey(privateKey: string | Uint8Array) {
	if (!privateKey) {
		throw new Error('Private key is required');
	}

	try {
		// SUI SDK should handle bech32 format automatically
		const keypair = Ed25519Keypair.fromSecretKey(privateKey);
		return keypair;
	} catch (error) {
		console.error('Failed to create keypair:', error);
		const err = error as { message?: string } | Error;
		throw new Error(`Invalid private key format: ${err?.message || String(error)}`);
	}
}

// Create SuiClient instance for server-side operations
export const suiClient = new SuiClient({
	url: 'https://fullnode.testnet.sui.io'
});

/**
 * Get SUI balance for a given address
 * @param {string} address - The wallet address to check balance for
 * @param {string} coinType - Optional coin type (defaults to SUI)
 * @returns {Promise<number>} - Balance in SUI (not MIST)
 */
export async function getSuiBalance(address: string, coinType: string = '0x2::sui::SUI') {
	try {
		const response = await suiClient.getBalance({
			owner: address,
			coinType
		});

		const totalBalance = Number(response.totalBalance);
		const suiAmount = totalBalance / 1_000_000_000; // Convert MIST to SUI

		return Number(suiAmount.toFixed(9)); // Return with precision
	} catch (error) {
		console.error('Error fetching SUI balance:', error);
		throw new Error(`Failed to fetch balance for address ${address}`);
	}
}

/**
 * Get coin balance for any coin type
 * @param {string} address - The wallet address to check balance for
 * @param {string} coinType - The coin type to query
 * @param {number} decimals - Number of decimal places for the coin
 * @returns {Promise<number>} - Balance in display units
 */
export async function getCoinBalance(
	address: string,
	coinType: string,
	decimals: number = 9
): Promise<number> {
	try {
		const response = await suiClient.getBalance({
			owner: address,
			coinType
		});

		const totalBalance = Number(response.totalBalance);
		const divisor = Math.pow(10, decimals);
		const displayAmount = totalBalance / divisor;

		return Number(displayAmount.toFixed(decimals));
	} catch (error) {
		console.error(`Error fetching ${coinType} balance:`, error);
		throw new Error(`Failed to fetch balance for address ${address} and coin type ${coinType}`);
	}
}

/**
 * Get coin metadata from the blockchain
 * @param {string} coinType - The coin type to query
 * @returns {Promise<Object>} - Coin metadata object
 */
export async function getCoinMetadata(coinType: string) {
	try {
		const metadata = await suiClient.getCoinMetadata({ coinType });

		if (!metadata) {
			throw new Error(`Metadata not found for coin type: ${coinType}`);
		}

		return {
			coinType,
			decimals: metadata.decimals,
			name: metadata.name,
			symbol: metadata.symbol,
			description: metadata.description,
			iconUrl: metadata.iconUrl || null,
			id: metadata.id
		};
	} catch (error) {
		console.error(`Error fetching metadata for ${coinType}:`, error);
		throw new Error(`Failed to fetch metadata for coin type ${coinType}`);
	}
}
