<script lang="ts">
	import { help, toggleHelp, closeHelp } from '$lib/stores/ui.svelte.js';

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeHelp();
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- Help button -->
<button
	class="help-btn"
	class:active={help.open}
	onclick={toggleHelp}
	aria-label="Controls & instructions"
	aria-expanded={help.open}
>?</button>

<!-- Modal -->
{#if help.open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="help-modal"
		role="dialog"
		aria-modal="true"
		aria-label="Controls & Instructions"
	>
		<div class="help-title">Controls &amp; Guide</div>

		<section class="help-section">
			<div class="help-section-label">Navigate</div>
			{#each [
				['🖱️', 'Drag',         'Orbit / rotate the room'],
				['⚙️', 'Scroll',        'Zoom in & out'],
				['👆', 'Click object',  'Fly to it and open detail panel'],
				['⎋',  'Esc',           'Close panel and reset view'],
			] as [icon, key, val]}
				<div class="help-row">
					<span class="help-icon" aria-hidden="true">{icon}</span>
					<span class="help-row-text">
						<span class="help-key">{key}</span>
						<span class="help-val">{val}</span>
					</span>
				</div>
			{/each}
		</section>

		<hr class="help-divider" />

		<section class="help-section">
			<div class="help-section-label">Interactive Objects</div>
			{#each [
				['💻', 'Laptop',     'Projects & work'],
				['📚', 'Bookshelf',  'Skills & technologies'],
				['🖼️', 'Wall Frame', 'About me'],
				['👨‍💻', 'Developer',  'Contact info'],
				['💡', 'Desk Lamp',  'Click to toggle the lamp on / off'],
			] as [icon, key, val]}
				<div class="help-row">
					<span class="help-icon" aria-hidden="true">{icon}</span>
					<span class="help-row-text">
						<span class="help-key">{key}</span>
						<span class="help-val">{val}</span>
					</span>
				</div>
			{/each}
		</section>

		<hr class="help-divider" />

		<p class="help-tip">
			Room lighting changes with the real time of day.
		</p>

		<button class="help-close" onclick={closeHelp} aria-label="Close help">✕</button>
	</div>

	<!-- Backdrop -->
	<button class="modal-backdrop" onclick={closeHelp} aria-label="Close help" tabindex="-1"></button>
{/if}

<style>
	.help-btn {
		position: fixed;
		bottom: 24px;
		right: 24px;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: rgba(255 255 255 / 0.12);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(255 255 255 / 0.2);
		color: rgba(255 255 255 / 0.75);
		font-size: 18px;
		font-weight: 700;
		cursor: pointer;
		z-index: 15;
		transition: background 0.15s, color 0.15s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.help-btn:hover,
	.help-btn.active {
		background: rgba(100 130 255 / 0.3);
		color: #fff;
	}

	.help-modal {
		position: fixed;
		bottom: 70px;
		right: 24px;
		width: min(340px, 90vw);
		max-height: 70vh;
		overflow-y: auto;
		background: rgba(10 12 28 / 0.94);
		backdrop-filter: blur(16px);
		border: 1px solid rgba(100 130 255 / 0.2);
		border-radius: 16px;
		padding: 20px 20px 18px;
		z-index: 30;
		color: #e8eeff;
		box-shadow: 0 16px 60px rgba(0 0 0 / 0.6);
	}

	.help-title {
		font-size: 15px;
		font-weight: 700;
		margin-bottom: 16px;
		color: #c8d8ff;
	}

	.help-section {
		margin-bottom: 4px;
	}

	.help-section-label {
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(255 255 255 / 0.35);
		margin-bottom: 10px;
	}

	.help-row {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		margin-bottom: 8px;
	}

	.help-icon {
		font-size: 16px;
		width: 20px;
		flex-shrink: 0;
	}

	.help-row-text {
		display: flex;
		gap: 6px;
		font-size: 13px;
		flex-wrap: wrap;
	}

	.help-key {
		font-weight: 600;
		color: #a0b8ff;
	}

	.help-val {
		color: rgba(255 255 255 / 0.6);
	}

	.help-divider {
		border: none;
		border-top: 1px solid rgba(255 255 255 / 0.08);
		margin: 14px 0;
	}

	.help-tip {
		font-size: 12px;
		color: rgba(255 255 255 / 0.4);
		line-height: 1.6;
		margin: 0;
	}

	.help-close {
		position: absolute;
		top: 10px;
		right: 12px;
		background: none;
		border: none;
		color: rgba(255 255 255 / 0.4);
		cursor: pointer;
		font-size: 14px;
		padding: 4px 6px;
		border-radius: 4px;
		transition: color 0.15s;
	}

	.help-close:hover {
		color: #fff;
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 29;
		background: transparent;
		border: none;
	}
</style>
