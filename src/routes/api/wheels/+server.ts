import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = (await request.json()) as {
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

		const organizerAddressNormalized = String(organizerAddress).toLowerCase();

		// Upsert wheel + replace entries transactionally for idempotency
		await locals.prisma.$transaction(async (tx) => {
			await tx.wheel.upsert({
				where: { wheelId },
				create: {
					wheelId,
					txDigest,
					packageId,
					organizerAddress: organizerAddressNormalized,
					prizes: prizeAmounts.map(String),
					totalDonation: totalDonationAmount,
					network,
					coinType
				},
				update: {
					txDigest,
					packageId,
					organizerAddress: organizerAddressNormalized,
					prizes: prizeAmounts.map(String),
					totalDonation: totalDonationAmount,
					network,
					coinType
				}
			});

			// Replace all entries (even if empty) to keep behavior deterministic
			await tx.wheelEntry.deleteMany({ where: { wheelId } });
			if (Array.isArray(orderedEntries) && orderedEntries.length > 0) {
				await tx.wheelEntry.createMany({
					data: orderedEntries.map((entry: string, idx: number) => ({
						wheelId,
						entryAddress: String(entry).toLowerCase(),
						entryIndex: idx
					}))
				});
			}
		});

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

		const wheel = await locals.prisma.wheel.findUnique({
			where: { wheelId },
			select: { coinType: true }
		});

		const entries = await locals.prisma.wheelEntry.findMany({
			where: { wheelId },
			select: { entryAddress: true },
			orderBy: { entryIndex: 'asc' }
		});

		return json({
			success: true,
			entries: entries.map((r) => r.entryAddress),
			coinType: wheel?.coinType || '0x2::sui::SUI'
		});
	} catch (e) {
		console.error('[api/wheels] GET error', e);
		return json({ success: false, message: 'Internal server error' }, { status: 500 });
	}
};
