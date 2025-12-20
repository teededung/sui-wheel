<script lang="ts">
	import type { Reward, RewardPreset } from '$lib/types/wheel.js';
	import { useTranslation } from '$lib/hooks/useTranslation.js';
	import { toast } from 'svelte-daisy-toaster';

	interface Props {
		rewards: Reward[];
		equalSlices?: boolean;
		onUpdate: (rewards: Reward[]) => void;
		onUpdateEqualSlices?: (equalSlices: boolean) => void;
		disabled?: boolean;
		savedPresets?: RewardPreset[]; // Lifted state
		onOpenIconModal?: (rewardId: string) => void;
		onOpenSaveModal?: () => void;
		onLoadPreset?: (preset: RewardPreset) => void;
		onDeletePreset?: (id: string) => void;
		onClearPresets?: () => void;
	}

	let {
		rewards,
		equalSlices = false,
		onUpdate,
		onUpdateEqualSlices,
		disabled = false,
		savedPresets = [],
		onOpenIconModal,
		onOpenSaveModal,
		onLoadPreset,
		onDeletePreset,
		onClearPresets
	}: Props = $props();
	const t = useTranslation();

	function addReward() {
		const newReward: Reward = {
			id: crypto.randomUUID(),
			text: '',
			probability: 25,
			color: '',
			icon: 'gift'
		};
		onUpdate([...rewards, newReward]);
	}

	function removeReward(id: string) {
		if (rewards.length <= 2) {
			toast({
				type: 'error',
				message: t('reward.min2Rewards') || 'At least 2 rewards are required'
			});
			return;
		}
		onUpdate(rewards.filter((r) => r.id !== id));
	}

	function updateReward(id: string, updates: Partial<Reward>) {
		onUpdate(rewards.map((r) => (r.id === id ? { ...r, ...updates } : r)));
	}

	function setEqualProbabilities() {
		const count = rewards.length;
		if (count === 0) return;
		const equalProb = 100 / count;
		onUpdate(rewards.map((r) => ({ ...r, probability: Number(equalProb.toFixed(2)) })));
	}

	function handleProbabilityChange(id: string, value: number) {
		updateReward(id, { probability: value });
	}

	let pendingDeleteId = $state<string | null>(null);
	let pendingClearAll = $state(false);
	let resetTimer: ReturnType<typeof setTimeout> | null = null;

	function resetConfirmStates() {
		pendingDeleteId = null;
		pendingClearAll = false;
		if (resetTimer) clearTimeout(resetTimer);
		resetTimer = null;
	}

	function handleDeletePreset(id: string) {
		if (pendingDeleteId !== id) {
			pendingDeleteId = id;
			if (resetTimer) clearTimeout(resetTimer);
			resetTimer = setTimeout(resetConfirmStates, 3000); // Reset after 3 seconds
			return;
		}

		onDeletePreset?.(id);
		resetConfirmStates();
	}

	function handleClearAllPresets() {
		if (!pendingClearAll) {
			pendingClearAll = true;
			if (resetTimer) clearTimeout(resetTimer);
			resetTimer = setTimeout(resetConfirmStates, 3000);
			return;
		}

		onClearPresets?.();
		resetConfirmStates();
	}

	let totalProbability = $derived(rewards.reduce((acc, r) => acc + r.probability, 0));
</script>

