<script>
	import { onMount } from 'svelte';
	import { SuiClient } from '@mysten/sui/client';
	import { Transaction } from '@mysten/sui/transactions';
	import { account, signAndExecuteTransaction } from 'sui-svelte-wallet-kit';
	import { page } from '$app/stores';
	import { shortenAddress } from '$lib/utils/string.js';
	import { formatMistToSuiCompact } from '$lib/utils/suiHelpers.js';
	import { PACKAGE_ID, WHEEL_MODULE, WHEEL_FUNCTIONS, CLOCK_OBJECT_ID } from '$lib/constants.js';

	const client = new SuiClient({ url: 'https://fullnode.testnet.sui.io' });

	let wheelId = $state('');
	let loading = $state(true);
	let error = $state('');
	let packageId = $derived(PACKAGE_ID);
	let winners = $state([]);
	let prizeAmounts = $state([]);
	let spinTimes = $state([]);
	let delayMs = $state(0);
	let claimWindowMs = $state(0);

	onMount(async () => {
		wheelId = new URLSearchParams($page.url.search).get('wheelId') ?? '';
		await fetchData();
	});

	async function fetchData() {
		if (!wheelId) return;
		loading = true;
		error = '';
		try {
			const res = await client.getObject({ id: wheelId, options: { showContent: true } });
			const f = res?.data?.content?.fields ?? {};
			winners = (f.winners || []).map(w => ({
				addr: String(w?.fields?.addr ?? w?.addr ?? ''),
				prize_index: Number(w?.fields?.prize_index ?? w?.prize_index ?? 0),
				claimed: Boolean(w?.fields?.claimed ?? w?.claimed ?? false)
			}));
			prizeAmounts = (f.prize_amounts || []).map(v => BigInt(v));
			spinTimes = (f.spin_times || []).map(v => Number(v));
			delayMs = Number(f.delay_ms || 0);
			claimWindowMs = Number(f.claim_window_ms || 0);
		} catch (e) {
			error = e?.message || String(e);
		} finally {
			loading = false;
		}
	}

	function getClaimState(prizeIndex) {
		const spinTime = spinTimes[prizeIndex] ?? 0;
		const now = Date.now();
		const start = spinTime + delayMs;
		const end = spinTime + delayMs + claimWindowMs;
		if (now < start) return { state: 'too_early', startsInMs: start - now };
		if (now >= end) return { state: 'expired' };
		return { state: 'claimable' };
	}

	function findWinner(idx) {
		try {
			return winners.find(w => w.prize_index === idx);
		} catch {
			return null;
		}
	}

	async function claim(prizeIndex) {
		if (!account.value) {
			error = 'Connect wallet to claim';
			return;
		}
		error = '';
		try {
			const tx = new Transaction();
			// Call claim to get a Coin<SUI> back in the PTB
			const claimedCoin = tx.moveCall({
				target: `${packageId}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.CLAIM}`,
				arguments: [tx.object(wheelId), tx.object(CLOCK_OBJECT_ID)]
			});
			// Transfer the returned coin to the sender's address
			tx.transferObjects([claimedCoin], tx.pure.address(account.value.address));

			await signAndExecuteTransaction(tx);
			await fetchData();
		} catch (e) {
			error = e?.message || String(e);
		}
	}
</script>

<section class="container mx-auto px-4 py-6">
	<div class="mb-4 flex items-center justify-between">
		<h1 class="text-xl font-bold">Wheel Results</h1>
		{#if wheelId}
			<span class="text-sm opacity-70"
				>Wheel ID: <span class="font-mono">{shortenAddress(wheelId)}</span></span
			>
		{/if}
	</div>

	{#if error}
		<div class="alert alert-error mb-4">{error}</div>
	{/if}

	{#if loading}
		<div class="space-y-2">
			<div class="skeleton h-6 w-40"></div>
			<div class="skeleton h-24 w-full"></div>
		</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="table-zebra table">
				<thead>
					<tr>
						<th>#</th>
						<th>Amount (SUI)</th>
						<th>Winner</th>
						<th>Status</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each prizeAmounts as m, i}
						<tr>
							<td class="w-12">{i + 1}</td>
							<td class="font-mono">{formatMistToSuiCompact(m)}</td>
							<td class="font-mono">{findWinner(i) ? shortenAddress(findWinner(i).addr) : '—'}</td>
							<td>
								{#if findWinner(i)}
									{#if findWinner(i).claimed}
										<span class="badge badge-success badge-sm">claimed</span>
									{:else if getClaimState(i).state === 'claimable'}
										<span class="badge badge-primary badge-sm">claimable</span>
									{:else if getClaimState(i).state === 'too_early'}
										<span class="badge badge-warning badge-sm">too early</span>
									{:else}
										<span class="badge badge-error badge-sm">expired</span>
									{/if}
								{:else}
									<span class="opacity-60">—</span>
								{/if}
							</td>
							<td>
								{#if findWinner(i) && !findWinner(i).claimed && getClaimState(i).state === 'claimable'}
									<button class="btn btn-sm btn-primary" onclick={() => claim(i)}>Claim</button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
