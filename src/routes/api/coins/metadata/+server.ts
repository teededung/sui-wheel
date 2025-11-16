/**
 * API endpoint for fetching coin metadata
 * GET /api/coins/metadata?coinType={coinType}
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createTestnetCoinService } from '$lib/services/coinService';
import { CoinError, CoinErrorType } from '$lib/utils/coinHelpers';

export const GET: RequestHandler = async ({ url }) => {
	const coinType = url.searchParams.get('coinType');

	// Validate required parameter
	if (!coinType) {
		return json(
			{
				error: 'Missing required parameter: coinType',
				message: 'Please provide a coinType query parameter'
			},
			{ status: 400 }
		);
	}

	try {
		// Create coin service instance
		const coinService = createTestnetCoinService();

		// Fetch metadata
		const metadata = await coinService.getCoinMetadata(coinType);

		return json({
			success: true,
			metadata
		});
	} catch (error) {
		console.error('Error fetching coin metadata:', error);

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
