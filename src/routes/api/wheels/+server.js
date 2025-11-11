import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	try {
		const body = await request.json();
		const {
			wheelId,
			txDigest,
			packageId,
			organizerAddress,
			prizesMist = [],
			totalDonationMist = null,
			network = 'testnet',
			orderedEntries = []
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
				prizes_mist: prizesMist,
				total_donation_mist: totalDonationMist,
				network
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

			const rows = orderedEntries.map((entry, idx) => ({
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
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, locals }) {
	try {
		const wheelId = url.searchParams.get('wheelId');
		if (!wheelId) {
			return json({ success: false, message: 'Missing wheelId' }, { status: 400 });
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

		return json({ success: true, entries: (entries ?? []).map(r => r.entry_address) });
	} catch (e) {
		console.error('[api/wheels] GET error', e);
		return json({ success: false, message: 'Internal server error' }, { status: 500 });
	}
}
