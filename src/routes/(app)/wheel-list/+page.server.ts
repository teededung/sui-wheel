import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import type { PageServerLoad } from './$types';
import {
	LATEST_PACKAGE_ID,
	WHEEL_MODULE,
	WHEEL_FUNCTIONS,
	WHEEL_STRUCT,
	NETWORK
} from '$lib/constants.js';

export const load: PageServerLoad = async () => {
	const networkPart = NETWORK.split(':')[1] as 'mainnet' | 'testnet' | 'devnet';
	const suiClient = new SuiClient({ url: getFullnodeUrl(networkPart) });

	try {
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
				showInput: true,
				showEffects: false,
				showEvents: false
			},
			order: 'descending',
			limit: 30
		});

		const transactions = response?.data || [];

		const items: Array<{ id: string; digest?: string; timestampMs: number }> = [];
		for (const tx of transactions) {
			const objectChanges = tx?.objectChanges || [];
			
			for (const ch of objectChanges) {
				const change = ch as { type?: string; objectType?: string; objectId?: string };
				
				if (change?.type === 'created') {
					const objectType = String(change?.objectType || '');
					
					// Check if it's a Wheel object (handle both with and without type parameters)
					if (objectType.includes(`::${WHEEL_MODULE}::${WHEEL_STRUCT}`)) {
						items.push({
							id: change.objectId!,
							digest: tx?.digest,
							timestampMs: Number(tx?.timestampMs || 0)
						});
						break; // Only one wheel per transaction
					}
				}
			}
		}

		let publicWheels = items;
		if (items.length > 0) {
			try {
				const objs = await suiClient.multiGetObjects({
					ids: items.map(i => i.id),
					options: { showContent: true }
				});
				const idToMeta = new Map<string, { status: string; remainingSpins: number; totalEntries: number }>();
				for (const o of objs || []) {
					try {
						const id = String(o?.data?.objectId || '');
						const f = (o?.data?.content as { fields?: Record<string, unknown> } | undefined)?.fields || {};
						const isCancelled = Boolean(f['is_cancelled']);
						let spunCount = 0;
						try {
							spunCount = Number(f['spun_count'] || 0);
						} catch {}
						let prizesLen = 0;
						try {
							prizesLen = Array.isArray(f['prize_amounts']) ? f['prize_amounts'].length : 0;
						} catch {}
						let remainingEntriesCount = 0;
						try {
							remainingEntriesCount = Array.isArray(f['remaining_entries'])
								? f['remaining_entries'].length
								: 0;
						} catch {}
						const totalEntries = remainingEntriesCount + spunCount;
						const remaining = Math.max(0, prizesLen - spunCount);
						const status = isCancelled ? 'Cancelled' : remaining > 0 ? 'Running' : 'Finished';
						idToMeta.set(id, { status, remainingSpins: remaining, totalEntries });
					} catch {}
				}
				publicWheels = items
					.map(it => {
						const meta = idToMeta.get(it.id) || {
							status: '—',
							remainingSpins: 0,
							totalEntries: 0
						};
						return { ...it, ...meta };
					})
					.filter(w => w.status !== 'Cancelled');
			} catch (err) {
				console.error('[WheelList Server] Enrichment failed:', err);
				// keep base items if enrichment fails
				publicWheels = items;
			}
		}

		return { publicWheels };
	} catch (err) {
		console.error('[WheelList Server] Load failed:', err);
		return { publicWheels: [] as Array<{ id: string; digest?: string; timestampMs: number }> };
	}
};
