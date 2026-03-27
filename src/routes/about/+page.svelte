<script lang="ts">
	import { resume } from '$lib/data/resume.js';
	import { onMount } from 'svelte';

	// Sub-pages need scrollable body
	onMount(() => { document.body.classList.add('scrollable'); return () => document.body.classList.remove('scrollable'); });
</script>

<svelte:head>
	<title>About {resume.about.name} — {resume.about.role}</title>
	<meta name="description" content="{resume.about.bio} {resume.about.facts.join('. ')}." />
	<link rel="canonical" href="https://alexmorgan.dev/about" />
</svelte:head>

<div class="page">
	<a href="/" class="back-link">← Back to 3D Portfolio</a>

	<header>
		<h1>{resume.about.name}</h1>
		<p class="role">{resume.about.role}</p>
		{#if resume.contact.available}
			<span class="badge">Open to opportunities</span>
		{/if}
	</header>

	<section aria-labelledby="bio-heading">
		<h2 id="bio-heading">Biography</h2>
		<p>{resume.about.bio}</p>
	</section>

	<section aria-labelledby="facts-heading">
		<h2 id="facts-heading">Quick Facts</h2>
		<ul>
			{#each resume.about.facts as fact}
				<li>{fact}</li>
			{/each}
		</ul>
	</section>

	<section aria-labelledby="links-heading">
		<h2 id="links-heading">Links</h2>
		<div class="links">
			{#each resume.about.links as link}
				<a href={link.url} class="link-btn {link.type}" rel="noopener">{link.label}</a>
			{/each}
		</div>
	</section>
</div>

<style>
	@import '../_page-base.css';
</style>
