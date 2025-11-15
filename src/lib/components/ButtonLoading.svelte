<script lang="ts">
	interface Props {
		type?: 'button' | 'submit' | 'reset';
		formLoading?: boolean;
		disabled?: boolean;
		size?: string;
		loadingText?: string;
		className?: string;
		color?: 'primary' | 'secondary' | 'accent' | 'error' | 'success' | 'warning' | 'info' | '';
		icon?: string;
		children: import('svelte').Snippet;
		onclick?: (event: MouseEvent) => void;
		[key: string]: unknown;
	}

	let {
		type = 'button',
		formLoading = false,
		disabled = false,
		size = 'sm',
		loadingText = 'Please wait',
		className = '',
		color = '',
		icon = '',
		children,
		onclick,
		...args
	}: Props = $props();
</script>

<button
	{type}
	class={`btn btn-${size}${className ? ` ${className}` : ''}`}
	class:btn-primary={color === 'primary'}
	class:btn-secondary={color === 'secondary'}
	class:btn-accent={color === 'accent'}
	class:btn-error={color === 'error'}
	class:btn-success={color === 'success'}
	class:btn-warning={color === 'warning'}
	class:btn-info={color === 'info'}
	class:btn-disabled={formLoading || disabled}
	disabled={formLoading || disabled}
	{onclick}
	{...args}
>
	{#if icon && !formLoading}
		<span class={`${icon} h-5 w-5`}></span>
	{/if}
	{#if formLoading}
		<span class={`loading loading-spinner ${size !== 'md' ? `loading-${size}` : ''}`}></span>
		{#if loadingText}
			<span>{loadingText}</span>
		{/if}
	{:else}
		{@render children()}
	{/if}
</button>
