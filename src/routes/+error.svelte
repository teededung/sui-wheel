<script>
	let { status, message } = $props();

	// Default error messages based on status codes
	let errorTitle = $derived.by(() => {
		switch (status) {
			case 404:
				return 'Page Not Found';
			case 500:
				return 'Server Error';
			case 403:
				return 'Access Denied';
			default:
				return 'Something went wrong';
		}
	});

	let errorDescription = $derived.by(() => {
		switch (status) {
			case 404:
				return 'The page you are looking for does not exist.';
			case 500:
				return 'Something went wrong on our end. Please try again later.';
			case 403:
				return 'You do not have permission to access this resource.';
			default:
				return message || 'An unexpected error occurred.';
		}
	});
</script>

<div class="bg-base-100 flex min-h-screen items-center justify-center p-4">
	<div class="card bg-base-200 w-full max-w-md shadow-xl">
		<div class="card-body text-center">
			<!-- Error Icon -->
			<div class="mb-4 flex justify-center">
				<div class="bg-error/20 flex h-16 w-16 items-center justify-center rounded-full">
					<svg class="text-error h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
						></path>
					</svg>
				</div>
			</div>

			<!-- Error Status -->
			{#if status}
				<div class="badge badge-error mb-2">Error {status}</div>
			{/if}

			<!-- Error Title -->
			<h1 class="card-title text-base-content mb-2 justify-center text-2xl font-bold">
				{errorTitle}
			</h1>

			<!-- Error Description -->
			<p class="text-base-content/70 mb-6">
				{errorDescription}
			</p>

			<!-- Action Buttons -->
			<div class="card-actions justify-center gap-2">
				<button class="btn btn-primary" onclick={() => window.history.back()}>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 19l-7-7m0 0l7-7m-7 7h18"
						></path>
					</svg>
					Go Back
				</button>

				<a href="/" class="btn btn-outline">
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
						></path>
					</svg>
					Home
				</a>
			</div>
		</div>
	</div>
</div>
