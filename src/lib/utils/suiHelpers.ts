import { MIST_PER_SUI } from '../constants.js';

/**
 * Converts SUI amount to MIST (the smallest unit of SUI)
 * @param {string|number} input - The SUI amount to convert (supports decimal strings with comma/dot separators)
 * @returns {bigint} The equivalent amount in MIST as a BigInt
 * @example
 * parseSuiToMist("1.5") // returns 1500000000n
 * parseSuiToMist("1,5") // returns 1500000000n (comma separator)
 * parseSuiToMist(2) // returns 2000000000n
 */
export function parseSuiToMist(input: string | number | null | undefined): bigint {
	// Parse decimal string SUI to BigInt MIST (9 decimals)
	let str = String(input ?? '').trim();
	// Normalize comma decimal to dot and strip spaces
	str = str.replace(/,/g, '.').replace(/\s+/g, '');
	if (!str) return 0n;
	if (!/^[0-9]*\.?[0-9]*$/.test(str)) return 0n;
	const [intPart, fracRaw = ''] = str.split('.');
	const frac = (fracRaw + '000000000').slice(0, 9); // pad to 9 decimals
	try {
		const mist = BigInt(intPart || '0') * BigInt(MIST_PER_SUI) + BigInt(frac || '0');
		return mist < 0n ? 0n : mist;
	} catch {
		return 0n;
	}
}

/**
 * Converts MIST amount to SUI with 6 decimal places
 * @param {bigint|number|string} mist - The MIST amount to convert
 * @returns {string} The equivalent amount in SUI as a string with 6 decimal places
 * @example
 * formatMistToSui(1500000000n) // returns "1.500000"
 * formatMistToSui("2000000000") // returns "2.000000"
 */
export function formatMistToSui(mist: bigint | number | string): string {
	try {
		const v = Number(mist) / MIST_PER_SUI;
		return Number.isFinite(v) ? v.toFixed(6) : '0';
	} catch {
		return '0';
	}
}

/**
 * Converts MIST amount to SUI in compact format (removes trailing .0)
 * @param {bigint|number|string} mist - The MIST amount to convert
 * @returns {string} The equivalent amount in SUI as a compact string
 * @example
 * formatMistToSuiCompact(1500000000n) // returns "1.5"
 * formatMistToSuiCompact(2000000000n) // returns "2"
 * formatMistToSuiCompact("2500000000") // returns "2.5"
 */
export function formatMistToSuiCompact(mist: bigint | number | string): string {
	try {
		const v = Number(mist) / MIST_PER_SUI;
		if (!Number.isFinite(v)) return '0';
		const s = v.toFixed(2);
		return s.endsWith('.0') ? s.slice(0, -2) : s;
	} catch {
		return '0';
	}
}

/**
 * Validates if a string is a valid SUI blockchain address
 * @param {string} address - The address string to validate
 * @returns {boolean} True if the address is a valid SUI address format, false otherwise
 * @example
 * isValidSuiAddress("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef") // returns true
 * isValidSuiAddress("invalid_address") // returns false
 */
export function isValidSuiAddress(address: string): boolean {
	// SUI addresses start with 0x and are 64 characters long
	const suiAddressRegex = /^0x[a-fA-F0-9]{64}$/;
	return suiAddressRegex.test(address);
}

/**
 * Checks if an account object is associated with the SUI blockchain
 * @param {Object} acc - The account object to check
 * @param {string[]} acc.chains - Array of blockchain identifiers associated with the account
 * @returns {boolean} True if the account has SUI in its chains, false otherwise
 * @example
 * isSuiAccount({ chains: ["sui:devnet", "eth:mainnet"] }) // returns true
 * isSuiAccount({ chains: ["eth:mainnet", "btc:mainnet"] }) // returns false
 * isSuiAccount({}) // returns false
 */
export function isSuiAccount(acc: { chains: string[] }): boolean {
	return (acc.chains ?? []).some(c => c.startsWith('sui:'));
}

/**
 * Format SUI balance to a more readable format
 * @param {string|number} balance - The balance in MIST units (smallest unit of SUI)
 * @returns {string} - The formatted balance in SUI
 */
export function formatSui(balance: string | number | null | undefined = '0'): string {
	try {
		// Handle null, undefined, empty string
		if (balance == null || balance === '') {
			return '0';
		}

		// Convert to string first to handle both numbers and strings
		const balanceStr = balance.toString().trim();

		// Check if it's a valid number
		if (isNaN(Number(balanceStr))) {
			return '0';
		}

		// Parse the MIST balance and convert to SUI (1 SUI = 1_000_000_000 MIST)
		const mistAmount = BigInt(balanceStr);
		const suiAmount = Number(mistAmount) / 1_000_000_000;

		// For large numbers, show with appropriate decimal places
		if (suiAmount >= 1) {
			// Show with 4 decimal places for balances >= 1 SUI
			return suiAmount.toLocaleString('en-US', {
				minimumFractionDigits: 0,
				maximumFractionDigits: 4
			});
		} else {
			// Show with up to 9 decimal places for small balances
			return suiAmount.toFixed(9).replace(/\.?0+$/, '');
		}
	} catch {
		// Fallback to original behavior
		return balance?.toString() ?? '0';
	}
}

