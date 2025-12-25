<script lang="ts">
	import { onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import { useSuiClient, useCurrentAccount, accountLoading } from 'sui-svelte-wallet-kit';
	import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
	import { formatDistanceToNow, format } from 'date-fns';
	import { shortenAddress } from '$lib/utils/string.js';
	import { isTestnet, getExplorerLink, getNetworkDisplayName } from '$lib/utils/suiHelpers.js';
	import {
		NETWORK,
		LATEST_PACKAGE_ID,
		WHEEL_MODULE,
		WHEEL_FUNCTIONS,
		WHEEL_STRUCT
	} from '$lib/constants.js';
	import { createGraphQLService, type SuiNetwork } from '$lib/services/suiGraphQL.js';
	import { watch, IsIdle } from 'runed';
	import { useTranslation } from '$lib/hooks/useTranslation.js';
	import type { WheelDataSource, ExtendedWheelDataSource } from '$lib/types/wheel.js';
	import { dev } from '$app/environment';

	import AlertTestnetWarning from '$lib/components/AlertTestnetWarning.svelte';
	import DataSourceBadge from '$lib/components/DataSourceBadge.svelte';
	import ButtonConnectWallet from '$lib/components/ButtonConnectWallet.svelte';

	type WheelRow = {
		id: string;
		digest?: string;
		timestampMs: number;
		status?: string;
		remainingSpins?: number;
		totalEntries?: number;
		joined?: boolean;
	};

	const t = useTranslation();

	const account = $derived(useCurrentAccount());
	let isOnTestnet = $derived.by(() => {
		if (!account || !account.chains) return false;
		return isTestnet({ chains: account.chains });
	});
	const currentNetwork = $derived.by(() => {
		return getNetworkDisplayName(NETWORK, { lowercase: true });
	});

	const suiClient = $derived(
		account && isOnTestnet ? useSuiClient() : new SuiClient({ url: getFullnodeUrl('testnet') })
	);

	let pageState = $state('initializing'); // initializing, loading, loaded
	let wheels = $state<
		Array<{
			id: string;
			digest?: string;
			timestampMs: number;
			status?: string;
			remainingSpins?: number;
			totalEntries?: number;
		}>
	>([]);
	let _pollInterval = $state<ReturnType<typeof setInterval> | null>(null);
	let refreshing = $state(false);

	// Joined wheels list fetched from DB (latest 10)
	let joinedWheels = $state<
		Array<{
			id: string;
			digest?: string;
			timestampMs: number;
			status?: string;
			remainingSpins?: number;
			totalEntries?: number;
		}>
	>([]);
	let joinedWheelsPageState = $state('initializing'); // initializing, loading, loaded
	let joinedWheelsDbStatus = $state<'success' | 'failed' | 'unknown'>('unknown');
	let joinedWheelsFallbackUsed = $state(false);
	let joinedWheelsWarning = $state('');
	let joinedWheelsSource = $state<ExtendedWheelDataSource>('none');

	// Public wheels state (server-provided)
	const { data } = $props();
	let publicWheelsPageState = $state('initializing'); // may be streamed from server
	let publicWheelsSource = $state<WheelDataSource>('none');
	let publicWheels = $state<
		Array<{
			id: string;
			digest?: string;
			timestampMs: number;
			status?: string;
			remainingSpins?: number;
			totalEntries?: number;
		}>
	>([]); // [{ id, digest, timestampMs, status, remainingSpins, totalEntries }]

	// Your wheels source tracking
	let yourWheelsSource = $state<WheelDataSource>('none');

	// Initialize/stream public wheels from server data (supports deferred promises)
	let publicWheelsLoadSeq = 0;
	$effect(() => {
		const wheelsOrPromise = data?.publicWheels;
		const sourceOrPromise = data?.publicWheelsSource;

		// No server data at all (shouldn't happen), keep defaults
		if (wheelsOrPromise === undefined && sourceOrPromise === undefined) return;

		publicWheelsPageState = 'loading';
		publicWheelsLoadSeq += 1;
		const seq = publicWheelsLoadSeq;

		void Promise.all([Promise.resolve(wheelsOrPromise), Promise.resolve(sourceOrPromise)])
			.then(([wheelsResolved, sourceResolved]) => {
				if (seq !== publicWheelsLoadSeq) return;
				publicWheels = Array.isArray(wheelsResolved) ? wheelsResolved : [];
				publicWheelsSource = (sourceResolved as WheelDataSource) || 'none';
			})
			.catch(() => {
				if (seq !== publicWheelsLoadSeq) return;
				publicWheels = [];
				publicWheelsSource = 'none';
			})
			.finally(() => {
				if (seq !== publicWheelsLoadSeq) return;
				publicWheelsPageState = 'loaded';
			});
	});

	// Load wheels using GraphQL
	async function loadWheelsWithGraphQL(
		address: string
	): Promise<Array<{ id: string; digest?: string; timestampMs: number }>> {
		const suiGQL = createGraphQLService(currentNetwork as SuiNetwork);
		const txResult = await suiGQL.getTransactionsBySenderAndFunction(
			address,
			LATEST_PACKAGE_ID,
			WHEEL_MODULE,
			WHEEL_FUNCTIONS.CREATE,
			50
		);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const transactions = (txResult as any)?.nodes || [];
		const items: Array<{ id: string; digest?: string; timestampMs: number }> = [];

		for (const tx of transactions) {
			const objectChanges = tx?.effects?.objectChanges?.nodes || [];
			const timestampMs = tx?.effects?.timestamp ? new Date(tx.effects.timestamp).getTime() : 0;

			for (const change of objectChanges) {
				const outputState = change?.outputState;
				if (!outputState?.address) continue;

				const objectType = outputState?.asMoveObject?.contents?.type?.repr || '';
				if (objectType.includes(`::${WHEEL_MODULE}::${WHEEL_STRUCT}`)) {
					items.push({
						id: outputState.address,
						digest: tx?.digest,
						timestampMs
					});
					break;
				}
			}
		}
		return items;
	}

	// Load wheels using JSON-RPC (fallback)
	async function loadWheelsWithRPC(
		address: string
	): Promise<Array<{ id: string; digest?: string; timestampMs: number }>> {
		const response = await suiClient.queryTransactionBlocks({
			filter: {
				MoveFunction: {
					package: LATEST_PACKAGE_ID,
					module: WHEEL_MODULE,
					function: WHEEL_FUNCTIONS.CREATE
				}
			},
			options: {
				showObjectChanges: true,
				showInput: true,
				showEffects: false,
				showEvents: false
			},
			order: 'descending',
			limit: 50
		});

		const transactions = response?.data || [];
		const senderLc = String(address).toLowerCase();
		const items: Array<{ id: string; digest?: string; timestampMs: number }> = [];

		for (const tx of transactions) {
			const txData = tx?.transaction?.data as { sender?: string } | undefined;
			const txSender = String(txData?.sender || '').toLowerCase();
			if (txSender !== senderLc) continue;

			const objectChanges = tx?.objectChanges || [];
			for (const ch of objectChanges) {
				const change = ch as { type?: string; objectType?: string; objectId?: string };
				if (change?.type === 'created') {
					const objectType = String(change?.objectType || '');
					if (objectType.includes(`::${WHEEL_MODULE}::${WHEEL_STRUCT}`)) {
						items.push({
							id: change.objectId!,
							digest: tx?.digest,
							timestampMs: Number(tx?.timestampMs || 0)
						});
						break;
					}
				}
			}
		}
		return items;
	}

	// Enrich wheel items with on-chain status
	async function enrichWheelItems(
		items: Array<{ id: string; digest?: string; timestampMs: number }>
	) {
		if (items.length === 0) return items;

		try {
			const objs = await suiClient.multiGetObjects({
				ids: items.map((i) => i.id),
				options: { showContent: true }
			});
			const idToMeta = new Map();
			for (const o of objs || []) {
				try {
					const id = String(o?.data?.objectId || '');
					const content = o?.data?.content as
						| { dataType?: string; fields?: Record<string, unknown> }
						| undefined;
					const f = (content?.dataType === 'moveObject' ? content?.fields : {}) || {};
					const isCancelled = Boolean(f['is_cancelled']);
					const spunCount = Number(f['spun_count'] || 0);
					const prizesLen = Array.isArray(f['prize_amounts']) ? f['prize_amounts'].length : 0;
					const remainingEntriesCount = Array.isArray(f['remaining_entries'])
						? f['remaining_entries'].length
						: 0;
					const totalEntries = remainingEntriesCount + spunCount;
					const remaining = Math.max(0, prizesLen - spunCount);
					const status = isCancelled ? 'Cancelled' : remaining > 0 ? 'Running' : 'Finished';
					idToMeta.set(id, { status, remainingSpins: remaining, totalEntries });
				} catch {}
			}
			return items.map((it) => ({
				...it,
				...(idToMeta.get(it.id) || { status: '—', remainingSpins: 0, totalEntries: 0 })
			}));
		} catch {
			return items;
		}
	}

	async function loadWheelsFor(address: string, opts: { isRefresh?: boolean } = {}) {
		if (!address) return;
		const isRefresh = Boolean(opts.isRefresh);
		if (!isRefresh) pageState = 'loading';

		try {
			let items: Array<{ id: string; digest?: string; timestampMs: number }> = [];

			// Try GraphQL first (for Sui GraphQL challenge)
			try {
				items = await loadWheelsWithGraphQL(address);
				yourWheelsSource = 'graphql';
			} catch (gqlErr) {
				if (dev) {
					console.warn('[WheelList] GraphQL failed, falling back to RPC:', gqlErr);
				}
				items = await loadWheelsWithRPC(address);
				yourWheelsSource = 'rpc';
			}

			// Enrich with on-chain status
			wheels = await enrichWheelItems(items);
		} catch {
			yourWheelsSource = 'none';
			// Error loading wheels
		} finally {
			if (!isRefresh) pageState = 'loaded';
			refreshing = false;
		}
	}

	async function loadJoinedWheels(address: string, opts: { isRefresh?: boolean } = {}) {
		const isRefresh = Boolean(opts.isRefresh);
		if (!isRefresh) joinedWheelsPageState = 'loading';
		try {
			const addr = String(address || '').toLowerCase();

			if (!addr) {
				joinedWheels = [];
				if (!isRefresh) joinedWheelsPageState = 'loaded';
				return;
			}

			// Reset debug status
			joinedWheelsDbStatus = 'unknown';
			joinedWheelsFallbackUsed = false;
			joinedWheelsWarning = '';
			joinedWheelsSource = 'none';

			let joinedIds = new Set<string>();
			let dbWheels: Array<{ id: string; digest?: string; timestampMs: number }> = [];
			let dbCheckSucceeded = false;

			// Fetch joined wheels from database
			try {
				const resp = await fetch(`/api/wheels/joined?address=${encodeURIComponent(addr)}`);

				if (resp?.ok) {
					const data = await resp.json();

					if (data?.success) {
						// API returns either { wheels: [...] } or { joinedIds: [...] }
						if (Array.isArray(data?.wheels)) {
							dbWheels = data.wheels;
							joinedIds = new Set(dbWheels.map((w: any) => w.id));
						} else if (Array.isArray(data?.joinedIds)) {
							joinedIds = new Set((data.joinedIds || []).map(String));
						}
						dbCheckSucceeded = true;
						joinedWheelsDbStatus = 'success';
						joinedWheelsSource = 'offchain backup';
					}
				}
			} catch {
				joinedWheelsDbStatus = 'failed';
			}

			// Final fallback: check on-chain for visible wheels
			if (!dbCheckSucceeded) {
				const allIds = [...(wheels || []), ...(publicWheels || [])].map((w) => w.id);
				const uniqueIds = Array.from(new Set(allIds)).filter(Boolean);

				if (uniqueIds.length > 0) {
					joinedWheelsFallbackUsed = true;

					// Helper: check if user participated in wheel from fields
					const checkUserParticipation = (
						wheelId: string,
						fields: Record<string, unknown>,
						userAddr: string
					): boolean => {
						// Skip cancelled wheels
						if (Boolean(fields['is_cancelled'])) return false;

						// Check winners array
						const winners = Array.isArray(fields['winners']) ? fields['winners'] : [];
						const hasWon = winners.some((winner: any) => {
							try {
								const winnerAddr = String(winner?.fields?.addr || winner?.addr || '').toLowerCase();
								return winnerAddr === userAddr;
							} catch {
								return false;
							}
						});
						if (hasWon) return true;

						// Check remaining_entries
						const entries = Array.isArray(fields['remaining_entries'])
							? fields['remaining_entries']
							: [];
						return entries.some((entry: any) => {
							return String(entry || '').toLowerCase() === userAddr;
						});
					};

					let onChainCheckSucceeded = false;

					// Try GraphQL first
					try {
						const suiGQL = createGraphQLService(currentNetwork as SuiNetwork);
						const gqlObjs = await suiGQL.getMultipleObjects(uniqueIds);

						if (gqlObjs.length > 0) {
							for (const obj of gqlObjs) {
								try {
									const wheelId = obj?.address || '';
									const json = obj?.asMoveObject?.contents?.json as Record<string, unknown>;
									if (!json) continue;

									if (checkUserParticipation(wheelId, json, addr)) {
										joinedIds.add(wheelId);
									}
								} catch {}
							}
							onChainCheckSucceeded = true;
							joinedWheelsSource = 'graphql';
						}
					} catch (gqlErr) {
						if (dev) {
							console.warn('[loadJoinedWheels] GraphQL failed, falling back to RPC:', gqlErr);
						}
					}

					// Fallback to RPC
					if (!onChainCheckSucceeded) {
						try {
							const objs = await suiClient.multiGetObjects({
								ids: uniqueIds,
								options: { showContent: true }
							});

							const validObjs = objs?.filter((o) => o?.data && o?.data?.content) || [];

							if (validObjs.length === 0) {
								joinedWheelsWarning = 'Database unavailable and wheels not found on-chain.';
							} else {
								for (const o of validObjs) {
									try {
										const wheelId = String(o?.data?.objectId || '');
										const content = o?.data?.content as
											| { dataType?: string; fields?: Record<string, unknown> }
											| undefined;
										const f = (content?.dataType === 'moveObject' ? content?.fields : {}) || {};

										if (checkUserParticipation(wheelId, f, addr)) {
											joinedIds.add(wheelId);
										}
									} catch {}
								}
								onChainCheckSucceeded = true;
								joinedWheelsSource = 'rpc';
							}
						} catch {
							joinedWheelsWarning = 'Database unavailable and on-chain check failed.';
						}
					}

					if (onChainCheckSucceeded && joinedIds.size === 0) {
						joinedWheelsWarning =
							'Database unavailable. Cannot verify joined wheels that are not in the visible list.';
					}
				} else {
					joinedWheelsWarning = 'Database unavailable. No wheels available to check.';
				}
			}

			if (joinedIds.size === 0) {
				joinedWheels = [];
				if (!isRefresh) joinedWheelsPageState = 'loaded';
				return;
			}

			// Use database wheels if available, otherwise use visible wheels
			let baseWheels =
				dbWheels.length > 0
					? dbWheels
					: [...(wheels || []), ...(publicWheels || [])].filter((w) => joinedIds.has(w.id));

			// Deduplicate by wheel ID
			const seenIds = new Set<string>();
			baseWheels = baseWheels.filter((w) => {
				if (seenIds.has(w.id)) return false;
				seenIds.add(w.id);
				return true;
			});

			// Enrich joined list status similar to others
			try {
				const ids = baseWheels.map((w) => w.id);

				const objs = await suiClient.multiGetObjects({
					ids,
					options: { showContent: true }
				});
				const idToMeta = new Map();
				for (const o of objs || []) {
					try {
						const id = String(o?.data?.objectId || '');
						const content = o?.data?.content as
							| { dataType?: string; fields?: Record<string, unknown> }
							| undefined;
						const f = (content?.dataType === 'moveObject' ? content?.fields : {}) || {};
						const isCancelled = Boolean(f['is_cancelled']);
						let spunCount = 0;
						try {
							spunCount = Number(f['spun_count'] || 0);
						} catch {}
						let prizesLen = 0;
						try {
							prizesLen = Array.isArray(f['prize_amounts']) ? f['prize_amounts'].length : 0;
						} catch {}
						let remainingEntriesCount = 0;
						try {
							remainingEntriesCount = Array.isArray(f['remaining_entries'])
								? f['remaining_entries'].length
								: 0;
						} catch {}
						const totalEntries = remainingEntriesCount + spunCount;
						const remaining = Math.max(0, prizesLen - spunCount);
						const status = isCancelled ? 'Cancelled' : remaining > 0 ? 'Running' : 'Finished';
						idToMeta.set(id, { status, remainingSpins: remaining, totalEntries });
					} catch {}
				}
				// Build joined list using base wheels data
				joinedWheels = baseWheels
					.map((w) => ({
						...w,
						joined: true,
						...(idToMeta.get(w.id) || { status: '—', remainingSpins: 0, totalEntries: 0 })
					}))
					.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0)); // Sort by newest first
			} catch {
				// Fallback without enrichment
				joinedWheels = baseWheels
					.map((w) => ({
						...w,
						joined: true
					}))
					.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0)); // Sort by newest first
			}

			// Update joined flags on visible lists
			wheels = wheels.map((w) => ({ ...w, joined: joinedIds.has(w.id) }));
			publicWheels = publicWheels.map((w) => ({ ...w, joined: joinedIds.has(w.id) }));
		} catch {
			joinedWheels = [];
		} finally {
			if (!isRefresh) joinedWheelsPageState = 'loaded';
		}
	}

	function clearJoinedWheelStatus() {
		joinedWheels = [];
		if (wheels.length > 0) {
			wheels = wheels.map((w) => ({ ...w, joined: false }));
		}
		publicWheels = publicWheels.map((w) => ({ ...w, joined: false }));
	}

	const idle = new IsIdle({ timeout: 15000 });

	// Initialize page state on mount (run once)
	let pageStateInitialized = $state(false);
	$effect(() => {
		if (!pageStateInitialized) {
			// If no account and still initializing, mark as loaded
			if (!account && pageState === 'initializing') {
				pageState = 'loaded';
			}
			if (!account && joinedWheelsPageState === 'initializing') {
				joinedWheelsPageState = 'loaded';
			}
			pageStateInitialized = true;
		}
	});

	// Watch for account changes
	watch(
		() => account?.address,
		(curr, prev) => {
			void (async () => {
				// Clear user's wheels and joined wheels status when no account is connected
				if (curr === undefined) {
					wheels = [];
					clearJoinedWheelStatus();
					if (pageState === 'initializing') {
						pageState = 'loaded';
					}
					if (joinedWheelsPageState === 'initializing') {
						joinedWheelsPageState = 'loaded';
					}
					return;
				}

				// Account is connected
				if (curr !== prev) {
					// Clear joined wheel status when account changes
					if (wheels.length > 0 || publicWheels.length > 0) {
						clearJoinedWheelStatus();
					}

					// Only load user's wheels on testnet
					if (isOnTestnet && curr) {
						pageState = 'loading';
						startPolling();
						await loadWheelsFor(curr);
					} else if (!isOnTestnet) {
						// Not on testnet, just mark as loaded
						if (pageState === 'initializing') {
							pageState = 'loaded';
						}
					}

					// Load joined wheels for any network
					if (curr) {
						await loadJoinedWheels(curr);
					}
				}
			})();
		}
	);

	// Watch for idle state
	watch(
		() => idle.current,
		() => {
			if (!isOnTestnet) return;
			if (idle.current) {
				stopPolling();
			} else {
				if (account?.address && !_pollInterval) {
					startPolling();
					refreshNow();
				}
			}
		}
	);

	function startPolling(ms = 10000) {
		if (_pollInterval) return;
		_pollInterval = setInterval(() => refreshNow(), ms) as ReturnType<typeof setInterval> | null;
	}

	function refreshNow() {
		if (!account) return;
		refreshing = true;
		loadWheelsFor(account.address, { isRefresh: true });
	}

	function stopPolling() {
		if (_pollInterval) {
			clearInterval(_pollInterval);
			_pollInterval = null;
		}
	}

	// ensure polling stops on component destroy
	onDestroy(() => {
		stopPolling();
	});
