<script lang="ts">
	// FallbackContent.svelte — SEO-critical semantic HTML that lives outside the canvas.
	//
	// Strategy:
	//   • When WebGL is available: hidden visually but present in DOM (crawlable by Google).
	//     Screen readers can still access it. 3D scene is the primary visual.
	//   • When WebGL is unavailable: shown as the full static portfolio.
	//
	// Google's crawler does NOT render WebGL. This component ensures all resume
	// content is in the HTML source, indexed, and linkable without JavaScript.

	import { resume } from '$lib/data/resume.js';
	import { webgl } from '$lib/stores/scene.svelte.js';
</script>

<div class="fallback-root" class:webgl-hidden={webgl.supported && webgl.checked}>
	<!-- ── Header ─────────────────────────────────────────────────── -->
	<header class="fb-header">
		<div class="fb-container">
			<h1>{resume.about.name}</h1>
			<p class="tagline">{resume.about.role}</p>
			{#if resume.contact.available}
				<span class="badge">Open to opportunities</span>
			{/if}
		</div>
	</header>

	<main class="fb-container">
		<!-- ── About ───────────────────────────────────────────────── -->
		<section id="about" aria-labelledby="about-heading">
			<h2 id="about-heading">About Me</h2>
			<p>{resume.about.bio}</p>
			<ul class="facts-list">
				{#each resume.about.facts as fact}
					<li>{fact}</li>
				{/each}
			</ul>
			<div class="links">
				{#each resume.about.links as link}
					<a href={link.url} class="fb-link {link.type}" rel="noopener">
						{link.label}
					</a>
				{/each}
			</div>
		</section>

		<!-- ── Skills ─────────────────────────────────────────────── -->
		<section id="skills" aria-labelledby="skills-heading">
			<h2 id="skills-heading">Skills &amp; Technologies</h2>

			<div class="skill-grid">
				<article>
					<h3>Frontend</h3>
					<ul>
						{#each resume.skills.frontend as skill}
							<li>{skill}</li>
						{/each}
					</ul>
				</article>

				<article>
					<h3>Backend</h3>
					<ul>
						{#each resume.skills.backend as skill}
							<li>{skill}</li>
						{/each}
					</ul>
				</article>

				<article>
					<h3>Tools &amp; DevOps</h3>
					<ul>
						{#each resume.skills.tools as skill}
							<li>{skill}</li>
						{/each}
					</ul>
				</article>
			</div>
		</section>

		<!-- ── Projects ───────────────────────────────────────────── -->
		<section id="projects" aria-labelledby="projects-heading">
			<h2 id="projects-heading">Projects</h2>

			<div class="project-grid">
				{#each resume.projects as project}
					<article class="project-card">
						<h3>{project.name}</h3>
						<p>{project.desc}</p>
						<ul class="tech-list" aria-label="Technologies used">
							{#each project.tech as tech}
								<li>{tech}</li>
							{/each}
						</ul>
						{#if project.url}
							<a href={project.url} rel="noopener" class="project-link">View project →</a>
						{/if}
					</article>
				{/each}
			</div>
		</section>

		<!-- ── Contact ────────────────────────────────────────────── -->
		<section id="contact" aria-labelledby="contact-heading">
			<h2 id="contact-heading">Contact</h2>
			<address>
				<dl>
					<dt>Email</dt>
					<dd><a href="mailto:{resume.contact.email}">{resume.contact.email}</a></dd>

					<dt>GitHub</dt>
					<dd><a href="https://{resume.contact.github}" rel="noopener">{resume.contact.github}</a></dd>

					<dt>LinkedIn</dt>
					<dd><a href="https://{resume.contact.linkedin}" rel="noopener">{resume.contact.linkedin}</a></dd>

					<dt>Twitter</dt>
					<dd>{resume.contact.twitter}</dd>

					<dt>Location</dt>
					<dd>{resume.contact.location}</dd>
				</dl>
			</address>
		</section>
	</main>
</div>

<style>
	/* When WebGL is active: visually hide but keep in DOM for SEO + a11y.
	   `visibility: hidden` is better than `display: none` for crawlers. */
	.fallback-root.webgl-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}

	/* When WebGL is unavailable: render as a clean static portfolio */
	.fallback-root:not(.webgl-hidden) {
		min-height: 100vh;
		background: #0d0d1a;
		color: #e8eeff;
		font-family: system-ui, -apple-system, sans-serif;
		line-height: 1.6;
	}

	.fb-header {
		padding: 80px 24px 48px;
		text-align: center;
		background: linear-gradient(180deg, rgba(100 130 255 / 0.08) 0%, transparent 100%);
	}

	.fb-container {
		max-width: 800px;
		margin: 0 auto;
		padding: 0 24px;
	}

	h1 {
		font-size: clamp(32px, 6vw, 56px);
		margin: 0 0 8px;
		color: #c8d8ff;
	}

	.tagline {
		font-size: clamp(16px, 2.5vw, 20px);
		color: #7799ff;
		margin: 0 0 16px;
	}

	.badge {
		display: inline-block;
		padding: 4px 14px;
		border-radius: 20px;
		background: rgba(80 200 120 / 0.15);
		color: #80e8a0;
		border: 1px solid rgba(80 200 120 / 0.3);
		font-size: 13px;
	}

	section {
		padding: 56px 0;
		border-bottom: 1px solid rgba(255 255 255 / 0.07);
	}

	h2 {
		font-size: clamp(22px, 4vw, 30px);
		color: #c8d8ff;
		margin: 0 0 24px;
	}

	h3 {
		font-size: 16px;
		color: #99bbff;
		margin: 0 0 12px;
	}

	p {
		color: rgba(255 255 255 / 0.7);
		margin: 0 0 16px;
	}

	.facts-list {
		padding: 0;
		margin: 0 0 24px;
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 8px 16px;
	}

	.facts-list li::before {
		content: '▸ ';
		color: #7799ff;
	}

	.links {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}

	.fb-link {
		padding: 8px 20px;
		border-radius: 24px;
		text-decoration: none;
		font-size: 14px;
		font-weight: 500;
		transition: opacity 0.15s;
	}

	.fb-link:hover { opacity: 0.8; }

	.fb-link.primary {
		background: rgba(100 130 255 / 0.25);
		border: 1px solid rgba(100 130 255 / 0.4);
		color: #c8d8ff;
	}

	.fb-link.secondary {
		background: rgba(255 255 255 / 0.06);
		border: 1px solid rgba(255 255 255 / 0.15);
		color: rgba(255 255 255 / 0.7);
	}

	.skill-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 24px;
	}

	.skill-grid article {
		background: rgba(255 255 255 / 0.04);
		border: 1px solid rgba(255 255 255 / 0.08);
		border-radius: 12px;
		padding: 20px;
	}

	.skill-grid ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 14px;
		color: rgba(255 255 255 / 0.65);
	}

	.project-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 20px;
	}

	.project-card {
		background: rgba(255 255 255 / 0.04);
		border: 1px solid rgba(255 255 255 / 0.08);
		border-radius: 12px;
		padding: 22px;
	}

	.project-card h3 {
		margin: 0 0 8px;
	}

	.project-card p {
		font-size: 14px;
		margin: 0 0 12px;
	}

	.tech-list {
		margin: 0 0 14px;
		padding: 0;
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.tech-list li {
		font-size: 11px;
		padding: 3px 8px;
		border-radius: 20px;
		background: rgba(100 130 255 / 0.15);
		color: #99bbff;
		border: 1px solid rgba(100 130 255 / 0.25);
	}

	.project-link {
		font-size: 13px;
		color: #88aaff;
		text-decoration: none;
	}

	.project-link:hover {
		text-decoration: underline;
	}

	address {
		font-style: normal;
	}

	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 10px 20px;
		font-size: 15px;
	}

	dt {
		font-weight: 600;
		color: rgba(255 255 255 / 0.4);
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding-top: 2px;
	}

	dd {
		margin: 0;
		color: rgba(255 255 255 / 0.8);
	}

	dd a {
		color: #88aaff;
		text-decoration: none;
	}

	dd a:hover {
		text-decoration: underline;
	}
</style>
