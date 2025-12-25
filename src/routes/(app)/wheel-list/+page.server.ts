import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import type { PageServerLoad } from './$types';
import { createGraphQLService, type SuiNetwork } from '$lib/services/suiGraphQL';
import {
	LATEST_PACKAGE_ID,
	WHEEL_MODULE,
	WHEEL_FUNCTIONS,
	WHEEL_STRUCT,
	NETWORK
} from '$lib/constants.js';
import { dev } from '$app/environment';
import { LRUCache } from 'lru-cache';

interface WheelItem {
	id: string;
	digest?: string;
	timestampMs: number;
	status?: string;
	remainingSpins?: number;
	totalEntries?: number;
}

const publicWheelsCache = new LRUCache({
	max: 10,
	ttl: 15_000
});

const gqlFunctionFilterSupportedCache = new LRUCache({
	max: 10,
	ttl: 5 * 60_000
});

function isFunctionFilterUnsupportedError(err: unknown) {
	const msg = err instanceof Error ? err.message : String(err);
	return msg.toLowerCase().includes('filtering transactions by function calls not available');
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | null = null;
	try {
		return await Promise.race([
			promise,
			new Promise<T>((_, reject) => {
				timer = setTimeout(() => reject(new Error(`[Timeout] ${label} exceeded ${ms}ms`)), ms);
			})
		]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}

// Fallback to JSON-RPC when GraphQL is unavailable
async function loadWithRPC(networkPart: 'mainnet' | 'testnet' | 'devnet'): Promise<WheelItem[]> {
	const suiClient = new SuiClient({ url: getFullnodeUrl(networkPart) });

	const response = await suiClient.queryTransactionBlocks({
		filter: {
			MoveFunction: {
				package: LATEST_PACKAGE_ID,
				module: WHEEL_MODULE,
				function: WHEEL_FUNCTIONS.CREATE
			}
		},
		options: {
			showObjectChanges: true,
			showInput: false,
			showEffects: false,
			showEvents: false
		},
		order: 'descending',
		limit: 30
	});

	const transactions = response?.data || [];
	const items: WheelItem[] = [];

	for (const tx of transactions) {
		const objectChanges = tx?.objectChanges || [];
		for (const ch of objectChanges) {
			const change = ch as { type?: string; objectType?: string; objectId?: string };
			if (change?.type === 'created') {
				const objectType = String(change?.objectType || '');
				if (objectType.includes(`::${WHEEL_MODULE}::${WHEEL_STRUCT}`)) {
					items.push({
						id: change.objectId!,
						digest: tx?.digest,
						timestampMs: Number(tx?.timestampMs || 0)
					});
					break;
				}
			}
		}
	}

	if (items.length === 0) return [];

	// Enrich with object metadata
	const objs = await suiClient.multiGetObjects({
		ids: items.map((i) => i.id),
		options: { showContent: true }
	});

	const idToMeta = new Map<
		string,
		{ status: string; remainingSpins: number; totalEntries: number }
	>();

	for (const o of objs || []) {
		try {
			const id = String(o?.data?.objectId || '');
			const f =
				(o?.data?.content as { fields?: Record<string, unknown> } | undefined)?.fields || {};
			const isCancelled = Boolean(f['is_cancelled']);
			const spunCount = Number(f['spun_count'] || 0);
			const prizesLen = Array.isArray(f['prize_amounts']) ? f['prize_amounts'].length : 0;
			const remainingEntriesCount = Array.isArray(f['remaining_entries'])
				? f['remaining_entries'].length
				: 0;
			const totalEntries = remainingEntriesCount + spunCount;
			const remaining = Math.max(0, prizesLen - spunCount);
			const status = isCancelled ? 'Cancelled' : remaining > 0 ? 'Running' : 'Finished';
			idToMeta.set(id, { status, remainingSpins: remaining, totalEntries });
		} catch {
			// Skip
		}
	}

	return items
		.map((it) => ({
			...it,
			...(idToMeta.get(it.id) || { status: '—', remainingSpins: 0, totalEntries: 0 })
		}))
		.filter((w) => w.status !== 'Cancelled');
}

// Load with GraphQL
async function loadWithGraphQL(networkPart: SuiNetwork): Promise<WheelItem[]> {
	const suiGQL = createGraphQLService(networkPart);

	const txResult = await suiGQL.getTransactionsByFunction(
		LATEST_PACKAGE_ID,
		WHEEL_MODULE,
		WHEEL_FUNCTIONS.CREATE,
		30
	);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const transactions = (txResult as any)?.nodes || [];
	const items: WheelItem[] = [];

	for (const tx of transactions) {
		const objectChanges = tx?.effects?.objectChanges?.nodes || [];
		const timestampMs = tx?.effects?.timestamp ? new Date(tx.effects.timestamp).getTime() : 0;

		for (const change of objectChanges) {
			const outputState = change?.outputState;
			if (!outputState?.address) continue;

			const objectType = outputState?.asMoveObject?.contents?.type?.repr || '';
			if (objectType.includes(`::${WHEEL_MODULE}::${WHEEL_STRUCT}`)) {
				items.push({
					id: outputState.address,
					digest: tx?.digest,
					timestampMs
				});
				break;
			}
		}
	}

	if (items.length === 0) return [];

	// Enrich with object data
	const objects = await suiGQL.getMultipleObjects(items.map((i) => i.id));

	const idToMeta = new Map<
		string,
		{ status: string; remainingSpins: number; totalEntries: number }
	>();

	for (const obj of objects) {
		try {
			const id = obj?.address || '';
			const json = obj?.asMoveObject?.contents?.json as Record<string, unknown> | undefined;
			if (!json) {
				continue;
			}

			const isCancelled = Boolean(json['is_cancelled']);
			const spunCount = Number(json['spun_count'] || 0);
			const prizesLen = Array.isArray(json['prize_amounts']) ? json['prize_amounts'].length : 0;
			const remainingEntriesCount = Array.isArray(json['remaining_entries'])
				? json['remaining_entries'].length
				: 0;
			const totalEntries = remainingEntriesCount + spunCount;
			const remaining = Math.max(0, prizesLen - spunCount);
			const status = isCancelled ? 'Cancelled' : remaining > 0 ? 'Running' : 'Finished';
			idToMeta.set(id, { status, remainingSpins: remaining, totalEntries });
		} catch {
			// Skip
		}
	}

	return items
		.map((it) => ({
			...it,
			...(idToMeta.get(it.id) || { status: '—', remainingSpins: 0, totalEntries: 0 })
		}))
		.filter((w) => w.status !== 'Cancelled');
}

async function loadPublicWheels(networkPart: SuiNetwork) {
	const cacheKey = `publicWheels:${networkPart}`;
	const cached = publicWheelsCache.get(cacheKey);

	if (cached)
		return cached as { publicWheels: WheelItem[]; publicWheelsSource: 'graphql' | 'rpc' | 'none' };

	try {
		const shouldTryGraphQL = gqlFunctionFilterSupportedCache.get(networkPart) !== false;

		// Try GraphQL first (for Sui GraphQL challenge), but skip if we already learned it's unsupported
		if (shouldTryGraphQL) {
			try {
				const publicWheels = await withTimeout(
					loadWithGraphQL(networkPart),
					1200,
					'WheelList public wheels GraphQL'
				);
				const result = { publicWheels, publicWheelsSource: 'graphql' as const };
				gqlFunctionFilterSupportedCache.set(networkPart, true);
				publicWheelsCache.set(cacheKey, result);
				return result;
			} catch (gqlErr) {
				if (isFunctionFilterUnsupportedError(gqlErr)) {
					gqlFunctionFilterSupportedCache.set(networkPart, false);
				}
				if (dev) {
					console.warn('[WheelList Server] GraphQL failed, falling back to RPC:', gqlErr);
				}
			}
		}

		// Fallback to JSON-RPC
		try {
			const publicWheels = await loadWithRPC(networkPart as 'mainnet' | 'testnet' | 'devnet');
			const result = { publicWheels, publicWheelsSource: 'rpc' as const };
			publicWheelsCache.set(cacheKey, result);
			return result;
		} catch (rpcErr) {
			if (dev) {
				console.error('[WheelList Server] RPC fallback also failed:', rpcErr);
			}
			const result = { publicWheels: [] as WheelItem[], publicWheelsSource: 'none' as const };
			publicWheelsCache.set(cacheKey, result);
			return result;
		}
	} catch (err) {
		if (dev) {
			console.error('[WheelList Server] loadPublicWheels unexpected error:', err);
		}
		const result = { publicWheels: [] as WheelItem[], publicWheelsSource: 'none' as const };
		publicWheelsCache.set(cacheKey, result);
		return result;
	}
}

export const load: PageServerLoad = async () => {
	const networkPart = NETWORK.split(':')[1] as SuiNetwork;

	const payloadPromise = loadPublicWheels(networkPart);
	// Prevent unhandled rejections before SvelteKit starts rendering/streaming
	payloadPromise.catch(() => {});

	return {
		publicWheels: payloadPromise.then((r) => r.publicWheels),
		publicWheelsSource: payloadPromise.then((r) => r.publicWheelsSource)
	};
};
