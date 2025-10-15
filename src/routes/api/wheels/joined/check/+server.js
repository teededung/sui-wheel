import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	try {
		const body = await request.json();
		const address = String(body?.address || '').toLowerCase();
		const wheelIds = Array.isArray(body?.wheelIds) ? body.wheelIds.map(String) : [];
		if (!address || wheelIds.length === 0) {
			return json({ success: false, message: 'Missing address or wheelIds' }, { status: 400 });
		}

		const { data, error } = await locals.supabaseAdmin
			.from('wheel_entries')
			.select('wheel_id')
			.eq('entry_address', address)
			.in('wheel_id', wheelIds)
			.limit(wheelIds.length);

		if (error) {
			console.error('[api/wheels/joined/check] error', error);
			return json({ success: false, message: 'Failed to check joined wheels' }, { status: 500 });
		}

		const joinedIds = Array.from(new Set((data || []).map(r => String(r.wheel_id))));
		return json({ success: true, joinedIds });
	} catch (e) {
		console.error('[api/wheels/joined/check] POST error', e);
		return json({ success: false, message: 'Internal server error' }, { status: 500 });
	}
}
