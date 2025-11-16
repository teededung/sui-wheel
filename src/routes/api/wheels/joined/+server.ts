import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const address = url.searchParams.get('address')?.toLowerCase();
		
		if (!address) {
			return json({ success: false, message: 'Missing address parameter' }, { status: 400 });
		}

		if (!locals.supabaseAdmin) {
			console.error('[api/wheels/joined] supabaseAdmin not available');
			return json(
				{ success: false, message: 'Database connection not available' },
				{ status: 500 }
			);
		}

		// Get all wheels that the user has joined
		const { data, error } = await locals.supabaseAdmin
			.from('wheel_entries')
			.select(`
				wheel_id,
				wheels!inner (
					wheel_id,
					tx_digest,
					created_at,
					prizes,
					total_donation,
					coin_type
				)
			`)
			.eq('entry_address', address)
			.order('created_at', { referencedTable: 'wheels', ascending: false })
			.limit(50);

		if (error) {
			console.error('[api/wheels/joined] Supabase error', error);
			return json(
				{ success: false, message: 'Failed to fetch joined wheels', error: error.message },
				{ status: 500 }
			);
		}

		// Transform data to match expected format
		const wheels = Array.from(
			new Map(
				(data || []).map((entry: any) => {
					const wheel = entry.wheels;
					return [
						wheel.wheel_id,
						{
							id: wheel.wheel_id,
							digest: wheel.tx_digest,
							timestampMs: new Date(wheel.created_at).getTime(),
							joined: true
						}
					];
				})
			).values()
		);

		return json({ success: true, wheels });
	} catch (e) {
		console.error('[api/wheels/joined] GET error', e);
		const errorMessage = e instanceof Error ? e.message : 'Internal server error';
		return json(
			{ success: false, message: 'Internal server error', error: errorMessage },
			{ status: 500 }
		);
	}
};
