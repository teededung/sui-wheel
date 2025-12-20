<script lang="ts">
	import type { Reward } from '$lib/types/wheel.js';
	import { useTranslation } from '$lib/hooks/useTranslation.js';
	import { toast } from 'svelte-daisy-toaster';

	interface Props {
		rewards: Reward[];
		equalSlices?: boolean;
		onUpdate: (rewards: Reward[]) => void;
		onUpdateEqualSlices?: (equalSlices: boolean) => void;
		disabled?: boolean;
	}

	let {
		rewards,
		equalSlices = false,
		onUpdate,
		onUpdateEqualSlices,
		disabled = false
	}: Props = $props();
	const t = useTranslation();

	interface RewardPreset {
		id: string;
		name: string;
		rewards: Reward[];
		createdAt: number;
	}

	let activeIconRewardId = $state<string | null>(null);
	let iconModalEl = $state<HTMLDialogElement | null>(null);
	let saveModalEl = $state<HTMLDialogElement | null>(null);
	let newPresetName = $state('');
	let savedPresets = $state<RewardPreset[]>([]);

	const curatedIcons = [
		'gift',
		'trophy',
		'gem',
		'star',
		'heart',
		'flame',
		'clover',
		'coffee',
		'pizza',
		'music',
		'camera',
		'smile',
		'rocket',
		'package',
		'ticket',
		'crown',
		'zap',
		'sun',
		'moon',
		'ghost',
		'piggy-bank',
		'coins',
		'shopping-bag',
		'map-pin',
		'bell',
		'anchor',
		'bike',
		'car',
		'plane',
		'ship',
		'umbrella',
		'wrench',
		'x'
	];

	// Load presets on mount
	import { onMount } from 'svelte';
	onMount(() => {
		const stored = localStorage.getItem('wheel_reward_presets');
		if (stored) {
			try {
				savedPresets = JSON.parse(stored);
			} catch (e) {
				console.error('Failed to parse presets', e);
			}
		}
	});

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

	function openIconModal(id: string) {
		activeIconRewardId = id;
		iconModalEl?.showModal();
	}

	function selectIcon(icon: string) {
		if (activeIconRewardId) {
			const isLoss = icon === 'x';
			updateReward(activeIconRewardId, { icon, isLoss });
		}
		iconModalEl?.close();
	}

	function openSaveModal() {
		newPresetName = `Preset ${savedPresets.length + 1}`;
		saveModalEl?.showModal();
	}

	function savePresetWithName() {
		if (!newPresetName.trim()) return;
		const newPreset: RewardPreset = {
			id: crypto.randomUUID(),
			name: newPresetName.trim(),
			rewards: JSON.parse(JSON.stringify(rewards)), // deep copy
			createdAt: Date.now()
		};
		savedPresets = [newPreset, ...savedPresets];
		localStorage.setItem('wheel_reward_presets', JSON.stringify(savedPresets));
		saveModalEl?.close();
		toast({
			type: 'success',
			message: t('reward.presetSaved') || 'Preset saved successfully'
		});
	}

	function loadPreset(preset: RewardPreset) {
		onUpdate(JSON.parse(JSON.stringify(preset.rewards)));
		toast({
			type: 'success',
			message: t('reward.presetLoaded') || 'Preset loaded successfully'
		});
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

	function deletePreset(id: string) {
		if (pendingDeleteId !== id) {
			pendingDeleteId = id;
			if (resetTimer) clearTimeout(resetTimer);
			resetTimer = setTimeout(resetConfirmStates, 3000); // Reset after 3 seconds
			return;
		}

		savedPresets = savedPresets.filter((p) => p.id !== id);
		localStorage.setItem('wheel_reward_presets', JSON.stringify(savedPresets));
		resetConfirmStates();
		toast({
			type: 'info',
			message: t('reward.presetDeleted') || 'Preset deleted'
		});
	}

	function clearAllPresets() {
		if (!pendingClearAll) {
			pendingClearAll = true;
			if (resetTimer) clearTimeout(resetTimer);
			resetTimer = setTimeout(resetConfirmStates, 3000);
			return;
		}

		savedPresets = [];
		localStorage.removeItem('wheel_reward_presets');
		resetConfirmStates();
		toast({
			type: 'success',
			message: t('reward.allPresetsCleared') || 'All presets cleared'
		});
	}

	let totalProbability = $derived(rewards.reduce((acc, r) => acc + r.probability, 0));

	// Tailwind 4 safelist for icons used in the grid
	// icon-[lucide--gift] icon-[lucide--trophy] icon-[lucide--gem] icon-[lucide--star] icon-[lucide--heart]
	// icon-[lucide--flame] icon-[lucide--clover] icon-[lucide--coffee] icon-[lucide--pizza] icon-[lucide--music]
	// icon-[lucide--camera] icon-[lucide--smile] icon-[lucide--rocket] icon-[lucide--package] icon-[lucide--ticket]
	// icon-[lucide--crown] icon-[lucide--zap] icon-[lucide--sun] icon-[lucide--moon] icon-[lucide--ghost]
	// icon-[lucide--piggy-bank] icon-[lucide--coins] icon-[lucide--shopping-bag] icon-[lucide--map-pin] icon-[lucide--bell]
	// icon-[lucide--anchor] icon-[lucide--bike] icon-[lucide--car] icon-[lucide--plane] icon-[lucide--ship]
	// icon-[lucide--umbrella] icon-[lucide--wrench]
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
										clearAllPresets();
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
											loadPreset(preset);
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
											deletePreset(preset.id);
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

			<button class="btn flex-1 btn-outline btn-sm sm:flex-none" onclick={openSaveModal} {disabled}>
				<span class="mr-1 icon-[lucide--save]"></span>
				{t('reward.saveAs') || 'Save As...'}
			</button>
		</div>
	</div>

	<div class="alert flex flex-col gap-3 py-3 alert-info shadow-sm sm:flex-row sm:items-center">
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
				class="btn h-8 min-h-0 cursor-pointer border-none bg-info-content/10 font-bold text-info-content btn-sm hover:bg-info-content/20"
				onclick={setEqualProbabilities}
				{disabled}
			>
				<span class="icon-[lucide--layout-grid] h-3.5 w-3.5"></span>
				{t('reward.setEqual') || 'Set Equal'}
			</button>

			<div class="h-4 w-[1px] bg-info-content/20"></div>

			<label class="label cursor-pointer justify-start gap-2.5 p-0">
				<span class="label-text text-xs font-semibold whitespace-nowrap text-info-content/90"
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
									onclick={() => !disabled && openIconModal(reward.id)}
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

<!-- Icon Selection Modal -->
<dialog bind:this={iconModalEl} class="modal modal-middle">
	<div class="modal-box max-w-lg bg-base-200">
		<h3 class="mb-4 text-xl font-bold">{t('reward.selectIcon') || 'Select Icon'}</h3>

		<div class="grid grid-cols-6 gap-2">
			{#each curatedIcons as iconName}
				<button
					class="tooltip btn btn-square text-2xl btn-ghost btn-md {iconName === 'x'
						? 'text-error hover:bg-error/20'
						: 'hover:btn-primary'}"
					data-tip={iconName === 'x' ? t('reward.noPrize') || 'No Prize' : iconName}
					onclick={() => selectIcon(iconName)}
					aria-label={iconName === 'x' ? t('reward.noPrize') || 'No Prize' : iconName}
				>
					<span class="icon-[lucide--{iconName}]"></span>
				</button>
			{/each}
		</div>

		<div class="modal-action">
			<form method="dialog">
				<button class="btn">{t('common.close') || 'Close'}</button>
			</form>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>

<!-- Save Preset Modal -->
<dialog bind:this={saveModalEl} class="modal modal-middle">
	<div class="modal-box bg-base-200">
		<h3 class="mb-4 text-xl font-bold">{t('reward.saveAs') || 'Save As...'}</h3>
		<div class="form-control w-full">
			<label class="label p-0 pb-2" for="preset-name-input">
				<span class="label-text text-xs">{t('reward.enterPresetName') || 'Enter preset name'}</span>
			</label>
			<input
				id="preset-name-input"
				type="text"
				bind:value={newPresetName}
				class="input-bordered input w-full"
				placeholder={t('reward.enterPresetName') || 'Enter preset name'}
				onkeydown={(e) => e.key === 'Enter' && savePresetWithName()}
			/>
		</div>
		<div class="modal-action">
			<form method="dialog">
				<button class="btn btn-ghost">{t('common.cancel') || 'Cancel'}</button>
				<button class="btn btn-primary" onclick={savePresetWithName}>
					{t('common.save') || 'Save'}
				</button>
			</form>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
