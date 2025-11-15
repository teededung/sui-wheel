import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSuiBalance } from '$lib/server/suiHelpers.js';

export const GET: RequestHandler = async ({ url }) => {
	const address = url.searchParams.get('address');

	if (!address) {
		return json({ error: 'Missing required parameter: address' }, { status: 400 });
	}

	try {
		const balance = await getSuiBalance(address);

		return json({
			success: true,
			address,
			balance,
			balanceFormatted: balance.toFixed(4)
		});
	} catch (error) {
		console.error('Error fetching wallet balance:', error);
		const err = error as { message?: string } | Error;

		return json(
			{
				error: 'Failed to fetch wallet balance',
				message: err?.message || String(error)
			},
			{ status: 500 }
		);
	}
};
