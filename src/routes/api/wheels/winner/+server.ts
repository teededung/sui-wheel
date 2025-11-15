import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = await request.json() as {
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

		const row: {
			wheel_id: string;
			winner_address: string;
			prize_index: number;
			spin_tx_digest: string;
			spin_time?: string;
		} = {
			wheel_id: wheelId,
			winner_address: String(winnerAddress).toLowerCase(),
			prize_index: prizeIndex,
			spin_tx_digest: spinTxDigest
		};
		if (spinTime) row.spin_time = new Date(spinTime).toISOString();

		const { error: upsertErr } = await locals.supabaseAdmin
			.from('wheel_winners')
			.upsert(row, { onConflict: 'wheel_id,prize_index' });

		if (upsertErr) {
			console.error('[api/wheels/winner] upsert error', upsertErr);
			return json({ success: false, message: 'Failed to save winner' }, { status: 500 });
		}

		return json({ success: true });
	} catch (err) {
		console.error('[api/wheels/winner] POST error', err);
		return json({ success: false, message: 'Internal server error' }, { status: 500 });
	}
};
