<script>
	import { onMount, onDestroy } from 'svelte';
	import { SuiClient } from '@mysten/sui/client';
	import { Transaction } from '@mysten/sui/transactions';
	import { account, signAndExecuteTransaction } from 'sui-svelte-wallet-kit';
	import { page } from '$app/stores';
	import { shortenAddress } from '$lib/utils/string.js';
	import { formatMistToSuiCompact } from '$lib/utils/suiHelpers.js';
	import { PACKAGE_ID, WHEEL_MODULE, WHEEL_FUNCTIONS, CLOCK_OBJECT_ID } from '$lib/constants.js';
	import ButtonLoading from '$lib/components/ButtonLoading.svelte';
	import { toast } from 'svelte-daisy-toaster';
	import { format, formatDistanceToNow } from 'date-fns';

	const client = new SuiClient({ url: 'https://fullnode.testnet.sui.io' });

	let wheelId = $state('');
	let loading = $state(true);
	let error = $state('');
	let packageId = $state(PACKAGE_ID);
	let winners = $state([]);
	let prizeAmounts = $state([]);
	let spinTimes = $state([]);
	let spunAtTexts = $state([]);
	let delayMs = $state(0);
	let claimWindowMs = $state(0);
	let organizer = $state('');
	let nowMs = $state(Date.now());
	let reclaimLoading = $state(false);
	let ticker;
	let poolBalanceMist = $state(0n);
	let lastReclaim = $state({ amount: 0n, timestampMs: 0, digest: '' });
	let lastClaim = $state({ amount: 0n, timestampMs: 0, digest: '' });
	let isCancelled = $state(false);
	// Wheel meta
	let wheelCreatedAtMs = $state(0);
	let wheelCreatedTx = $state('');
	// Non-winning entries (remaining entries on chain)
	let nonWinningEntries = $state([]);
	let winnerInfo = $derived.by(() => {
		try {
			const addr = account.value?.address?.toLowerCase?.();
			if (!addr) return null;
			return winners.find(w => String(w?.addr || '').toLowerCase() === addr) ?? null;
		} catch {
			return null;
		}
	});
	let winnerPrizeIndex = $derived.by(() => (winnerInfo ? Number(winnerInfo.prize_index) : -1));

	// Remaining spins based on number of prizes and spun timestamps
	let remainingSpins = $derived.by(() => {
		try {
			const spun = (spinTimes || []).filter(v => Number(v) > 0).length;
			return Math.max(0, (prizeAmounts || []).length - spun);
		} catch {
			return 0;
		}
	});

	async function getPackageIdFromWheelId(wheelId) {
		try {
			const objectData = await client.getObject({
				id: wheelId,
				options: { showType: true }
			});
			if (!objectData.data?.type) {
				throw new Error('Object not found or invalid type');
			}
			// Parse type: "0xpackage::module::struct"
			const type = objectData.data.type;
			const packageId = type.split('::')[0];
			return packageId;
		} catch (e) {
			console.error('Error querying object:', e.message);
			return null;
		}
	}

	onMount(async () => {
		wheelId = new URLSearchParams($page.url.search).get('wheelId') ?? '';
		packageId = await getPackageIdFromWheelId(wheelId);
		await fetchData();
		await fetchReclaimEvents();
		await fetchClaimEventsForWinner(); // Initial fetch for lastClaim for winner
		// Precompute static "Spun at" texts based on current time once
		const base = Date.now();
		spunAtTexts = (spinTimes || []).map(ts => formatRelativePreciseAt(ts, base));
	});

	onDestroy(() => {});

	async function fetchData() {
		if (!wheelId) return;
		loading = true;
		error = '';
		try {
			const res = await client.getObject({
				id: wheelId,
				options: { showContent: true, showPreviousTransaction: true }
			});
			const f = res?.data?.content?.fields ?? {};
			isCancelled = Boolean(f.is_cancelled);
			winners = (f.winners || []).map(w => ({
				addr: String(w?.fields?.addr ?? w?.addr ?? ''),
				prize_index: Number(w?.fields?.prize_index ?? w?.prize_index ?? 0),
				claimed: Boolean(w?.fields?.claimed ?? w?.claimed ?? false)
			}));
			prizeAmounts = (f.prize_amounts || []).map(v => BigInt(v));
			spinTimes = (f.spin_times || []).map(v => Number(v));
			delayMs = Number(f.delay_ms || 0);
			claimWindowMs = Number(f.claim_window_ms || 0);
			organizer = String(f.organizer || '');
			// Remaining entries represent non-winners
			nonWinningEntries = (f.remaining_entries || []).map(v => String(v));

			// Wheel creation timestamp from the transaction that created this object
			await fetchWheelCreationMeta();
			// Parse pool balance from nested balance field variants
			try {
				let pool = 0n;
				const v = f['pool'];
				if (v != null) {
					if (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint') {
						pool = BigInt(v);
					} else if (typeof v === 'object') {
						const val =
							v?.fields?.balance?.fields?.value ?? v?.fields?.value ?? v?.value ?? v?.balance;
						if (val != null) pool = BigInt(val);
					}
				}
				poolBalanceMist = pool;
			} catch {}
		} catch (e) {
			error = e?.message || String(e);
		} finally {
			loading = false;
		}
	}

	async function fetchReclaimEvents() {
		try {
			if (!packageId || !wheelId) return;
			const eventType = `${packageId}::${WHEEL_MODULE}::ReclaimEvent`;
			const res = await client.queryEvents({ query: { MoveEventType: eventType }, limit: 1 });
			const events = Array.isArray(res?.data) ? res.data : [];
			const filtered = events.filter(e => {
				const wid = String(e?.parsedJson?.wheel_id ?? e?.parsedJson?.wheelId ?? '').toLowerCase();
				return wid === String(wheelId).toLowerCase();
			});
			if (filtered.length === 0) {
				lastReclaim = { amount: 0n, timestampMs: 0, digest: '' };
				return;
			}
			filtered.sort((a, b) => {
				const ta = Number(a?.timestampMs ?? 0);
				const tb = Number(b?.timestampMs ?? 0);
				if (tb !== ta) return tb - ta;
				try {
					const ea = BigInt(a?.id?.eventSeq ?? '0');
					const eb = BigInt(b?.id?.eventSeq ?? '0');
					return eb > ea ? 1 : eb < ea ? -1 : 0;
				} catch {
					return 0;
				}
			});
			const latest = filtered[0];
			const amount = (() => {
				try {
					return BigInt(latest?.parsedJson?.amount ?? 0);
				} catch {
					return 0n;
				}
			})();
			const ts = Number(latest?.timestampMs ?? 0);
			const digest = String(latest?.id?.txDigest ?? latest?.transactionDigest ?? '');
			lastReclaim = { amount, timestampMs: ts, digest };
		} catch {
			// ignore
		}
	}

	async function fetchClaimEvents() {
		try {
			if (!packageId || !wheelId) return;
			const eventType = `${packageId}::${WHEEL_MODULE}::ClaimEvent`;
			const res = await client.queryEvents({ query: { MoveEventType: eventType }, limit: 1 });
			const events = Array.isArray(res?.data) ? res.data : [];
			const filtered = events.filter(e => {
				const wid = String(e?.parsedJson?.wheel_id ?? e?.parsedJson?.wheelId ?? '').toLowerCase();
				return wid === String(wheelId).toLowerCase();
			});
			if (filtered.length === 0) {
				lastClaim = { amount: 0n, timestampMs: 0, digest: '' };
				return;
			}
			filtered.sort((a, b) => {
				const ta = Number(a?.timestampMs ?? 0);
				const tb = Number(b?.timestampMs ?? 0);
				if (tb !== ta) return tb - ta;
				try {
					const ea = BigInt(a?.id?.eventSeq ?? '0');
					const eb = BigInt(b?.id?.eventSeq ?? '0');
					return eb > ea ? 1 : eb < ea ? -1 : 0;
				} catch {
					return 0;
				}
			});
			const latest = filtered[0];
			const amount = (() => {
				try {
					return BigInt(latest?.parsedJson?.amount ?? 0);
				} catch {
					return 0n;
				}
			})();
			const ts = Number(latest?.timestampMs ?? 0);
			const digest = String(latest?.id?.txDigest ?? latest?.transactionDigest ?? '');
			lastClaim = { amount, timestampMs: ts, digest };
		} catch {
			// ignore
		}
	}

	async function fetchClaimEventsForWinner() {
		try {
			if (!packageId || !wheelId || !account.value?.address) return;
			const eventType = `${packageId}::${WHEEL_MODULE}::ClaimEvent`;
			const res = await client.queryEvents({ query: { MoveEventType: eventType }, limit: 50 });
			const events = Array.isArray(res?.data) ? res.data : [];
			const who = String(account.value.address).toLowerCase();
			const filtered = events.filter(e => {
				const wid = String(e?.parsedJson?.wheel_id ?? e?.parsedJson?.wheelId ?? '').toLowerCase();
				const winner = String(e?.parsedJson?.winner ?? '').toLowerCase();
				return wid === String(wheelId).toLowerCase() && winner === who;
			});
			if (filtered.length === 0) {
				lastClaim = { amount: 0n, timestampMs: 0, digest: '' };
				return;
			}
			filtered.sort((a, b) => {
				const ta = Number(a?.timestampMs ?? 0);
				const tb = Number(b?.timestampMs ?? 0);
				if (tb !== ta) return tb - ta;
				try {
					const ea = BigInt(a?.id?.eventSeq ?? '0');
					const eb = BigInt(b?.id?.eventSeq ?? '0');
					return eb > ea ? 1 : eb < ea ? -1 : 0;
				} catch {
					return 0;
				}
			});
			const latest = filtered[0];
			const amount = (() => {
				try {
					return BigInt(latest?.parsedJson?.amount ?? 0);
				} catch {
					return 0n;
				}
			})();
			const ts = Number(latest?.timestampMs ?? 0);
			const digest = String(latest?.id?.txDigest ?? latest?.transactionDigest ?? '');
			lastClaim = { amount, timestampMs: ts, digest };
		} catch {
			// ignore
		}
	}

	function getClaimState(prizeIndex) {
		const spinTime = spinTimes[prizeIndex] ?? 0;
		const now = nowMs;
		const start = spinTime + delayMs;
		const end = spinTime + delayMs + claimWindowMs;
		if (now < start) return { state: 'too_early', startsInMs: start - now };
		if (now >= end) return { state: 'expired' };
		return { state: 'claimable', endsInMs: end - now };
	}

	// Precise relative formatter similar to Suivision (mins/secs granularity)
	function formatRelativePreciseAt(tsMs, baseMs) {
		const ts = Number(tsMs || 0);
		if (!Number.isFinite(ts) || ts <= 0) return '';
		const diffSec = Math.max(0, Math.floor((baseMs - ts) / 1000));
		const days = Math.floor(diffSec / 86400);
		const hours = Math.floor((diffSec % 86400) / 3600);
		const minutes = Math.floor((diffSec % 3600) / 60);
		const seconds = diffSec % 60;
		if (days > 0) {
			return `${days} ${days === 1 ? 'day' : 'days'} ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
		}
		if (hours > 0) {
			return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${minutes} mins ago`;
		}
		if (minutes > 0) {
			return `${minutes} mins ${seconds} secs ago`;
		}
		return `${seconds} secs ago`;
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
			await fetchClaimEventsForWinner();
		} catch (e) {
			error = e?.message || String(e);
		}
	}

	// Format milliseconds to HH:MM:SS or Dd HH:MM:SS
	function formatDuration(ms) {
		try {
			const total = Math.max(0, Math.floor(ms / 1000));
			const days = Math.floor(total / 86400);
			const hours = Math.floor((total % 86400) / 3600);
			const minutes = Math.floor((total % 3600) / 60);
			const seconds = total % 60;
			const hh = String(hours).padStart(2, '0');
			const mm = String(minutes).padStart(2, '0');
			const ss = String(seconds).padStart(2, '0');
			if (days > 0) return `${days}d ${hh}:${mm}:${ss}`;
			return `${hh}:${mm}:${ss}`;
		} catch {
			return '00:00:00';
		}
	}

	// Derived flag: connected wallet is the organizer
	let isOrganizer = $derived.by(() => {
		const acc = account.value?.address?.toLowerCase?.();
		const org = String(organizer || '').toLowerCase();
		return Boolean(acc && org && acc === org);
	});

	function canOrganizerReclaim() {
		if (!isOrganizer) return false;
		const allSpun =
			Array.isArray(spinTimes) &&
			spinTimes.length === prizeAmounts.length &&
			spinTimes.every(v => Number(v) > 0);
		if (!allSpun) return false;
		for (let i = 0; i < prizeAmounts.length; i++) {
			const w = findWinner(i);
			if (!w) continue;
			if (w.claimed) continue;
			const st = getClaimState(i).state;
			if (st !== 'expired') return false;
		}
		return true;
	}

	async function reclaimPool() {
		if (!account.value) {
			error = 'Connect wallet to reclaim';
			return;
		}
		if (!isOrganizer) {
			error = 'Only organizer can reclaim the pool';
			return;
		}
		if (!canOrganizerReclaim()) {
			error = 'Pool cannot be reclaimed yet';
			return;
		}
		error = '';
		reclaimLoading = true;

		try {
			const tx = new Transaction();
			// Call reclaim_pool to get Coin<SUI> and transfer to organizer (sender)
			const coin = tx.moveCall({
				target: `${packageId}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.RECLAIM}`,
				arguments: [tx.object(wheelId), tx.object(CLOCK_OBJECT_ID)]
			});
			tx.transferObjects([coin], tx.pure.address(account.value.address));
			await signAndExecuteTransaction(tx);
			await fetchData();
			await fetchReclaimEvents();
			if (lastReclaim.digest) {
				toast.success('Reclaimed pool successfully', {
					position: 'bottom-right',
					durationMs: 1500,
					button: {
						text: 'Open on Suivision',
						class: 'btn btn-primary btn-sm',
						callback: () => {
							window.open(
								`https://testnet.suivision.xyz/txblock/${lastReclaim.digest}`,
								'_blank',
								'noopener'
							);
						}
					}
				});
			}
		} catch (e) {
			error = e?.message || String(e);
			// Parse error for user-friendly msg, e.g., if includes 'EReclaimTooEarly'
			if (error.includes('EReclaimTooEarly')) {
				error = 'Reclaim window not yet open. Please wait.';
			} else if (error.includes('ENoRemaining')) {
				error = 'No remaining funds in pool to reclaim.';
			}
		} finally {
			reclaimLoading = false;
		}
	}

	function isYou(addr) {
		return String(account.value?.address || '').toLowerCase() === String(addr).toLowerCase();
	}

	async function fetchWheelCreationMeta() {
		try {
			wheelCreatedAtMs = 0;
			wheelCreatedTx = '';

			// Preferred: read CreateEvent for this wheel id
			try {
				const eventType = `${PACKAGE_ID}::${WHEEL_MODULE}::CreateEvent`;

				let cursorEv = null;
				for (let page = 0; page < 10; page++) {
					const evRes = await client.queryEvents({
						query: { MoveEventType: eventType },
						cursor: cursorEv,
						limit: 10
					});

					const list = Array.isArray(evRes?.data) ? evRes.data : [];
					const match = list.find(
						e =>
							String(e?.parsedJson?.wheel_id || '').toLowerCase() === String(wheelId).toLowerCase()
					);
					if (match) {
						wheelCreatedAtMs = Number(match?.timestampMs || 0);
						wheelCreatedTx = String(match?.id?.txDigest || match?.transactionDigest || '');
						return;
					}
					if (!evRes?.hasNextPage) break;
					cursorEv = evRes?.nextCursor || null;
				}
			} catch {}

			// Fast path: Check if previous transaction created the wheel
			const obj = await client.getObject({
				id: wheelId,
				options: { showPreviousTransaction: true }
			});

			let digest = obj?.data?.previousTransaction || '';

			if (digest) {
				const txb = await client.getTransactionBlock({
					digest,
					options: { showObjectChanges: true }
				});

				const created = (txb?.objectChanges || []).some(
					ch => ch?.type === 'created' && ch.objectId === wheelId
				);
				if (created) {
					wheelCreatedTx = digest;
					wheelCreatedAtMs = Number(txb?.timestampMs || 0);
					return;
				}
			}

			// Fallback: Query transactions by Move function and find the creation tx
			const moveFilter = {
				MoveFunction: { package: packageId, module: 'sui_wheel', function: 'create_wheel' }
			};
			let cursor = null;
			let found = false;
			while (!found) {
				const res = await client.queryTransactionBlocks({
					filter: moveFilter,
					options: { showObjectChanges: true },
					limit: 50,
					order: 'ascending',
					cursor
				});

				for (const tx of res?.data || []) {
					const created = (tx?.objectChanges || []).some(
						ch => ch?.type === 'created' && ch.objectId === wheelId
					);
					if (created) {
						wheelCreatedTx = tx.digest;
						wheelCreatedAtMs = Number(tx?.timestampMs || 0);
						found = true;
						break;
					}
				}
				if (!res?.hasNextPage || found) break;
				cursor = res.nextCursor;
			}
		} catch {
			// Silently fail, keep defaults
		}
	}
