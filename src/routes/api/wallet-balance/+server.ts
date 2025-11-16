import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSuiBalance } from '$lib/server/suiHelpers.js';
import { createTestnetCoinService } from '$lib/services/coinService';
import { CoinError, DEFAULT_COIN_TYPE } from '$lib/utils/coinHelpers';

export const GET: RequestHandler = async ({ url }) => {
	const address = url.searchParams.get('address');
	const coinType = url.searchParams.get('coinType');

	if (!address) {
		return json({ error: 'Missing required parameter: address' }, { status: 400 });
	}

	try {
		// If coinType is provided, use the new coin service
		if (coinType && coinType !== DEFAULT_COIN_TYPE) {
			const coinService = createTestnetCoinService();
			const balance = await coinService.getCoinBalance(address, coinType);

			return json({
				success: true,
				address,
				coinType,
				balance: balance.totalBalance,
				balanceFormatted: balance.formattedBalance
			});
		}

		// Default to SUI balance (backward compatibility)
		const balance = await getSuiBalance(address);

		return json({
			success: true,
			address,
			coinType: DEFAULT_COIN_TYPE,
			balance,
			balanceFormatted: balance.toFixed(4)
		});
	} catch (error) {
		console.error('Error fetching wallet balance:', error);

		// Handle coin errors
		if (error instanceof CoinError) {
			return json(
				{
					error: error.type,
					message: error.message
				},
				{ status: 500 }
			);
		}

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
