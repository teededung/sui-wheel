import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = await request.json() as {
			address?: string;
			wheelIds?: unknown[];
		};
		const address = String(body?.address || '').toLowerCase();
		const wheelIds = Array.isArray(body?.wheelIds) ? body.wheelIds.map(String) : [];
		if (!address || wheelIds.length === 0) {
			return json({ success: false, message: 'Missing address or wheelIds' }, { status: 400 });
		}

		if (!locals.supabaseAdmin) {
			console.error('[api/wheels/joined/check] supabaseAdmin not available');
			return json(
				{ success: false, message: 'Database connection not available' },
				{ status: 500 }
			);
		}

		const wheelIdsSet = new Set(wheelIds);

		// Check which wheels the user has joined (no auto-sync)
		const { data, error } = await locals.supabaseAdmin
			.from('wheel_entries')
			.select('wheel_id')
			.eq('entry_address', address)
			.in('wheel_id', wheelIds)
			.limit(10000);

		if (error) {
			console.error('[api/wheels/joined/check] Supabase error', error);
			return json(
				{ success: false, message: 'Failed to check joined wheels', error: error.message },
				{ status: 500 }
			);
		}

		const allJoined = Array.from(new Set((data || []).map((r: { wheel_id: string }) => String(r.wheel_id))));
		const joinedIds = allJoined.filter(id => wheelIdsSet.has(id));
		return json({ success: true, joinedIds });
	} catch (e) {
		console.error('[api/wheels/joined/check] POST error', e);
		const errorMessage = e instanceof Error ? e.message : 'Internal server error';
		return json(
			{ success: false, message: 'Internal server error', error: errorMessage },
			{ status: 500 }
		);
	}
};
