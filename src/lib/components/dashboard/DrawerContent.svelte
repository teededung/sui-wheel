<script>
	import NavbarAdmin from '$lib/components/dashboard/NavbarAdmin.svelte';

	let { children, drawerOpen = false } = $props();
</script>

<div class="drawer-content flex flex-col">
	<NavbarAdmin />
	<div class="p-4 lg:p-6 {drawerOpen ? 'lg:pl-72' : ''}" style="transition: padding 0.3s ease-out;">
		{@render children()}
	</div>
</div>
