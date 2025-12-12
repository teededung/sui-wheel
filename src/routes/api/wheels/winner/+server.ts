import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = (await request.json()) as {
			wheelId?: string;
			winnerAddress?: string;
			prizeIndex?: number;
			spinTxDigest?: string;
			spinTime?: string;
		};
		const {
			wheelId,
			winnerAddress,
			prizeIndex,
			spinTxDigest,
			spinTime // optional ISO string
		} = body ?? {};

		if (!wheelId || !winnerAddress || typeof prizeIndex !== 'number' || !spinTxDigest) {
			return json({ success: false, message: 'Missing required fields' }, { status: 400 });
		}

		// Backup DB is optional. If DATABASE_URL is not configured, no-op and keep onchain flow working.
		if (!locals.prisma) return json({ success: true, skippedDb: true });

		const winnerAddressNormalized = String(winnerAddress).toLowerCase();
		const spinTimeDate = spinTime ? new Date(spinTime) : undefined;

		await locals.prisma.wheelWinner.upsert({
			where: { wheelId_prizeIndex: { wheelId, prizeIndex } },
			create: {
				wheelId,
				winnerAddress: winnerAddressNormalized,
				prizeIndex,
				spinTxDigest,
				...(spinTimeDate ? { spinTime: spinTimeDate } : {})
			},
			update: {
				winnerAddress: winnerAddressNormalized,
				// Do not update spinTxDigest. It is @unique and represents the original spin transaction.
				...(spinTimeDate ? { spinTime: spinTimeDate } : {})
			}
		});

		return json({ success: true });
	} catch (err) {
		console.error('[api/wheels/winner] POST error', err);
		return json({ success: false, message: 'Internal server error' }, { status: 500 });
	}
};
