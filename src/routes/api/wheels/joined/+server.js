import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	try {
		const address = String(url.searchParams.get('address') || '').toLowerCase();
		if (!address) return json({ success: false, message: 'Missing address' }, { status: 400 });

		const { data, error } = await supabaseAdmin
			.from('wheel_entries')
			.select('wheel_id')
			.eq('entry_address', address)
			.limit(1000);

		if (error) {
			console.error('[api/wheels/joined] error', error);
			return json({ success: false, message: 'Failed to fetch joined wheels' }, { status: 500 });
		}

		const joinedIds = Array.from(new Set((data ?? []).map(r => r.wheel_id)));
		return json({ success: true, joinedIds });
	} catch (e) {
		console.error('[api/wheels/joined] GET error', e);
		return json({ success: false, message: 'Internal server error' }, { status: 500 });
	}
}