/**
 * Checks if an account is on the SUI testnet
 * @param {Object} account - The account object to check
 * @returns {boolean} True if the account is on the SUI testnet, false otherwise
 */
export function isTestnet(account: { chains: readonly string[] }): boolean {
	if (!account) return true;
	const chain = account?.chains[0];
	if (!chain) return true;
	return chain === 'sui:testnet';
}

/**
 * Formats network name for display
 * @param {string} network - The network identifier (e.g., 'sui:mainnet', 'sui:testnet')
 * @returns {string} Formatted network name for display
 * @example
 * getNetworkDisplayName('sui:mainnet') // returns 'Mainnet'
 * getNetworkDisplayName('sui:testnet') // returns 'Testnet'
 * getNetworkDisplayName('sui:devnet') // returns 'Devnet'
 */
export function getNetworkDisplayName(network: string): string {
	if (!network) return 'Unknown';
	if (network.includes('mainnet')) return 'Mainnet';
	if (network.includes('testnet')) return 'Testnet';
	if (network.includes('devnet')) return 'Devnet';
	return network.replace('sui:', '').charAt(0).toUpperCase() + network.replace('sui:', '').slice(1);
}

/**
 * Highlights the first 4 characters after '0x' and last 4 characters of a SUI address for better readability
 * @param {string} address - The SUI address to format
 * @returns {string} HTML string with highlighted address
 * @example
 * highlightAddress('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
 * // returns '0x<span class="font-bold text-primary">1234</span>...cdef'
 */
export function highlightAddress(address: string): string {
	if (!address || typeof address !== 'string') return address;

	const addr = address.trim();
	if (!isValidSuiAddress(addr)) return addr;

	const prefix = addr.slice(0, 2); // '0x'
	const first4 = addr.slice(2, 6); // 4 characters after '0x'
	const last4 = addr.slice(-4);
	const middle = addr.slice(6, -4);

	return `${prefix}<span class="font-bold text-primary">${first4}</span>${middle}<span class="font-bold text-primary">${last4}</span>`;
}

export type NetworkType = 'mainnet' | 'testnet';
export type ExplorerType = 'txblock' | 'object' | 'address' | 'package';
export type ExplorerProvider = 'suiscan' | 'suivision';

/**
 * Generates explorer link for SUI blockchain
 * @param network - Network name ('mainnet' or 'testnet')
 * @param type - Explorer page type ('txblock', 'object', 'address', 'package')
 * @param identifier - The transaction hash, object ID, address, or package ID
 * @param provider - Explorer provider ('suiscan' or 'suivision'), defaults to 'suiscan'
 * @returns Full explorer URL
 * @example
 * getExplorerLink('mainnet', 'txblock', '0x123...') // returns 'https://suiscan.xyz/mainnet/tx/0x123...'
 * getExplorerLink('testnet', 'object', '0x456...', 'suivision') // returns 'https://testnet.suivision.xyz/object/0x456...'
 */
export function getExplorerLink(network: string, type: string, identifier: string, provider: ExplorerProvider = 'suiscan'): string {
	const validNetworks: NetworkType[] = ['mainnet', 'testnet'];
	const validTypes: ExplorerType[] = ['txblock', 'object', 'address', 'package'];

	let finalNetwork: NetworkType = 'testnet';
	if (validNetworks.includes(network as NetworkType)) {
		finalNetwork = network as NetworkType;
	}

	let finalType: ExplorerType = 'txblock';
	if (validTypes.includes(type as ExplorerType)) {
		finalType = type as ExplorerType;
	}

	if (provider === 'suiscan') {
		// Suiscan URL format: https://suiscan.xyz/{network}/{type}/{identifier}
		const typeMap: Record<ExplorerType, string> = {
			txblock: 'tx',
			object: 'object',
			address: 'account',
			package: 'object'
		};
		return `https://suiscan.xyz/${finalNetwork}/${typeMap[finalType]}/${identifier}`;
	} else {
		// Suivision URL format (original)
		// Testnet uses subdomain, mainnet does not
		const baseUrl =
			finalNetwork === 'testnet' ? 'https://testnet.suivision.xyz' : 'https://suivision.xyz';
		return `${baseUrl}/${finalType}/${identifier}`;
	}
}
