<script>
	import { useTranslation } from '$lib/hooks/useTranslation.js';
	const t = useTranslation();

	const { className = '' } = $props();
</script>

<div class="alert alert-soft dark:!border-warning alert-warning {className}">
	<span class="icon-[lucide--alert-triangle] animate-ping"></span>
	<div>
		<h3 class="font-bold">{t('common.testnetWarning')}</h3>
		<div class="text-xs">{t('common.switchToTestnet')}</div>
	</div>
</div>
