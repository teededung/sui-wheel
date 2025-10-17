import { json } from '@sveltejs/kit';
import { cache } from '$lib/server/cache.js';

const TTL_SECONDS = 600;

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	try {
		const body = await request.json();
		const address = String(body?.address || '').toLowerCase();
		const wheelIds = Array.isArray(body?.wheelIds) ? body.wheelIds.map(String) : [];
		if (!address || wheelIds.length === 0) {
			return json({ success: false, message: 'Missing address or wheelIds' }, { status: 400 });
		}

		const wheelIdsSet = new Set(wheelIds);
		const cacheKey = `joined:${address}`;

		let allJoined = await cache.getJSON(cacheKey);
		// if (Array.isArray(allJoined)) {
		// 	console.log('[api/wheels/joined/check] cache HIT', { address, count: allJoined.length });
		// } else {
		// 	console.log('[api/wheels/joined/check] cache MISS', { address });
		// }
		if (!Array.isArray(allJoined)) {
			const { data, error } = await locals.supabaseAdmin
				.from('wheel_entries')
				.select('wheel_id')
				.eq('entry_address', address)
				.limit(10000);

			if (error) {
				console.error('[api/wheels/joined/check] error', error);
				return json({ success: false, message: 'Failed to check joined wheels' }, { status: 500 });
			}

			allJoined = Array.from(new Set((data || []).map(r => String(r.wheel_id))));
			// console.log('[api/wheels/joined/check] cache SET', {
			// 	address,
			// 	count: allJoined.length,
			// 	ttl: TTL_SECONDS
			// });
			await cache.setJSON(cacheKey, allJoined, TTL_SECONDS);
		}

		const joinedIds = (allJoined || []).filter(id => wheelIdsSet.has(id));
		return json({ success: true, joinedIds });
	} catch (e) {
		console.error('[api/wheels/joined/check] POST error', e);
		return json({ success: false, message: 'Internal server error' }, { status: 500 });
	}
}
