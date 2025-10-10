<script>
	import { onMount } from 'svelte';
	import { watch } from 'runed';
	import { page } from '$app/state';
	import { useSearchParams } from 'runed/kit';
	import { searchParamsSchema } from '$lib/paramSchema.js';
	import { Transaction } from '@mysten/sui/transactions';
	import { toast } from 'svelte-daisy-toaster';
	import { formatDistanceToNow } from 'date-fns';
	import {
		useSuiClient,
		useCurrentAccount,
		signAndExecuteTransaction,
		suiBalance,
		suiBalanceLoading
	} from 'sui-svelte-wallet-kit';
	import { shortenAddress, arraysShallowEqual, shuffleArray } from '$lib/utils/string.js';
	import {
		isValidSuiAddress,
		parseSuiToMist,
		formatMistToSuiCompact,
		isTestnet
	} from '$lib/utils/suiHelpers.js';

	import ButtonLoading from '$lib/components/ButtonLoading.svelte';
	import ButtonCopy from '$lib/components/ButtonCopy.svelte';
	import Wheel from '$lib/components/Wheel.svelte';
	import { wheelContext } from '$lib/context/wheel.js';
	import { useTranslation } from '$lib/hooks/useTranslation.js';
	import QRCode from 'qrcode';

	const t = useTranslation();

	import {
		LATEST_PACKAGE_ID,
		// MIST_PER_SUI,
		WHEEL_MODULE,
		WHEEL_FUNCTIONS,
		MINIMUM_PRIZE_AMOUNT,
		MAX_ENTRIES,
		RANDOM_OBJECT_ID,
		CLOCK_OBJECT_ID
	} from '$lib/constants.js';

	// Language - using translation hook instead

	const suiClient = $derived(useSuiClient());
	const account = $derived(useCurrentAccount());

	// State
	let entries = $state([
		'0x4e4ab932a358e66e79cce1d94457d50029af1e750482ca3619ea3dd41f1c62b4',
		'0x860de660df6f748354e7a6d44b36d302f9dbe70938b957837bf8556d258ca35f',
		'0xf4be218d73c57b9622de671b683221274f9f5a306a2825c470563249e2c718e5'
	]);

	// Reactive URL search params
	const params = useSearchParams(searchParamsSchema);

	// Blockchain setup state
	let packageId = $state(LATEST_PACKAGE_ID);
	let prizeAmounts = $state(['']); // SUI amounts as strings (decimal supported)
	let delayMs = $state(0);
	let claimWindowMs = $state(1440); // 24 hours
	let setupLoading = $state(false);
	let setupError = $state('');
	let setupSuccessMsg = $state('');

	// Reactive wheel ID from URL params
	let createdWheelId = $derived(params.wheelId);

	// View/Edit and on-chain fetched state
	let isEditing = $state(false);
	let wheelFetched = $state(false);
	let entriesOnChain = $state([]);
	let prizesOnChainMist = $state([]);
	let spunCountOnChain = $state(0);
	let delayMsOnChain = $state(0);
	let claimWindowMsOnChain = $state(0);
	let poolBalanceMistOnChain = $state(0n);
	let winnersOnChain = $state([]);
	let spinTimesOnChain = $state([]);

	// Cancellation state
	let isCancelled = $state(false);

	// QR code for results link when wheel is finished
	let qrDataUrl = $state('');
	$effect(() => {
		try {
			if (createdWheelId && remainingSpins === 0 && typeof window !== 'undefined') {
				const url = `${window.location.origin}/wheel-result?wheelId=${createdWheelId}`;
				QRCode.toDataURL(url, { width: 256, margin: 1 })
					.then(u => (qrDataUrl = u))
					.catch(() => (qrDataUrl = ''));
			} else {
				qrDataUrl = '';
			}
		} catch {
			qrDataUrl = '';
		}
	});

	// QR code for entry form
	let entryFormQRDataUrl = $state('');
	$effect(() => {
		try {
			if (entryFormEnabled && typeof window !== 'undefined') {
				// Use wheelTempId if wheel not created yet, otherwise use createdWheelId
				const wheelId = createdWheelId || generateWheelTempId();
				const nameParam = entryFormModalName
					? `&name=${encodeURIComponent(entryFormModalName)}`
					: '';
				const url = `${window.location.origin}/entry-form?wheelId=${wheelId}&type=${entryFormType}${nameParam}`;
				entryFormQRUrl = url;
				QRCode.toDataURL(url, { width: 256, margin: 1 })
					.then(u => (entryFormQRDataUrl = u))
					.catch(() => (entryFormQRDataUrl = ''));
			} else {
				entryFormQRDataUrl = '';
				entryFormQRUrl = '';
			}
		} catch {
			entryFormQRDataUrl = '';
			entryFormQRUrl = '';
		}
	});

	// Action loading states
	let updateLoading = $state(false);
	let cancelLoading = $state(false);

	// Real-time entry updates
	let entryPollingInterval = $state(null);
	let lastEntryCount = $state(0);
	let onlineEntriesCount = $state(0);

	// Compute additional SUI (in MIST) needed to top up the pool when editing
	let topUpMist = $derived.by(() => {
		try {
			const desired = prizeAmounts.reduce((acc, v) => acc + parseSuiToMist(v), 0n);
			const currentPool = poolBalanceMistOnChain || 0n;
			return desired > currentPool ? desired - currentPool : 0n;
		} catch {
			return 0n;
		}
	});

	let totalDonationMist = $derived.by(() => {
		try {
			return prizeAmounts.reduce((acc, v) => acc + parseSuiToMist(v), 0n);
		} catch {
			return 0n;
		}
	});

	let isOnTestnet = $derived.by(() => isTestnet(account));

	// UI: active tab in settings (entries | prizes | settings)
	let activeTab = $state('entries');

	// UI: view mode for entries (table | textarea)
	let entriesViewMode = $state('textarea');

	// UI: table expanded state
	let tableExpanded = $state(false);

	// Entry form settings
	let entryFormEnabled = $state(false);
	let entryFormType = $state('address'); // 'address' or 'name'
	let entryFormQRUrl = $state('');
	let wheelTempId = $state(''); // Temporary ID for online entries before wheel creation

	let spinning = $state(false);
	let entriesTextareaEl = $state(null);
	let entriesText = $state('');

	// Duplicate entries tracking
	let duplicateEntries = $state([]);

	// Index order state: maps current `entries` positions -> original indices in `entriesOnChain`
	let shuffledIndexOrder = $state([]);

	// Expose helpers to Wheel component via context
	function setWheelSpinning(v) {
		spinning = Boolean(v);
	}

	// Remove entry value from entries array
	function removeEntryValue(value) {
		const v = String(value ?? '').trim();
		entries = entries.filter(entry => String(entry ?? '').trim() !== v);
		entriesText = entries.join('\n');
	}

	// Remaining spins based on on-chain prizes and spun count
	let remainingSpins = $derived.by(() =>
		Math.max(0, (prizesOnChainMist.length || 0) - (spunCountOnChain || 0))
	);

	let invalidEntriesCount = $derived.by(() => {
		const lines = entries.map(s => String(s ?? '').trim()).filter(s => s.length > 0);
		return lines.filter(s => !isValidSuiAddress(s)).length;
	});

	let uniqueValidEntriesCount = $derived.by(() => {
		const valid = entries
			.map(s => String(s ?? '').trim())
			.filter(s => s.length > 0 && isValidSuiAddress(s))
			.map(s => s.toLowerCase());
		return new Set(valid).size;
	});

	let prizesCount = $derived.by(() => prizeAmounts.filter(v => parseSuiToMist(v) > 0n).length);

	let invalidPrizeAmountsCount = $derived.by(() => {
		return prizeAmounts.filter(v => {
			const mist = parseSuiToMist(v);
			return mist > 0n && mist < MINIMUM_PRIZE_AMOUNT.MIST;
		}).length;
	});

	let hasInsufficientBalance = $derived.by(() => {
		// Do not warn about balance until wallet and balance are fully loaded
		if (!account) return false;
		if (suiBalanceLoading?.value) return false;
		try {
			return suiBalance.value - 1_000_000_000 < totalDonationMist;
		} catch {
			return false;
		}
	});

	// Consolidated warnings visibility
	let hasSetupWarnings = $derived.by(
		() =>
			invalidEntriesCount > 0 ||
			uniqueValidEntriesCount < 2 ||
			prizesCount === 0 ||
			prizesCount > uniqueValidEntriesCount ||
			invalidPrizeAmountsCount > 0 ||
			entries.length > MAX_ENTRIES ||
			hasInsufficientBalance ||
			!isOnTestnet
	);

	// Final condition to show setup warnings
	let shouldShowSetupWarnings = $derived.by(() => {
		return hasSetupWarnings && ((isEditing && createdWheelId) || !createdWheelId);
	});

	function addPrize() {
		prizeAmounts = [...prizeAmounts, ''];
	}

	function removePrize(idx) {
		if (prizeAmounts.length <= 1) return;
		prizeAmounts = prizeAmounts.filter((_, i) => i !== idx);
	}

	function updatePrizeAmount(index, value) {
		prizeAmounts = prizeAmounts.map((v, i) => (i === index ? value : v));
	}

	function handlePrizeKeydown(index, e) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addPrize();
			setTimeout(() => {
				const els = document.querySelectorAll('.prize-input');
				const el = els[els.length - 1];
				if (el && typeof el.focus === 'function') el.focus();
			}, 0);
		}
	}

	function getAddressEntries() {
		return entries
			.map(s => String(s ?? '').trim())
			.filter(s => s.length > 0 && isValidSuiAddress(s));
	}

	function validateSetup() {
		const errors = [];
		if (!account) errors.push(t('main.errors.walletNotConnected'));
		if (!isOnTestnet) errors.push(t('main.errors.walletMustBeOnTestnet'));
		if (!packageId || packageId.trim().length === 0)
			errors.push(t('main.errors.packageIdRequired'));
		const addrList = getAddressEntries();
		if (addrList.length < 2) errors.push(t('main.errors.atLeast2Addresses'));
		if (addrList.length > MAX_ENTRIES)
			errors.push(t('main.errors.entriesCountLimit', { maxEntries: MAX_ENTRIES }));
		const prizesCount = prizeAmounts.filter(v => parseSuiToMist(v) > 0n).length;
		if (prizesCount === 0) errors.push(t('main.errors.addAtLeast1Prize'));
		if (addrList.length < prizesCount) errors.push(t('main.errors.entriesMustBeGreaterThanPrizes'));
		// unique addresses check
		const uniqueCount = new Set(addrList.map(a => a.toLowerCase())).size;
		if (uniqueCount < prizesCount)
			errors.push(t('main.errors.uniqueAddressCountMustBeGreaterThanPrizes'));
		// Check minimum prize amount
		const invalidPrizes = prizeAmounts.filter(v => {
			const mist = parseSuiToMist(v);
			return mist > 0n && mist < MINIMUM_PRIZE_AMOUNT.MIST;
		});
		if (invalidPrizes.length > 0) {
			errors.push(t('main.errors.eachPrizeMustBeAtLeast', { minAmount: MINIMUM_PRIZE_AMOUNT.SUI }));
		}
		return errors;
	}

	async function createWheelAndFund() {
		setupError = '';
		setupSuccessMsg = '';
		const errors = validateSetup();
		if (errors.length) {
			setupError = errors.join('\n');
			return;
		}
		setupLoading = true;
		try {
			const addrList = getAddressEntries();
			const prizeMistList = prizeAmounts.map(v => parseSuiToMist(v)).filter(v => v > 0n);
			const total = totalDonationMist;
			if (total <= 0n) throw new Error(t('main.errors.totalDonationMustBeGreaterThan0'));

			// Combine into a single PTB
			const tx = new Transaction();

			// Split the donation coin from gas first
			const [donationCoin] = tx.splitCoins(tx.gas, [total]);

			// Call create_wheel and capture the returned Wheel
			const wheel = tx.moveCall({
				target: `${packageId}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.CREATE}`,
				arguments: [
					tx.pure.vector('address', addrList),
					tx.pure.vector('u64', prizeMistList),
					tx.pure.u64(BigInt(Number(delayMs || 0)) * 60000n),
					tx.pure.u64(BigInt(Number(claimWindowMs || 0)) * 60000n)
				]
			});

			// Call donate_to_pool using the wheel (as mutable ref) and donationCoin
			tx.moveCall({
				target: `${packageId}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.DONATE}`,
				arguments: [wheel, donationCoin]
			});

			// Share the wheel object using the new share_wheel function
			tx.moveCall({
				target: `${packageId}::${WHEEL_MODULE}::share_wheel`,
				arguments: [wheel]
			});

			// Sign and execute the combined PTB
			const res = await signAndExecuteTransaction(tx);

			const digest = res?.digest ?? res?.effects?.transactionDigest;
			if (!digest) throw new Error('Failed to get transaction digest');

			// Wait for the transaction to be available across RPCs, then read object changes
			const txBlock = await suiClient.waitForTransaction({
				digest,
				options: { showObjectChanges: true }
			});
			const created = (txBlock?.objectChanges || []).find(
				ch =>
					ch.type === 'created' && String(ch.objectType || '').endsWith(`::${WHEEL_MODULE}::Wheel`)
			);

			const finalWheelId = created?.objectId;
			if (!finalWheelId) throw new Error(t('main.errors.wheelObjectIdNotFound'));

			setupSuccessMsg = t('main.success.wheelCreatedAndFunded');

			// Notify and update current URL with wheelId param so reload keeps context
			toast.success(t('main.success.wheelCreatedAndFundedSuccessfully'), {
				position: 'bottom-right',
				durationMs: 5000,
				button: {
					text: t('main.success.viewTx'),
					class: 'btn btn-primary btn-sm',
					callback: () => {
						window.open(`https://testnet.suivision.xyz/txblock/${digest}`, '_blank', 'noopener');
					}
				}
			});

			// Update URL params reactively
			params.update({ wheelId: finalWheelId });
		} catch (e) {
			setupError = e?.message || String(e);
			toast.error(setupError || t('main.errors.failedToGetTransactionDigest'), {
				position: 'bottom-right'
			});
		} finally {
			setupLoading = false;
		}
	}

	/**
	 * Fetch wheel data from testnet by createdWheelId and populate read-only state
	 */
	async function fetchWheelFromChain() {
		if (!createdWheelId) return;
		try {
			const res = await suiClient.getObject({
				id: createdWheelId,
				options: { showContent: true, showOwner: true, showType: true }
			});
			const content = res?.data?.content;
			if (!content || content?.dataType !== 'moveObject') return;
			const f = content.fields || {};

			// Cancellation flag
			isCancelled = Boolean(f['is_cancelled']);

			// Entries (addresses)
			entriesOnChain = (f['remaining_entries'] || []).map(v => String(v));

			// Prizes (mist amounts)
			prizesOnChainMist = (f['prize_amounts'] || []).map(v => {
				try {
					return BigInt(v);
				} catch {
					return 0n;
				}
			});

			// Winners list
			winnersOnChain = (f['winners'] || []).map(w => ({
				addr: String(w?.fields?.addr ?? w?.addr ?? ''),
				prize_index: Number(w?.fields?.prize_index ?? w?.prize_index ?? 0),
				claimed: Boolean(w?.fields?.claimed ?? w?.claimed ?? false)
			}));

			// Spin times (ms since epoch) aligned with prize indices
			try {
				spinTimesOnChain = (f['spin_times'] || []).map(v => Number(v));
			} catch {
				spinTimesOnChain = [];
			}

			// Spun count and Delay / ClaimWindow (ms -> minutes)
			try {
				spunCountOnChain = Number(f['spun_count'] || 0);
			} catch {
				spunCountOnChain = 0;
			}
			const delayMsRaw = Number(f['delay_ms']);
			delayMsOnChain = Math.max(0, Math.round(delayMsRaw / 60000));

			const claimRaw = Number(f['claim_window_ms']);
			claimWindowMsOnChain = Math.max(0, Math.round(claimRaw / 60000));

			// Pool balance
			let poolMist = 0n;
			const poolCandidates = ['pool'];
			for (const _k of poolCandidates) {
				const v = f['pool'];
				if (v == null) continue;
				try {
					if (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint') {
						poolMist = BigInt(v);
						break;
					}
					if (typeof v === 'object') {
						const val =
							v?.fields?.balance?.fields?.value ?? v?.fields?.value ?? v?.value ?? v?.balance;
						if (val != null) {
							poolMist = BigInt(val);
							break;
						}
					}
				} catch {
					// Ignore parsing errors
				}
			}
			poolBalanceMistOnChain = poolMist;

			// Sync form states for edit mode convenience
			entriesText = entriesOnChain.join('\n');
			entries = [...entriesOnChain];
			prizeAmounts = prizesOnChainMist.map(m => formatMistToSuiCompact(m));
			delayMs = delayMsOnChain;
			claimWindowMs = claimWindowMsOnChain;

			wheelFetched = true;

			// Initialize shuffled index order to identity mapping
			shuffledIndexOrder = computeShuffledIndexOrder(entriesOnChain, entries);
		} catch (e) {
			console.error('Failed to fetch wheel:', e);
		} finally {
		}
	}

	async function updateWheel() {
		if (!createdWheelId) return;
		updateLoading = true;
		setupError = '';
		try {
			// Top up only if needed
			if (topUpMist > 0n) {
				const tx = new Transaction();
				const [coin] = tx.splitCoins(tx.gas, [topUpMist]);
				tx.moveCall({
					target: `${packageId}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.DONATE}`,
					arguments: [tx.object(createdWheelId), coin]
				});
				await signAndExecuteTransaction(tx);
			}
			setupSuccessMsg = t('main.success.wheelUpdatedSuccessfully');
			isEditing = false;
			await fetchWheelFromChain();
		} catch (e) {
			setupError = e?.message || String(e);
		} finally {
			updateLoading = false;
		}
	}

	async function cancelWheel() {
		if (!createdWheelId) return;
		cancelLoading = true;
		setupError = '';

		try {
			const tx = new Transaction();

			// Get mutable ref to Wheel
			const wheelRef = tx.object(createdWheelId);

			// Call cancel_wheel_and_reclaim_pool and capture the optional Coin
			const optCoin = tx.moveCall({
				target: `${packageId}::${WHEEL_MODULE}::cancel_wheel_and_reclaim_pool`,
				arguments: [wheelRef]
			});

			// Handle the optional reclaim by transferring to sender if present
			tx.moveCall({
				target: `${packageId}::${WHEEL_MODULE}::transfer_optional_reclaim`,
				arguments: [optCoin, tx.pure.address(account.address)] // Assume walletAddress is the connected organizer's address
			});

			// Sign and execute the PTB
			const res = await signAndExecuteTransaction(tx);
			const digest = res?.digest ?? res?.effects?.transactionDigest;
			if (!digest) {
				setupError = t('main.errors.failedToCancelWheel');
				toast.error(setupError || t('main.errors.failedToCancelWheel'), {
					position: 'bottom-right'
				});
				return;
			}
			setupSuccessMsg = t('main.success.wheelCancelledAndPoolReclaimed');
			toast.success(t('main.success.wheelCancelledSuccessfully'), {
				position: 'bottom-right',
				durationMs: 3000,
				button: {
					text: t('main.success.viewTx'),
					class: 'btn btn-primary btn-sm',
					callback: () => {
						window.open(`https://testnet.suivision.xyz/txblock/${digest}`, '_blank', 'noopener');
					}
				}
			});

			// Fetch wheel from chain again
			isCancelled = true;
		} catch (e) {
			setupError = e?.message || String(e);
		} finally {
			cancelLoading = false;
		}
	}

	// Import entries from X (Twitter) post
	let xImportDialogEl = $state(null);
	let xImportInputEl = $state(null);
	let xImportInput = $state('');
	let xImportLoading = $state(false);

	// Online entry form modal
	let entryFormModalEl = $state(null);
	let entryFormModalType = $state('address'); // 'address', 'name', 'email'
	let entryFormModalEnabled = $state(false);
	let entryFormModalName = $state(''); // Wheel name for entry form
	let entryFormModalDuration = $state(3); // Duration in minutes, default 3
	let entryFormEndTime = $state(null); // End time timestamp
	let entryFormTimer = $state(null); // Timer reference
	let remainingTime = $state(0); // Remaining time in seconds

	async function openXImportModal() {
		xImportInput = '';
		try {
			if (xImportDialogEl && typeof xImportDialogEl.showModal === 'function') {
				xImportDialogEl.showModal();

				// insert delay
				await new Promise(resolve => setTimeout(resolve, 100));

				// focus on input
				if (xImportInputEl && typeof xImportInputEl.focus === 'function') {
					xImportInputEl.focus();
				}
			}
		} catch {
			// Ignore modal errors
		}
	}

	async function openEntryFormModal() {
		try {
			if (entryFormModalEl && typeof entryFormModalEl.showModal === 'function') {
				entryFormModalEl.showModal();
			}
		} catch {
			// Ignore modal errors
		}
	}

	function handleEntryFormModalSubmit() {
		entryFormEnabled = entryFormModalEnabled;
		entryFormType = entryFormModalType;

		// Set timer if enabled
		if (entryFormEnabled && entryFormModalDuration > 0) {
			entryFormEndTime = Date.now() + entryFormModalDuration * 60 * 1000;
			startEntryFormTimer();

			// Register wheel metadata with API for auto-cleanup
			const wheelId = wheelTempId;
			if (wheelId) {
				fetch(`/api/submit-entry?wheelId=${wheelId}&duration=${entryFormModalDuration}`).catch(
					error => console.error('Error registering wheel metadata:', error)
				);
			}
		}

		try {
			entryFormModalEl?.close?.();
		} catch {
			// Ignore close errors
		}
	}

	function startEntryFormTimer() {
		// Clear existing timer
		if (entryFormTimer) {
			clearInterval(entryFormTimer);
		}

		// Start new timer
		entryFormTimer = setInterval(() => {
			if (entryFormEndTime) {
				const now = Date.now();
				const timeLeft = Math.max(0, Math.floor((entryFormEndTime - now) / 1000));
				remainingTime = timeLeft;

				if (timeLeft <= 0) {
					// Time's up - disable entry form and clear data
					disableOnlineEntries();
					clearEntryFormData();
				}
			}
		}, 1000); // Check every second
	}

	function clearEntryFormData() {
		const wheelId = wheelTempId;
		if (wheelId) {
			// Clear data from API
			fetch(`/api/submit-entry?wheelId=${wheelId}&clear=true`).catch(error =>
				console.error('Error clearing entry data:', error)
			);
		}

		// Clear local state
		wheelTempId = '';
		entryFormEndTime = null;
		remainingTime = 0;

		if (entryFormTimer) {
			clearInterval(entryFormTimer);
			entryFormTimer = null;
		}
	}

	function disableOnlineEntries() {
		entryFormEnabled = false;
		stopEntryPolling();

		// Clear timer if exists
		if (entryFormTimer) {
			clearInterval(entryFormTimer);
			entryFormTimer = null;
		}
		entryFormEndTime = null;
		remainingTime = 0;

		toast.success(t('main.success.onlineEntriesDisabled'), { position: 'top-right' });
	}

	function generateWheelTempId() {
		// Generate a unique temporary ID for this session
		if (!wheelTempId) {
			wheelTempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		}
		return wheelTempId;
	}

	async function handleXImportSubmit() {
		if (!xImportInput || xImportLoading) return;
		xImportLoading = true;
		try {
			const res = await fetch('/api/import-x-post', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ input: xImportInput })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok || !data?.success) {
				throw new Error(data?.message || data?.error || 'Failed to import X post');
			}

			if (data?.addresses.length === 0) {
				toast.error(t('main.notifications.noEntriesFoundInXPost'), { position: 'top-right' });
			} else {
				toast.success(
					t('main.success.importedEntriesFromXPost', { count: data?.addresses.length }),
					{
						title: t('main.success.imported'),
						position: 'top-right'
					}
				);
				// console.log('X post import result:', data);

				entriesText = data?.addresses.join('\n') || '';
				entries = data?.addresses || [];
				entriesOnChain = data?.addresses || [];
			}

			try {
				xImportDialogEl?.close?.();
			} catch {
				// Ignore close errors
			}
		} catch (e) {
			toast.error(e?.message || t('main.notifications.failedToImportXPost'), {
				position: 'top-right'
			});
		} finally {
			xImportLoading = false;
		}
	}

	// Watch for entries changes and update duplicate entries
	watch(
		() => entries,
		() => {
			updateDuplicateEntries();
		}
	);

	// Watch for wheelId changes and fetch wheel data reactively
	watch(
		() => params.wheelId,
		() => fetchWheelFromChain()
	);

	// Watch for entry form enable/disable
	watch(
		() => entryFormEnabled,
		() => {
			if (entryFormEnabled) {
				startEntryPolling();
			} else {
				stopEntryPolling();
			}
		}
	);

	// Update entries text when entries change
	$effect(() => {
		if (!entriesTextareaEl || document.activeElement !== entriesTextareaEl) {
			entriesText = entries.join('\n');
		}
	});

	// Check for new entries from online form
	async function checkForNewEntries() {
		if (!entryFormEnabled) return;
		if (!wheelTempId) return;
		const wheelId = wheelTempId;

		try {
			const response = await fetch(`/api/submit-entry?wheelId=${wheelId}`);

			if (!response.ok) {
				console.error('API response not ok:', response.status, response.statusText);
				return;
			}

			const data = await response.json().catch(error => {
				console.error('Failed to parse JSON response:', error);
				return { success: false, message: 'Invalid response format' };
			});

			if (data.success && data.entries) {
				onlineEntriesCount = data.count;

				// Check if there are new entries
				if (onlineEntriesCount > lastEntryCount) {
					// New entries detected, add them to the local entries list
					const newEntries = data.entries.slice(lastEntryCount);
					let addedCount = 0;

					// Add new entries to local list (avoid duplicates and respect MAX_ENTRIES limit)
					newEntries.forEach(newEntry => {
						if (!entries.includes(newEntry) && entries.length < MAX_ENTRIES) {
							entries = [...entries, newEntry];
							addedCount++;
						}
					});

					// Update entries text
					entriesText = entries.join('\n');

					// Show notification only if entries were actually added
					if (addedCount > 0) {
						// Format new entries for display
						const formattedEntries = newEntries.slice(0, addedCount).map(entry => {
							return isValidSuiAddress(entry) ? shortenAddress(entry) : entry;
						});

						const entriesList =
							formattedEntries.length <= 3
								? formattedEntries.join(', ')
								: `${formattedEntries.slice(0, 3).join(', ')} and ${formattedEntries.length - 3} more`;

						toast.success(entriesList, {
							title: t('main.notifications.newEntriesAdded', {
								count: addedCount,
								plural: addedCount === 1 ? 'y' : 'ies'
							}),
							position: 'top-right',
							durationMs: 5000
						});
					}

					lastEntryCount = onlineEntriesCount;
				}
			} else if (!data.success && data.message === 'Entry form has expired') {
				// Wheel has expired, disable entry form
				console.log('Wheel has expired, disabling entry form');
				disableOnlineEntries();
				clearEntryFormData();
			}
		} catch (error) {
			console.error('Error checking for new entries:', error);
			// If there's a network error, don't disable the form
			// It might be a temporary issue
		}
	}

	// Start/stop polling for new entries
	function startEntryPolling() {
		if (entryPollingInterval) return;
		if (!entryFormEnabled) return;

		// Generate wheelTempId if not exists
		if (!createdWheelId && !wheelTempId) {
			generateWheelTempId();
		}

		// Initialize lastEntryCount to 0 to catch all existing entries
		lastEntryCount = 0;
		entryPollingInterval = setInterval(checkForNewEntries, 5000); // Check every 5 seconds
	}

	function stopEntryPolling() {
		if (entryPollingInterval) {
			clearInterval(entryPollingInterval);
			entryPollingInterval = null;
		}
	}

	let isInitialized = $state(false);
	onMount(() => {
		isInitialized = true;

		// Open prizes tab if remaining spins is 0 and wheel is created
		if (remainingSpins === 0 && createdWheelId) {
			activeTab = 'prizes';
		}
	});

	// Cleanup on component destroy
	onMount(() => {
		// Handle browser close/refresh
		const handleBeforeUnload = () => {
			if (entryFormEnabled) {
				const wheelId = wheelTempId;
				if (wheelId) {
					// Send cleanup request (may not complete if browser closes)
					fetch(`/api/submit-entry?wheelId=${wheelId}&clear=true`, {
						keepalive: true // Try to send even if page is closing
					}).catch(() => {
						// Ignore errors - browser might be closing
					});
				}
			}
		};

		window.addEventListener('beforeunload', handleBeforeUnload);

		return () => {
			stopEntryPolling();
			if (entryFormTimer) {
				clearInterval(entryFormTimer);
				entryFormTimer = null;
			}
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	});

	function handleShuffle() {
		if (spinning) return;
		entries = shuffleArray(entries);
		entriesText = entries.join('\n');
		// Update index order vs on-chain list and log
		if (createdWheelId && wheelFetched) {
			shuffledIndexOrder = computeShuffledIndexOrder(entriesOnChain, entries);
		}
	}

	function clearAllEntries() {
		if (spinning) return;
		entriesText = '';
		entries = [];
		shuffledIndexOrder = [];
	}

	function onEntriesTextChange(text) {
		if (spinning) return;
		const list = text
			.split('\n')
			.map(s => s.trim())
			.filter(s => s.length > 0);
		if (arraysShallowEqual(entries, list)) {
			return;
		}
		entries = list;
	}

	function updateDuplicateEntries() {
		const entryCount = {};
		entries.forEach(entry => {
			const trimmed = entry.trim();
			if (trimmed) {
				entryCount[trimmed] = (entryCount[trimmed] || 0) + 1;
			}
		});

		// Filter entries that appear more than once
		const duplicates = Object.entries(entryCount)
			.filter(([entry, count]) => count > 1)
			.map(([entry, count]) => ({ entry, count }))
			.sort((a, b) => b.count - a.count); // Sort by count descending

		duplicateEntries = duplicates;
	}

	// Compute mapping from current entries to on-chain baseline indices
	function computeShuffledIndexOrder(baselineList, currentList) {
		try {
			const baseline = (baselineList || []).map(v => String(v ?? ''));
			const current = (currentList || []).map(v => String(v ?? ''));
			// Build queues of original indices for each value (handles duplicates)
			const queues = new Map();
			for (let i = 0; i < baseline.length; i++) {
				const key = baseline[i].toLowerCase();
				if (!queues.has(key)) queues.set(key, []);
				queues.get(key).push(i);
			}
			// Map each current entry to the next available original index
			const order = new Array(current.length);
			for (let i = 0; i < current.length; i++) {
				const key = current[i].toLowerCase();
				const q = queues.get(key) || [];
				order[i] = q.length ? q.shift() : -1; // -1 if not found in baseline
			}
			return order;
		} catch {
			return [];
		}
	}

	// Set wheel context for child component during initialization
	wheelContext.set({
		packageId,
		WHEEL_MODULE,
		WHEEL_FUNCTIONS,
		RANDOM_OBJECT_ID,
		CLOCK_OBJECT_ID,
		fetchWheelFromChain,
		setSpinning: setWheelSpinning,
		onShuffle: handleShuffle,
		onClearAllEntries: clearAllEntries,
		removeEntry: removeEntryValue
	});
</script>

<svelte:head>
	<title>{t('main.title')}</title>
	<meta name="description" content={t('main.metaDescription')} />
	<meta property="og:title" content={t('main.ogTitle')} />
	<meta property="og:description" content={t('main.ogDescription')} />
</svelte:head>

{#snippet showDuplicateEntries()}
	{#if duplicateEntries.length > 0}
		<div class="mt-4">
			<h4 class="text-base-content/70 mb-2 text-sm font-semibold">{t('main.duplicateEntries')}</h4>
			<div class="bg-base-300 flex max-h-32 flex-col gap-1 overflow-y-auto rounded-lg p-2">
				{#each duplicateEntries as duplicate}
					<div class="flex items-center justify-between gap-2 text-sm">
						<span class="flex-1 truncate font-medium">
							{isValidSuiAddress(duplicate.entry)
								? shortenAddress(duplicate.entry)
								: duplicate.entry}
						</span>
						<span class="badge badge-secondary badge-sm">{duplicate.count}x</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
{/snippet}

{#snippet entriesTable(entriesList, showActions = false, shortAddress = true)}
	{#if entriesList.length > 0}
		<div class="overflow-x-auto">
			<div class="relative">
				<div
					class="overflow-y-auto"
					class:max-h-64={!tableExpanded}
					class:max-h-none={tableExpanded}
				>
					<table class="table-zebra table-sm table">
						<thead>
							<tr>
								<th>#</th>
								<th>Address</th>
								{#if showActions}
									<th>Actions</th>
								{/if}
							</tr>
						</thead>
						<tbody>
							{#each entriesList as addr, i}
								<tr>
									<td class="w-12">{i + 1}</td>
									<td class="font-mono">
										{#if shortAddress}
											{shortenAddress(addr)}
										{:else}
											{addr}
										{/if}
									</td>
									{#if showActions}
										<td>
											<button
												class="btn btn-xs btn-error btn-soft"
												onclick={() => removeEntryValue(addr)}
												disabled={spinning}
												aria-label="Remove entry"
											>
												<span class="icon-[lucide--x] h-3 w-3"></span>
											</button>
										</td>
									{/if}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				{#if entriesList.length > 8}
					<div class="absolute right-0 bottom-0 left-0 flex justify-center pb-2">
						<button
							class="btn btn-xs btn-primary btn-soft shadow-lg"
							onclick={() => (tableExpanded = !tableExpanded)}
							aria-label={tableExpanded ? 'Collapse table' : 'Expand table'}
						>
							{#if tableExpanded}
								<span class="icon-[lucide--chevron-up] h-3 w-3"></span>
								Collapse
							{:else}
								<span class="icon-[lucide--chevron-down] h-3 w-3"></span>
								Show all ({entriesList.length})
							{/if}
						</button>
					</div>
				{/if}
			</div>

			{@render showDuplicateEntries()}
		</div>
	{:else}
		<div class="text-center text-sm text-gray-500">{t('main.noEntries')}</div>
	{/if}
{/snippet}

<section class="container mx-auto px-4 py-12">
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<div class="w-full">
			<Wheel
				{entries}
				{spinning}
				{createdWheelId}
				{remainingSpins}
				{isCancelled}
				{entryFormEnabled}
				accountConnected={Boolean(account)}
				{shuffledIndexOrder}
			/>
		</div>

		<div class="w-full">
			<div class="card bg-base-200 shadow">
				<div class="card-body">
					<!-- Header actions for view/edit -->
					{#if createdWheelId && wheelFetched}
						<div class="mb-3 flex items-center justify-between gap-2">
							<!-- Header info -->
							<div class="flex items-center gap-2 text-sm opacity-70">
								<span
									>{t('main.wheelId')}
									<span class="font-mono">{shortenAddress(createdWheelId)}</span></span
								>
								{#if remainingSpins === 0}
									<span class="badge badge-success badge-sm"
										><span class="icon-[lucide--check]"></span> {t('main.finished')}</span
									>
								{/if}
								{#if isCancelled}
									<span class="badge badge-warning badge-sm"
										><span class="icon-[lucide--circle-x]"></span> {t('main.cancelled')}</span
									>
								{/if}
							</div>

							<div class="flex items-center gap-2">
								<!-- New wheel button -->
								{#if (!isEditing && remainingSpins === 0) || isCancelled}
									<button
										class="btn btn-primary btn-sm"
										onclick={() => {
											params.update({ wheelId: undefined });
											wheelFetched = false;
											entriesText = '';
											entries = [];
											entriesOnChain = [];
											prizeAmounts = [];
											prizesOnChainMist = [];
											winnersOnChain = [];
											spunCountOnChain = 0;
											poolBalanceMistOnChain = 0n;
											entriesViewMode = 'textarea';
										}}>{t('main.newWheel')}</button
									>
								{/if}

								{#if isEditing}
									<ButtonLoading
										formLoading={updateLoading}
										color="primary"
										loadingText={t('main.updating')}
										onclick={updateWheel}>{t('main.updateWheel')}</ButtonLoading
									>
									<button
										class="btn"
										onclick={() => (isEditing = false)}
										disabled={spunCountOnChain > 0}>{t('main.cancelEdit')}</button
									>
								{:else}
									<!-- Edit wheel button -->
									<!-- <button
											class="btn btn-sm btn-outline"
											onclick={() => (isEditing = true)}
											disabled={spunCountOnChain > 0 || isCancelled}>Edit wheel</button
										> -->
								{/if}

								<!-- New/Cancel wheel button -->
								{#if account && !isCancelled && remainingSpins > 0}
									<ButtonLoading
										formLoading={cancelLoading}
										color="error"
										loadingText={t('main.cancelling')}
										onclick={cancelWheel}
										disabled={spinning || spunCountOnChain > 0}
										>{t('main.cancelWheel')}</ButtonLoading
									>
								{/if}
							</div>
						</div>
					{/if}

					{#if createdWheelId && !wheelFetched && !isEditing}
						<!-- Loading state to avoid flicker before on-chain data replaces off-chain forms -->
						<div class="space-y-3">
							<div class="skeleton h-8 w-40"></div>
							<div class="skeleton h-32 w-full"></div>
							<div class="skeleton h-8 w-56"></div>
						</div>
					{:else}
						<!-- Tabs -->
						<div class="tabs tabs-lift">
							<input
								type="radio"
								name="wheel_tabs"
								class="tab"
								aria-label={`${t('main.entries')} (${entries.length})`}
								checked={activeTab === 'entries'}
								onclick={() => (activeTab = 'entries')}
							/>
							<div class="tab-content bg-base-100 border-base-300 p-6">
								{#if createdWheelId && wheelFetched && !isEditing}
									<div class="mb-3 flex items-center justify-between gap-2">
										<div class="text-sm opacity-70">{t('main.entries')}</div>
										<div class="flex items-center gap-2">
											<div class="join">
												<button
													class="btn btn-xs join-item"
													class:btn-primary={entriesViewMode === 'textarea'}
													class:btn-soft={entriesViewMode !== 'textarea'}
													onclick={() => (entriesViewMode = 'textarea')}
													aria-label={t('main.textareaView')}
												>
													<span class="icon-[lucide--edit] h-4 w-4"></span>
													{t('main.text')}
												</button>
												<button
													class="btn btn-xs join-item"
													class:btn-primary={entriesViewMode === 'table'}
													class:btn-soft={entriesViewMode !== 'table'}
													onclick={() => (entriesViewMode = 'table')}
													aria-label={t('main.tableView')}
												>
													<span class="icon-[lucide--table] h-4 w-4"></span>
													{t('main.table')}
												</button>
											</div>
										</div>
									</div>

									{#if entriesViewMode === 'table'}
										{@render entriesTable(entries, false, false)}
									{:else}
										<textarea
											class="textarea h-48 w-full text-base"
											placeholder={t('main.oneEntryPerLine')}
											value={entries.join('\n')}
											readonly
											aria-label={t('main.entriesListReadOnly')}
										></textarea>
									{/if}
								{:else}
									<div class="mb-3 flex items-center justify-between gap-2">
										<!-- View mode toggle -->
										<div class="join">
											<button
												class="btn btn-xs join-item"
												class:btn-primary={entriesViewMode === 'textarea'}
												class:btn-soft={entriesViewMode !== 'textarea'}
												onclick={() => (entriesViewMode = 'textarea')}
												aria-label={t('main.textareaView')}
											>
												<span class="icon-[lucide--edit] h-4 w-4"></span>
												{t('main.text')}
											</button>
											<button
												class="btn btn-xs join-item"
												class:btn-primary={entriesViewMode === 'table'}
												class:btn-soft={entriesViewMode !== 'table'}
												onclick={() => (entriesViewMode = 'table')}
												aria-label={t('main.tableView')}
											>
												<span class="icon-[lucide--table] h-4 w-4"></span>
												{t('main.table')}
											</button>
										</div>

										{#if account}
											<div class="flex items-center gap-2">
												{#if entryFormEnabled}
													<button
														class="btn btn-xs btn-outline"
														onclick={checkForNewEntries}
														aria-label={t('main.syncOnlineEntries')}
													>
														<span class="icon-[lucide--refresh-cw] h-4 w-4"></span>
														{t('main.sync')}
													</button>
												{/if}

												<div class="dropdown dropdown-end">
													<button
														class="btn btn-xs btn-primary btn-soft"
														aria-label={t('main.importEntries')}
													>
														<span class="icon-[lucide--list-plus] h-4 w-4"></span>
														<span>{t('main.import')}</span>
													</button>
													<ul
														class="menu dropdown-content rounded-box bg-base-200 z-[1] w-56 p-2 shadow"
													>
														<li>
															<button
																onclick={openEntryFormModal}
																aria-label={t('main.setupOnlineEntryForm')}
															>
																<span class="icon-[lucide--qr-code] h-4 w-4"></span>
																{t('main.onlineEntryForm')}
															</button>
														</li>
														<li>
															<button
																onclick={openXImportModal}
																aria-label={t('main.importByXPost')}
															>
																<svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
																	<path
																		d="M13.317 10.774L20.28 2h-1.73l-6.32 7.353L8.29 2H2.115l7.33 10.638L2.115 22h1.73l6.707-7.783L15.315 22H21.59l-7.482-10.774z"
																	/>
																</svg>
																{t('main.importByXPost')}
															</button>
														</li>
													</ul>
												</div>
											</div>
										{/if}
									</div>

									{#if entriesViewMode === 'table'}
										{@render entriesTable(entries, true)}
									{:else}
										<textarea
											class="textarea h-48 w-full text-base"
											placeholder={t('main.oneEntryPerLine')}
											bind:value={entriesText}
											oninput={() => onEntriesTextChange(entriesText)}
											bind:this={entriesTextareaEl}
											disabled={spinning}
										></textarea>

										{@render showDuplicateEntries()}
									{/if}
								{/if}
							</div>

							<!-- Prizes tab -->
							<input
								type="radio"
								name="wheel_tabs"
								class="tab"
								aria-label={t('main.prizes')}
								checked={activeTab === 'prizes'}
								onclick={() => (activeTab = 'prizes')}
							/>
							<div class="tab-content bg-base-100 border-base-300 p-6">
								<h3 class="mb-4 text-lg font-semibold">{t('main.prizesSui')}</h3>

								{#if createdWheelId && wheelFetched && !isEditing}
									<div class="overflow-x-auto">
										<table class="table-zebra table">
											<thead>
												<tr>
													<th>#</th>
													<th>{t('main.amount')}</th>
													<th>{t('main.winner')}</th>
												</tr>
											</thead>
											<tbody>
												{#each prizesOnChainMist as m, i}
													<tr>
														<td class="w-12">{i + 1}</td>
														<td class="font-mono">{formatMistToSuiCompact(m)}</td>
														<td class="flex items-center font-mono">
															{#if winnersOnChain.find(w => w.prize_index === i)}
																{shortenAddress(winnersOnChain.find(w => w.prize_index === i).addr)}
																{#if Number(spinTimesOnChain[i] || 0) > 0}
																	<span class="badge badge-success badge-sm ml-2 text-xs opacity-70"
																		>{formatDistanceToNow(spinTimesOnChain[i], {
																			addSuffix: true
																		})}</span
																	>
																{/if}
															{:else}
																<span class="opacity-60">—</span>
															{/if}
														</td>
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
								{:else}
									<!-- Prize repeater -->
									{#each prizeAmounts as prize, i}
										<div class="join mb-2 w-full">
											<button class="btn btn-disabled join-item">{t('main.prize')} #{i + 1}</button>
											<input
												type="text"
												class="input join-item prize-input w-full"
												placeholder={t('main.amountExample')}
												value={prizeAmounts[i] ?? ''}
												oninput={e => updatePrizeAmount(i, e.currentTarget.value)}
												onchange={e => updatePrizeAmount(i, e.currentTarget.value)}
												onkeydown={e => handlePrizeKeydown(i, e)}
												aria-label={t('main.prizeAmountInSui', { number: i + 1 })}
											/>
											<button
												class="btn btn-error btn-soft join-item"
												onclick={() => removePrize(i)}
												disabled={prizeAmounts.length <= 1}
												aria-label={t('main.removePrize')}
												><span class="icon-[lucide--x] h-4 w-4"></span></button
											>
										</div>
									{/each}
									<div class="mt-2 flex items-center justify-between">
										<button class="btn btn-outline" onclick={addPrize}>{t('main.addPrize')}</button>
										<div class="text-sm">
											<strong>{t('main.need')}:</strong>
											<span>{formatMistToSuiCompact(totalDonationMist)} SUI</span>
										</div>
									</div>

									{#if createdWheelId && wheelFetched}
										<div class="mt-2 text-sm">
											<span class="opacity-70">{t('main.topUpRequired')}:</span>
											<strong class="ml-1">{formatMistToSuiCompact(topUpMist)} SUI</strong>
										</div>
									{/if}
								{/if}
							</div>

							{#if account}
								<!-- Settings tab -->
								<input
									type="radio"
									name="wheel_tabs"
									class="tab"
									aria-label={t('main.settings')}
									checked={activeTab === 'settings'}
									onclick={() => (activeTab = 'settings')}
								/>
								<div class="tab-content bg-base-100 border-base-300 p-6">
									<h3 class="mb-4 text-lg font-semibold">{t('main.settings')}</h3>
									<div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
										<fieldset class="fieldset border-base-300 rounded-box border p-4">
											<legend class="fieldset-legend">{t('main.claimDelay')}</legend>
											<select
												class="select"
												bind:value={delayMs}
												aria-label={t('main.delay')}
												disabled={createdWheelId && wheelFetched && !isEditing}
											>
												<option value={0}>{t('main.zeroMinuteDefault')}</option>
												<option value={15}>{t('main.fifteenMinutes')}</option>
												<option value={30}>{t('main.thirtyMinutes')}</option>
												<option value={60}>{t('main.oneHour')}</option>
												<option value={120}>{t('main.twoHours')}</option>
											</select>
											<span class="label">{t('main.waitTimeBeforeClaimingPrize')}</span>
										</fieldset>

										<fieldset class="fieldset border-base-300 rounded-box border p-4">
											<legend class="fieldset-legend">{t('main.claimPeriod')}</legend>
											<select
												class="select"
												bind:value={claimWindowMs}
												aria-label={t('main.claimWindow')}
												disabled={createdWheelId && wheelFetched && !isEditing}
											>
												<option value={60}>{t('main.oneHour')}</option>
												<option value={1440}>{t('main.twentyFourHoursDefault')}</option>
												<option value={2880}>{t('main.twoDays')}</option>
												<option value={4320}>{t('main.threeDays')}</option>
												<option value={10080}>{t('main.oneWeek')}</option>
											</select>
											<span class="label">{t('main.deadlineToClaimPrize')}</span>
										</fieldset>
									</div>
								</div>
							{/if}
						</div>

						{#if createdWheelId && remainingSpins === 0}
							<div class="mt-2">
								<div class="alert alert-soft alert-info light:!border-info w-60">
									<span class="icon-[lucide--info] h-4 w-4"></span>
									<a class="link" href={`/wheel-result?wheelId=${createdWheelId}`}>
										{t('main.claimLink')}
									</a>
									<ButtonCopy
										originText={`${page.url.origin}/wheel-result?wheelId=${createdWheelId}`}
										size="xs"
										className="btn-soft"
									/>
								</div>

								{#if qrDataUrl}
									<div class="mt-3 flex items-center gap-3">
										<img
											src={qrDataUrl}
											alt={t('main.resultQr')}
											class="rounded-box border-base-300 bg-base-100 mb-3 h-64 w-64 border p-2 shadow"
										/>

										<div class="flex w-full flex-col items-center gap-2 text-center opacity-80">
											<span class="icon-[lucide--smartphone] h-8 w-8"></span>
											<span class="text-lg">{t('main.scanWithYourPhone')}</span>
										</div>
									</div>
								{/if}
							</div>
						{/if}

						{#if entryFormEnabled}
							<div class="mt-2">
								<div class="alert alert-soft light:!border-success alert-success">
									<span class="icon-[lucide--qr-code] h-4 w-4"></span>
									<span>{t('main.onlineEntryFormScanToJoin')}</span>
									<ButtonCopy originText={entryFormQRUrl} size="xs" className="btn-soft" />
								</div>

								{#if entryFormQRDataUrl}
									<div class="mt-3 flex items-center gap-3">
										<img
											src={entryFormQRDataUrl}
											alt={t('main.entryFormQr')}
											class="rounded-box border-base-300 bg-base-100 mb-3 h-64 w-64 border p-2 shadow"
										/>
										<div class="flex w-full flex-col items-center gap-2">
											{#if remainingTime > 0}
												<div
													class="text-base-content/70 flex flex-col items-center gap-2 text-center"
												>
													<span class="icon-[lucide--clock] h-6 w-6"></span>
													<span>{t('main.timeRemaining')}</span>

													<div class="flex gap-2">
														<div
															class="bg-neutral rounded-box text-neutral-content flex flex-col p-2"
														>
															<span class="countdown font-mono text-3xl">
																<span
																	style="--value:{Math.floor(remainingTime / 60)};"
																	aria-live="polite"
																	aria-label={Math.floor(remainingTime / 60)}
																	>{Math.floor(remainingTime / 60)}</span
																>
															</span>
															{t('main.min')}
														</div>
														<div
															class="bg-neutral rounded-box text-neutral-content flex flex-col p-2"
														>
															<span class="countdown font-mono text-3xl">
																<span
																	style="--value:{remainingTime % 60};"
																	aria-live="polite"
																	aria-label={remainingTime % 60}>{remainingTime % 60}</span
																>
															</span>
															{t('main.sec')}
														</div>
													</div>
												</div>
											{/if}
										</div>
									</div>
								{/if}

								<div class="mt-2">
									<button
										class="btn btn-sm btn-outline btn-error"
										onclick={disableOnlineEntries}
										aria-label={t('main.disableOnlineEntries')}
									>
										<span class="icon-[lucide--x] h-4 w-4"></span>
										{t('main.disableOnlineEntries')}
									</button>
								</div>
							</div>
						{/if}

						<!-- Common alerts and button (always visible) -->
						{#if account}
							{#if setupError}
								<div class="alert alert-error light:!border-error mt-3 whitespace-pre-wrap">
									{setupError}
								</div>
							{/if}
							{#if setupSuccessMsg}
								<div class="alert alert-success light:!border-success mt-3 break-words">
									<span class="icon-[lucide--check-circle] h-4 w-4"></span>
									{setupSuccessMsg}
								</div>
							{/if}

							{#if shouldShowSetupWarnings}
								<div class="alert alert-soft light:!border-warning alert-warning mt-3">
									<ul class="list-inside list-disc">
										{#if !isOnTestnet}
											<li>{t('main.pleaseSwitchWalletToTestnet')}</li>
										{/if}
										{#if invalidEntriesCount > 0}
											<li>
												{t('main.pleaseFixInvalidEntries', { count: invalidEntriesCount })}
											</li>
										{/if}
										{#if uniqueValidEntriesCount < 2}
											<li>{t('main.atLeastTwoUniqueEntriesRequired')}</li>
										{/if}
										{#if prizesCount === 0}
											<li>
												{t('main.youNeedToAddAtLeastOnePrize')}
												<button
													class="btn btn-link btn-sm ml-1 align-baseline"
													onclick={() => (activeTab = 'prizes')}
													aria-label={t('main.goToPrizesTab')}
												>
													{t('main.openPrizes')}
												</button>
											</li>
										{/if}
										{#if prizesCount > uniqueValidEntriesCount}
											<li>
												{t('main.prizesCountMustBeLessThanOrEqualUniqueEntries', {
													prizesCount,
													uniqueValidEntriesCount
												})}
											</li>
										{/if}
										{#if invalidPrizeAmountsCount > 0}
											<li>
												{t('main.prizesMustBeAtLeast', {
													count: invalidPrizeAmountsCount,
													amount: MINIMUM_PRIZE_AMOUNT.SUI
												})}
											</li>
										{/if}
										{#if entries.length > MAX_ENTRIES}
											<li>
												{t('main.entriesCountMustBeLessThanOrEqual', {
													count: entries.length,
													max: MAX_ENTRIES
												})}
											</li>
										{/if}
										{#if hasInsufficientBalance}
											{#if suiBalance.value < 1_000_000_000}
												<li>{t('main.walletBalanceNeedsToBeMoreThanOneSui')}</li>
											{:else}
												<li>
													{t('main.walletBalanceIsLessThanTotalRequired', {
														balance: formatMistToSuiCompact(suiBalance.value),
														required: formatMistToSuiCompact(totalDonationMist)
													})}
												</li>
											{/if}
										{/if}
									</ul>
								</div>
							{/if}

							{#if !createdWheelId}
								<div class="mt-4">
									<ButtonLoading
										formLoading={setupLoading}
										color="primary"
										loadingText={t('main.settingUp')}
										onclick={createWheelAndFund}
										aria-label={t('main.createWheelAndFund')}
										size="md"
										disabled={invalidEntriesCount > 0 ||
											uniqueValidEntriesCount < 2 ||
											prizesCount === 0 ||
											prizesCount > uniqueValidEntriesCount ||
											invalidPrizeAmountsCount > 0 ||
											entries.length > MAX_ENTRIES ||
											getAddressEntries().length < 2 ||
											hasInsufficientBalance}
									>
										{#if totalDonationMist > 0n}
											{t('main.createWheelAndFund')}
											<span class="text-success text-bold font-mono"
												>{formatMistToSuiCompact(totalDonationMist)}</span
											> SUI
										{:else}
											{t('main.createWheel')}
										{/if}
									</ButtonLoading>
								</div>
							{/if}
						{:else if isInitialized}
							<div class="alert alert-info alert-soft light:!border-info mt-3">
								<span class="icon-[lucide--info] h-5 w-5"></span>
								{t('main.connectWalletToCreateAndSpin')}
							</div>
						{/if}
					{/if}
				</div>
			</div>
		</div>
	</div>
</section>

<!-- X Import Modal -->
<dialog id="x_import_modal" class="modal modal-middle" bind:this={xImportDialogEl}>
	<div class="modal-box">
		<h3 class="text-lg font-bold">{t('main.importEntriesByXPost')}</h3>
		<p class="py-3 text-sm opacity-80">{t('main.pasteXLinkOrTweetId')}</p>

		<fieldset class="fieldset">
			<input
				type="text"
				class="input w-full text-base"
				autocomplete="off"
				placeholder={t('main.xPostLinkPlaceholder')}
				bind:value={xImportInput}
				bind:this={xImportInputEl}
				aria-label={t('main.xPostLinkOrId')}
			/>
			<p class="label">{t('main.noteOnlyFirstEntriesFromReplies', { max: MAX_ENTRIES })}</p>
		</fieldset>

		<div class="flex justify-end">
			<ButtonLoading
				type="button"
				className="mt-1"
				size="md"
				color="primary"
				formLoading={xImportLoading}
				loadingText={t('main.importing')}
				onclick={handleXImportSubmit}
			>
				{t('main.import')}
			</ButtonLoading>
		</div>
	</div>

	<form method="dialog" class="modal-backdrop">
		<button>{t('main.close')}</button>
	</form>
</dialog>

<!-- Entry Form Modal -->
<dialog id="entry_form_modal" class="modal modal-middle" bind:this={entryFormModalEl}>
	<div class="modal-box">
		<h3 class="text-lg font-bold">{t('main.onlineEntryFormSettings')}</h3>
		<p class="py-3 text-sm opacity-80">{t('main.configureHowParticipantsCanJoin')}</p>

		<div class="mb-3 space-y-4">
			<div class="form-control">
				<label class="label cursor-pointer justify-start gap-3">
					<input
						type="checkbox"
						class="checkbox checkbox-primary"
						bind:checked={entryFormModalEnabled}
					/>
					<span class="label-text">{t('main.enableOnlineEntryForm')}</span>
				</label>
				<p class="text-base-content/70 ml-8 text-xs">
					{t('main.allowParticipantsToJoinByScanningQrCode')}
				</p>
			</div>

			{#if entryFormModalEnabled}
				<fieldset class="fieldset">
					<legend class="fieldset-legend">{t('main.wheelName')}</legend>
					<input
						type="text"
						class="input w-full text-base"
						placeholder={t('main.enterWheelNameOptional')}
						bind:value={entryFormModalName}
						autocomplete="off"
					/>
					<p class="label text-base-content/70 mt-1 text-xs">
						{t('main.thisNameWillBeDisplayedToParticipants')}
					</p>
				</fieldset>

				<fieldset class="fieldset">
					<legend class="fieldset-legend">{t('main.durationMinutes')}</legend>
					<input
						type="number"
						class="input w-full text-base"
						placeholder="3"
						min="1"
						max="60"
						bind:value={entryFormModalDuration}
						autocomplete="off"
					/>
					<p class="label text-base-content/70 mt-1 text-xs">
						{t('main.entryFormWillAutomaticallyCloseAfterThisTime')}
					</p>
				</fieldset>
				<fieldset class="fieldset">
					<legend class="fieldset-legend">{t('main.entryType')}</legend>
					<div class="flex flex-col gap-2">
						<label class="label cursor-pointer gap-2">
							<input
								type="radio"
								name="entryFormModalType"
								class="radio radio-primary"
								value="address"
								bind:group={entryFormModalType}
							/>
							<span class="label-text">{t('main.suiWalletAddress')}</span>
						</label>
						<label class="label cursor-pointer gap-2">
							<input
								type="radio"
								name="entryFormModalType"
								class="radio radio-primary"
								value="name"
								bind:group={entryFormModalType}
							/>
							<span class="label-text">{t('main.nameAnyText')}</span>
						</label>
						<label class="label cursor-pointer gap-2">
							<input
								type="radio"
								name="entryFormModalType"
								class="radio radio-primary"
								value="email"
								bind:group={entryFormModalType}
							/>
							<span class="label-text">{t('main.emailAddress')}</span>
						</label>
					</div>
				</fieldset>
			{/if}
		</div>

		<div class="flex justify-end gap-2">
			<button
				type="button"
				class="btn"
				onclick={() => {
					try {
						entryFormModalEl?.close?.();
					} catch {
						// Ignore close errors
					}
				}}
			>
				{t('main.cancel')}
			</button>
			<button
				type="button"
				class="btn btn-primary"
				onclick={handleEntryFormModalSubmit}
				disabled={!entryFormModalEnabled}
			>
				{t('main.ok')}
			</button>
		</div>
	</div>

	<form method="dialog" class="modal-backdrop">
		<button>{t('main.close')}</button>
	</form>
</dialog>
