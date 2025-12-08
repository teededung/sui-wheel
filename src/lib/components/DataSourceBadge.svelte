<script lang="ts">
	import { dev } from '$app/environment';
	import type { ExtendedWheelDataSource } from '$lib/types/wheel.js';

	type Props = {
		source: ExtendedWheelDataSource;
	};

	let { source }: Props = $props();
</script>

{#if dev && source !== 'none'}
	<span
		class="badge badge-sm"
		class:badge-info={source === 'offchain backup'}
		class:badge-primary={source === 'graphql'}
		class:badge-secondary={source === 'rpc'}
	>
		{#if source === 'offchain backup'}
			Offchain Backup
		{:else if source === 'graphql'}
			GraphQL
		{:else}
			RPC
		{/if}
	</span>
{/if}
