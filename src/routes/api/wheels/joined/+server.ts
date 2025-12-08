import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const address = url.searchParams.get('address')?.toLowerCase();
		// Optional: filter by specific wheelIds (comma-separated)
		const wheelIdsParam = url.searchParams.get('wheelIds');
		const wheelIds = wheelIdsParam ? wheelIdsParam.split(',').filter(Boolean) : null;

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

		// If wheelIds provided, just check which ones user has joined (fast path)
		if (wheelIds && wheelIds.length > 0) {
			const { data, error } = await locals.supabaseAdmin
				.from('wheel_entries')
				.select('wheel_id')
				.eq('entry_address', address)
				.in('wheel_id', wheelIds)
				.limit(10000);

			if (error) {
				console.error('[api/wheels/joined] Supabase error (check mode)', error);
				return json(
					{ success: false, message: 'Failed to check joined wheels', error: error.message },
					{ status: 500 }
				);
			}

			const joinedIds = Array.from(
				new Set((data || []).map((r: { wheel_id: string }) => String(r.wheel_id)))
			);
			return json({ success: true, joinedIds });
		}

		// Otherwise, get all wheels that the user has joined (with full info)
		const { data, error } = await locals.supabaseAdmin
			.from('wheel_entries')
			.select(
				`
				wheel_id,
				wheels!inner (
					wheel_id,
					tx_digest,
					created_at,
					prizes,
					total_donation,
					coin_type
				)
			`
			)
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
