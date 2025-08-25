<script>
	import { page } from '$app/stores';
	import { getContext } from 'svelte';
	import ProfileDropdown from '$lib/components/ProfileDropdown.svelte';

	// Get data from context
	let navItems = getContext('navItems');

	let path = $derived($page.url.pathname);
	let currentSection = $derived.by(() => {
		// Find exact match first
		let exactMatch = navItems.find(section => path === section.slug);
		if (exactMatch) return exactMatch;

		// If no exact match, find by startsWith
		return navItems.find(section => path.startsWith(`${section.slug}/`));
	});

	let pageTitle = $derived(currentSection?.title);
</script>

<div class="navbar bg-base-100 sticky top-0 z-10 px-4 shadow-md">
	<div class="flex flex-1">
		<label for="my-drawer-2" class="btn btn-sm border-base-300 drawer-button shadow-sm">
			<span class="icon-[lucide--menu] h-5 w-5"></span>
		</label>
		<h1 class="ml-3 text-2xl font-semibold">{pageTitle}</h1>
	</div>

	<!-- Right side with profile dropdown -->
	<div class="flex-none">
		<ProfileDropdown />
	</div>
</div>
