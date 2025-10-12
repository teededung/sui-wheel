<script>
	import { onMount } from 'svelte';
	import { Transaction } from '@mysten/sui/transactions';
	import {
		useSuiClient,
		useCurrentAccount,
		signAndExecuteTransaction
	} from 'sui-svelte-wallet-kit';
	import { shortenAddress } from '$lib/utils/string.js';
	import {
		formatMistToSuiCompact,
		isTestnet,
		highlightAddress,
		getExplorerLink
	} from '$lib/utils/suiHelpers.js';
	import {
		LATEST_PACKAGE_ID,
		WHEEL_MODULE,
		WHEEL_FUNCTIONS,
		WHEEL_STRUCT,
		CLOCK_OBJECT_ID,
		WHEEL_EVENTS
	} from '$lib/constants.js';
	import { toast } from 'svelte-daisy-toaster';
	import { format, formatDistanceToNow } from 'date-fns';
	import { watch } from 'runed';
	import { useSearchParams } from 'runed/kit';
	import { searchParamsSchema } from '$lib/paramSchema.js';

	// Components
	import ButtonLoading from '$lib/components/ButtonLoading.svelte';
	import ButtonCopy from '$lib/components/ButtonCopy.svelte';
	import { useTranslation } from '$lib/hooks/useTranslation.js';

	const t = useTranslation();

	const suiClient = $derived(useSuiClient());
	const account = $derived(useCurrentAccount());

	let isOnTestnet = $derived.by(() => isTestnet(account));

	// Reactive URL search params
	const params = useSearchParams(searchParamsSchema);

	let loading = $state(true);
	let reclaimLoading = $state(false);
	let claimLoading = $state(false);
	let error = $state('');

	let wheelId = $derived(params.wheelId);

	let winners = $state([]);
	let prizeAmounts = $state([]);
	let spinTimes = $state([]);
	let spunAtTexts = $state([]);
	let delayMs = $state(0);
	let claimWindowMs = $state(0);
	let organizer = $state('');
	let nowMs = $state(Date.now());

	// Wheel meta
	let wheelCreatedAtMs = $state(0);
	let isCancelled = $state(false);

	let ticker;
	let poolBalanceMist = $state(0n);
	let lastReclaim = $state({ amount: 0n, timestampMs: 0, digest: '' });
	let lastClaim = $state({ amount: 0n, timestampMs: 0, digest: '' });

	// Non-winning entries (remaining entries on chain)
	let nonWinningEntries = $state([]);
	let winnerInfo = $derived.by(() => {
		try {
			const addr = account?.address.toLowerCase();
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

	// Watch wheelId change
	watch(
		() => wheelId,
		async () => {
			await fetchData(wheelId);

			// Precompute static "Spun at" texts based on current time once
			const base = Date.now();
			spunAtTexts = (spinTimes || []).map(ts => formatRelativePreciseAt(ts, base));
		}
	);

	// Watch isOrganizer change
	watch(
		() => isOrganizer,
		async () => {
			if (!account && !wheelId && !isOrganizer) return;
			await fetchReclaimEvents(wheelId);
		}
	);

	// Watch winnerInfo change
	watch(
		() => winnerInfo,
		async () => {
			if (!account && !wheelId && !winnerInfo) return;
			await fetchClaimEventsForWinner(wheelId);
		}
	);

	async function fetchWheelCreationTimestamp(wheelId) {
		if (!wheelId) return;
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

			const transactions = response?.data || [];
			for (const tx of transactions) {
				const created = (tx?.objectChanges || []).find(
					ch =>
						ch?.type === 'created' &&
						String(ch?.objectType || '').endsWith(`::${WHEEL_MODULE}::${WHEEL_STRUCT}`) &&
						String(ch?.objectId || '').toLowerCase() === String(wheelId).toLowerCase()
				);
				if (created?.objectId) {
					wheelCreatedAtMs = Number(tx?.timestampMs || 0);
					return;
				}
			}
		} catch (e) {
			console.error('Failed to fetch wheel creation timestamp:', e);
		}
	}

	async function fetchData(wheelId) {
		if (!wheelId) return;
		loading = true;
		error = '';
		try {
			const wheelContent = await suiClient.getObject({
				id: wheelId,
				options: { showContent: true }
			});

			const f = wheelContent?.data?.content?.fields ?? {};

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

			// Fetch wheel creation timestamp
			await fetchWheelCreationTimestamp(wheelId);
		} catch (e) {
			error = e?.message || String(e);
		} finally {
			loading = false;
		}
	}

	async function fetchReclaimEvents(wheelId) {
		try {
			if (!wheelId || !account) return;
			const eventType = `${LATEST_PACKAGE_ID}::${WHEEL_MODULE}::${WHEEL_EVENTS.RECLAIM}`;
			let cursor = null;
			let hasNextPage = true;
			let allEvents = [];
			while (hasNextPage) {
				const res = await suiClient.queryEvents({
					query: { MoveEventType: eventType },
					limit: 100,
					cursor
				});
				const events = Array.isArray(res?.data) ? res.data : [];
				allEvents = allEvents.concat(events);
				cursor = res.nextCursor;
				hasNextPage = res.hasNextPage;
			}
			const filtered = allEvents.filter(e => {
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

	async function fetchClaimEventsForWinner(wheelId) {
		try {
			if (!wheelId || !account) return;
			const eventType = `${LATEST_PACKAGE_ID}::${WHEEL_MODULE}::${WHEEL_EVENTS.CLAIM}`;
			let cursor = null;
			let hasNextPage = true;
			let allEvents = [];
			while (hasNextPage) {
				const res = await suiClient.queryEvents({
					query: { MoveEventType: eventType },
					limit: 100,
					cursor
				});
				const events = Array.isArray(res?.data) ? res.data : [];
				allEvents = allEvents.concat(events);
				cursor = res.nextCursor;
				hasNextPage = res.hasNextPage;
			}
			const who = String(account?.address).toLowerCase();
			const filtered = allEvents.filter(e => {
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
		let state = 'claimable';
		if (now < start) state = 'too_early';
		if (now >= end) state = 'expired';
		return { state, startsInMs: start - now, endsInMs: end - now };
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
		if (!account) {
			error = t('wheelResult.errors.connectWalletToClaim');
			return;
		}
		error = '';
		claimLoading = true;
		const toastInstance = toast.loading(t('wheelResult.claiming'), { position: 'bottom-right' });
		try {
			const tx = new Transaction();
			// Call claim to get a Coin<SUI> back in the PTB
			const claimedCoin = tx.moveCall({
				target: `${LATEST_PACKAGE_ID}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.CLAIM}`,
				arguments: [tx.object(wheelId), tx.object(CLOCK_OBJECT_ID)]
			});
			// Transfer the returned coin to the sender's address
			tx.transferObjects([claimedCoin], tx.pure.address(account?.address));

			const res = await signAndExecuteTransaction(tx);
			const digest = res?.digest ?? res?.effects?.transactionDigest;
			if (!digest) throw new Error('Missing tx digest for claim');

			// Wait for transaction to be confirmed on-chain
			await suiClient.waitForTransaction({
				digest,
				options: { showEvents: true }
			});

			// Refresh data after transaction is confirmed
			await fetchData(wheelId);
			await fetchClaimEventsForWinner(wheelId);
		} catch (e) {
			error = e?.message || String(e);
		} finally {
			claimLoading = false;
			toastInstance.dismiss();
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
		const acc = account?.address.toLowerCase();
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
		if (!account) {
			error = t('wheelResult.errors.connectWalletToReclaim');
			return;
		}
		if (!isOrganizer) {
			error = t('wheelResult.errors.onlyOrganizerCanReclaim');
			return;
		}
		if (!canOrganizerReclaim()) {
			error = t('wheelResult.errors.poolCannotBeReclaimedYet');
			return;
		}
		error = '';
		reclaimLoading = true;

		try {
			const tx = new Transaction();
			// Call reclaim_pool to get Coin<SUI> and transfer to organizer (sender)
			const coin = tx.moveCall({
				target: `${LATEST_PACKAGE_ID}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.RECLAIM}`,
				arguments: [tx.object(wheelId), tx.object(CLOCK_OBJECT_ID)]
			});
			tx.transferObjects([coin], tx.pure.address(account.address));

			const res = await signAndExecuteTransaction(tx);
			const digest = res?.digest ?? res?.effects?.transactionDigest;
			if (!digest) throw new Error('Missing tx digest for reclaim');

			// Wait for transaction to be confirmed on-chain
			await suiClient.waitForTransaction({
				digest,
				options: { showEvents: true }
			});

			// Refresh data after transaction is confirmed
			await fetchData(wheelId);
			await fetchReclaimEvents(wheelId);

			if (lastReclaim.digest) {
				toast.success(t('wheelResult.success.reclaimedPoolSuccessfully'), {
					position: 'bottom-right',
					durationMs: 1500,
					button: {
						text: t('wheelResult.success.openOnSuivision'),
						class: 'btn btn-primary btn-sm',
						callback: () => {
							window.open(
								`${getExplorerLink('testnet', 'txblock', lastReclaim.digest)}`,
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
				error = t('wheelResult.errors.reclaimWindowNotYetOpen');
			} else if (error.includes('ENoRemaining')) {
				error = t('wheelResult.errors.noRemainingFunds');
			}
		} finally {
			reclaimLoading = false;
		}
	}

	function isYou(addr) {
		return String(account?.address || '').toLowerCase() === String(addr).toLowerCase();
	}
</script>

<svelte:head>
	<title>{t('wheelResult.title')}</title>
	<meta name="description" content={t('wheelResult.metaDescription')} />
	<meta property="og:title" content={t('wheelResult.ogTitle')} />
	<meta property="og:description" content={t('wheelResult.ogDescription')} />
</svelte:head>

<section class="container mx-auto px-4 py-6">
	{#if account && !isOnTestnet}
		<div class="alert alert-warning mb-4 text-sm">
			<span class="icon-[lucide--triangle-alert] h-4 w-4"></span>
			<span>{t('wheelResult.testnetWarning')}</span>
		</div>
	{/if}
	<div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		<h1 class="text-xl font-bold">{t('wheelResult.pageTitle')}</h1>
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
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
			<div class="order-2 overflow-x-auto lg:order-1 lg:col-span-2">
				{#if lastReclaim.timestampMs > 0 && isOrganizer}
					<div class="text-base-content/70 mb-4 text-xs">
						{t('wheelResult.lastReclaim')}
						<strong>{formatMistToSuiCompact(lastReclaim.amount)} SUI</strong>
						{t('wheelResult.on')}
						<span title={new Date(lastReclaim.timestampMs).toISOString()}>
							{format(new Date(lastReclaim.timestampMs), 'PPpp')} ({formatDistanceToNow(
								new Date(lastReclaim.timestampMs),
								{ addSuffix: true }
							)})
						</span>
						{#if lastReclaim.digest}
							<a
								class="link link-primary ml-2"
								href={`${getExplorerLink('testnet', 'txblock', lastReclaim.digest)}`}
								target="_blank"
								rel="noopener noreferrer">{t('wheelResult.viewTx')}</a
							>
						{/if}
					</div>
				{/if}

				<h2 class="mt-6 mb-3 text-lg font-semibold">
					{t('wheelResult.winners')} ({winners.length})
				</h2>
				<div class="card bg-base-200 border-base-300 mb-6 border shadow-sm">
					<div class="card-body p-0">
						<div class="overflow-x-auto">
							<table class="table">
								<thead>
									<tr>
										<th>{t('wheelResult.table.number')}</th>
										<th>{t('wheelResult.table.amount')}</th>
										<th>{t('wheelResult.table.winner')}</th>
										<th>{t('wheelResult.table.spunAt')}</th>
									</tr>
								</thead>
								<tbody>
									{#each prizeAmounts as m, i}
										<tr>
											<td class="w-12">{i + 1}</td>
											<td class="flex items-center gap-1">
												<span class="text-primary font-mono">{formatMistToSuiCompact(m)}</span>
												<span class="text-base-content/80 text-xs">SUI</span>
											</td>
											<td class="font-mono">
												<div class="flex items-center">
													{findWinner(i) ? shortenAddress(findWinner(i).addr) : '—'}
													{#if findWinner(i) && isYou(findWinner(i).addr)}
														<span class="badge badge-neutral badge-sm ml-2 text-xs opacity-70"
															>{t('wheelResult.you')}</span
														>
													{/if}
												</div>
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
					</div>
				</div>

				{#if nonWinningEntries.length > 0}
					<h2 class="mt-6 mb-3 text-lg font-semibold">
						{t('wheelResult.nonWinningEntries')}
						({nonWinningEntries.length})
					</h2>

					<div class="card bg-base-200 border-base-300 mb-6 border shadow-sm">
						<div class="card-body p-0">
							<div class="overflow-x-auto">
								<table class="table">
									<thead>
										<tr>
											<th>{t('wheelResult.tableNonWinning.number')}</th>
											<th>{t('wheelResult.tableNonWinning.address')}</th>
										</tr>
									</thead>
									<tbody>
										{#each nonWinningEntries as addr, idx}
											<tr class:active={isYou(addr)}>
												<td class="w-12">{idx + 1}</td>
												<td class="flex items-center font-mono"
													>{@html highlightAddress(addr)}
													{#if isYou(addr)}
														<span class="badge badge-neutral badge-sm ml-2 text-xs opacity-70"
															>{t('wheelResult.you')}</span
														>
													{/if}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				{/if}
			</div>
			<div class="order-1 mb-4 lg:order-2 lg:mb-0">
				<div class="card bg-base-200 border-base-300 border-1 shadow">
					<div class="card-body">
						{#if isCancelled}
							<div class="alert alert-soft dark:!border-warning alert-warning text-sm">
								<span class="icon-[lucide--info] h-4 w-4"></span>
								<span>{t('wheelResult.wheelCancelled')}</span>
							</div>
						{:else if !account}
							<div class="alert alert-soft dark:!border-info alert-info text-sm">
								<span class="icon-[lucide--info] h-4 w-4"></span>
								<span>{t('wheelResult.connectWallet')}</span>
							</div>
						{:else if winnerInfo}
							<h3 class="mb-2 text-lg font-semibold">{t('wheelResult.yourPrize')}</h3>
							{#if winnerInfo.claimed}
								<div class="alert alert-success mb-3 text-sm">
									<span class="icon-[lucide--party-popper] h-6 w-6"></span>
									<p>
										<strong class="mb-1 block">{t('wheelResult.congratulations')}</strong>
										{#if lastClaim.timestampMs > 0}
											<span class="block text-xs">
												<span>{t('wheelResult.claimedAt')}</span>
												<span
													class="text-primary"
													title={new Date(lastClaim.timestampMs).toISOString()}
												>
													{format(new Date(lastClaim.timestampMs), 'PPpp')}</span
												>
												<span>
													({formatDistanceToNow(new Date(lastClaim.timestampMs), {
														addSuffix: true
													})}).</span
												>
												{#if lastClaim.digest}
													<a
														class="link link-primary hover:link-primary mt-1 flex items-center"
														href={`${getExplorerLink('testnet', 'txblock', lastClaim.digest)}`}
														target="_blank"
														rel="noopener noreferrer"
													>
														<span class="mr-2">{t('wheelResult.viewTx')}</span>
														<span class="icon-[lucide--external-link]"></span>
													</a>
												{/if}
											</span>
										{/if}
									</p>
								</div>
							{:else if getClaimState(winnerPrizeIndex).state === 'claimable'}
								<div class="alert alert-success mb-3 text-sm">
									<span class="icon-[lucide--gift] h-4 w-4"></span>
									<span>{t('wheelResult.congratulationsClaim')}</span>
								</div>
							{:else if getClaimState(winnerPrizeIndex).state === 'expired'}
								<div class="alert alert-error mb-3 text-sm">
									<span class="icon-[lucide--circle-alert] h-4 w-4"></span>
									<span>{t('wheelResult.claimExpired')}</span>
								</div>
							{/if}
						{:else if remainingSpins > 0}
							<div class="alert alert-info text-sm">
								<span class="icon-[lucide--clock] h-4 w-4"></span>
								<span>{t('wheelResult.wheelRunning')}</span>
							</div>
						{:else}
							<div class="alert border-info alert-outline text-sm">
								<span class="icon-[lucide--circle-alert] h-4 w-4"></span>
								<span>{t('wheelResult.notWinner')}</span>
							</div>
						{/if}

						{#if winnerInfo}
							{#if !winnerInfo.claimed}
								{#if winnerPrizeIndex >= 0}
									{#if getClaimState(winnerPrizeIndex).state === 'claimable'}
										<ButtonLoading
											formLoading={claimLoading}
											color="primary"
											loadingText={t('wheelResult.claiming')}
											onclick={() => claim(winnerPrizeIndex)}
											disabled={!isOnTestnet}
											className="mb-2"
											>{t('wheelResult.claim')}
											{formatMistToSuiCompact(prizeAmounts[winnerPrizeIndex] ?? 0n)} SUI</ButtonLoading
										>
									{/if}
									{#if getClaimState(winnerPrizeIndex).state === 'too_early'}
										<div class="text-xs opacity-80">
											{t('wheelResult.startsIn')}
											{formatDuration(getClaimState(winnerPrizeIndex).startsInMs)}
										</div>
									{:else}
										<div class="text-error text-xs">
											{t('wheelResult.claimExpiredOn')}
											<strong
												class="ml-1"
												title={new Date(
													(spinTimes[winnerPrizeIndex] ?? 0) + delayMs + claimWindowMs
												).toISOString()}
											>
												{format(
													new Date((spinTimes[winnerPrizeIndex] ?? 0) + delayMs + claimWindowMs),
													'PPpp'
												)}
											</strong>
											<span class="text-base-content"
												>({formatDistanceToNow(
													new Date((spinTimes[winnerPrizeIndex] ?? 0) + delayMs + claimWindowMs),
													{ addSuffix: true }
												)})</span
											>
										</div>
									{/if}
								{:else}
									<div class="text-sm opacity-70">{t('wheelResult.notWinner')}</div>
								{/if}
							{/if}
						{/if}
					</div>
				</div>

				{#if wheelId}
					<div class="card bg-base-200 border-base-300 mt-4 border-1 shadow">
						<div class="card-body">
							<div class="flex max-w-full items-center gap-2 text-sm">
								<span class="mr-1 inline-block">{t('wheelResult.wheelId')}</span>
								<span
									class="inline-block max-w-[12rem] truncate font-mono text-xs sm:max-w-[16rem]"
									title={wheelId}>{shortenAddress(wheelId)}</span
								>
								<ButtonCopy originText={wheelId} size="xs" className="ml-1 btn-soft" />
								<a
									class="btn btn-soft btn-xs flex items-center gap-1"
									href={`${getExplorerLink('testnet', 'object', wheelId)}`}
									target="_blank"
									rel="noopener noreferrer"
									>{t('wheelResult.suivision')}
									<span class="icon-[lucide--external-link]"></span></a
								>
							</div>

							<div class="mt-1 flex flex-wrap items-center gap-2 text-sm">
								{t('wheelResult.status')}
								{#if isCancelled}
									<span class="badge badge-warning badge-sm"
										><span class="icon-[lucide--circle-x]"></span>
										{t('wheelList.status.cancelled')}</span
									>
								{:else if remainingSpins > 0}
									<span class="badge badge-primary badge-sm"
										><span class="icon-[lucide--clock]"></span>
										{t('wheelList.status.running')}</span
									>
								{:else}
									<span class="badge badge-success badge-sm"
										><span class="icon-[lucide--check]"></span>
										{t('wheelList.status.finished')}</span
									>
								{/if}
							</div>

							<div class="mt-1 flex items-center gap-2">
								<div class="flex gap-2 text-sm">
									{t('wheelResult.remainingPoolBalance')}
									<div class="flex items-center gap-1 font-mono font-semibold">
										<span class="text-primary">{formatMistToSuiCompact(poolBalanceMist)}</span>
										<span class="text-base-content/80 text-xs">SUI</span>
									</div>
								</div>
								{#if account && isOrganizer && canOrganizerReclaim() && poolBalanceMist > 0n}
									<ButtonLoading
										formLoading={reclaimLoading}
										color="warning"
										size="xs"
										loadingText={t('wheelResult.reclaiming')}
										onclick={reclaimPool}
										disabled={!isOnTestnet}>{t('wheelResult.reclaim')}</ButtonLoading
									>
								{/if}
							</div>

							{#if wheelCreatedAtMs > 0 && !isNaN(new Date(wheelCreatedAtMs).getTime())}
								<div class="mt-1 flex items-center gap-1 text-sm">
									<span>{t('wheelResult.created')} </span>
									<span class="text-base-content/80 text-xs"
										>{format(wheelCreatedAtMs, "MMMM d, yyyy 'at' h:mm a")}</span
									>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</section>
