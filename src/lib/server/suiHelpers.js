import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiClient } from '@mysten/sui/client';

export function createKeypairFromPrivateKey(privateKey) {
	if (!privateKey) {
		throw new Error('Private key is required');
	}

	try {
		// SUI SDK should handle bech32 format automatically
		const keypair = Ed25519Keypair.fromSecretKey(privateKey);
		return keypair;
	} catch (error) {
		console.error('Failed to create keypair:', error);
		throw new Error(`Invalid private key format: ${error.message}`);
	}
}

// Create SuiClient instance for server-side operations
export const suiClient = new SuiClient({
	url: 'https://fullnode.testnet.sui.io'
});

/**
 * Get SUI balance for a given address
 * @param {string} address - The wallet address to check balance for
 * @returns {Promise<number>} - Balance in SUI (not MIST)
 */
export async function getSuiBalance(address) {
	try {
		const response = await suiClient.getBalance({
			owner: address,
			coinType: '0x2::sui::SUI'
		});

		const totalBalance = Number(response.totalBalance);
		const suiAmount = totalBalance / 1_000_000_000; // Convert MIST to SUI

		return Number(suiAmount.toFixed(9)); // Return with precision
	} catch (error) {
		console.error('Error fetching SUI balance:', error);
		throw new Error(`Failed to fetch balance for address ${address}`);
	}
}
