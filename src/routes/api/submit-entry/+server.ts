import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isValidSuiAddress } from '$lib/utils/suiHelpers.js';
import { MAX_ENTRIES } from '$lib/constants.js';

interface WheelMetadata {
	createdAt: number;
	endTime?: number;
	duration?: number;
}

// In-memory storage for demo purposes
// In production, you'd use a database
const wheelEntries = new Map<string, string[]>();

// Auto-cleanup system for expired wheels
const wheelMetadata = new Map<string, WheelMetadata>(); // Store metadata like creation time and duration

// Cleanup expired wheels every 30 minutes
setInterval(
	() => {
		const now = Date.now();
		for (const [wheelId, metadata] of wheelMetadata.entries()) {
			if (metadata.endTime && now > metadata.endTime) {
				console.log(`Auto-cleaning expired wheel: ${wheelId}`);
				wheelEntries.delete(wheelId);
				wheelMetadata.delete(wheelId);
			}
		}
	},
	30 * 60 * 1000
);

export const POST: RequestHandler = async ({ request, url }) => {
	try {
		// Check if this is a clear request (GET-style parameters in POST)
		const clear = url.searchParams.get('clear');
		if (clear === 'true') {
			const wheelId = url.searchParams.get('wheelId');
			if (!wheelId) {
				return json({ success: false, message: 'Missing wheelId' }, { status: 400 });
			}
			wheelEntries.delete(wheelId);
			wheelMetadata.delete(wheelId);
			return json({
				success: true,
				message: 'Data cleared successfully'
			});
		}

		let requestData: {
			wheelId?: string;
			entry?: string;
			entryType?: string;
		};
		try {
			requestData = await request.json();
		} catch (error) {
			console.error('Failed to parse request JSON:', error);
			return json({ success: false, message: 'Invalid request format' }, { status: 400 });
		}

		const { wheelId, entry, entryType } = requestData;

		// Validate input
		if (!wheelId || !entry || !entryType) {
			return json({ success: false, message: 'Missing required fields' }, { status: 400 });
		}

		if (entryType === 'address' && !isValidSuiAddress(entry)) {
			return json({ success: false, message: 'Invalid Sui address' }, { status: 400 });
		}

		if (entryType === 'name' && (entry.length < 1 || entry.length > 50)) {
			return json({ success: false, message: 'Name must be 1-50 characters' }, { status: 400 });
		}

		const trimmedEntry = entry.trim();

		if (entryType === 'email') {
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(trimmedEntry)) {
				return json({ success: false, message: 'Invalid email address' }, { status: 400 });
			}
		}

		// Get existing entries for this wheel
		if (!wheelEntries.has(wheelId)) {
			wheelEntries.set(wheelId, []);
		}

		// Check if wheel has expired
		const metadata = wheelMetadata.get(wheelId);
		if (metadata && metadata.endTime && Date.now() > metadata.endTime) {
			return json({ success: false, message: 'Entry form has expired' }, { status: 400 });
		}

		const existingEntries = wheelEntries.get(wheelId);
		if (!existingEntries) {
			return json({ success: false, message: 'Wheel not found' }, { status: 400 });
		}

		// Check if wheel is full (MAX_ENTRIES entries limit)
		if (existingEntries.length >= MAX_ENTRIES) {
			return json(
				{ success: false, message: `Wheel is full (${MAX_ENTRIES} entries limit reached)` },
				{ status: 400 }
			);
		}

		// Check for duplicates
		if (existingEntries.includes(trimmedEntry)) {
			return json({ success: false, message: 'Entry already exists' }, { status: 400 });
		}

		// Add new entry
		existingEntries.push(trimmedEntry);

		return json({
			success: true,
			message: 'Entry submitted successfully',
			entry: trimmedEntry,
			entryType,
			totalEntries: existingEntries.length
		});
	} catch (error) {
		console.error('Submit entry error:', error);
		return json({ success: false, message: 'Internal server error' }, { status: 500 });
	}
};

export const GET: RequestHandler = async ({ url }) => {
	try {
		const wheelId = url.searchParams.get('wheelId');
		const clear = url.searchParams.get('clear');

		if (!wheelId) {
			return json({ success: false, message: 'Missing wheelId' }, { status: 400 });
		}

		// Clear data if requested
		if (clear === 'true') {
			wheelEntries.delete(wheelId);
			wheelMetadata.delete(wheelId);
			return json({
				success: true,
				message: 'Data cleared successfully'
			});
		}

		// Register wheel metadata if provided
		const duration = url.searchParams.get('duration');
		if (duration) {
			const durationMs = parseInt(duration) * 60 * 1000; // Convert minutes to milliseconds
			wheelMetadata.set(wheelId, {
				createdAt: Date.now(),
				endTime: Date.now() + durationMs,
				duration: parseInt(duration)
			});
		}

		const entries = wheelEntries.get(wheelId) || [];

		return json({
			success: true,
			entries,
			count: entries.length
		});
	} catch (error) {
		console.error('Get entries error:', error);
		return json({ success: false, message: 'Internal server error' }, { status: 500 });
	}
};
