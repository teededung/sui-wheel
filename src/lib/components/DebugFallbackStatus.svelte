<script lang="ts">
	interface Props {
		dbStatus: 'success' | 'failed' | 'unknown';
		fallbackUsed: boolean;
		itemsCount: number;
	}
	
	let { dbStatus, fallbackUsed, itemsCount }: Props = $props();
</script>

<div class="alert alert-info text-xs">
	<span class="icon-[lucide--info]"></span>
	<div class="flex flex-col gap-1">
		<div class="font-semibold">Debug Info (Dev Only)</div>
		<div class="flex gap-4 text-xs opacity-80">
			<span>DB Status: <strong>{dbStatus}</strong></span>
			<span>Fallback: <strong>{fallbackUsed ? 'Yes (On-chain)' : 'No'}</strong></span>
			<span>Items: <strong>{itemsCount}</strong></span>
		</div>
	</div>
</div>

