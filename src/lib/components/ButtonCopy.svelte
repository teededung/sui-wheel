<script>
	let { originText, originHtml, className = '', size = 'xs' } = $props();

	let copiedText = $state('');
	let timeoutId = $state(null);

	/**
	 * copyContent:
	 * - If `originHtml` exists, try to copy as HTML (and fallback to text).
	 * - If no `originHtml`, copy text normally.
	 */
	async function copyContent() {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}

		copiedText = '';

		setTimeout(async () => {
			try {
				// Check if originText and originHtml have valid values
				if (!originText) return;

				if (originHtml && window.ClipboardItem) {
					const clipboardData = new ClipboardItem({
						'text/html': new Blob([originHtml], { type: 'text/html' }),
						'text/plain': new Blob([originText], { type: 'text/plain' })
					});
					await navigator.clipboard.write([clipboardData]);
				} else {
					await navigator.clipboard.writeText(originText);
				}

				copiedText = originText;
			} catch (err) {
				console.error('Error when copying:', err);
			}

			timeoutId = setTimeout(() => {
				copiedText = '';
				timeoutId = null;
			}, 2000);
		}, 10);
	}

	// Clean up timeout when component is destroyed
	$effect(() => {
		return () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
	});
</script>

<button
	type="button"
	class={`btn btn-${size} btn-ghost ${className}`}
	title="Copy"
	onclick={() => copyContent()}
>
	{#if copiedText !== '' && copiedText === originText}
		<span class="icon-[lucide--check] text-success h-4 w-4"></span>
		<span>Copied</span>
	{:else}
		<span class="icon-[lucide--copy] h-3 w-3"></span>
	{/if}
</button>
