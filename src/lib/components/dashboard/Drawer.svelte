<script>
	import DrawerSide from './DrawerSide.svelte';
	import DrawerContent from './DrawerContent.svelte';

	/** @type {{children: any, user: any}} */
	let { children } = $props();
	let drawerOpen = $state(false);
</script>

<div class="drawer">
	<!-- drawer-toggle is used to toggle the drawer -->
	<input id="my-drawer-2" type="checkbox" class="drawer-toggle" bind:checked={drawerOpen} />

	<DrawerContent {drawerOpen}>
		{@render children()}
	</DrawerContent>

	<DrawerSide />
</div>
