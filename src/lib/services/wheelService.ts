/**
 * Wheel Service
 * Provides unified interface for fetching wheel data via GraphQL or RPC
 */

import { SuiClient } from '@mysten/sui/client';
import { createGraphQLService, type SuiNetwork } from './suiGraphQL.js';
import { extractCoinTypeFromObjectType } from '../utils/wheelHelpers.js';
import type { WheelDataSource } from '../types/wheel.js';

export interface WheelData {
	fields: Record<string, unknown>;
	objectType: string;
	coinType: string | null;
	createdAtMs?: number;
}

/**
 * Fetch wheel object using GraphQL
 */
export async function fetchWheelWithGraphQL(
	wheelId: string,
	network: SuiNetwork
): Promise<WheelData | null> {
	const suiGQL = createGraphQLService(network);
	const obj = await suiGQL.getObject(wheelId);

	if (!obj) return null;

	const contents = obj.asMoveObject?.contents;
	if (!contents) return null;

	const objectType = contents.type?.repr || '';
	const json = contents.json as Record<string, unknown> | undefined;
	if (!json) return null;

	const coinType = extractCoinTypeFromObjectType(objectType);

	// Get creation timestamp from previousTransaction if available
	let createdAtMs: number | undefined;
	try {
		const timestamp = obj.previousTransaction?.effects?.timestamp;
		if (timestamp) {
			createdAtMs = new Date(timestamp).getTime();
		}
	} catch {}

	return { fields: json, objectType, coinType, createdAtMs };
}

/**
 * Fetch wheel object using JSON-RPC (fallback)
 */
export async function fetchWheelWithRPC(
	wheelId: string,
	suiClient: SuiClient
): Promise<WheelData | null> {
	const res = await suiClient.getObject({
		id: wheelId,
		options: { showContent: true, showOwner: true, showType: true }
	});

	const content = res?.data?.content;
	if (!content || content?.dataType !== 'moveObject') return null;

	const objectType = (content as { type?: string }).type || '';
	const fields = (content as { fields?: Record<string, unknown> }).fields || {};
	const coinType = extractCoinTypeFromObjectType(objectType);

	return { fields, objectType, coinType };
}

/**
 * Fetch wheel with GraphQL first, fallback to RPC
 * @returns WheelData and source ('graphql' | 'rpc' | 'none')
 */
export async function fetchWheel(
	wheelId: string,
	network: SuiNetwork,
	suiClient: SuiClient
): Promise<{ data: WheelData | null; source: WheelDataSource }> {
	// Try GraphQL first
	try {
		const data = await fetchWheelWithGraphQL(wheelId, network);
		if (data) {
			return { data, source: 'graphql' };
		}
	} catch (gqlErr) {
		console.warn('[WheelService] GraphQL failed, falling back to RPC:', gqlErr);
	}

	// Fallback to RPC
	try {
		const data = await fetchWheelWithRPC(wheelId, suiClient);
		if (data) {
			return { data, source: 'rpc' };
		}
	} catch (rpcErr) {
		console.error('[WheelService] RPC also failed:', rpcErr);
	}

	return { data: null, source: 'none' };
}