<div class="flex flex-col gap-4">
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<h3 class="text-lg font-bold">{t('reward.title') || 'Rewards Configuration'}</h3>
		<div class="flex flex-wrap gap-2">
			<div class="dropdown-hover dropdown dropdown-end flex-1 sm:flex-none">
				<div
					tabindex="0"
					role="button"
					class="btn w-full btn-outline btn-sm"
					class:pointer-events-none={disabled}
					class:opacity-50={disabled}
				>
					<span class="mr-1 icon-[lucide--archive]"></span>
					{t('reward.presets') || 'Presets'}
				</div>
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				{#if !disabled}
					<ul
						tabindex="0"
						class="dropdown-content menu z-[1] w-64 rounded-box border border-base-100 bg-base-300 p-2 shadow-xl"
					>
						<li class="flex flex-row items-center justify-between menu-title px-2">
							<span>{t('reward.presets') || 'Presets'}</span>
							{#if savedPresets.length > 0}
								<button
									class="btn btn-ghost transition-all btn-xs {pendingClearAll
										? 'bg-error/20 text-error hover:bg-error/30'
										: 'text-error hover:bg-error/10'}"
									onclick={(e) => {
										e.stopPropagation();
										handleClearAllPresets();
									}}
								>
									{pendingClearAll
										? t('reward.confirmClear') || 'Clear anyway?'
										: t('reward.clearAll') || 'Clear All'}
								</button>
							{/if}
						</li>
						{#if savedPresets.length === 0}
							<li class="px-3 py-4 text-center text-xs opacity-50">
								{t('reward.noPresetFound') || 'No saved preset found'}
							</li>
						{/if}
						{#each savedPresets as preset}
							<li>
								<div class="group flex items-center justify-between gap-2">
									<button
										class="flex-1 cursor-pointer truncate text-left"
										class:opacity-40={pendingDeleteId === preset.id}
										onclick={() => {
											resetConfirmStates();
											onLoadPreset?.(preset);
										}}
									>
										{preset.name}
									</button>
									<button
										class="btn btn-ghost transition-all btn-xs {pendingDeleteId === preset.id
											? 'w-24 bg-error/20 px-2 opacity-100'
											: 'btn-square opacity-0 group-hover:opacity-100'}"
										onclick={(e) => {
											e.stopPropagation();
											handleDeletePreset(preset.id);
										}}
										title={t('reward.deletePreset') || 'Delete Preset'}
									>
										{#if pendingDeleteId === preset.id}
											<span class="text-[10px] font-bold whitespace-nowrap text-error">
												{t('reward.confirmDelete') || 'Press to Delete'}
											</span>
										{:else}
											<span class="icon-[lucide--trash-2] h-3.5 w-3.5 text-error"></span>
										{/if}
									</button>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<button
				class="btn flex-1 btn-outline btn-sm sm:flex-none"
				onclick={() => onOpenSaveModal?.()}
				{disabled}
			>
				<span class="mr-1 icon-[lucide--save]"></span>
				{t('reward.saveAs') || 'Save As...'}
			</button>
		</div>
	</div>

	<div
		class="alert flex flex-col gap-3 alert-soft py-3 alert-info shadow-sm sm:flex-row sm:items-center"
	>
		<div class="flex flex-1 items-center gap-2">
			<span class="icon-[lucide--info] text-lg"></span>
			<div class="text-xs">
				{t('reward.totalProbability') || 'Total Distribution'}:
				<span class="font-bold">{totalProbability}%</span>
				{#if totalProbability !== 100}
					<span class="ml-2 animate-pulse text-warning">
						({t('reward.not100Percent') || 'Auto-normalizing to 100% on wheel'})
					</span>
				{/if}
			</div>
		</div>

		<div class="flex items-center gap-4 border-t border-info/20 pt-2 sm:border-t-0 sm:pt-0">
			<button
				class="btn h-8 min-h-0 cursor-pointer border-none font-bold btn-soft btn-sm"
				onclick={setEqualProbabilities}
				{disabled}
			>
				<span class="icon-[lucide--layout-grid] h-3.5 w-3.5"></span>
				{t('reward.setEqual') || 'Set Equal'}
			</button>

			<div class="h-4 w-[1px]"></div>

			<label class="label cursor-pointer justify-start gap-2.5 p-0">
				<span class="label-text text-xs font-semibold whitespace-nowrap"
					>{t('reward.equalSlices') || 'Equal Slices'}</span
				>
				<input
					type="checkbox"
					class="toggle toggle-primary toggle-xs"
					checked={equalSlices}
					onchange={(e) => onUpdateEqualSlices?.(e.currentTarget.checked)}
					{disabled}
				/>
			</label>
		</div>
	</div>

	<div class="grid gap-4 sm:gap-3">
		{#each rewards as reward (reward.id)}
			<div class="card bg-base-200 shadow-sm transition-all hover:shadow-md">
				<div class="card-body p-3">
					<div class="flex flex-wrap items-center gap-3 sm:flex-nowrap">
						<!-- Icon & Color Row on Mobile -->
						<div class="flex w-full items-center gap-3 sm:w-auto">
							<!-- Icon Selector Button -->
							<div
								class="tooltip tooltip-top"
								data-tip={reward.icon === 'x'
									? t('reward.noPrize') || 'No Prize (Better luck next time)'
									: t('reward.icon') || 'Icon'}
							>
								<button
									id="reward-icon-{reward.id}"
									class="relative flex h-12 w-12 items-center justify-center rounded-xl border-2 transition-all hover:shadow-md active:scale-95 {reward.icon ===
									'x'
										? 'border-error/50 bg-error/5 hover:border-error'
										: 'border-base-300 bg-base-100 hover:border-primary'}"
									class:cursor-pointer={!disabled}
									class:cursor-not-allowed={disabled}
									class:opacity-50={disabled}
									onclick={() => !disabled && onOpenIconModal?.(reward.id)}
									{disabled}
								>
									{#if reward.icon}
										<span
											class="icon-[lucide--{reward.icon}] text-xl {reward.icon === 'x'
												? 'text-error'
												: 'text-primary'}"
										></span>
									{:else}
										<span class="icon-[lucide--image] text-xl text-primary"></span>
									{/if}
								</button>
							</div>

							<!-- Color Selector -->
							<div class="tooltip tooltip-top" data-tip={t('reward.color') || 'Color'}>
								<label
									class="relative flex h-12 w-12 items-center justify-center rounded-xl border-2 border-base-300 bg-base-100 transition-all hover:border-primary hover:shadow-md active:scale-95"
									class:cursor-pointer={!disabled}
									class:cursor-not-allowed={disabled}
									class:opacity-50={disabled}
								>
									<input
										type="color"
										class="absolute inset-0 h-full w-full opacity-0"
										class:cursor-pointer={!disabled}
										class:cursor-not-allowed={disabled}
										value={reward.color || '#cccccc'}
										oninput={(e) => updateReward(reward.id, { color: e.currentTarget.value })}
										{disabled}
									/>
									<div
										class="h-7 w-7 rounded-lg shadow-inner ring-1 ring-black/10"
										style="background-color: {reward.color || '#cccccc'}"
									></div>
								</label>
							</div>

							<!-- Delete on Mobile (Hidden on Desktop) -->
							<button
								class="btn btn-circle btn-soft btn-md btn-error sm:hidden"
								onclick={() => removeReward(reward.id)}
								aria-label={t('reward.remove') || 'Remove Reward'}
								{disabled}
							>
								<span class="icon-[lucide--trash-2]"></span>
							</button>
						</div>

						<!-- Text & Prob Inputs -->
						<div class="flex w-full flex-1 flex-col gap-3 sm:flex-row sm:gap-3">
							<!-- Text Input -->
							<label class="floating-label flex-1">
								<span>{t('reward.label') || 'Reward Label'}</span>
								<input
									id="reward-text-{reward.id}"
									type="text"
									class="input-bordered input input-md w-full"
									placeholder={t('reward.placeholder') || 'Enter reward name...'}
									value={reward.text}
									oninput={(e) => updateReward(reward.id, { text: e.currentTarget.value })}
									{disabled}
								/>
							</label>

							<!-- Probability -->
							<label class="floating-label w-full sm:w-28">
								<span>{t('reward.probability') || 'Prob (%)'}</span>
								<input
									id="reward-prob-{reward.id}"
									type="number"
									min="0.1"
									max="100"
									step="0.1"
									class="input-bordered input input-md w-full"
									value={reward.probability}
									oninput={(e) =>
										handleProbabilityChange(reward.id, parseFloat(e.currentTarget.value) || 0)}
									{disabled}
								/>
							</label>
						</div>

						<!-- Delete on Desktop (Hidden on Mobile) -->
						<button
							class="btn hidden btn-circle text-error btn-ghost btn-md hover:bg-error/10 sm:flex"
							onclick={() => removeReward(reward.id)}
							title={t('reward.remove') || 'Remove Reward'}
							{disabled}
						>
							<span class="icon-[lucide--trash-2]"></span>
						</button>
					</div>
				</div>
			</div>
		{/each}
	</div>

	<button
		class="btn mt-2 w-full shadow-lg transition-all btn-primary hover:scale-[1.01] active:scale-[0.99]"
		onclick={addReward}
		{disabled}
	>
		<span class="icon-[lucide--plus] text-xl"></span>
		<span class="text-lg font-bold">{t('reward.add') || 'Add Reward'}</span>
	</button>
</div>
