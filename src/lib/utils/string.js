// Validate SUI address format (basic validation)
export function isValidSuiAddress(address) {
	// SUI addresses start with 0x and are 64 characters long
	const suiAddressRegex = /^0x[a-fA-F0-9]{64}$/;
	return suiAddressRegex.test(address);
}

// Check if an account is a SUI account
export const isSuiAccount = acc => (acc.chains ?? []).some(c => c.startsWith('sui:'));

// Check if two objects are deeply equal
export const deepEqual = (a, b) =>
	a === b || (a && b && a.length === b.length && JSON.stringify(a) === JSON.stringify(b));

// Shorten address to 6 characters
export function shortenAddress(address) {
	if (!address || address.length < 10) return address || 'Unknown';
	return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
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