</script>

<svelte:head>
	<title>{t('wheelList.title')}</title>
	<meta name="description" content={t('wheelList.metaDescription')} />
	<meta property="og:title" content={t('wheelList.ogTitle')} />
	<meta property="og:description" content={t('wheelList.ogDescription')} />
</svelte:head>

{#snippet wheelsTable(rows: WheelRow[])}
	<div class="relative">
		<div class="overflow-x-auto">
			<table class="table table-zebra">
				<thead>
					<tr>
						<th class="w-12">{t('wheelList.table.number')}</th>
						<th class="w-48">{t('wheelList.table.wheelId')}</th>
						<th class="w-56">{t('wheelList.table.actions')}</th>
						<th class="w-24">{t('wheelList.table.created')}</th>
						<th class="w-12">{t('wheelList.table.totalEntries')}</th>
						<th>{t('wheelList.table.status')}</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as w, i (w.id)}
						<tr>
							<td>{i + 1}</td>
							<td class="font-mono">
								<a
									href={`${getExplorerLink('testnet', 'object', w.id)}`}
									target="_blank"
									rel="noopener noreferrer"
									class="flex link items-center gap-2 link-primary hover:link-accent"
									title={`View ${w.id} on Sui Vision`}
									aria-label={`View wheel ${shortenAddress(w.id)} on Sui Vision`}
								>
									{shortenAddress(w.id)}
									<span class="icon-[lucide--external-link]"></span>
								</a>
							</td>
							<td>
								<div class="join">
									<a
										class="btn join-item btn-soft btn-sm btn-success"
										href={`/?wheelId=${w.id}`}
										aria-label={t('wheelList.actions.open')}>{t('wheelList.actions.open')}</a
									>
									<a
										class="btn join-item btn-soft btn-sm btn-secondary"
										href={`/wheel-result/?wheelId=${w.id}`}
										aria-label={t('wheelList.actions.results')}>{t('wheelList.actions.results')}</a
									>
								</div>
							</td>
							<td class="whitespace-nowrap">
								{#if w.timestampMs}
									<div class="tooltip" data-tip={format(w.timestampMs, "MMMM d, yyyy 'at' h:mm a")}>
										<span class="badge badge-soft badge-success">
											{formatDistanceToNow(w.timestampMs, { addSuffix: true })}
										</span>
									</div>
								{:else}
									<span class="opacity-60">—</span>
								{/if}
							</td>
							<td class="text-center">
								<span class="badge font-mono badge-neutral">{w.totalEntries || 0}</span>
							</td>
							<td>
								<div
									class="tooltip"
									class:tooltip-open={w.joined}
									class:tooltip-right={w.joined}
									data-tip={w.joined ? 'Joined' : ''}
								>
									{#if w.status === 'Cancelled'}
										<span class="badge badge-warning"
											><span class="icon-[lucide--circle-x]"></span>
											{t('wheelList.status.cancelled')}</span
										>
									{:else if w.status === 'Running'}
										<span class="badge badge-primary"
											><span class="icon-[lucide--clock]"></span>
											{t('wheelList.status.running')}</span
										>
									{:else if w.status === 'Finished'}
										<span class="badge badge-success"
											><span class="icon-[lucide--check]"></span>
											{t('wheelList.status.finished')}</span
										>
									{:else}
										<span class="badge"
											><span class="icon-[lucide--circle-alert]"></span>
											{t('wheelList.status.unknown')}</span
										>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/snippet}

{#snippet skeleton()}
	<div class="space-y-3">
		<div class="h-8 w-40 skeleton"></div>
		<div class="h-32 w-full skeleton"></div>
	</div>
{/snippet}

<section class="container mx-auto px-4 py-12">
	{#if account}
		<!-- User's Wheels Section -->
		<div class="card bg-base-200 border border-base-300 shadow-sm">
			<div class="card-body">
				<div class="mb-4 flex items-center justify-between">
					<div class="flex items-center gap-2">
						<h2 class="text-lg font-semibold">{t('wheelList.pageTitle')}</h2>
						{#if wheels.length > 0}
							<DataSourceBadge source={yourWheelsSource} />
						{/if}
					</div>
					<a href="/" class="btn btn-sm btn-primary" aria-label={t('wheelList.createNew')}
						>{t('wheelList.createNew')}</a
					>
				</div>
				{#if !isOnTestnet}
					<AlertTestnetWarning />
				{:else if pageState === 'initializing' || (pageState === 'loading' && accountLoading.value)}
					<div class="flex items-center gap-2">
						<span class="loading loading-sm loading-spinner"></span>
						{t('wheelList.loading')}
					</div>
				{:else if pageState === 'loading'}
					{@render skeleton()}
				{:else if pageState === 'loaded'}
					{#if wheels.length === 0}
						<div class="text-sm opacity-70">{t('wheelList.noWheels')}</div>
					{:else}
						<div class="relative">
							{@render wheelsTable(wheels)}
							{#if refreshing}
								<div
									class="pointer-events-none absolute inset-0 grid place-items-center bg-base-300/40"
									in:fade
									out:fade
									aria-hidden="true"
								>
									<span
										class="loading loading-md loading-spinner text-primary"
										aria-label={t('wheelList.refreshing')}
									></span>
								</div>
							{/if}
						</div>
					{/if}
				{/if}
			</div>
		</div>

		<!-- Joined Wheels Section -->
		<div class="card mt-8 bg-base-200 border border-base-300 shadow-sm">
			<div class="card-body">
				<div class="mb-4">
					<div class="flex items-center gap-2">
						<h2 class="text-lg font-semibold">{t('wheelList.joinedWheels.title')}</h2>
						{#if joinedWheels.length > 0}
							<DataSourceBadge source={joinedWheelsSource} />
						{/if}
					</div>
					<p class="mt-1 text-sm opacity-70">{t('wheelList.joinedWheels.description')}</p>
				</div>

				{#if joinedWheelsWarning && dev}
					<div class="alert alert-warning">
						<span class="icon-[lucide--alert-triangle]"></span>
						<span>{joinedWheelsWarning}</span>
					</div>
				{/if}

				{#if joinedWheelsPageState === 'initializing'}
					<div class="flex items-center gap-2">
						<span class="loading loading-sm loading-spinner"></span>
						{t('wheelList.publicWheels.loading')}
					</div>
				{:else if joinedWheelsPageState === 'loading'}
					{@render skeleton()}
				{:else if joinedWheelsPageState === 'loaded'}
					{#if joinedWheels.length > 0}
						{@render wheelsTable(joinedWheels)}
					{:else}
						<div class="text-sm opacity-70">{t('wheelList.joinedWheels.noWheels')}</div>
					{/if}
				{/if}
			</div>
		</div>
	{:else}
		<!-- Connect Wallet Placeholder -->
		<div class="card relative overflow-hidden border border-base-300 bg-base-200/50 shadow-sm text-center">
			<!-- Background Pattern -->
			<div class="bg-dot-pattern text-base-content/10 absolute inset-0 pointer-events-none"></div>

			<div class="card-body relative z-10 items-center py-10">
				<div class="bg-base-100 flex h-12 w-12 items-center justify-center rounded-full mb-2 shadow-sm">
					<span class="icon-[lucide--wallet] h-6 w-6 text-primary"></span>
				</div>
				<h2 class="text-lg font-bold mb-1">{t('wheelList.connectWalletTitle')}</h2>
				<p class="text-base-content/60 text-sm max-w-sm mx-auto mb-4">
					{t('wheelList.connectWalletDescription')}
				</p>
				<ButtonConnectWallet />
			</div>
		</div>
	{/if}

	<!-- Public Wheels Section -->
	<div class="card mt-8 bg-base-200 border border-base-300 shadow-sm">
		<div class="card-body">
			<div class="mb-4">
				<div class="flex items-center gap-2">
					<h2 class="text-lg font-semibold">{t('wheelList.publicWheels.title')}</h2>
					<DataSourceBadge source={publicWheelsSource} />
				</div>

				<p class="mt-1 text-sm opacity-70">{t('wheelList.publicWheels.description')}</p>
			</div>

			{#if publicWheelsPageState === 'initializing'}
				<div class="flex items-center gap-2">
					<span class="loading loading-sm loading-spinner"></span>
					{t('wheelList.publicWheels.loading')}
				</div>
			{:else if publicWheelsPageState === 'loading'}
				{@render skeleton()}
			{:else if publicWheelsPageState === 'loaded'}
				{#if publicWheels.length === 0}
					<div class="text-sm opacity-70">{t('wheelList.publicWheels.noWheels')}</div>
				{:else}
					<div class="relative">
						{@render wheelsTable(publicWheels)}
					</div>
				{/if}
			{/if}
		</div>
	</div>
</section>
