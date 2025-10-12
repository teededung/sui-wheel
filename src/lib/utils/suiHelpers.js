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
export function parseSuiToMist(input) {
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
export function formatMistToSui(mist) {
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
export function formatMistToSuiCompact(mist) {
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
export function isValidSuiAddress(address) {
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
export function isSuiAccount(acc) {
	return (acc.chains ?? []).some(c => c.startsWith('sui:'));
}

/**
 * Format SUI balance to a more readable format
 * @param {string|number} balance - The balance in MIST units (smallest unit of SUI)
 * @returns {string} - The formatted balance in SUI
 */
export function formatSui(balance = '0') {
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
export function isTestnet(account) {
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
export function getNetworkDisplayName(network) {
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
export function highlightAddress(address) {
	if (!address || typeof address !== 'string') return address;

	const addr = address.trim();
	if (!isValidSuiAddress(addr)) return addr;

	const prefix = addr.slice(0, 2); // '0x'
	const first4 = addr.slice(2, 6); // 4 characters after '0x'
	const last4 = addr.slice(-4);
	const middle = addr.slice(6, -4);

	return `${prefix}<span class="font-bold text-primary">${first4}</span>${middle}<span class="font-bold text-primary">${last4}</span>`;
}

/**
 * Generates explorer link for SUI blockchain
 * @param {string} network - Network name ('mainnet' or 'testnet')
 * @param {string} type - Explorer page type ('txblock', 'object', 'address', 'package')
 * @param {string} identifier - The transaction hash, object ID, address, or package ID
 * @returns {string} Full Suivision URL
 * @example
 * getExplorerLink('mainnet', 'txblock', '0x123...') // returns 'https://suivision.xyz/txblock/0x123...'
 * getExplorerLink('testnet', 'object', '0x456...') // returns 'https://testnet.suivision.xyz/object/0x456...'
 */
export function getExplorerLink(network, type, identifier) {
	const validNetworks = ['mainnet', 'testnet'];
	const validTypes = ['txblock', 'object', 'address', 'package'];

	if (!validNetworks.includes(network)) {
		network = 'testnet'; // default fallback
	}

	if (!validTypes.includes(type)) {
		type = 'txblock'; // default fallback
	}

	// Testnet uses subdomain, mainnet does not
	const baseUrl = network === 'testnet' ? 'https://testnet.suivision.xyz' : 'https://suivision.xyz';

	return `${baseUrl}/${type}/${identifier}`;
}
