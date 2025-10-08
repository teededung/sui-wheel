<script>
	import { onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import { useSuiClient, useCurrentAccount, accountLoading } from 'sui-svelte-wallet-kit';
	import { formatDistanceToNow, format } from 'date-fns';
	import { shortenAddress } from '$lib/utils/string.js';
	import {
		LATEST_PACKAGE_ID,
		WHEEL_MODULE,
		WHEEL_FUNCTIONS,
		WHEEL_STRUCT
	} from '$lib/constants.js';
	import { watch, IsIdle } from 'runed';

	const suiClient = $derived(useSuiClient());
	const account = $derived(useCurrentAccount());

	let pageState = $state('initializing'); // initializing, loading, loaded
	let errorMsg = $state('');
	let wheels = $state([]); // [{ id, digest, timestampMs }]
	let _pollInterval = $state(null);
	let refreshing = $state(false);

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

	const idle = new IsIdle({ timeout: 15000 });

	// Watch for account changes
	watch(
		() => account?.address,
		addr => {
			pageState = 'loading';
			if (addr) {
				startPolling();
				loadWheelsFor(addr);
			} else {
				wheels = [];
			}
		}
	);

	// Watch for idle state
	watch(
		() => idle.current,
		() => {
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
		if (!account?.address) return;
		refreshing = true;
		loadWheelsFor(account?.address, { isRefresh: true });
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
	<title>Sui Wheel — Your wheels</title>
	<meta name="description" content={'List of wheels you created on Sui Testnet.'} />
	<meta property="og:title" content={'Sui Wheel — Your wheels'} />
	<meta property="og:description" content={'List of wheels you created on Sui Testnet.'} />
</svelte:head>

<section class="container mx-auto px-4 py-6">
	<div class="card bg-base-200 shadow">
		<div class="card-body">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold">Your Wheels</h2>
				<a href="/" class="btn btn-primary btn-sm" aria-label="Create new wheel">Create new</a>
			</div>
			{#if pageState === 'initializing'}
				<div class="flex items-center gap-2">
					<span class="loading loading-spinner loading-sm"></span>
					Loading...
				</div>
			{:else if pageState === 'loading'}
				{#if accountLoading.value && !account}
					<div class="space-y-3">
						<div class="skeleton h-8 w-40"></div>
						<div class="skeleton h-32 w-full"></div>
					</div>
				{:else if !account}
					<div class="flex items-center gap-2">Please connect your wallet to view your wheels.</div>
				{/if}
			{:else if pageState === 'loaded'}
				{#if wheels.length === 0}
					<div class="text-sm opacity-70">No wheels found.</div>
				{:else}
					<div class="relative">
						<div class="overflow-x-auto">
							<table class="table-zebra table">
								<thead>
									<tr>
										<th class="w-12">#</th>
										<th>Wheel ID</th>
										<th>Created</th>
										<th>Status</th>
										<th class="w-20">Total Entries</th>
										<th class="w-64">Actions</th>
									</tr>
								</thead>
								<tbody>
									{#each wheels as w, i (w.id)}
										<tr>
											<td>{i + 1}</td>
											<td class="font-mono">
												<a
													href={`https://testnet.suivision.xyz/object/${w.id}`}
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
											<td class="whitespace-nowrap">
												{#if w.timestampMs}
													<div
														class="tooltip"
														data-tip={format(w.timestampMs, "MMMM d, yyyy 'at' h:mm a")}
													>
														<span class="badge badge-soft badge-success">
															{formatDistanceToNow(w.timestampMs, { addSuffix: true })}
														</span>
													</div>
												{:else}
													<span class="opacity-60">—</span>
												{/if}
											</td>
											<td>
												{#if w.status === 'Cancelled'}
													<span class="badge badge-warning"
														><span class="icon-[lucide--circle-x]"></span> Cancelled</span
													>
												{:else if w.status === 'Running'}
													<span class="badge badge-primary"
														><span class="icon-[lucide--clock]"></span> Running</span
													>
												{:else if w.status === 'Finished'}
													<span class="badge badge-success"
														><span class="icon-[lucide--check]"></span> Finished</span
													>
												{:else}
													<span class="badge"
														><span class="icon-[lucide--circle-alert]"></span> —</span
													>
												{/if}
											</td>
											<td class="text-center">
												<span class="badge badge-neutral font-mono">
													{w.totalEntries || 0}
												</span>
											</td>
											<td>
												<div class="join">
													<a
														class="btn btn-sm btn-success btn-soft join-item"
														href={`/?wheelId=${w.id}`}
														aria-label="Open wheel to spin">Open</a
													>
													<a
														class="btn btn-sm btn-secondary btn-soft join-item"
														href={`/wheel-result/?wheelId=${w.id}`}
														aria-label="View results">Results</a
													>
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						{#if refreshing}
							<div
								class="bg-base-300/40 pointer-events-none absolute inset-0 grid place-items-center"
								in:fade
								out:fade
								aria-hidden="true"
							>
								<span
									class="loading loading-spinner loading-md text-primary"
									aria-label="Refreshing"
								></span>
							</div>
						{/if}
					</div>
				{/if}
			{/if}
		</div>
	</div>
</section>
