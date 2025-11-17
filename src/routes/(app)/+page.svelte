<script lang="ts">
	import { onMount } from 'svelte';
	import { watch, StateHistory, IsDocumentVisible } from 'runed';
	import { page } from '$app/state';
	import { useSearchParams } from 'runed/kit';
	import { searchParamsSchema } from '$lib/paramSchema.js';
	import { Transaction } from '@mysten/sui/transactions';
	import { toast } from 'svelte-daisy-toaster';
	import { formatDistanceToNow } from 'date-fns';
	import { vi } from 'date-fns/locale';
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
		isTestnet,
		highlightAddress,
		getExplorerLink
	} from '$lib/utils/suiHelpers.js';

	import ButtonLoading from '$lib/components/ButtonLoading.svelte';
	import ButtonCopy from '$lib/components/ButtonCopy.svelte';
	import Wheel from '$lib/components/Wheel.svelte';
	import CoinSelector from '$lib/components/coin/CoinSelector.svelte';
	import CoinDisplay from '$lib/components/coin/CoinDisplay.svelte';
	import { createTestnetCoinService } from '$lib/services/coinService';
	import { wheelContext } from '$lib/context/wheel.js';
	import { useTranslation } from '$lib/hooks/useTranslation.js';
	import { getLanguageContext } from '$lib/context/language.js';
	import { qr } from '@svelte-put/qr/svg';
	import logo from "$lib/assets/sui-wheel-logo-small.png";
	import {
		buildCreateWheelAndFundTx,
		buildDonateToPoolTx,
		buildCancelWheelTx,
		prepareDonationCoin
	} from '$lib/utils/transactionBuilders.js';

	import {
		LATEST_PACKAGE_ID,
		WHEEL_MODULE,
		WHEEL_STRUCT,
		WHEEL_FUNCTIONS,
		MINIMUM_PRIZE_AMOUNT,
		MAX_ENTRIES,
		RANDOM_OBJECT_ID,
		CLOCK_OBJECT_ID,
		VERSION_OBJECT_ID,
		DEFAULT_COIN_TYPE,
		COMMON_COINS,
		RESERVED_GAS_FEE_MIST
	} from '$lib/constants.js';

	const t = useTranslation();
	const suiClient = $derived(useSuiClient());
	const account = $derived(useCurrentAccount());
	const documentVisible = new IsDocumentVisible();
	let isOnTestnet = $derived.by(() => {
		if (!account || !account.chains) return false;
		return isTestnet({ chains: account.chains });
	});

	// Get current language for date-fns locale
	const languageContext = getLanguageContext();
	const dateLocale = $derived.by(() => {
		return languageContext?.language?.code === 'vi' ? vi : undefined;
	});

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
	let selectedCoinType = $state(DEFAULT_COIN_TYPE); // Selected coin type for prizes
	let prizeAmounts = $state(['']); // Coin amounts as strings (decimal supported)
	let delayMs = $state(0);
	let claimWindowMs = $state(1440); // 24 hours
	let setupLoading = $state(false);
	let setupError = $state('');
	let setupSuccessMsg = $state('');
	let errorMsg = $state('');

	// Get selected coin metadata from COMMON_COINS
	let selectedCoinMetadata = $derived.by(() => {
		return COMMON_COINS.find((c) => c.coinType === selectedCoinType) || {
			coinType: DEFAULT_COIN_TYPE,
			symbol: 'SUI',
			name: 'Sui',
			decimals: 9,
			iconUrl: ''
		};
	});

	let selectedCoinSymbol = $derived(selectedCoinMetadata.symbol);
	let selectedCoinDecimals = $derived(selectedCoinMetadata.decimals);

	// Helper function to parse amount string to smallest unit based on decimals
	function parseAmountToSmallestUnit(amount: string, decimals: number): bigint {
		try {
			const trimmed = String(amount || '').trim();
			if (!trimmed || trimmed === '') return 0n;

			const [intPart, decPart = ''] = trimmed.split('.');
			const paddedDec = decPart.padEnd(decimals, '0').slice(0, decimals);
			const combined = intPart + paddedDec;
			return BigInt(combined);
		} catch {
			return 0n;
		}
	}

	// Helper function to format smallest unit to readable amount based on decimals
	function formatSmallestUnitToAmount(amount: bigint | string | number, decimals: number): string {
		try {
			const amountStr = String(amount);
			const paddedAmount = amountStr.padStart(decimals + 1, '0');
			let intPart = paddedAmount.slice(0, -decimals) || '0';
			const decPart = paddedAmount.slice(-decimals);
			
			// Add thousand separators to integer part
			intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
			
			// Remove trailing zeros from decimal part
			const trimmedDec = decPart.replace(/0+$/, '');
			
			if (trimmedDec === '') {
				return intPart;
			}
			return `${intPart}.${trimmedDec}`;
		} catch {
			return '0';
		}
	}

	// Selected coin balance (for non-SUI coins)
	let selectedCoinBalance = $state<bigint | null>(null);
	let selectedCoinBalanceLoading = $state(false);

	// Fetch selected coin balance when coin type or account changes
	$effect(() => {
		async function fetchSelectedCoinBalance() {
			if (!account || !selectedCoinType) {
				selectedCoinBalance = null;
				return;
			}

			// For SUI, use the existing suiBalance
			if (selectedCoinType === DEFAULT_COIN_TYPE) {
				selectedCoinBalance = suiBalance.value ? BigInt(suiBalance.value) : null;
				return;
			}

			// For other coins, fetch from blockchain
			selectedCoinBalanceLoading = true;
			try {
				const coinService = createTestnetCoinService();
				const balance = await coinService.getCoinBalance(account.address, selectedCoinType);
				selectedCoinBalance = BigInt(balance.totalBalance);
			} catch (err) {
				console.error('Failed to fetch selected coin balance:', err);
				selectedCoinBalance = null;
			} finally {
				selectedCoinBalanceLoading = false;
			}
		}

		fetchSelectedCoinBalance();
	});

	// Reactive wheel ID from URL params
	let createdWheelId = $derived(params.wheelId);

	// View/Edit and on-chain fetched state
	let isEditing = $state(false);
	let wheelFetched = $state(false);
	let entriesOnChain = $state<string[]>([]);
	let prizesOnChain = $state<bigint[]>([]); // Prize amounts in smallest unit (not just MIST)
	let spunCountOnChain = $state(0);
	let delayMsOnChain = $state(0);
	let claimWindowMsOnChain = $state(0);
	let poolBalanceOnChain = $state(0n); // Pool balance in smallest unit (not just MIST)
	let winnersOnChain = $state<Array<{ addr: string; prize_index: number }>>([]);
	let spinTimesOnChain = $state<number[]>([]);
	let organizerAddress = $state('');

	// Cancellation state
	let isCancelled = $state(false);

	// Off-chain winners history (only for off-chain wheels) -----------------------------
	let offchainWinners = $state<string[]>([]);

	// StateHistory to track off-chain winners
	const offchainWinnersHistory = new StateHistory(
		() => offchainWinners,
		(value) => {
			offchainWinners = value;
		}
	);

	// Get current winners from history log
	const currentWinnersFromHistory = $derived.by(() => {
		const snapshot = offchainWinnersHistory.log.at(-1)?.snapshot || [];
		// Transform string array to objects with address and timestamp
		return snapshot.map((address: string, index: number) => ({
			address,
			timestamp: Date.now() - (snapshot.length - index - 1) * 1000 // Approximate timestamp
		}));
	});

	// Real-time clock for history timestamps
	let currentTime = $state(Date.now());
	// -------------------------------------------------------------------------------------

	// QR code URL for results link when wheel is finished
	let resultQRUrl = $state('');
	$effect(() => {
		try {
			if (createdWheelId && remainingSpins === 0) {
				resultQRUrl = `${page.url.origin}/wheel-result?wheelId=${createdWheelId}`;
			} else {
				resultQRUrl = '';
			}
		} catch {
			resultQRUrl = '';
		}
	});

	// QR code URL for entry form
	$effect(() => {
		try {
			if (entryFormEnabled) {
				// Use wheelTempId if wheel not created yet, otherwise use createdWheelId
				const wheelId = createdWheelId || generateWheelTempId();
				const nameParam = entryFormModalName
					? `&name=${encodeURIComponent(entryFormModalName)}`
					: '';
				const url = `${page.url.origin}/entry-form?wheelId=${wheelId}&type=${entryFormType}${nameParam}`;
				entryFormQRUrl = url;
			} else {
				entryFormQRUrl = '';
			}
		} catch {
			entryFormQRUrl = '';
		}
	});

	// Action loading states
	let updateLoading = $state(false);
	let cancelLoading = $state(false);

	// Real-time entry updates
	let entryPollingInterval = $state<ReturnType<typeof setInterval> | null>(null);
	let lastEntryCount = $state(0);
	let onlineEntriesCount = $state(0);

	// Compute additional amount (in smallest unit) needed to top up the pool when editing
	let topUpAmount = $derived.by(() => {
		try {
			const desired = prizeAmounts.reduce(
				(acc, v) => acc + parseAmountToSmallestUnit(v, selectedCoinDecimals),
				0n
			);
			const currentPool = poolBalanceOnChain || 0n;
			return desired > currentPool ? desired - currentPool : 0n;
		} catch {
			return 0n;
		}
	});

	let totalDonationAmount = $derived.by(() => {
		try {
			return prizeAmounts.reduce(
				(acc, v) => acc + parseAmountToSmallestUnit(v, selectedCoinDecimals),
				0n
			);
		} catch {
			return 0n;
		}
	});

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
	let entriesTextareaEl = $state<HTMLTextAreaElement | null>(null);
	let entriesText = $state('');

	// Duplicate entries tracking
	let duplicateEntries = $state<Array<{ entry: string; count: number }>>([]);

	// Index order state: maps current `entries` positions -> original indices in `entriesOnChain`
	let shuffledIndexOrder = $state<number[]>([]);

	// Expose helpers to Wheel component via context
	function setWheelSpinning(v: boolean) {
		spinning = Boolean(v);
	}

	// Handle off-chain winner (called from Wheel component)
	function handleOffchainWinner(winnerAddress: string) {
		if (!createdWheelId && winnerAddress) {
			offchainWinners = [...offchainWinners, winnerAddress];
			// Timer will auto-start via watch on currentWinnersFromHistory.length
		}
	}

	// Remove entry value from entries array
	function removeEntryValue(value: string) {
		const v = String(value ?? '').trim();
		entries = entries.filter((entry) => String(entry ?? '').trim() !== v);
		entriesText = entries.join('\n');
	}

	// Remaining spins based on on-chain prizes and spun count
	let remainingSpins = $derived.by(() =>
		Math.max(0, (prizesOnChain.length || 0) - (spunCountOnChain || 0))
	);

	let invalidEntriesCount = $derived.by(() => {
		const lines = entries.map((s) => String(s ?? '').trim()).filter((s) => s.length > 0);
		return lines.filter((s) => !isValidSuiAddress(s)).length;
	});

	let uniqueValidEntriesCount = $derived.by(() => {
		const valid = entries
			.map((s) => String(s ?? '').trim())
			.filter((s) => s.length > 0 && isValidSuiAddress(s))
			.map((s) => s.toLowerCase());
		return new Set(valid).size;
	});

	let prizesCount = $derived.by(() =>
		prizeAmounts.filter((v) => parseAmountToSmallestUnit(v, selectedCoinDecimals) > 0n).length
	);

	let invalidPrizeAmountsCount = $derived.by(() => {
		return prizeAmounts.filter((v) => {
			const amount = parseAmountToSmallestUnit(v, selectedCoinDecimals);
			// Use minimum based on decimals (0.01 for most coins)
			const minAmount = BigInt(10 ** Math.max(0, selectedCoinDecimals - 2));
			return amount > 0n && amount < minAmount;
		}).length;
	});

	// Check if user has insufficient balance for selected coin
	let hasInsufficientBalance = $derived.by(() => {
		// Do not warn about balance until wallet and balance are fully loaded
		if (!account) return false;
		if (suiBalanceLoading?.value) return false;
		
		try {
			const suiBalanceValue = suiBalance.value;
			if (suiBalanceValue == null) return false;
			
			const suiBalanceBigInt = BigInt(suiBalanceValue);
			
			// If selected coin is SUI
			if (selectedCoinType === DEFAULT_COIN_TYPE) {
				// Need: totalDonation + reserved gas fee
				const required = totalDonationAmount + RESERVED_GAS_FEE_MIST;
				return suiBalanceBigInt < required;
			}
			
			// If selected coin is NOT SUI, just check if we have enough SUI for gas
			// (coin balance will be checked separately)
			return suiBalanceBigInt < RESERVED_GAS_FEE_MIST;
		} catch {
			return false;
		}
	});

	// Check if user has insufficient gas (SUI) for transaction
	let hasInsufficientGas = $derived.by(() => {
		if (!account) return false;
		if (suiBalanceLoading?.value) return false;
		
		try {
			const suiBalanceValue = suiBalance.value;
			if (suiBalanceValue == null) return false;
			
			return BigInt(suiBalanceValue) < RESERVED_GAS_FEE_MIST;
		} catch {
			return false;
		}
	});

	// Check if user has insufficient selected coin balance (for non-SUI coins)
	let hasInsufficientCoinBalance = $derived.by(() => {
		if (!account) return false;
		if (selectedCoinBalanceLoading) return false;
		
		// Only check for non-SUI coins
		if (selectedCoinType === DEFAULT_COIN_TYPE) return false;
		
		try {
			// If balance is null or 0, and we need some amount, it's insufficient
			if (selectedCoinBalance == null || selectedCoinBalance === 0n) {
				return totalDonationAmount > 0n;
			}
			
			return selectedCoinBalance < totalDonationAmount;
		} catch (err) {
			console.error('Error checking coin balance:', err);
			return false;
		}
	});

	// Organizer mismatch warning: show only when wallet is connected and organizer is known
	let isNotOrganizer = $derived.by(() => {
		try {
			if (!account) return false;
			const org = String(organizerAddress || '').trim();
			if (!org) return false;
			return account.address !== org;
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
			hasInsufficientGas ||
			hasInsufficientCoinBalance ||
			!isOnTestnet
	);

	// Final condition to show setup warnings
	let shouldShowSetupWarnings = $derived.by(() => {
		return (
			isNotOrganizer || (hasSetupWarnings && ((isEditing && createdWheelId) || !createdWheelId))
		);
	});

	function addPrize() {
		prizeAmounts = [...prizeAmounts, ''];
	}

	function removePrize(idx: number) {
		if (prizeAmounts.length <= 1) return;
		prizeAmounts = prizeAmounts.filter((_, i) => i !== idx);
	}

	function updatePrizeAmount(index: number, value: string) {
		prizeAmounts = prizeAmounts.map((v, i) => (i === index ? value : v));
	}

	function handlePrizeKeydown(index: number, e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addPrize();
			setTimeout(() => {
				const els = document.querySelectorAll<HTMLInputElement>('.prize-input');
				const el = els[els.length - 1];
				if (el && typeof el.focus === 'function') el.focus();
			}, 0);
		}
	}

	function getAddressEntries() {
		return entries
			.map((s) => String(s ?? '').trim())
			.filter((s) => s.length > 0 && isValidSuiAddress(s));
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
		const prizesCount = prizeAmounts.filter(
			(v) => parseAmountToSmallestUnit(v, selectedCoinDecimals) > 0n
		).length;
		if (prizesCount === 0) errors.push(t('main.errors.addAtLeast1Prize'));
		if (addrList.length < prizesCount) errors.push(t('main.errors.entriesMustBeGreaterThanPrizes'));
		// unique addresses check
		const uniqueCount = new Set(addrList.map((a) => a.toLowerCase())).size;
		if (uniqueCount < prizesCount)
			errors.push(t('main.errors.uniqueAddressCountMustBeGreaterThanPrizes'));
		// Check minimum prize amount (0.01 for most coins)
		const minAmount = BigInt(10 ** Math.max(0, selectedCoinDecimals - 2));
		const invalidPrizes = prizeAmounts.filter((v) => {
			const amount = parseAmountToSmallestUnit(v, selectedCoinDecimals);
			return amount > 0n && amount < minAmount;
		});
		if (invalidPrizes.length > 0) {
			errors.push(
				t('main.errors.eachPrizeMustBeAtLeast', { minAmount: MINIMUM_PRIZE_AMOUNT.SUI })
			);
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
			const prizeAmountsList = prizeAmounts
				.map((v) => parseAmountToSmallestUnit(v, selectedCoinDecimals))
				.filter((v) => v > 0n);
			const total = totalDonationAmount;
			if (total <= 0n) throw new Error(t('main.errors.totalDonationMustBeGreaterThan0'));

			// Prepare donation coin and build transaction
			const tx = new Transaction();
			const donationCoin = await prepareDonationCoin(
				tx,
				selectedCoinType,
				total,
				account!.address
			);

			// Build create wheel and fund transaction
			buildCreateWheelAndFundTx(
				tx,
				selectedCoinType,
				addrList,
				prizeAmountsList,
				BigInt(Number(delayMs || 0)) * 60000n,
				BigInt(Number(claimWindowMs || 0)) * 60000n,
				donationCoin
			);

			// Sign and execute the combined PTB
			const res = await signAndExecuteTransaction(tx);

			const digest = res?.digest ?? res?.effects?.transactionDigest;
			if (!digest) throw new Error('Failed to get transaction digest');

			// Wait for the transaction to be available across RPCs, then read object changes
			const txBlock = await suiClient.waitForTransaction({
				digest,
				options: { showObjectChanges: true, showInput: true }
			});
			
			// Find the created wheel object
			const wheelChange = (txBlock?.objectChanges || []).find(
				(ch) => ch.type === 'created' && String((ch as any).objectType || '').includes(`::${WHEEL_MODULE}::${WHEEL_STRUCT}`)
			);

			const finalWheelId = (wheelChange as { objectId?: string })?.objectId;
			if (!finalWheelId) throw new Error(t('main.errors.wheelObjectIdNotFound'));

			setupSuccessMsg = t('main.success.wheelCreatedAndFunded');

			// Notify and update current URL with wheelId param so reload keeps context
			toast({
				type: 'success',
				message: t('main.success.wheelCreatedAndFundedSuccessfully'),
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

			// Use the data we already have from local variables instead of parsing transaction inputs
			// This is more reliable than trying to parse the transaction structure
			const orderedEntries = addrList; // Already validated and used in transaction
			const prizeAmountsInSmallestUnit = prizeAmountsList.map((amount) => amount.toString());
			const totalDonationStr = total.toString();

			// Send directly to API to persist in DB
			const payload = {
				wheelId: finalWheelId,
				txDigest: digest,
				packageId,
				organizerAddress: account?.address,
				prizeAmounts: prizeAmountsInSmallestUnit, // Prize amounts in smallest unit
				totalDonationAmount: totalDonationStr, // Total donation in smallest unit
				network: 'testnet',
				orderedEntries,
				coinType: selectedCoinType
			};

			try {
				const resp = await fetch('/api/wheels', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				if (!resp?.ok) {
					const text = await resp.text().catch(() => '');
					console.error('Persist wheel failed:', resp?.status, text);
				}
			} catch (persistErr) {
				console.error('Failed to persist wheel to Supabase:', persistErr);
			}
		} catch (e) {
			const error = e as { message?: string } | Error;
			const errorMessage = error?.message || String(e);
			
			// Check for version mismatch error
			if (errorMessage.includes('EInvalidPackageVersion') || 
			    errorMessage.toLowerCase().includes('version')) {
				setupError = t('main.errors.contractVersionMismatch') || 'Contract version mismatch. Please refresh the page and try again.';
			} else {
				setupError = errorMessage;
			}
			
			toast({
				type: 'error',
				message: setupError || t('main.errors.failedToGetTransactionDigest'),
				position: 'bottom-right'
			});
		} finally {
			setupLoading = false;
		}
	}

	/**
	 * Fetch wheel data from testnet by createdWheelId and populate read-only state
	 */
	async function getEntriesForFinishedWheel(
		wheelId: string,
		winnersList: Array<{ addr: string }>,
		entriesOnChainList: string[]
	): Promise<string[]> {
		try {
			const resp = await fetch(`/api/wheels?wheelId=${encodeURIComponent(wheelId)}`);
			if (resp?.ok) {
				const data = (await resp.json()) as { entries?: string[]; coinType?: string };
				const dbEntries = Array.isArray(data?.entries) ? data.entries.map(String) : [];
				
				// Update selectedCoinType if available from API
				if (data?.coinType) {
					selectedCoinType = data.coinType;
				}
				
				if (dbEntries.length > 0) return dbEntries;
			}
		} catch {}
		const winnerAddresses = winnersList.map((w: { addr: string }) => w.addr);
		return [...winnerAddresses, ...entriesOnChainList];
	}

	async function fetchWheelCoinType(wheelId: string): Promise<void> {
		try {
			const resp = await fetch(`/api/wheels?wheelId=${encodeURIComponent(wheelId)}`);
			if (resp?.ok) {
				const data = (await resp.json()) as { coinType?: string };
				if (data?.coinType) {
					selectedCoinType = data.coinType;
				}
			}
		} catch (err) {
			console.error('Failed to fetch wheel coin type:', err);
		}
	}

	async function fetchWheelFromChain() {
		if (!createdWheelId) return;

		errorMsg = '';

		try {
			// Fetch coin type from API first and wait for it
			await fetchWheelCoinType(createdWheelId);

			const res = await suiClient.getObject({
				id: createdWheelId,
				options: { showContent: true, showOwner: true, showType: true }
			});
			const content = res?.data?.content;
			if (!content || content?.dataType !== 'moveObject') {
				errorMsg = t('main.errors.wheelNotFound');
				return;
			}
			
			// Extract coin type from object type as fallback
			// Object type format: "0x...::sui_wheel::Wheel<0x...::coin::COIN>"
			const objectType = (content as { type?: string }).type;
			if (objectType && objectType.includes('<') && objectType.includes('>')) {
				const match = objectType.match(/<(.+)>/);
				if (match && match[1]) {
					const extractedCoinType = match[1].trim();
					// Only update if API didn't provide coin type (still default)
					if (selectedCoinType === DEFAULT_COIN_TYPE && extractedCoinType !== DEFAULT_COIN_TYPE) {
						selectedCoinType = extractedCoinType;
					}
				}
			}
			
			const f = (content as { fields?: Record<string, unknown> }).fields || {};

			// Cancellation flag
			isCancelled = Boolean(f['is_cancelled']);

			// Organizer address
			organizerAddress = String(f['organizer'] || '');

			// Entries (addresses)
			entriesOnChain = ((f['remaining_entries'] as unknown[]) || []).map((v: unknown) => String(v));

			// Prize amounts in smallest unit (works for any coin type)
			prizesOnChain = ((f['prize_amounts'] as unknown[]) || []).map((v: unknown) => {
				try {
					if (
						typeof v === 'string' ||
						typeof v === 'number' ||
						typeof v === 'bigint' ||
						typeof v === 'boolean'
					) {
						return BigInt(v);
					}
					return 0n;
				} catch {
					return 0n;
				}
			});

			// Winners list
			winnersOnChain = ((f['winners'] as unknown[]) || []).map((w: unknown) => {
				const winner = w as {
					fields?: { addr?: unknown; prize_index?: unknown; claimed?: unknown };
					addr?: unknown;
					prize_index?: unknown;
					claimed?: unknown;
				};
				return {
					addr: String(winner?.fields?.addr ?? winner?.addr ?? ''),
					prize_index: Number(winner?.fields?.prize_index ?? winner?.prize_index ?? 0),
					claimed: Boolean(winner?.fields?.claimed ?? winner?.claimed ?? false)
				};
			});

			// Spin times (ms since epoch) aligned with prize indices
			try {
				spinTimesOnChain = ((f['spin_times'] as unknown[]) || []).map((v: unknown) => Number(v));
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

			// Pool balance (in smallest unit)
			let poolBalance = 0n;
			const poolCandidates = ['pool'];
			for (const _k of poolCandidates) {
				const v = f['pool'];
				if (v == null) continue;
				try {
					if (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint') {
						poolBalance = BigInt(v);
						break;
					}
					if (typeof v === 'object' && v !== null) {
						const vObj = v as {
							fields?: {
								balance?: { fields?: { value?: unknown } };
								value?: unknown;
							};
							value?: unknown;
							balance?: unknown;
						};
						const val =
							vObj?.fields?.balance?.fields?.value ??
							vObj?.fields?.value ??
							vObj?.value ??
							vObj?.balance;
						if (
							val != null &&
							(typeof val === 'string' ||
								typeof val === 'number' ||
								typeof val === 'bigint' ||
								typeof val === 'boolean')
						) {
							poolBalance = BigInt(val);
							break;
						}
					}
				} catch {
					// Ignore parsing errors
				}
			}
			poolBalanceOnChain = poolBalance;

			// Sync form states for edit mode convenience
			const lowerWinners = winnersOnChain.map((w) => w.addr.toLowerCase());
			let newEntries = [];

			// Show entries after the wheel is finished
			if (remainingSpins === 0 && winnersOnChain.length > 0) {
				newEntries = await getEntriesForFinishedWheel(
					createdWheelId,
					winnersOnChain,
					entriesOnChain
				);
			} else {
				// Always adopt on-chain order to keep deterministic index mapping
				// This avoids unintended detection of a shuffled order after spins
				newEntries = [...entriesOnChain];
			}
			entries = newEntries;
			entriesText = entries.join('\n');

			prizeAmounts = prizesOnChain.map((m) =>
				formatSmallestUnitToAmount(m, selectedCoinDecimals)
			);
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
			if (topUpAmount > 0n) {
				const tx = new Transaction();
				
				// Prepare top-up coin
				const coin = await prepareDonationCoin(
					tx,
					selectedCoinType,
					topUpAmount,
					account!.address
				);
				
				// Build donate transaction
				buildDonateToPoolTx(tx, selectedCoinType, createdWheelId, coin);
				
				await signAndExecuteTransaction(tx);
			}
			setupSuccessMsg = t('main.success.wheelUpdatedSuccessfully');
			isEditing = false;
			await fetchWheelFromChain();
		} catch (e) {
			const error = e as { message?: string } | Error;
			setupError = error?.message || String(e);
		} finally {
			updateLoading = false;
		}
	}

	async function cancelWheel() {
		if (!createdWheelId || !account) return;
		cancelLoading = true;
		setupError = '';

		try {
			const tx = new Transaction();

			// Build cancel wheel transaction
			buildCancelWheelTx(tx, selectedCoinType, createdWheelId, account.address);

			// Sign and execute the PTB
			const res = await signAndExecuteTransaction(tx);
			const digest = res?.digest ?? res?.effects?.transactionDigest;
			if (!digest) {
				setupError = t('main.errors.failedToCancelWheel');
				toast({
					type: 'error',
					message: setupError || t('main.errors.failedToCancelWheel'),
					position: 'bottom-right'
				});
				return;
			}
			setupSuccessMsg = t('main.success.wheelCancelledAndPoolReclaimed');
			toast({
				type: 'success',
				message: t('main.success.wheelCancelledSuccessfully'),
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
			const error = e as { message?: string } | Error;
			const errorMessage = error?.message || String(e);
			
			// Check for version mismatch error
			if (errorMessage.includes('EInvalidPackageVersion') || 
			    errorMessage.toLowerCase().includes('version')) {
				setupError = t('common.contractVersionMismatch');
			} else {
				setupError = errorMessage;
			}
		} finally {
			cancelLoading = false;
		}
	}

	// Import entries from X (Twitter) post
	let xImportDialogEl = $state<HTMLDialogElement | null>(null);
	let xImportInputEl = $state<HTMLInputElement | null>(null);
	let xImportInput = $state('');
	let xImportLoading = $state(false);

	// Online entry form modal
	let entryFormModalEl = $state<HTMLDialogElement | null>(null);
	let entryFormModalType = $state<'address' | 'name' | 'email'>('address');
	let entryFormModalEnabled = $state(false);
	let entryFormModalName = $state('');
	let entryFormModalDuration = $state(3);
	let entryFormEndTime = $state<number | null>(null);
	let entryFormTimer = $state<ReturnType<typeof setInterval> | null>(null);
	let remainingTime = $state(0);

	// QR Lightbox modal
	let qrLightboxEl = $state<HTMLDialogElement | null>(null);
	let qrLightboxUrl = $state('');
	let qrLightboxTitle = $state('');
	function openQRLightbox(url: string, title: string) {
		try {
			qrLightboxUrl = url || '';
			qrLightboxTitle = title || 'QR';
			if (qrLightboxEl && typeof qrLightboxEl.showModal === 'function') {
				qrLightboxEl.showModal();
			}
		} catch {}
	}

	function closeQRLightbox() {
		try {
			qrLightboxEl?.close?.();
		} catch {}
	}

	async function openXImportModal() {
		xImportInput = '';
		try {
			if (xImportDialogEl && typeof xImportDialogEl.showModal === 'function') {
				xImportDialogEl.showModal();

				// insert delay
				await new Promise((resolve) => setTimeout(resolve, 100));

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
					(error) => console.error('Error registering wheel metadata:', error)
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
			fetch(`/api/submit-entry?wheelId=${wheelId}&clear=true`).catch((error) =>
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

		toast({
			type: 'success',
			message: t('main.success.onlineEntriesDisabled'),
			position: 'top-right'
		});
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
				toast({
					type: 'error',
					message: t('main.notifications.noEntriesFoundInXPost'),
					position: 'top-right'
				});
			} else {
				toast({
					type: 'success',
					message: t('main.success.importedEntriesFromXPost', { count: data?.addresses.length }),
					title: t('main.success.imported'),
					position: 'top-right'
				});
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
			const error = e as { message?: string } | Error;
			toast({
				type: 'error',
				message: error?.message || t('main.notifications.failedToImportXPost'),
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
		() => {
			// Only fetch when document is visible (client-side)
			if (documentVisible.current) {
				void fetchWheelFromChain();
			}
		}
	);

	// Watch for entry form enable/disable
	watch(
		() => entryFormEnabled,
		() => {
			// Only run when document is visible (client-side)
			if (documentVisible.current) {
				if (entryFormEnabled) {
					startEntryPolling();
				} else {
					stopEntryPolling();
				}
			}
		}
	);

	// Watch wheelFetched
	watch(
		() => wheelFetched,
		() => {
			if (!wheelFetched || !createdWheelId) return;
			// Open prizes tab if remaining spins is 0 and wheel is created
			if (remainingSpins === 0 && createdWheelId) {
				activeTab = 'prizes';
			}
			// Set entries view mode to table if remaining spins is 0 or wheel is cancelled
			if (remainingSpins === 0 || isCancelled) {
				entriesViewMode = 'table';
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

			const data = await response.json().catch((error) => {
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
					newEntries.forEach((newEntry: string) => {
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
						const formattedEntries = newEntries.slice(0, addedCount).map((entry: string) => {
							return isValidSuiAddress(entry) ? shortenAddress(entry) : entry;
						});

						const entriesList =
							formattedEntries.length <= 3
								? formattedEntries.join(', ')
								: `${formattedEntries.slice(0, 3).join(', ')} and ${formattedEntries.length - 3} more`;

						toast({
							type: 'success',
							message: entriesList,
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
		entryPollingInterval = setInterval(checkForNewEntries, 5000) as ReturnType<
			typeof setInterval
		> | null; // Check every 5 seconds
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
	});

	// Start/stop history timer
	let historyTimer = $state<ReturnType<typeof setInterval> | null>(null);
	function startHistoryTimer() {
		if (historyTimer) return;
		if (currentWinnersFromHistory.length === 0) return;
		historyTimer = setInterval(() => {
			currentTime = Date.now();
		}, 1000) as ReturnType<typeof setInterval>; // Update every second
	}

	function stopHistoryTimer() {
		if (historyTimer) {
			clearInterval(historyTimer);
			historyTimer = null;
		}
	}

	// Watch currentWinnersFromHistory to start/stop timer
	watch(
		() => currentWinnersFromHistory.length,
		() => {
			if (currentWinnersFromHistory.length > 0) {
				startHistoryTimer();
			} else {
				stopHistoryTimer();
			}
		}
	);

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
			stopHistoryTimer();
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	});

	function handleShuffle() {
		if (spinning) return;
		const shuffled = shuffleArray(entries);
		if (shuffled) {
			entries = shuffled;
			entriesText = entries.join('\n');
		}
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

	function onEntriesTextChange(text: string) {
		if (spinning) return;
		const list = text
			.split('\n')
			.map((s: string) => s.trim())
			.filter((s: string) => s.length > 0);
		if (arraysShallowEqual(entries, list)) {
			return;
		}
		entries = list;
	}

	function updateDuplicateEntries() {
		const entryCount: Record<string, number> = {};
		entries.forEach((entry: string) => {
			const trimmed = entry.trim();
			if (trimmed) {
				entryCount[trimmed] = (entryCount[trimmed] || 0) + 1;
			}
		});

		// Filter entries that appear more than once
		const duplicates = Object.entries(entryCount)
			.filter(([, count]) => count > 1)
			.map(([entry, count]) => ({ entry, count }))
			.sort((a, b) => b.count - a.count); // Sort by count descending

		duplicateEntries = duplicates;
	}

	// Compute mapping from current entries to on-chain baseline indices
	function computeShuffledIndexOrder(baselineList: string[], currentList: string[]): number[] {
		try {
			const baseline = (baselineList || []).map((v: unknown) => String(v ?? ''));
			const current = (currentList || []).map((v: unknown) => String(v ?? ''));
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
		VERSION_OBJECT_ID,
		fetchWheelFromChain,
		setSpinning: setWheelSpinning,
		onShuffle: handleShuffle,
		onClearAllEntries: clearAllEntries,
		removeEntry: removeEntryValue,
		onOffchainWinner: handleOffchainWinner
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
			<h4 class="mb-2 text-sm font-semibold text-base-content/70">{t('main.duplicateEntries')}</h4>
			<div class="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-lg bg-base-300 p-2">
				{#each duplicateEntries as duplicate}
					<div class="flex items-center justify-between gap-2 text-sm">
						<span class="flex-1 truncate font-medium">
							{isValidSuiAddress(duplicate.entry)
								? shortenAddress(duplicate.entry)
								: duplicate.entry}
						</span>
						<span class="badge badge-sm badge-secondary">{duplicate.count}x</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
{/snippet}

{#snippet entriesTable(entriesList: string[], showActions = false, shortAddress = true)}
	{#if entriesList.length > 0}
		<div class="overflow-x-auto">
			<div class="relative">
				<div
					class="overflow-y-auto"
					class:max-h-64={!tableExpanded}
					class:max-h-none={tableExpanded}
				>
					<table class="table table-zebra table-sm">
						<thead>
							<tr>
								<th>#</th>
								<th>Address</th>
								{#if showActions}
									<th>{t('main.tableAction')}</th>
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
											{@html highlightAddress(addr)}
										{/if}
									</td>
									{#if showActions}
										<td>
											<button
												class="btn btn-soft btn-xs btn-error"
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
							class="btn shadow-lg btn-soft btn-xs btn-primary"
							onclick={() => (tableExpanded = !tableExpanded)}
							aria-label={tableExpanded ? 'Collapse table' : 'Expand table'}
						>
							{#if tableExpanded}
								<span class="icon-[lucide--chevron-up] h-3 w-3"></span>
								{t('main.tableCollapse')}
							{:else}
								<span class="icon-[lucide--chevron-down] h-3 w-3"></span>
								{t('main.tableShowAll')} ({entriesList.length})
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
				accountFromWallet={Boolean(account)}
				{isNotOrganizer}
				{shuffledIndexOrder}
				{selectedCoinType}
			/>
		</div>

		<div class="w-full">
			<div class="card bg-base-200 shadow">
				<div class="card-body">
					{#if errorMsg}
						<div class="alert alert-error">
							<span class="icon-[lucide--x] h-6 w-6 animate-pulse font-bold"></span>
							<span>{errorMsg}</span>
							<a
								class="btn btn-sm"
								href="/"
								onclick={() => {
									errorMsg = '';
									params.update({ wheelId: undefined });
								}}>{t('common.back')}</a
							>
						</div>
					{:else}
						<!-- Header actions for view/edit -->
						{#if createdWheelId && wheelFetched}
							<div class="mb-3 flex items-center justify-between gap-2">
								<!-- Header info -->
								<div class="flex items-center gap-2 text-sm opacity-70">
									<span
										>{t('main.wheelId')}
										<a
											href={getExplorerLink(
												isOnTestnet ? 'testnet' : 'mainnet',
												'object',
												createdWheelId
											)}
											target="_blank"
											rel="noopener noreferrer"
											class="link font-mono link-primary"
										>
											{shortenAddress(createdWheelId)}
										</a></span
									>
									{#if remainingSpins === 0}
										<span class="badge badge-sm whitespace-nowrap badge-success"
											><span class="icon-[lucide--check]"></span> {t('main.finished')}</span
										>
									{/if}
									{#if isCancelled}
										<span class="badge badge-sm whitespace-nowrap badge-warning"
											><span class="icon-[lucide--circle-x]"></span> {t('main.cancelled')}</span
										>
									{/if}
								</div>

								<div class="flex items-center gap-2">
									<!-- New wheel button -->
									{#if (!isEditing && remainingSpins === 0) || isCancelled}
										<button
											class="btn btn-sm btn-primary"
											onclick={() => {
												params.update({ wheelId: undefined });
												wheelFetched = false;
												entriesText = '';
												entries = [];
												entriesOnChain = [];
												prizeAmounts = [];
												prizesOnChain = [];
												winnersOnChain = [];
												spunCountOnChain = 0;
												poolBalanceOnChain = 0n;
												activeTab = 'entries';
												entriesViewMode = 'textarea';
												// Reset off-chain history
												offchainWinnersHistory.clear();
												stopHistoryTimer();
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
								<div class="h-8 w-40 skeleton"></div>
								<div class="h-32 w-full skeleton"></div>
								<div class="h-8 w-56 skeleton"></div>
							</div>
						{:else}
							<!-- Tabs -->
							<div class="tabs-lift tabs">
								<input
									type="radio"
									name="wheel_tabs"
									class="tab"
									aria-label={`${t('main.entries')} (${entries.length})`}
									checked={activeTab === 'entries'}
									onclick={() => (activeTab = 'entries')}
								/>
								<div class="tab-content border-base-300 bg-base-100 p-4">
									<div class="mb-1 flex items-center justify-end gap-2">
										<div class="text-xs opacity-70">{t('main.entriesViewModeLabel')}</div>
										<div class="flex items-center gap-2">
											<div class="join">
												<button
													class="btn join-item btn-xs"
													class:btn-primary={entriesViewMode === 'textarea'}
													class:btn-soft={entriesViewMode !== 'textarea'}
													onclick={() => (entriesViewMode = 'textarea')}
													aria-label={t('main.textareaView')}
												>
													<span class="icon-[lucide--edit] h-4 w-4"></span>
													{t('main.text')}
												</button>
												<button
													class="btn join-item btn-xs"
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

										<!-- Import buttons -->
										<div class="dropdown dropdown-end">
											<button
												class="btn btn-soft btn-xs btn-primary"
												aria-label={t('main.importEntries')}
											>
												<span class="icon-[lucide--list-plus] h-4 w-4"></span>
												<span>{t('main.import')}</span>
											</button>
											<ul
												class="dropdown-content menu z-[1] w-56 rounded-box bg-base-200 p-2 shadow"
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
												{#if account}
													<li>
														<button onclick={openXImportModal} aria-label={t('main.importByXPost')}>
															<svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
																<path
																	d="M13.317 10.774L20.28 2h-1.73l-6.32 7.353L8.29 2H2.115l7.33 10.638L2.115 22h1.73l6.707-7.783L15.315 22H21.59l-7.482-10.774z"
																/>
															</svg>
															{t('main.importByXPost')}
														</button>
													</li>
												{/if}
											</ul>
										</div>
									</div>

									{#if createdWheelId && wheelFetched && !isEditing}
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
									{:else if entriesViewMode === 'table'}
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
								</div>

								<!-- History tab (only for off-chain wheels without wallet connected) -->
								{#if !createdWheelId && !account}
									<input
										type="radio"
										name="wheel_tabs"
										class="tab"
										aria-label={`${t('main.history')} (${currentWinnersFromHistory.length})`}
										checked={activeTab === 'history'}
										onclick={() => (activeTab = 'history')}
									/>
									<div class="tab-content border-base-300 bg-base-100 p-6">
										<div class="mb-4 flex items-center justify-between">
											<h3 class="text-lg font-semibold">{t('main.history')}</h3>
											{#if currentWinnersFromHistory.length > 0}
												<button
													class="btn btn-outline btn-sm btn-error"
													onclick={() => {
														offchainWinnersHistory.clear();
														stopHistoryTimer();
													}}
													aria-label={t('main.clearHistory')}
												>
													<span class="icon-[lucide--trash-2] h-4 w-4"></span>
													{t('main.clearHistory')}
												</button>
											{/if}
										</div>

										<p class="mb-4 text-sm opacity-70">{t('main.historyNote')}</p>

										{#if currentWinnersFromHistory.length === 0}
											<div class="py-8 text-center text-sm text-base-content/50">
												{t('main.noHistory')}
											</div>
										{:else}
											<div class="overflow-x-auto">
												<table class="table table-zebra">
													<thead>
														<tr>
															<th>#</th>
															<th>{t('main.winner')}</th>
															<th>{t('main.timestamp')}</th>
														</tr>
													</thead>
													<tbody>
														{#each currentWinnersFromHistory as winner, i}
															<tr>
																<td class="w-12">{i + 1}</td>
																<td class="font-mono">
																	{isValidSuiAddress(winner.address)
																		? shortenAddress(winner.address)
																		: winner.address}
																</td>
																<td class="text-sm opacity-70">
																	{(() => {
																		// Reference currentTime to trigger reactivity
																		void currentTime;
																		return formatDistanceToNow(new Date(winner.timestamp), {
																			addSuffix: true,
																			includeSeconds: true,
																			locale: dateLocale
																		});
																	})()}
																</td>
															</tr>
														{/each}
													</tbody>
												</table>
											</div>
										{/if}
									</div>
								{/if}

								<!-- Prizes tab -->
								{#if account || createdWheelId}
									<input
										type="radio"
										name="wheel_tabs"
										class="tab"
										aria-label={t('main.prizes')}
										checked={activeTab === 'prizes'}
										onclick={() => (activeTab = 'prizes')}
									/>
									<div class="tab-content border-base-300 bg-base-100 p-6">
										<h3 class="mb-4 text-lg font-semibold">
											{t('main.prizes')} ({selectedCoinSymbol})
										</h3>

										<!-- Coin Selector (only show when creating new wheel) -->
										{#if !createdWheelId && account}
											<div class="mb-4">
												<fieldset class="fieldset">
													<legend class="fieldset-legend">{t('main.selectCoin')}</legend>
													<CoinSelector
														bind:selectedCoinType
														walletAddress={account.address}
														showBalance={true}
														placeholder={t('main.selectCoinPlaceholder')}
													/>
												</fieldset>
											</div>
										{/if}

										{#if createdWheelId && wheelFetched && !isEditing}
											<div class="overflow-x-auto">
												<table class="table table-zebra">
													<thead>
														<tr>
															<th>#</th>
															<th>{t('main.amount')}</th>
															<th>{t('main.winner')}</th>
														</tr>
													</thead>
													<tbody>
														{#each prizesOnChain as m, i}
															<tr>
																<td class="w-12">{i + 1}</td>
																<td>
																	<CoinDisplay
																		coinType={selectedCoinType}
																		amount={m}
																		showIcon={true}
																		showSymbol={true}
																		size="sm"
																		compact={true}
																	/>
																</td>
																<td class="flex items-center font-mono">
																	{#if winnersOnChain.find((w) => w.prize_index === i)}
																		{shortenAddress(
																			winnersOnChain.find((w) => w.prize_index === i)?.addr ?? ''
																		)}
																		{#if Number(spinTimesOnChain[i] || 0) > 0}
																			<span
																				class="ml-2 badge badge-soft badge-sm text-xs whitespace-nowrap opacity-70 badge-success"
																				>{formatDistanceToNow(spinTimesOnChain[i], {
																					addSuffix: true,
																					locale: dateLocale
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
												<div class="mb-2 join w-full">
													<button class="btn btn-disabled join-item"
														>{t('main.prize')} #{i + 1}</button
													>
													<input
														type="text"
														class="prize-input input join-item w-full"
														placeholder={t('main.amountExample')}
														value={prizeAmounts[i] ?? ''}
														oninput={(e) => updatePrizeAmount(i, e.currentTarget.value)}
														onchange={(e) => updatePrizeAmount(i, e.currentTarget.value)}
														onkeydown={(e) => handlePrizeKeydown(i, e)}
														aria-label={t('main.prizeAmountInSui', { number: i + 1 })}
													/>
													<button
														class="btn join-item btn-soft btn-error"
														onclick={() => removePrize(i)}
														disabled={prizeAmounts.length <= 1}
														aria-label={t('main.removePrize')}
														><span class="icon-[lucide--x] h-4 w-4"></span></button
													>
												</div>
											{/each}
											<div class="mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
												<button class="btn btn-outline" onclick={addPrize}
													>{t('main.addPrize')}</button
												>
												<div class="text-sm flex gap-1">
													<strong>{t('main.need')}:</strong>
													<p>
														<span class="font-mono text-primary"
															>{formatSmallestUnitToAmount(totalDonationAmount, selectedCoinDecimals)}</span
														> {selectedCoinSymbol}
													</p>
												</div>
											</div>

											{#if createdWheelId && wheelFetched}
												<div class="mt-2 text-sm">
													<span class="opacity-70">{t('main.topUpRequired')}:</span>
													<div class="ml-1">
														<span class="font-mono font-bold"
															>{formatSmallestUnitToAmount(topUpAmount, selectedCoinDecimals)}</span
														>
														{selectedCoinSymbol}
													</div>
												</div>
											{/if}
										{/if}
									</div>
								{/if}

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
									<div class="tab-content border-base-300 bg-base-100 p-6">
										<h3 class="mb-4 text-lg font-semibold">{t('main.settings')}</h3>
										<div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
											<fieldset class="fieldset rounded-box border border-base-300 p-4">
												<legend class="fieldset-legend">{t('main.claimDelay')}</legend>
												<select
													class="select"
													bind:value={delayMs}
													aria-label={t('main.delay')}
													disabled={Boolean(createdWheelId && wheelFetched && !isEditing)}
												>
													<option value={0}>{t('main.zeroMinuteDefault')}</option>
													<option value={15}>{t('main.fifteenMinutes')}</option>
													<option value={30}>{t('main.thirtyMinutes')}</option>
													<option value={60}>{t('main.oneHour')}</option>
													<option value={120}>{t('main.twoHours')}</option>
												</select>
												<span class="label">{t('main.waitTimeBeforeClaimingPrize')}</span>
											</fieldset>

											<fieldset class="fieldset rounded-box border border-base-300 p-4">
												<legend class="fieldset-legend">{t('main.claimPeriod')}</legend>
												<select
													class="select"
													bind:value={claimWindowMs}
													aria-label={t('main.claimWindow')}
													disabled={Boolean(createdWheelId && wheelFetched && !isEditing)}
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
									<div class="alert w-60 alert-soft alert-info light:!border-info">
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

									{#if resultQRUrl}
										<div class="mt-3 flex items-center gap-3">
											<button
												type="button"
												class="mb-3 w-128 cursor-zoom-in rounded-box border border-base-300 bg-base-100 p-2 shadow"
												aria-label={t('main.resultQr')}
												onclick={() => openQRLightbox(resultQRUrl, t('main.resultQr'))}
											>
												<svg
													use:qr={{ data: resultQRUrl, logo }}
													aria-hidden="true"
												/>
											</button>

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
									<div class="alert alert-soft alert-success light:!border-success">
										<span class="icon-[lucide--qr-code] h-4 w-4"></span>
										<span>{t('main.onlineEntryFormScanToJoin')}</span>
										<ButtonCopy originText={entryFormQRUrl} size="xs" className="btn-soft" />
									</div>

									{#if entryFormQRUrl}
										<div class="mt-3 flex items-center gap-3">
											<button
												type="button"
												class="mb-3 w-128 cursor-zoom-in rounded-box border border-base-300 bg-base-100 p-2 shadow"
												aria-label={t('main.entryFormQr')}
												onclick={() => openQRLightbox(entryFormQRUrl, t('main.entryFormQr'))}
											>
												<svg
													use:qr={{ data: entryFormQRUrl, logo }}
													aria-hidden="true"
												/>
											</button>
											<div class="flex w-full flex-col items-center gap-2">
												{#if remainingTime > 0}
													<div
														class="flex flex-col items-center gap-2 text-center text-base-content/70"
													>
														<span class="icon-[lucide--clock] h-6 w-6"></span>
														<span>{t('main.timeRemaining')}</span>

														<div class="flex gap-2">
															<div
																class="flex flex-col rounded-box bg-neutral p-2 text-neutral-content"
															>
																<span class="countdown font-mono text-3xl">
																	<span
																		style="--value:{Math.floor(remainingTime / 60)};"
																		aria-live="polite"
																		aria-label={String(Math.floor(remainingTime / 60))}
																		>{Math.floor(remainingTime / 60)}</span
																	>
																</span>
																{t('main.min')}
															</div>
															<div
																class="flex flex-col rounded-box bg-neutral p-2 text-neutral-content"
															>
																<span class="countdown font-mono text-3xl">
																	<span
																		style="--value:{remainingTime % 60};"
																		aria-live="polite"
																		aria-label={String(remainingTime % 60)}
																		>{remainingTime % 60}</span
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

									<div class="mt-2 sm:text-center">
										<button
											class="btn btn-outline btn-sm btn-error"
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
									<div class="mt-3 alert whitespace-pre-wrap alert-error light:!border-error">
										{setupError}
									</div>
								{/if}
								{#if setupSuccessMsg}
									<div class="mt-3 alert break-words alert-success light:!border-success">
										<span class="icon-[lucide--check-circle] h-4 w-4"></span>
										{setupSuccessMsg}
									</div>
								{/if}

								{#if shouldShowSetupWarnings}
									<div class="mt-3 alert alert-soft alert-warning light:!border-warning">
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
														class="btn ml-1 align-baseline btn-link btn-sm"
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
											{#if isNotOrganizer}
												<li>{t('wheel.notOrganizer')}</li>
											{/if}
											{#if hasInsufficientGas && selectedCoinType !== DEFAULT_COIN_TYPE}
												<li>{t('main.insufficientGasBalance')}</li>
											{/if}
											{#if hasInsufficientCoinBalance}
												<li>{t('main.insufficientCoinBalance', { symbol: selectedCoinSymbol })}</li>
											{/if}
											{#if hasInsufficientBalance && selectedCoinType === DEFAULT_COIN_TYPE}
												<li>{t('main.insufficientSuiBalance')}</li>
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
												hasInsufficientBalance ||
												hasInsufficientGas ||
												hasInsufficientCoinBalance}
										>
											{#if totalDonationAmount > 0n}
												{t('main.createWheelAndFund')}
												<span class="font-mono font-bold text-success"
													>{formatSmallestUnitToAmount(totalDonationAmount, selectedCoinDecimals)}</span
												> {selectedCoinSymbol}
											{:else}
												{t('main.createWheel')}
											{/if}
										</ButtonLoading>
									</div>
								{/if}
							{:else if isInitialized}
								<div class="mt-3 alert alert-soft alert-info light:!border-info">
									<span class="icon-[lucide--info] h-5 w-5"></span>
									{t('main.connectWalletToCreateAndSpin')}
								</div>
							{/if}
						{/if}
					{/if}
				</div>
			</div>
		</div>
	</div>
</section>

<!-- QR Lightbox Modal -->
<dialog class="modal" bind:this={qrLightboxEl} aria-label={qrLightboxTitle} tabindex="-1">
	<div class="modal-box w-11/12 max-w-2xl">
		<h3 class="mb-3 text-center text-lg font-semibold">{qrLightboxTitle}</h3>
		<div class="flex items-center justify-center">
			{#if qrLightboxUrl}
				<svg
					use:qr={{ data: qrLightboxUrl, logo }}
					class="w-128 rounded-box border-base-300 bg-base-100 p-2 shadow"
					role="img"
					aria-label={qrLightboxTitle}
				/>
			{/if}
		</div>

		<div class="mt-4 flex justify-center">
			<button class="btn" onclick={closeQRLightbox} aria-label="Close QR Lightbox">
				{t('main.close')}
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop" aria-label="Close">
		<button>{t('main.close')}</button>
	</form>
</dialog>

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
				<p class="ml-8 text-xs text-base-content/70">
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
					<p class="label mt-1 text-xs text-base-content/70">
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
					<p class="label mt-1 text-xs text-base-content/70">
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
