import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import {
	LATEST_PACKAGE_ID,
	WHEEL_MODULE,
	WHEEL_FUNCTIONS,
	WHEEL_STRUCT,
	NETWORK
} from '$lib/constants.js';

/** @type {import('./$types').PageServerLoad} */
export const load = async () => {
	const suiClient = new SuiClient({ url: getFullnodeUrl(NETWORK.split(':')[1]) });

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

		const items = [];
		for (const tx of transactions) {
			const created = (tx?.objectChanges || []).find(
				ch =>
					ch?.type === 'created' &&
					String(ch?.objectType || '').endsWith(`::${WHEEL_MODULE}::${WHEEL_STRUCT}`)
			);
			if (created?.objectId) {
				items.push({
					id: created.objectId,
					digest: tx?.digest,
					timestampMs: Number(tx?.timestampMs || 0)
				});
			}
		}

		let publicWheels = items;
		if (items.length > 0) {
			try {
				const objs = await suiClient.multiGetObjects({
					ids: items.map(i => i.id),
					options: { showContent: true }
				});
				const idToMeta = new Map();
				for (const o of objs || []) {
					try {
						const id = String(o?.data?.objectId || '');
						const f = o?.data?.content?.fields || {};
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
			} catch {
				// keep base items if enrichment fails
				publicWheels = items;
			}
		}

		return { publicWheels };
	} catch {
		return { publicWheels: [] };
	}
};
