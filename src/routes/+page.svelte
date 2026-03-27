<script lang="ts">
	// +page.svelte — Main page: 3D scene + all UI overlays.
	//
	// Composition pattern: this page is pure orchestration.
	// Each component reads from stores; stores talk to the scene.
	// The page itself holds NO state — it's a thin shell.

	import { onMount } from 'svelte';

	// Three.js scene (lazy-imported — excluded from SSR bundle entirely)
	let SceneComponent: typeof import('$lib/components/Scene.svelte').default | null = $state(null);

	// UI overlay components (these are fine to import statically)
	import LoadingScreen  from '$lib/components/UI/LoadingScreen.svelte';
	import Panel          from '$lib/components/UI/Panel.svelte';
	import NavDots        from '$lib/components/UI/NavDots.svelte';
	import HelpModal      from '$lib/components/UI/HelpModal.svelte';
	import HintBar        from '$lib/components/UI/HintBar.svelte';
	import MobileNotice   from '$lib/components/UI/MobileNotice.svelte';
	import FallbackContent from '$lib/components/UI/FallbackContent.svelte';

	// Lazy-load Three.js only on the client — never SSR.
	// This keeps the SSR bundle ~0kb for Three.js (it's 600kb+).
	onMount(async () => {
		const mod = await import('$lib/components/Scene.svelte');
		SceneComponent = mod.default;
	});
</script>

<!-- ── UI overlay stack (z-index layered above canvas) ───────────────────── -->

<!-- 1. Mobile notice (highest priority, shown before anything loads) -->
<MobileNotice />

<!-- 2. Loading screen (fades out when scene.loading.done = true) -->
<LoadingScreen />

<!-- 3. Three.js canvas — rendered client-side only after onMount -->
{#if SceneComponent}
	<SceneComponent />
{/if}

<!-- 4. SEO fallback — always in DOM, visually hidden when WebGL active -->
<FallbackContent />

<!-- 5. Nav dots (left side) -->
<NavDots />

<!-- 6. Detail panel (slides in from right on object click) -->
<Panel />

<!-- 7. Hint bar (bottom center, dismisses on first interaction) -->
<HintBar />

<!-- 8. Help modal + button (bottom right) -->
<HelpModal />
