import { json } from '@sveltejs/kit';
import { Rettiwt } from 'rettiwt-api';
import { env } from '$env/dynamic/private';
import { isValidSuiAddress } from '$lib/utils/suiHelpers.js';

/**
 * Extract Tweet ID from input which can be:
 * - Direct Tweet ID (digits)
 * - X/Twitter URL (twitter.com|x.com)/.../status/<id>
 */
function extractTweetId(rawInput: unknown): string {
	const input = String(rawInput || '').trim();
	if (!input) return '';

	// If only digits, assume it's already the tweet id
	if (/^\d{5,}$/.test(input)) return input;

	try {
		const url = new URL(input);
		// Path like: /<user>/status/<id>
		const parts = url.pathname.split('/').filter(Boolean);
		const statusIdx = parts.findIndex((p) => p.toLowerCase() === 'status');
		if (statusIdx !== -1 && parts[statusIdx + 1] && /^\d{5,}$/.test(parts[statusIdx + 1])) {
			return parts[statusIdx + 1];
		}
	} catch {}

	// Fallback: regex for status/<id>
	const m = input.match(/status\/(\d{5,})/i);
	if (m && m[1]) return m[1];

	return '';
}

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json().catch(() => ({}))) as {
			id?: string;
			url?: string;
			input?: string;
		};
		const candidate = body?.id ?? body?.url ?? body?.input ?? '';
		const tweetId = extractTweetId(candidate);

		if (!tweetId) {
			return json({ success: false, error: 'Missing or invalid tweet id/url' }, { status: 400 });
		}

		const xApiKey = env.X_API_KEY;
		if (!xApiKey) {
			console.log('[import-x-post] disabled: missing X_API_KEY');
			return json({ success: false, error: 'X API key is not set' }, { status: 501 });
		}

		const rettiwt = new Rettiwt({ apiKey: xApiKey });
		let replies = [];

		try {
			// Get tweet details and expected replies
			const tweetDetails = await rettiwt.tweet.details(tweetId);
			const expectedCount = Number(tweetDetails?.replyCount ?? 0);

			// Pagination loop to collect all replies
			let cursor = undefined;
			const seenIds = new Set();
			while (true) {
				const page = await rettiwt.tweet.replies(tweetId, cursor);
				const list = Array.isArray(page?.list) ? page.list : [];

				if (!list.length) break;

				for (const item of list) {
					const tweetItem = item as unknown as {
						id?: string;
						tweetId?: string;
						[key: string]: unknown;
					};
					const id = String(tweetItem?.id ?? tweetItem?.tweetId ?? '');
					if (!id || seenIds.has(id)) continue;
					seenIds.add(id);
					replies.push(item);
				}

				if (!page?.next) break;
				if (expectedCount > 0 && replies.length >= expectedCount) break;
				cursor = page.next;
			}

			console.log(
				'[import-x-post] final replies count:',
				replies.length,
				'expected:',
				expectedCount
			);

			// Sort replies by createdAt ascending (earliest first)
			replies.sort((a: { createdAt?: unknown }, b: { createdAt?: unknown }) => {
				const aMs = Date.parse(String(a?.createdAt ?? ''));
				const bMs = Date.parse(String(b?.createdAt ?? ''));
				return (Number.isNaN(aMs) ? Infinity : aMs) - (Number.isNaN(bMs) ? Infinity : bMs);
			});

			// Extract SUI addresses from reply texts (chronological order)
			const addressRegex = /0x[a-fA-F0-9]{64}/g;
			const addressesAll: string[] = [];
			for (const item of replies) {
				const tweetItem = item as unknown as {
					fullText?: string;
					text?: string;
					legacy?: { full_text?: string };
					[key: string]: unknown;
				};
				const textCandidates = [tweetItem?.fullText, tweetItem?.text, tweetItem?.legacy?.full_text];
				const sourceText = String(
					textCandidates.find((v) => typeof v === 'string' && v.length > 0) || ''
				);
				if (!sourceText) continue;
				const matches = sourceText.match(addressRegex) || [];
				const firstValid = matches.find((m) => isValidSuiAddress(m));
				if (firstValid) addressesAll.push(firstValid);
			}
			// Unique addresses, preserve first appearance order
			const seenLower = new Set();
			const addresses = [];
			for (const addr of addressesAll) {
				const k = addr.toLowerCase();
				if (!seenLower.has(k)) {
					seenLower.add(k);
					addresses.push(addr);
				}
			}

			// Limit to first 200 addresses
			if (addresses.length > 200) {
				addresses.length = 200;
			}

			// Log summary before responding
			console.log('[import-x-post] returning', {
				id: tweetId,
				expected: expectedCount,
				count: replies.length - 1,
				addresses: addresses.length
			});

			return json({
				success: true,
				id: tweetId,
				expected: expectedCount,
				count: replies.length - 1,
				data: replies,
				addresses
			});
		} catch (err) {
			console.error('[import-x-post] Rettiwt error:', err);
			const error = err as { message?: string } | Error;
			return json(
				{
					success: false,
					error: 'Failed to fetch tweet replies',
					message: error?.message || String(err)
				},
				{ status: 502 }
			);
		}
	} catch (e) {
		console.error('[import-x-post] Unexpected server error:', e);
		const error = e as { message?: string } | Error;
		return json(
			{
				success: false,
				error: 'Unexpected server error',
				message: error?.message || String(e)
			},
			{ status: 500 }
		);
	}
};
