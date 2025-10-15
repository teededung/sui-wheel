import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, locals }) {
	try {
		const address = String(url.searchParams.get('address') || '').toLowerCase();
		const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') || 10)));
		if (!address) return json({ success: false, message: 'Missing address' }, { status: 400 });

		// Join wheel_entries -> wheels to get created_at and tx_digest, order by wheels.created_at desc
		// Fetch more rows than needed to allow de-duplication by wheel_id
		const fetchLimit = Math.max(limit, 50);
		const { data, error } = await locals.supabaseAdmin
			.from('wheel_entries')
			.select('wheel_id, wheels(created_at, tx_digest)')
			.eq('entry_address', address)
			.order('created_at', { foreignTable: 'wheels', ascending: false })
			.limit(fetchLimit);

		if (error) {
			console.error('[api/wheels/joined/recent] error', error);
			return json(
				{ success: false, message: 'Failed to fetch recent joined wheels' },
				{ status: 500 }
			);
		}

		// Map to concise list for client
		const seen = new Set();
		const rows = [];
		for (const r of data || []) {
			const id = r?.wheel_id;
			if (!id || seen.has(id)) continue;
			seen.add(id);
			rows.push({
				id,
				digest: r?.wheels?.tx_digest || null,
				createdAt: r?.wheels?.created_at || null
			});
			if (rows.length >= limit) break;
		}

		return json({ success: true, wheels: rows });
	} catch (e) {
		console.error('[api/wheels/joined/recent] GET error', e);
		return json({ success: false, message: 'Internal server error' }, { status: 500 });
	}
}
