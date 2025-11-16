import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = await request.json() as {
			wheelId?: string;
			txDigest?: string;
			packageId?: string;
			organizerAddress?: string;
			prizeAmounts?: string[];
			totalDonationAmount?: string | null;
			network?: string;
			orderedEntries?: string[];
			coinType?: string;
		};
		const {
			wheelId,
			txDigest,
			packageId,
			organizerAddress,
			prizeAmounts = [],
			totalDonationAmount = null,
			network = 'testnet',
			orderedEntries = [],
			coinType = '0x2::sui::SUI'
		} = body ?? {};

		if (!wheelId || !txDigest || !packageId || !organizerAddress) {
			return json({ success: false, message: 'Missing required fields' }, { status: 400 });
		}

		// Upsert wheel row
		const { error: wheelErr } = await locals.supabaseAdmin.from('wheels').upsert(
			{
				wheel_id: wheelId,
				tx_digest: txDigest,
				package_id: packageId,
				organizer_address: organizerAddress,
				prizes: prizeAmounts,
				total_donation: totalDonationAmount,
				network,
				coin_type: coinType
			},
			{ onConflict: 'wheel_id' }
		);

		if (wheelErr) {
			console.error('[api/wheels] upsert wheel error', wheelErr);
			return json({ success: false, message: 'Failed to save wheel' }, { status: 500 });
		}

		// Insert ordered entries (clear previous first)
		if (Array.isArray(orderedEntries) && orderedEntries.length > 0) {
			// Delete existing entries for idempotency
			const { error: delErr } = await locals.supabaseAdmin
				.from('wheel_entries')
				.delete()
				.eq('wheel_id', wheelId);
			if (delErr) {
				console.error('[api/wheels] delete entries error', delErr);
			}

			const rows = orderedEntries.map((entry: string, idx: number) => ({
				wheel_id: wheelId,
				entry_address: String(entry),
				entry_index: idx
			}));
			const { error: insErr } = await locals.supabaseAdmin.from('wheel_entries').insert(rows);
			if (insErr) {
				console.error('[api/wheels] insert entries error', insErr);
				return json({ success: false, message: 'Failed to save entries' }, { status: 500 });
			}
		}

		return json({ success: true });
	} catch (err) {
		console.error('[api/wheels] POST error', err);
		return json({ success: false, message: 'Internal server error' }, { status: 500 });
	}
};

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const wheelId = url.searchParams.get('wheelId');
		if (!wheelId) {
			return json({ success: false, message: 'Missing wheelId' }, { status: 400 });
		}

		// Get wheel info including coin_type
		const { data: wheel, error: wheelErr } = await locals.supabaseAdmin
			.from('wheels')
			.select('coin_type')
			.eq('wheel_id', wheelId)
			.single();

		if (wheelErr) {
			console.error('[api/wheels] GET wheel error', wheelErr);
		}

		const { data: entries, error: err } = await locals.supabaseAdmin
			.from('wheel_entries')
			.select('entry_address, entry_index')
			.eq('wheel_id', wheelId)
			.order('entry_index', { ascending: true });

		if (err) {
			console.error('[api/wheels] GET entries error', err);
			return json({ success: false, message: 'Failed to fetch entries' }, { status: 500 });
		}

		return json({ 
			success: true, 
			entries: (entries ?? []).map((r: { entry_address: string }) => r.entry_address),
			coinType: wheel?.coin_type || '0x2::sui::SUI'
		});
	} catch (e) {
		console.error('[api/wheels] GET error', e);
		return json({ success: false, message: 'Internal server error' }, { status: 500 });
	}
};
