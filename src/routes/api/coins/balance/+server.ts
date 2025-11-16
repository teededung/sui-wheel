/**
 * API endpoint for fetching coin balance
 * GET /api/coins/balance?address={address}&coinType={coinType}
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createTestnetCoinService } from '$lib/services/coinService';
import { CoinError, CoinErrorType, DEFAULT_COIN_TYPE } from '$lib/utils/coinHelpers';

export const GET: RequestHandler = async ({ url }) => {
	const address = url.searchParams.get('address');
	const coinType = url.searchParams.get('coinType') || DEFAULT_COIN_TYPE;

	// Validate required parameters
	if (!address) {
		return json(
			{
				error: 'Missing required parameter: address',
				message: 'Please provide an address query parameter'
			},
			{ status: 400 }
		);
	}

	try {
		// Create coin service instance
		const coinService = createTestnetCoinService();

		// Fetch balance
		const balance = await coinService.getCoinBalance(address, coinType);

		return json({
			success: true,
			address,
			coinType,
			balance: balance.totalBalance,
			balanceFormatted: balance.formattedBalance,
			coinObjectCount: balance.coinObjectCount
		});
	} catch (error) {
		console.error('Error fetching coin balance:', error);

		// Handle specific coin errors
		if (error instanceof CoinError) {
			const statusCode =
				error.type === CoinErrorType.INVALID_COIN_TYPE
					? 400
					: error.type === CoinErrorType.METADATA_NOT_FOUND
						? 404
						: 500;

			return json(
				{
					error: error.type,
					message: error.message,
					coinType: error.coinType
				},
				{ status: statusCode }
			);
		}

		// Generic error
		const err = error as { message?: string } | Error;
		return json(
			{
				error: 'FETCH_ERROR',
				message: err?.message || String(error)
			},
			{ status: 500 }
		);
	}
};
