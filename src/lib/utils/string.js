/**
 * Checks if two values are deeply equal using strict equality or JSON comparison.
 * @param {*} a - First value.
 * @param {*} b - Second value.
 * @returns {boolean} True if deeply equal.
 */
export const deepEqual = (a, b) =>
	a === b || (a && b && a.length === b.length && JSON.stringify(a) === JSON.stringify(b));

/**
 * Shortens a blockchain address for display (first 6 + last 4 chars with ellipsis).
 * @param {string|undefined|null} address - Address to shorten.
 * @returns {string} Shortened address or 'Unknown'.
 */
export function shortenAddress(address) {
	if (!address || address.length < 10) return address || 'Unknown';
	return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * Compares two arrays shallowly by value and order.
 * @param {Array<any>} a - First array.
 * @param {Array<any>} b - Second array.
 * @returns {boolean} True if shallowly equal.
 */
export function arraysShallowEqual(a, b) {
	// Compare two string arrays by value and order
	if (a === b) return true;
	if (!Array.isArray(a) || !Array.isArray(b)) return false;
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

/**
 * Shuffles an array using Fisher-Yates, ensuring it's different from original.
 * @param {Array<any>} items - Array to shuffle (mutates in place).
 * @returns {Array<any>|undefined} Shuffled array or undefined if <2 items.
 */
export function shuffleArray(items) {
	if (items.length < 2) return;

	// Create a copy of the current entries for comparison
	const previousEntries = [...items];

	// Helper function for Fisher-Yates shuffle (unbiased random shuffle)
	function fisherYatesShuffle(arr) {
		const shuffled = [...arr];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		return shuffled;
	}

	// Shuffle until the result differs from the previous entries
	do {
		items = fisherYatesShuffle(items);
	} while (arraysShallowEqual(items, previousEntries));

	return items;
}
