<script>
	import { onMount } from 'svelte';
	import { SuiClient } from '@mysten/sui/client';
	import { account } from 'sui-svelte-wallet-kit';
	import { formatDistanceToNow } from 'date-fns';
	import { shortenAddress } from '$lib/utils/string.js';
	import { PACKAGE_ID, WHEEL_MODULE, WHEEL_FUNCTIONS, WHEEL_STRUCT } from '$lib/constants.js';

	const client = new SuiClient({ url: 'https://fullnode.testnet.sui.io' });

	let loading = $state(false);
	let errorMsg = $state('');
	let wheels = $state([]); // [{ id, digest, timestampMs }]

	async function loadWheelsFor(address) {
		if (!address) return;
		loading = true;
		errorMsg = '';
		try {
			const resp = await client.queryTransactionBlocks({
				filter: {
					MoveFunction: {
						package: PACKAGE_ID,
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

			const senderLc = String(address).toLowerCase();
			const items = [];
			for (const tx of resp?.data || []) {
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
					const objs = await client.multiGetObjects({
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
							const remaining = Math.max(0, prizesLen - spunCount);
							const status = isCancelled ? 'Cancelled' : remaining > 0 ? 'Running' : 'Finished';
							idToMeta.set(id, { status, remainingSpins: remaining });
						} catch {}
					}
					wheels = items.map(it => {
						const meta = idToMeta.get(it.id) || { status: '—', remainingSpins: 0 };
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
			loading = false;
		}
	}

	onMount(() => {
		if (account.value?.address) loadWheelsFor(account.value.address);
	});

	$effect(() => {
		const addr = account.value?.address;
		if (addr) {
			loadWheelsFor(addr);
		} else {
			wheels = [];
		}
	});
</script>

<section class="container mx-auto px-4 py-6">
	<div class="card bg-base-200 shadow">
		<div class="card-body">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold">Your Wheels</h2>
				<a href="/" class="btn btn-primary btn-sm" aria-label="Create new wheel">Create new</a>
			</div>

			{#if !account.value}
				<div class="alert alert-info">Please connect your wallet to view your wheels.</div>
			{:else}
				{#if errorMsg}
					<div class="alert alert-error break-words">{errorMsg}</div>
				{/if}

				{#if loading}
					<div class="space-y-3">
						<div class="skeleton h-8 w-40"></div>
						<div class="skeleton h-32 w-full"></div>
					</div>
				{:else if wheels.length === 0}
					<div class="text-sm opacity-70">No wheels found.</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="table-zebra table">
							<thead>
								<tr>
									<th class="w-12">#</th>
									<th>Wheel ID</th>
									<th>Created</th>
									<th>Status</th>
									<th class="w-64">Actions</th>
								</tr>
							</thead>
							<tbody>
								{#each wheels as w, i}
									<tr>
										<td>{i + 1}</td>
										<td class="font-mono">
											<a
												href={`https://testnet.suivision.xyz/object/${w.id}`}
												target="_blank"
												rel="noopener noreferrer"
												class="link link-primary hover:link-accent"
												title={`View ${w.id} on Sui Vision`}
												aria-label={`View wheel ${shortenAddress(w.id)} on Sui Vision`}
											>
												{shortenAddress(w.id)}
											</a>
										</td>
										<td class="whitespace-nowrap">
											{#if w.timestampMs}
												<span class="badge badge-soft badge-success">
													{formatDistanceToNow(w.timestampMs, { addSuffix: true })}
												</span>
											{:else}
												<span class="opacity-60">—</span>
											{/if}
										</td>
										<td>
											{#if w.status === 'Cancelled'}
												<span class="badge badge-warning">Cancelled</span>
											{:else if w.status === 'Running'}
												<span class="badge badge-primary">Running</span>
											{:else if w.status === 'Finished'}
												<span class="badge badge-neutral">Finished</span>
											{:else}
												<span class="badge">—</span>
											{/if}
										</td>
										<td>
											<div class="join">
												<a
													class="btn btn-sm join-item"
													href={`/?wheelId=${w.id}`}
													aria-label="Open wheel to spin">Open</a
												>
												<a
													class="btn btn-sm btn-outline join-item"
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
				{/if}
			{/if}
		</div>
	</div>
</section>
