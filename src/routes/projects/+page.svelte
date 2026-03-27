<script lang="ts">
	import { resume } from '$lib/data/resume.js';
	import { onMount } from 'svelte';

	onMount(() => { document.body.classList.add('scrollable'); return () => document.body.classList.remove('scrollable'); });
</script>

<svelte:head>
	<title>Projects — {resume.about.name}</title>
	<meta name="description" content="Portfolio projects by {resume.about.name}: {resume.projects.map(p => p.name).join(', ')}. {resume.about.role} specialising in {resume.skills.frontend.slice(0,3).join(', ')}." />
	<link rel="canonical" href="https://alexmorgan.dev/projects" />
</svelte:head>

<div class="page">
	<a href="/" class="back-link">← Back to 3D Portfolio</a>

	<header>
		<h1>Projects</h1>
		<p class="role">{resume.about.name} · {resume.about.role}</p>
	</header>

	<section aria-label="Project portfolio">
		<div class="project-grid">
			{#each resume.projects as project}
				<article class="project-card">
					<h2>{project.name}</h2>
					<p>{project.desc}</p>
					<ul class="tech-list" aria-label="Technologies">
						{#each project.tech as tech}
							<li>{tech}</li>
						{/each}
					</ul>
					{#if project.url}
						<a href={project.url} class="project-link" rel="noopener">View project →</a>
					{/if}
				</article>
			{/each}
		</div>
	</section>
</div>

<style>
	@import '../_page-base.css';

	.project-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 20px;
	}

	.project-card {
		background: rgba(255 255 255 / 0.04);
		border: 1px solid rgba(255 255 255 / 0.08);
		border-radius: 14px;
		padding: 24px;
	}

	.project-card h2 {
		font-size: 18px;
		margin: 0 0 10px;
		border: none;
		padding: 0;
	}

	.tech-list {
		flex-direction: row !important;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 16px;
	}

	.tech-list li {
		font-size: 11px;
		padding: 3px 9px;
		border-radius: 20px;
		background: rgba(100 130 255 / 0.15);
		color: #99bbff;
		border: 1px solid rgba(100 130 255 / 0.25);
	}

	.tech-list li::before { content: none; }

	.project-link {
		font-size: 13px;
		color: #88aaff;
		text-decoration: none;
	}

	.project-link:hover { text-decoration: underline; }
</style>
