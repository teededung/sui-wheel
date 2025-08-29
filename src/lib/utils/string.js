// Check if two objects are deeply equal
export const deepEqual = (a, b) =>
	a === b || (a && b && a.length === b.length && JSON.stringify(a) === JSON.stringify(b));

// Shorten address to 6 characters
export function shortenAddress(address) {
	if (!address || address.length < 10) return address || 'Unknown';
	return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}
