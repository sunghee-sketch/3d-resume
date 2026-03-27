<script lang="ts">
	import { focus, setFocus, loading } from '$lib/stores/scene.svelte.js';
	import { openPanel } from '$lib/stores/ui.svelte.js';
	import type { SceneObjectKey } from '$lib/stores/scene.svelte.js';

	const DOTS: { key: SceneObjectKey; label: string }[] = [
		{ key: 'laptop',    label: 'Projects' },
		{ key: 'bookshelf', label: 'Skills'   },
		{ key: 'frame',     label: 'About Me' },
		{ key: 'character', label: 'Contact'  }
	];

	function navigate(key: SceneObjectKey) {
		if (!loading.done) return;
		setFocus(key);
	}
</script>

{#if loading.done}
	<nav class="nav-dots" aria-label="Quick navigation">
		{#each DOTS as { key, label }}
			<button
				class="nav-dot"
				class:active={focus.key === key}
				onclick={() => navigate(key)}
				aria-label={label}
				title={label}
			>
				<span class="nav-dot-label">{label}</span>
			</button>
		{/each}
	</nav>
{/if}

<style>
	.nav-dots {
		position: fixed;
		left: 20px;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		flex-direction: column;
		gap: 14px;
		z-index: 10;
	}

	.nav-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: rgba(255 255 255 / 0.3);
		border: none;
		cursor: pointer;
		padding: 0;
		position: relative;
		transition: background 0.2s, transform 0.2s;
	}

	.nav-dot:hover,
	.nav-dot.active {
		background: #88aaff;
		transform: scale(1.3);
	}

	.nav-dot-label {
		position: absolute;
		left: 18px;
		top: 50%;
		transform: translateY(-50%);
		white-space: nowrap;
		font-size: 12px;
		color: rgba(255 255 255 / 0.7);
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.nav-dot:hover .nav-dot-label {
		opacity: 1;
	}

	@media (max-width: 600px) {
		.nav-dots {
			left: 10px;
			gap: 10px;
		}
	}
</style>
