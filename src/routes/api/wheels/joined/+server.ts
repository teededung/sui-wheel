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

		const addressNormalized = address.toLowerCase();

		// If wheelIds provided, just check which ones user has joined (fast path)
		if (wheelIds && wheelIds.length > 0) {
			const data = await locals.prisma.wheelEntry.findMany({
				where: { entryAddress: addressNormalized, wheelId: { in: wheelIds } },
				select: { wheelId: true },
				take: 10000
			});

			const joinedIds = Array.from(new Set((data || []).map((r) => String(r.wheelId))));
			return json({ success: true, joinedIds });
		}

		// Otherwise, get all wheels that the user has joined (with full info)
		const data = await locals.prisma.wheel.findMany({
			where: {
				entries: {
					some: {
						entryAddress: addressNormalized
					}
				}
			},
			select: {
				wheelId: true,
				txDigest: true,
				createdAt: true
			},
			orderBy: { createdAt: 'desc' },
			take: 50
		});

		const wheels = (data ?? []).map((wheel) => ({
			id: wheel.wheelId,
			digest: wheel.txDigest,
			timestampMs: new Date(wheel.createdAt).getTime(),
			joined: true
		}));

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
