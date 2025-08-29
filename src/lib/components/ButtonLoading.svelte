<script>
	/** @type {{type: string, formLoading: boolean, disabled: boolean, size: string, loadingText: string, moreClass: string, buttonStyle: string, icon: string, children: any}} */
	let {
		type = 'button',
		formLoading = false,
		disabled = false,
		size = 'sm',
		loadingText = 'Please wait',
		moreClass = '',
		color = 'success',
		icon = '',
		children,
		onclick,
		...args
	} = $props();
</script>

<button
	{type}
	class={`btn btn-${size}${moreClass ? ` ${moreClass}` : ''}`}
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
