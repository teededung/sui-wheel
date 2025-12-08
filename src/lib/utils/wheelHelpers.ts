/**
 * Shared utilities for wheel-related operations
 */

/**
 * Extract coin type from object type string
 * Format: "0x...::sui_wheel::Wheel<COIN_TYPE>"
 */
export function extractCoinTypeFromObjectType(objectType: string): string | null {
	if (objectType && objectType.includes('<') && objectType.includes('>')) {
		const match = objectType.match(/<(.+)>/);
		if (match?.[1]) {
			return match[1].trim();
		}
	}
	return null;
}

/**
 * Parse pool balance from nested balance field variants
 * Handles both direct values and nested object structures
 */
export function parsePoolBalance(fields: Record<string, unknown>): bigint {
	try {
		let pool = 0n;
		const v = fields['pool'];
		if (v != null) {
			if (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint') {
				pool = BigInt(v);
			} else if (typeof v === 'object' && v !== null) {
				const vObj = v as {
					fields?: {
						balance?: { fields?: { value?: unknown } };
						value?: unknown;
					};
					value?: unknown;
					balance?: unknown;
				};
				const val =
					vObj?.fields?.balance?.fields?.value ??
					vObj?.fields?.value ??
					vObj?.value ??
					vObj?.balance;
				if (
					val != null &&
					(typeof val === 'string' ||
						typeof val === 'number' ||
						typeof val === 'bigint' ||
						typeof val === 'boolean')
				) {
					pool = BigInt(val);
				}
			}
		}
		return pool;
	} catch {
		return 0n;
	}
}

/**
 * Parse winners array from wheel fields
 */
export function parseWinners(fields: Record<string, unknown>): Array<{
	addr: string;
	prize_index: number;
	claimed: boolean;
}> {
	return ((fields['winners'] as unknown[]) || []).map((w: unknown) => {
		const winner = w as {
			fields?: { addr?: unknown; prize_index?: unknown; claimed?: unknown };
			addr?: unknown;
			prize_index?: unknown;
			claimed?: unknown;
		};
		return {
			addr: String(winner?.fields?.addr ?? winner?.addr ?? ''),
			prize_index: Number(winner?.fields?.prize_index ?? winner?.prize_index ?? 0),
			claimed: Boolean(winner?.fields?.claimed ?? winner?.claimed ?? false)
		};
	});
}

/**
 * Parse prize amounts array from wheel fields
 */
export function parsePrizeAmounts(fields: Record<string, unknown>): bigint[] {
	return ((fields['prize_amounts'] as unknown[]) || []).map((v: unknown) => {
		if (
			typeof v === 'string' ||
			typeof v === 'number' ||
			typeof v === 'bigint' ||
			typeof v === 'boolean'
		) {
			return BigInt(v);
		}
		return 0n;
	});
}
