<script>
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-daisy-toaster';
	import ButtonLoading from '$lib/components/ButtonLoading.svelte';
	import { isValidSuiAddress } from '$lib/utils/suiHelpers.js';

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
			toast.error('Invalid wheel link', { position: 'top-center' });
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
			toast.error('Please enter a valid Sui address', { position: 'top-center' });
			return;
		}

		if (entryType === 'name' && (entry.length < 1 || entry.length > 50)) {
			toast.error('Name must be 1-50 characters', { position: 'top-center' });
			return;
		}

		if (entryType === 'email') {
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(entry)) {
				toast.error('Please enter a valid email address', { position: 'top-center' });
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
				toast.success('Entry submitted successfully!', {
					position: 'top-center',
					durationMs: 3000
				});
				submitted = true;
				entry = '';

				// Don't redirect, let user close the window manually
			} else {
				toast.error(data.message || 'Failed to submit entry', { position: 'top-center' });
			}
		} catch (error) {
			console.error('Submit error:', error);
			toast.error('Network error. Please try again.', { position: 'top-center' });
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
	<title>Join Wheel - Sui Wheel</title>
	<meta name="description" content="Join the Sui Wheel by submitting your entry" />
</svelte:head>

<div class="mt-10 flex items-center justify-center p-4">
	<div class="card bg-base-200 w-full max-w-md shadow-xl">
		<div class="card-body">
			{#if loading}
				<div class="flex flex-col items-center space-y-4">
					<div class="loading loading-spinner loading-lg text-primary"></div>
					<p class="text-base-content/70">Loading wheel information...</p>
				</div>
			{:else if submitted}
				<div class="text-center">
					<div class="mb-6">
						<h1 class="text-primary mb-2 text-2xl font-bold">Entry Submitted!</h1>
						<p class="text-base-content/70 text-sm">
							Please wait for the table to update automatically. You can close this window.
						</p>
					</div>
					<div class="alert alert-success">
						<span class="icon-[lucide--check-circle] h-5 w-5"></span>
						<span>Your entry has been recorded successfully!</span>
					</div>
				</div>
			{:else}
				<div class="mb-6 text-center">
					<h1 class="text-primary mb-2 text-2xl font-bold">Join the Wheel!</h1>
					<p class="text-base-content/70 text-sm">
						{#if entryType === 'address'}
							Enter your Sui wallet address to join
						{:else if entryType === 'email'}
							Enter your email address to join
						{:else}
							Enter your name to join
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
								? '0x...'
								: entryType === 'email'
									? 'your@email.com'
									: 'Enter your name'}
							bind:value={entry}
							onkeydown={handleKeydown}
							disabled={submitting}
							autocomplete="off"
							required
						/>
						<span>
							{#if entryType === 'address'}
								Wallet Address
							{:else if entryType === 'email'}
								Email Address
							{:else}
								Name
							{/if}
						</span>
					</label>

					<ButtonLoading
						formLoading={submitting}
						color="primary"
						size="lg"
						loadingText="Submitting..."
						onclick={handleSubmit}
						disabled={!entry.trim()}
						className="join-item"
					>
						Join Wheel
					</ButtonLoading>
				</form>

				<div class="divider text-base-content/50 text-xs">
					Wheel: {wheelName || (wheelId.startsWith('temp_') ? 'Temporary' : wheelId.slice(0, 8))}
				</div>
			{/if}
		</div>
	</div>
</div>
