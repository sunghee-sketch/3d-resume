import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		// Split Three.js + GSAP into separate cached chunks (client build only).
		// Applied via a plugin so it only targets the client bundle, not the SSR build
		// where `three` is correctly excluded (it's never imported server-side).
		{
			name: 'three-chunk-split',
			config(_, { command }) {
				if (command !== 'build') return;
				return {
					build: {
						rollupOptions: {
							output: {
								manualChunks(id) {
									if (id.includes('node_modules/three')) return 'three';
									if (id.includes('node_modules/gsap')) return 'gsap';
								}
							}
						}
					}
				};
			}
		}
	],

	optimizeDeps: {
		include: ['three', 'gsap']
	}
});
