<script>
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-daisy-toaster';
	import ButtonLoading from '$lib/components/ButtonLoading.svelte';
	import { isValidSuiAddress } from '$lib/utils/suiHelpers.js';
	import { useTranslation } from '$lib/hooks/useTranslation.js';

	const t = useTranslation();

	// Get wheelId from URL params (can be wheelTempId or createdWheelId)
	let wheelId = $state('');
	let entryType = $state('address'); // 'address', 'name', 'email'
	let wheelName = $state(''); // Wheel name from URL params
	let entry = $state('');
	let submitting = $state(false);
	let loading = $state(true);
	let submitted = $state(false);

	onMount(() => {
		const urlParams = new URLSearchParams(page.url.search);
		wheelId = urlParams.get('wheelId') || '';
		entryType = urlParams.get('type') || 'address';
		wheelName = urlParams.get('name') || '';

		if (!wheelId) {
			toast.error(t('entryForm.errors.invalidWheelLink'), { position: 'top-center' });
			goto('/');
			return;
		}

		// Simulate loading
		setTimeout(() => {
			loading = false;
		}, 500);
	});

	async function handleSubmit() {
		if (!entry.trim() || submitting) return;

		// Validate entry based on type
		if (entryType === 'address' && !isValidSuiAddress(entry)) {
			toast.error(t('entryForm.errors.pleaseEnterValidSuiAddress'), { position: 'top-center' });
			return;
		}

		if (entryType === 'name' && (entry.length < 1 || entry.length > 50)) {
			toast.error(t('entryForm.errors.nameMustBe1To50Characters'), { position: 'top-center' });
			return;
		}

		if (entryType === 'email') {
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(entry)) {
				toast.error(t('entryForm.errors.pleaseEnterValidEmailAddress'), { position: 'top-center' });
				return;
			}
		}

		submitting = true;

		try {
			const response = await fetch('/api/submit-entry', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					wheelId,
					entry: entry.trim(),
					entryType
				})
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json().catch(error => {
				console.error('Failed to parse JSON response:', error);
				throw new Error('Invalid response format');
			});

			if (data.success) {
				toast.success(t('entryForm.success.entrySubmittedSuccessfully'), {
					position: 'top-center',
					durationMs: 3000
				});
				submitted = true;
				entry = '';

				// Don't redirect, let user close the window manually
			} else {
				toast.error(data.message || t('entryForm.errors.failedToSubmitEntry'), {
					position: 'top-center'
				});
			}
		} catch (error) {
			console.error('Submit error:', error);
			toast.error(t('entryForm.errors.networkErrorPleaseTryAgain'), { position: 'top-center' });
		} finally {
			submitting = false;
		}
	}

	function handleKeydown(e) {
		if (e.key === 'Enter' && !submitting) {
			e.preventDefault();
			handleSubmit();
		}
	}
</script>

<svelte:head>
	<title>{t('entryForm.title')}</title>
	<meta name="description" content={t('entryForm.metaDescription')} />
</svelte:head>

<div class="mt-10 flex items-center justify-center p-4">
	<div class="card bg-base-200 w-full max-w-md shadow-xl">
		<div class="card-body">
			{#if loading}
				<div class="flex flex-col items-center space-y-4">
					<div class="loading loading-spinner loading-lg text-primary"></div>
					<p class="text-base-content/70">{t('entryForm.loadingWheelInformation')}</p>
				</div>
			{:else if submitted}
				<div class="text-center">
					<div class="mb-6">
						<h1 class="text-primary mb-2 text-2xl font-bold">{t('entryForm.entrySubmitted')}</h1>
						<p class="text-base-content/70 text-sm">
							{t('entryForm.pleaseWaitForTableToUpdate')}
						</p>
					</div>
					<div class="alert alert-success">
						<span class="icon-[lucide--check-circle] h-5 w-5"></span>
						<span>{t('entryForm.yourEntryHasBeenRecordedSuccessfully')}</span>
					</div>
				</div>
			{:else}
				<div class="mb-6 text-center">
					<h1 class="text-primary mb-2 text-2xl font-bold">{t('entryForm.joinTheWheel')}</h1>
					<p class="text-base-content/70 text-sm">
						{#if entryType === 'address'}
							{t('entryForm.enterYourSuiWalletAddressToJoin')}
						{:else if entryType === 'email'}
							{t('entryForm.enterYourEmailAddressToJoin')}
						{:else}
							{t('entryForm.enterYourNameToJoin')}
						{/if}
					</p>
				</div>

				<form
					onsubmit={e => {
						e.preventDefault();
						handleSubmit();
					}}
					class="join space-y-4"
				>
					<label class="floating-label w-full">
						<input
							type={entryType === 'email' ? 'email' : 'text'}
							class="input join-item w-full text-base"
							placeholder={entryType === 'address'
								? t('entryForm.placeholder.walletAddress')
								: entryType === 'email'
									? t('entryForm.placeholder.emailAddress')
									: t('entryForm.placeholder.name')}
							bind:value={entry}
							onkeydown={handleKeydown}
							disabled={submitting}
							autocomplete="off"
							required
						/>
						<span>
							{#if entryType === 'address'}
								{t('entryForm.label.walletAddress')}
							{:else if entryType === 'email'}
								{t('entryForm.label.emailAddress')}
							{:else}
								{t('entryForm.label.name')}
							{/if}
						</span>
					</label>

					<ButtonLoading
						formLoading={submitting}
						color="primary"
						size="lg"
						loadingText={t('entryForm.submitting')}
						onclick={handleSubmit}
						disabled={!entry.trim()}
						className="join-item"
					>
						{t('entryForm.joinWheel')}
					</ButtonLoading>
				</form>

				<div class="divider text-base-content/50 text-xs">
					{t('entryForm.wheel')}: {wheelName ||
						(wheelId.startsWith('temp_') ? t('entryForm.temporary') : wheelId.slice(0, 8))}
				</div>
			{/if}
		</div>
	</div>
</div>
