// Prerender all routes at build time.
// This generates static HTML for every route — including /about, /projects, /contact —
// so Google sees real HTML on first fetch, even before JS runs.
// Combined with the FallbackContent component on /, this makes the entire
// portfolio fully crawlable without relying on client-side rendering.

export const prerender = true;

// SPA mode: client-side navigation after initial HTML is served.
// The 3D home page benefits from SSR for meta tags + fallback content,
// while the Three.js canvas is always client-only (lazy-imported in onMount).
export const ssr = true;
