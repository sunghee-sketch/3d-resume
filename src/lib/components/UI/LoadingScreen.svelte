<script lang="ts">
	import { loading } from '$lib/stores/scene.svelte.js';
</script>

{#if !loading.done}
	<div class="loading-screen" role="status" aria-live="polite" aria-label="Loading 3D scene">
		<div class="loader-title">Portfolio Room</div>
		<div class="loader-bar-wrap">
			<div class="loader-bar" style="width: {loading.progress}%"></div>
		</div>
		<div class="loader-hint">{loading.hint}</div>
	</div>
{/if}

<style>
	.loading-screen {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		background: #0d0d1a;
		color: #fff;
		font-family: inherit;
	}

	.loader-title {
		font-size: clamp(20px, 4vw, 32px);
		font-weight: 700;
		letter-spacing: 0.1em;
		color: #c8d8ff;
	}

	.loader-bar-wrap {
		width: min(320px, 70vw);
		height: 4px;
		background: rgba(255 255 255 / 0.12);
		border-radius: 4px;
		overflow: hidden;
	}

	.loader-bar {
		height: 100%;
		background: linear-gradient(90deg, #6699ff, #99ccff);
		border-radius: 4px;
		transition: width 0.3s ease;
	}

	.loader-hint {
		font-size: 13px;
		color: rgba(255 255 255 / 0.5);
		letter-spacing: 0.05em;
	}
</style>