</script>

<section class="container mx-auto px-4 py-6">
	<div class="mb-4 flex items-center justify-between">
		<h1 class="text-xl font-bold">Wheel Results</h1>
		{#if wheelId}
			<div class="flex items-center gap-2">
				<span class="text-sm opacity-70"
					>Wheel ID:
					<a
						class="link link-primary font-mono"
						href={`https://testnet.suivision.xyz/object/${wheelId}`}
						target="_blank"
						rel="noopener noreferrer">{shortenAddress(wheelId)}</a
					></span
				>
				{#if isCancelled}
					<span class="badge badge-warning badge-sm">Cancelled</span>
				{:else if remainingSpins > 0}
					<span class="badge badge-primary badge-sm">Running</span>
				{:else}
					<span class="badge badge-neutral badge-sm">Finished</span>
				{/if}
			</div>
		{/if}
	</div>

	{#if error}
		<div class="alert alert-error mb-4">{error}</div>
	{/if}

	{#if loading}
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
			<div class="lg:col-span-2">
				<div class="space-y-3">
					<div class="skeleton h-6 w-40"></div>
					<div class="skeleton h-8 w-full"></div>
					<div class="skeleton h-8 w-full"></div>
					<div class="skeleton h-8 w-3/4"></div>
				</div>
			</div>
			<div>
				<div class="space-y-3">
					<div class="skeleton h-6 w-32"></div>
					<div class="skeleton h-24 w-full"></div>
				</div>
			</div>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
			<div class="overflow-x-auto lg:col-span-2">
				<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
					<div class="text-sm opacity-80">
						Pool balance: <span class="font-mono font-semibold"
							>{formatMistToSuiCompact(poolBalanceMist)} SUI</span
						>
					</div>

					{#if wheelCreatedAtMs > 0}
						<div class="text-sm opacity-80">
							Created
							<span title={new Date(wheelCreatedAtMs).toISOString()}>
								{formatDistanceToNow(new Date(wheelCreatedAtMs), { addSuffix: true })}
							</span>
							{#if wheelCreatedTx}
								<a
									class="link link-primary ml-2"
									href={`https://testnet.suivision.xyz/txblock/${wheelCreatedTx}`}
									target="_blank"
									rel="noopener noreferrer">View tx</a
								>
							{/if}
						</div>
					{/if}
				</div>

				{#if lastReclaim.timestampMs > 0 && isOrganizer}
					<div class="text-base-content/70 mb-4 text-xs">
						Last reclaim:
						<strong>{formatMistToSuiCompact(lastReclaim.amount)} SUI</strong>
						on
						<span title={new Date(lastReclaim.timestampMs).toISOString()}>
							{format(new Date(lastReclaim.timestampMs), 'PPpp')} ({formatDistanceToNow(
								new Date(lastReclaim.timestampMs),
								{ addSuffix: true }
							)})
						</span>
						{#if lastReclaim.digest}
							<a
								class="link link-primary ml-2"
								href={`https://testnet.suivision.xyz/txblock/${lastReclaim.digest}`}
								target="_blank"
								rel="noopener noreferrer">View tx</a
							>
						{/if}
					</div>
				{/if}
				{#if account.value && isOrganizer}
					{#if canOrganizerReclaim() && poolBalanceMist > 0n}
						<div class="mt-4">
							<ButtonLoading
								formLoading={reclaimLoading}
								color="warning"
								loadingText="Reclaiming..."
								onclick={reclaimPool}>Reclaim pool to organizer</ButtonLoading
							>
						</div>
					{/if}
				{/if}

				<h2 class="text-lg font-semibold">Winners</h2>
				<div class="mb-6 overflow-x-auto">
					<table class="table-zebra table">
						<thead>
							<tr>
								<th>#</th>
								<th>Amount</th>
								<th>Winner</th>
								<th>Spun at</th>
							</tr>
						</thead>
						<tbody>
							{#each prizeAmounts as m, i}
								<tr>
									<td class="w-12">{i + 1}</td>
									<td class="font-mono">{formatMistToSuiCompact(m)}</td>
									<td class="font-mono"
										>{findWinner(i) ? shortenAddress(findWinner(i).addr) : '—'}
										{#if findWinner(i) && isYou(findWinner(i).addr)}
											<span class="badge badge-neutral badge-sm ml-2 text-xs opacity-70">You</span>
										{/if}
									</td>
									<td class="text-sm opacity-80">
										{#if Number(spinTimes[i] || 0) > 0}
											<span title={new Date(spinTimes[i]).toISOString()}>
												{spunAtTexts[i]}
											</span>
										{:else}
											<span class="opacity-60">—</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				{#if nonWinningEntries.length > 0}
					<h2 class="text-lg font-semibold">Non-winning entries</h2>

					<div class="overflow-x-auto">
						<table class="table-zebra table">
							<thead>
								<tr>
									<th>#</th>
									<th>Address</th>
								</tr>
							</thead>
							<tbody>
								{#each nonWinningEntries as addr, idx}
									<tr class:active={isYou(addr)}>
										<td class="w-12">{idx + 1}</td>
										<td class="flex items-center font-mono"
											>{shortenAddress(addr)}
											{#if isYou(addr)}
												<span class="badge badge-neutral badge-sm ml-2 text-xs opacity-70">You</span
												>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
			<div>
				<div class="card bg-base-200 shadow">
					<div class="card-body">
						<h3 class="mb-2 text-lg font-semibold">Your prize</h3>

						{#if isCancelled}
							<div class="alert alert-info mb-3 text-sm">
								<span class="icon-[lucide--heart]"></span>
								<span>This wheel has been cancelled! 🌟</span>
							</div>
						{:else if !account.value}
							<div class="alert alert-info mb-3 text-sm">
								<span class="icon-[lucide--info]"></span>
								<span>Connect your wallet to view your prize and claim it! 🔑</span>
							</div>
						{:else if winnerInfo}
							{#if winnerInfo.claimed}
								<div class="alert alert-success mb-3 text-sm">
									<span class="icon-[lucide--party-popper]"></span>
									<span>Congratulations on your win! 🎉</span>
								</div>
							{:else}
								<div class="alert alert-warning mb-3 text-sm">
									<span class="icon-[lucide--gift]"></span>
									<span>Your prize is waiting! Don't forget to claim it!</span>
								</div>
							{/if}
						{:else}
							<div class="alert border-info alert-outline mb-3 text-sm">
								<span class="icon-[lucide--circle-alert] h-4 w-4"></span>
								<span>You are not a winner for this wheel.</span>
							</div>
						{/if}

						{#if winnerInfo}
							<div class="mb-2 text-sm">
								<span class="opacity-70">Winner:</span>
								<span class="ml-1 font-mono">{shortenAddress(winnerInfo.addr)}</span>
							</div>
							<div class="mb-3 text-sm">
								<span class="opacity-70">Prize:</span>
								<strong class="ml-1"
									>{formatMistToSuiCompact(prizeAmounts[winnerPrizeIndex] ?? 0n)} SUI</strong
								>
							</div>

							{#if winnerInfo.claimed}
								<div class="badge badge-success">Claimed</div>
								{#if lastClaim.timestampMs > 0}
									<div class="mt-2 text-xs opacity-80">
										Claimed at
										<span
											class="text-secondary"
											title={new Date(lastClaim.timestampMs).toISOString()}
										>
											{format(new Date(lastClaim.timestampMs), 'PPpp')} ({formatDistanceToNow(
												new Date(lastClaim.timestampMs),
												{ addSuffix: true }
											)})
										</span>.
									</div>

									{#if lastClaim.digest}
										<a
											class="link hover:link-primary flex items-center"
											href={`https://testnet.suivision.xyz/txblock/${lastClaim.digest}`}
											target="_blank"
											rel="noopener noreferrer"
										>
											<span class="mr-2">View tx</span>
											<span class="icon-[lucide--external-link]"></span>
										</a>
									{/if}
								{/if}
							{:else if winnerPrizeIndex >= 0}
								{#if getClaimState(winnerPrizeIndex).state === 'claimable'}
									<ButtonLoading
										formLoading={reclaimLoading}
										color="primary"
										loadingText="Claiming..."
										onclick={() => claim(winnerPrizeIndex)}>Claim prize</ButtonLoading
									>
								{:else if getClaimState(winnerPrizeIndex).state === 'too_early'}
									<div class="text-xs opacity-80">
										Starts in {formatDuration(getClaimState(winnerPrizeIndex).startsInMs)}
									</div>
								{:else}
									<div class="text-error text-xs">Expired</div>
								{/if}
							{:else}
								<div class="text-sm opacity-70">You are not a winner for this wheel.</div>
							{/if}
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}
</section>
