<script>
	import { onDestroy, onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { useSuiClient, useCurrentAccount, accountLoading } from 'sui-svelte-wallet-kit';
	import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
	import { formatDistanceToNow, format } from 'date-fns';
	import { shortenAddress } from '$lib/utils/string.js';
	import { isTestnet, getExplorerLink } from '$lib/utils/suiHelpers.js';
	import {
		LATEST_PACKAGE_ID,
		WHEEL_MODULE,
		WHEEL_FUNCTIONS,
		WHEEL_STRUCT
	} from '$lib/constants.js';
	import { watch, IsIdle } from 'runed';
	import { useTranslation } from '$lib/hooks/useTranslation.js';
	import AlertTestnetWarning from '$lib/components/AlertTestnetWarning.svelte';

	const t = useTranslation();

	const account = $derived(useCurrentAccount());
	let isOnTestnet = $derived(isTestnet(account));

	const suiClient = $derived(
		account && isOnTestnet ? useSuiClient() : new SuiClient({ url: getFullnodeUrl('testnet') })
	);

	let pageState = $state('initializing'); // initializing, loading, loaded
	let errorMsg = $state('');
	let wheels = $state([]); // [{ id, digest, timestampMs }]
	let _pollInterval = $state(null);
	let refreshing = $state(false);

	// Joined wheels list fetched from DB (latest 10)
	let joinedWheels = $state([]);
	let joinedWheelsPageState = $state('initializing'); // initializing, loading, loaded
	let joinedWheelsErrorMsg = $state('');

	// Public wheels state (server-provided)
	const { data } = $props();
	let publicWheelsPageState = $state('loaded'); // already loaded from server
	let publicWheelsErrorMsg = $state('');
	let publicWheels = $state(Array.isArray(data?.publicWheels) ? data.publicWheels : []); // [{ id, digest, timestampMs, status, remainingSpins, totalEntries }]

	async function loadWheelsFor(address, opts = {}) {
		if (!address) return;
		const isRefresh = Boolean(opts.isRefresh);
		if (!isRefresh) pageState = 'loading';
		errorMsg = '';
		try {
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

			// Get transactions from single response
			const transactions = response?.data || [];

			const senderLc = String(address).toLowerCase();
			const items = [];
			for (const tx of transactions) {
				const txSender = String(
					tx?.transaction?.data?.sender || tx?.transaction?.sender || ''
				).toLowerCase();
				if (txSender !== senderLc) continue;
				const created = (tx?.objectChanges || []).find(
					ch =>
						ch?.type === 'created' &&
						String(ch?.objectType || '').endsWith(`::${WHEEL_MODULE}::${WHEEL_STRUCT}`)
				);
				if (created?.objectId) {
					items.push({
						id: created.objectId,
						digest: tx?.digest,
						timestampMs: Number(tx?.timestampMs || 0)
					});
				}
			}

			// Enrich items with on-chain status (Cancelled / Running / Finished)
			if (items.length > 0) {
				try {
					const objs = await suiClient.multiGetObjects({
						ids: items.map(i => i.id),
						options: { showContent: true }
					});
					const idToMeta = new Map();
					for (const o of objs || []) {
						try {
							const id = String(o?.data?.objectId || '');
							const f = o?.data?.content?.fields || {};
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
					wheels = items.map(it => {
						const meta = idToMeta.get(it.id) || { status: '—', remainingSpins: 0, totalEntries: 0 };
						return { ...it, ...meta };
					});
				} catch {
					wheels = items;
				}
			} else {
				wheels = items;
			}
		} catch (e) {
			errorMsg = e?.message || String(e);
		} finally {
			if (!isRefresh) pageState = 'loaded';
			refreshing = false;
		}
	}

	// Keep public wheels in sync if `data` changes
	$effect(() => {
		if (Array.isArray(data?.publicWheels)) {
			publicWheels = data.publicWheels;
		}
	});

	async function loadJoinedWheels(address, opts = {}) {
		const isRefresh = Boolean(opts.isRefresh);
		if (!isRefresh) joinedWheelsPageState = 'loading';
		joinedWheelsErrorMsg = '';
		try {
			// Run last: check the union of IDs from both lists currently loaded
			const allIds = [...(wheels || []), ...(publicWheels || [])].map(w => w.id);
			const uniqueIds = Array.from(new Set(allIds)).filter(Boolean);
			if (uniqueIds.length === 0) {
				joinedWheels = [];
				if (!isRefresh) joinedWheelsPageState = 'loaded';
				return;
			}

			const addr = String(address || '').toLowerCase();
			if (!addr) {
				joinedWheels = [];
				if (!isRefresh) joinedWheelsPageState = 'loaded';
				return;
			}

			// Check joined status for these IDs only (database)
			const resp = await fetch('/api/wheels/joined/check', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ address: addr, wheelIds: uniqueIds })
			});
			if (!resp?.ok) {
				joinedWheels = [];
				return;
			}
			const data = await resp.json();
			const joinedIds = new Set((data?.joinedIds || []).map(String));
			if (joinedIds.size === 0) {
				joinedWheels = [];
				return;
			}
			// Enrich joined list status similar to others
			try {
				const ids = uniqueIds.filter(id => joinedIds.has(id));
				const objs = await suiClient.multiGetObjects({
					ids,
					options: { showContent: true }
				});
				const idToMeta = new Map();
				for (const o of objs || []) {
					try {
						const id = String(o?.data?.objectId || '');
						const f = o?.data?.content?.fields || {};
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
				// Build joined list keeping existing timestamps from wheels/publicWheels when possible
				const idToTs = new Map();
				for (const w of wheels) idToTs.set(w.id, w.timestampMs || 0);
				for (const w of publicWheels) if (!idToTs.has(w.id)) idToTs.set(w.id, w.timestampMs || 0);
				joinedWheels = ids.map(id => ({
					id,
					digest: null,
					timestampMs: idToTs.get(id) || 0,
					joined: true,
					...(idToMeta.get(id) || { status: '—', remainingSpins: 0, totalEntries: 0 })
				}));
			} catch {
				// Fallback without enrichment
				joinedWheels = Array.from(joinedIds).map(id => ({
					id,
					digest: null,
					timestampMs: 0,
					joined: true
				}));
			}

			// Update joined flags on visible lists
			wheels = wheels.map(w => ({ ...w, joined: joinedIds.has(w.id) }));
			publicWheels = publicWheels.map(w => ({ ...w, joined: joinedIds.has(w.id) }));
		} catch (e) {
			joinedWheels = [];
			joinedWheelsErrorMsg = e?.message || String(e);
		} finally {
			if (!isRefresh) joinedWheelsPageState = 'loaded';
		}
	}

	function clearJoinedWheelStatus() {
		joinedWheels = [];
		wheels = wheels.map(w => ({ ...w, joined: false }));
		publicWheels = publicWheels.map(w => ({ ...w, joined: false }));
	}

	const idle = new IsIdle({ timeout: 15000 });

	// Watch for account changes
	watch(
		() => account?.address,
		async (curr, prev) => {
			// Clear joined wheel status when account changes
			if (curr === undefined && pageState === 'loaded') {
				return clearJoinedWheelStatus();
			}

			// Prevent loop
			if (curr === prev) {
				if (curr === undefined && prev === undefined && pageState === 'initializing') {
					pageState = 'loading';
					joinedWheelsPageState = 'loaded';
					return;
				}
			} else if (curr !== prev) {
				// Clear joined wheel status when account changes
				if (wheels.length > 0 || publicWheels.length > 0) {
					clearJoinedWheelStatus();
				}

				// Only load user's wheels on testnet
				if (isOnTestnet) {
					pageState = 'loading';
					startPolling();
					await loadWheelsFor(curr);
				}

				loadJoinedWheels(curr);
			}
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
		_pollInterval = setInterval(() => refreshNow(), ms);
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

{#snippet wheelsTable(rows)}
	<div class="relative">
		<div class="overflow-x-auto">
			<table class="table-zebra table">
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
									class="link link-primary hover:link-accent flex items-center gap-2"
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
										class="btn btn-sm btn-success btn-soft join-item"
										href={`/?wheelId=${w.id}`}
										aria-label={t('wheelList.actions.open')}>{t('wheelList.actions.open')}</a
									>
									<a
										class="btn btn-sm btn-secondary btn-soft join-item"
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
								<span class="badge badge-neutral font-mono">{w.totalEntries || 0}</span>
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
		<div class="skeleton h-8 w-40"></div>
		<div class="skeleton h-32 w-full"></div>
	</div>
{/snippet}

<section class="container mx-auto px-4 py-12">
	<div class="card bg-base-200 shadow">
		<div class="card-body">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold">{t('wheelList.pageTitle')}</h2>
				<a href="/" class="btn btn-primary btn-sm" aria-label={t('wheelList.createNew')}
					>{t('wheelList.createNew')}</a
				>
			</div>
			{#if account && !isOnTestnet}
				<AlertTestnetWarning />
			{:else if pageState === 'initializing'}
				<div class="flex items-center gap-2">
					<span class="loading loading-spinner loading-sm"></span>
					{t('wheelList.loading')}
				</div>
			{:else if pageState === 'loading'}
				{#if accountLoading.value && !account}
					{@render skeleton()}
				{:else if !account}
					<div class="flex items-center gap-2">{t('wheelList.connectWallet')}</div>
				{/if}
			{:else if pageState === 'loaded'}
				{#if wheels.length === 0}
					<div class="text-sm opacity-70">{t('wheelList.noWheels')}</div>
				{:else}
					<div class="relative">
						{@render wheelsTable(wheels)}
						{#if refreshing}
							<div
								class="bg-base-300/40 pointer-events-none absolute inset-0 grid place-items-center"
								in:fade
								out:fade
								aria-hidden="true"
							>
								<span
									class="loading loading-spinner loading-md text-primary"
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
	<div class="card bg-base-200 mt-8 shadow">
		<div class="card-body">
			<div class="mb-4">
				<h2 class="text-lg font-semibold">{t('wheelList.joinedWheels.title')}</h2>
				<p class="mt-1 text-sm opacity-70">{t('wheelList.joinedWheels.description')}</p>
			</div>
			{#if joinedWheelsPageState === 'initializing'}
				<div class="flex items-center gap-2">
					<span class="loading loading-spinner loading-sm"></span>
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

	<!-- Public Wheels Section -->
	<div class="card bg-base-200 mt-8 shadow">
		<div class="card-body">
			<div class="mb-4">
				<h2 class="text-lg font-semibold">{t('wheelList.publicWheels.title')}</h2>
				<p class="mt-1 text-sm opacity-70">{t('wheelList.publicWheels.description')}</p>
			</div>
			{#if publicWheelsPageState === 'initializing'}
				<div class="flex items-center gap-2">
					<span class="loading loading-spinner loading-sm"></span>
					{t('wheelList.publicWheels.loading')}
				</div>
			{:else if publicWheelsPageState === 'loading'}
				<div class="space-y-3">
					<div class="skeleton h-8 w-40"></div>
					<div class="skeleton h-32 w-full"></div>
				</div>
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
