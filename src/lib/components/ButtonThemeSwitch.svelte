<script>
	let isDark = $state(false);
	let isInitialized = $state(false);

	/** @type {{className?: string}} */
	let { className = '' } = $props();

	$effect(() => {
		// Đọc theme từ document thay vì localStorage để đồng bộ với themes.js
		const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
		isDark = currentTheme === 'dark';
		isInitialized = true;
	});

	function toggleTheme(event) {
		isDark = event.target.checked;
		const newTheme = isDark ? 'dark' : 'light';
		localStorage.setItem('theme', newTheme);
		document.documentElement.setAttribute('data-theme', newTheme);
	}
</script>

{#if isInitialized}
	<label class={`swap swap-rotate ${className}`}>
		<input
			type="checkbox"
			class="theme-controller"
			checked={isDark}
			onchange={toggleTheme}
			aria-label="Toggle theme"
		/>

		<!-- sun icon -->
		<div class="swap-off icon-[lucide--sun-medium] h-5 w-5"></div>

		<!-- moon icon -->
		<div class="swap-on icon-[lucide--moon] h-5 w-5"></div>
	</label>
{/if}
