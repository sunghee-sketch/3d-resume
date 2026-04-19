<script lang="ts">
	// Scene.svelte — Three.js canvas wrapper.
	// All scene code runs inside onMount (client-only, never SSR).
	// $effect bridges Svelte store state → Three.js imperatively.

	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
	import gsap from 'gsap';

	import { setProgress, setFocus, focus, lamp, setWebGLSupport, updateClock } from '$lib/stores/scene.svelte.js';
	import { openPanel, closePanel } from '$lib/stores/ui.svelte.js';

	let canvasEl: HTMLCanvasElement;
	let labelsEl: HTMLDivElement;

	// Three.js refs kept outside reactive state
	let renderer: THREE.WebGLRenderer;
	let camera: THREE.PerspectiveCamera;
	let controls: OrbitControls;
	let scene: THREE.Scene;
	let raf: number;

	// Mutable scene state (plain JS, not Svelte reactive)
	let lampOn = true;
	let lampLightRef: THREE.PointLight;
	let lampShadeMat: THREE.MeshStandardMaterial;
	let lampBulbMesh: THREE.Mesh;
	let lampLightBase = 9.0;
	let deskGlowBase = 2.2;
	let deskGlowRef: THREE.PointLight;
	let laptopScreenMats: any[] = [];
	let lampMeshes: THREE.Object3D[] = [];
	let allInteractiveMeshes: THREE.Object3D[] = [];
	let focusedObject: any = null;
	let hoveredObject: any = null;
	let isAnimating = false;
	let charPoseActive = false;
	let charState = 'sitting';
	let characterGroupRef: THREE.Group;
	let particleGeoRef: THREE.BufferGeometry;
	let labelEls: Record<string, HTMLElement> = {};
	let labelDefs: any[] = [];
	let interactiveObjects: any[] = [];
	let focusObjectFn: ((obj: any) => void) | null = null;
	let hourPivot: THREE.Group, minPivot: THREE.Group, secPivot: THREE.Group;
	let winPaneMats: THREE.MeshStandardMaterial[] = [];
	let winLightRef: THREE.PointLight;
	let winMoonMat: THREE.MeshStandardMaterial | null = null;
	let winStarMats: THREE.MeshStandardMaterial[] = [];
	let fillLeftRef: THREE.PointLight, fillRightRef: THREE.PointLight;
	let ceilBounceRef: THREE.PointLight, charLightRef: THREE.PointLight;
	let ambientRef: THREE.AmbientLight, dirLightRef: THREE.DirectionalLight;
	let ceilPanelRef: THREE.Mesh;

	const DEFAULT_CAM_POS = new THREE.Vector3(0, 2.8, 5.2);
	const DEFAULT_CAM_TARGET = new THREE.Vector3(0, 1.4, -3.5);

	// ── $effect: lamp store → Three.js ────────────────────────────────────────
	$effect(() => {
		const isOn = lamp.on;
		if (!lampLightRef) return;
		lampOn = isOn;
		if (isOn) {
			lampLightRef.intensity = lampLightBase;
			if (lampShadeMat) { lampShadeMat.emissive.set(0xffaa44); lampShadeMat.emissiveIntensity = 3.0; }
			if (lampBulbMesh) (lampBulbMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 5.0;
		} else {
			lampLightRef.intensity = 0;
			if (lampShadeMat) { lampShadeMat.emissive.set(0x000000); lampShadeMat.emissiveIntensity = 0; }
			if (lampBulbMesh) (lampBulbMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
		}
	});

	// ── $effect: focus store → Three.js (from nav dots) ──────────────────────
	$effect(() => {
		const key = focus.key;
		if (!key || !focusObjectFn) return;
		const obj = interactiveObjects.find((o: any) => o.key === key);
		if (obj && (!focusedObject || focusedObject.key !== key)) focusObjectFn(obj);
	});

	onMount(() => {
		// WebGL detection
		try {
			const c = document.createElement('canvas');
			if (!c.getContext('webgl2') && !c.getContext('webgl')) { setWebGLSupport(false); return; }
		} catch { setWebGLSupport(false); return; }
		setWebGLSupport(true);

		const isMobile = window.innerWidth <= 600 || ('ontouchstart' in window && window.innerWidth <= 1024);

		/* ── Renderer ─────────────────────────────────────────────── */
		renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: !isMobile });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.shadowMap.enabled = !isMobile;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 2.2;

		/* ── Scene ────────────────────────────────────────────────── */
		scene = new THREE.Scene();
		scene.background = new THREE.Color(0x2a1d11);
		scene.fog = new THREE.FogExp2(0x2a1d11, 0.016);

		/* ── Camera ───────────────────────────────────────────────── */
		camera = new THREE.PerspectiveCamera(isMobile ? 65 : 55, window.innerWidth / window.innerHeight, 0.1, 60);
		camera.position.set(0, 7, 14);
		camera.lookAt(DEFAULT_CAM_TARGET);

		/* ── Controls ─────────────────────────────────────────────── */
		controls = new OrbitControls(camera, renderer.domElement);
		controls.target.copy(DEFAULT_CAM_TARGET);
		controls.enableDamping = true;
		controls.dampingFactor = 0.07;
		controls.minDistance = isMobile ? 2 : 2.5;
		controls.maxDistance = isMobile ? 12 : 9;
		controls.maxPolarAngle = Math.PI / 2.08;
		controls.minPolarAngle = 0.15;
		controls.enabled = false;

		setProgress(15, 'Setting up lights…');

		/* ── Lights ───────────────────────────────────────────────── */
		const ambient = new THREE.AmbientLight(0xc8d0ff, 1.4);
		scene.add(ambient); ambientRef = ambient;

		const dirLight = new THREE.DirectionalLight(0xfff8f0, 2.8);
		dirLight.position.set(5, 10, 6);
		dirLight.castShadow = true;
		dirLight.shadow.mapSize.set(1024, 1024);
		dirLight.shadow.camera.near = 0.5; dirLight.shadow.camera.far = 40;
		dirLight.shadow.camera.left = dirLight.shadow.camera.bottom = -10;
		dirLight.shadow.camera.right = dirLight.shadow.camera.top = 10;
		dirLight.shadow.bias = -0.001;
		scene.add(dirLight); dirLightRef = dirLight;

		const fillLeft = new THREE.PointLight(0x88aaff, 1.5, 14);
		fillLeft.position.set(-4, 4.5, -3); scene.add(fillLeft); fillLeftRef = fillLeft;

		const fillRight = new THREE.PointLight(0xffddbb, 1.4, 14);
		fillRight.position.set(4, 4.5, -4); scene.add(fillRight); fillRightRef = fillRight;

		deskGlowBase = 2.2;
		const deskGlow = new THREE.PointLight(0xffbb66, deskGlowBase, 5);
		deskGlow.position.set(-0.3, 3.2, -3.2); scene.add(deskGlow); deskGlowRef = deskGlow;

		lampLightBase = 9.0;
		const lampLight = new THREE.PointLight(0xffcc77, lampLightBase, 18);
		lampLight.castShadow = false;
		lampLight.position.set(1.2, 2.8, -4.0); scene.add(lampLight); lampLightRef = lampLight;

		const ceilBounce = new THREE.PointLight(0xaabbff, 1.3, 16);
		ceilBounce.position.set(0, 6.0, -5.0); scene.add(ceilBounce); ceilBounceRef = ceilBounce;

		const charLight = new THREE.PointLight(0xffeedd, 1.3, 7);
		charLight.position.set(2, 4, -1.5); scene.add(charLight); charLightRef = charLight;

		setProgress(28, 'Building room…');

		/* ── Material helpers ─────────────────────────────────────── */
		const mat = (c: number, o: any = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.78, metalness: 0.04, ...o });
		const gloss = (c: number, o: any = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.22, metalness: 0.35, ...o });
		const emMat = (c: number, e: number, i = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: i, roughness: 0.4 });

		/* ═══════════════════════════════════════════════════════════
		   ROOM
		═══════════════════════════════════════════════════════════ */
		const ROOM_W = 10, ROOM_D = 9, ROOM_H = 6.5, ROOM_CZ = -4.0;
		const wallColor = 0xa0805a, wallColor2 = 0x957550;
		const wainscotColor = 0x6b4a2a, trimColor = 0x4a3520;

		// Floor
		const floorBase = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), new THREE.MeshStandardMaterial({ color: 0x6b4528, roughness: 0.9 }));
		floorBase.rotation.x = -Math.PI / 2; floorBase.position.set(0, 0, ROOM_CZ); floorBase.receiveShadow = true; scene.add(floorBase);
		for (let i = 0; i < 12; i++) {
			const plank = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, 0.005), new THREE.MeshStandardMaterial({ color: 0x7d5530, roughness: 0.95 }));
			plank.rotation.x = -Math.PI / 2; plank.position.set(0, 0.001, ROOM_CZ - ROOM_D / 2 + (i + 1) * (ROOM_D / 13)); scene.add(plank);
		}
		const grid = new THREE.GridHelper(ROOM_W, 14, 0x4a3520, 0x3d2a18);
		grid.position.set(0, 0.002, ROOM_CZ); scene.add(grid);

		// Back wall — split around the door opening (door at x=-3.5, width 1.4, jamb 0.14 each side, top at y≈2.74)
		const DOOR_OPEN_X0 = -4.34, DOOR_OPEN_X1 = -2.76, DOOR_OPEN_Y1 = 2.74;
		const backWallMat = mat(wallColor, { roughness: 0.92 });
		const backTop = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_H - DOOR_OPEN_Y1), backWallMat);
		backTop.position.set(0, (DOOR_OPEN_Y1 + ROOM_H) / 2, -8.5); backTop.receiveShadow = true; scene.add(backTop);
		const backLeft = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_OPEN_X0 + ROOM_W / 2, DOOR_OPEN_Y1), backWallMat);
		backLeft.position.set((-ROOM_W / 2 + DOOR_OPEN_X0) / 2, DOOR_OPEN_Y1 / 2, -8.5); backLeft.receiveShadow = true; scene.add(backLeft);
		const backRight = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W / 2 - DOOR_OPEN_X1, DOOR_OPEN_Y1), backWallMat);
		backRight.position.set((ROOM_W / 2 + DOOR_OPEN_X1) / 2, DOOR_OPEN_Y1 / 2, -8.5); backRight.receiveShadow = true; scene.add(backRight);
		// Dark "hallway" visible through the open door
		const hallwayBackdrop = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 3.0), mat(0x0a0a12, { roughness: 0.98 }));
		hallwayBackdrop.position.set(-3.5, 1.4, -9.1); scene.add(hallwayBackdrop);
		// Left wall
		const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_D, ROOM_H), mat(wallColor2, { roughness: 0.92 }));
		leftWall.position.set(-5, ROOM_H / 2, ROOM_CZ); leftWall.rotation.y = Math.PI / 2; leftWall.receiveShadow = true; scene.add(leftWall);
		// Right wall
		const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_D, ROOM_H), mat(wallColor2, { roughness: 0.92 }));
		rightWall.position.set(5, ROOM_H / 2, ROOM_CZ); rightWall.rotation.y = -Math.PI / 2; rightWall.receiveShadow = true; scene.add(rightWall);
		// Ceiling
		const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), mat(0x9a7a55));
		ceil.rotation.x = Math.PI / 2; ceil.position.set(0, ROOM_H, ROOM_CZ); scene.add(ceil);

		// Wainscoting (back wall split around door; side walls intact)
		const backWainL_W = DOOR_OPEN_X0 + ROOM_W / 2, backWainR_W = ROOM_W / 2 - DOOR_OPEN_X1;
		([
			[backWainL_W, (-ROOM_W / 2 + DOOR_OPEN_X0) / 2, -8.47, 0],
			[backWainR_W, (ROOM_W / 2 + DOOR_OPEN_X1) / 2, -8.47, 0],
			[ROOM_D, -5 + 0.03, ROOM_CZ, Math.PI / 2],
			[ROOM_D, 5 - 0.03, ROOM_CZ, Math.PI / 2]
		] as any[]).forEach(([w, x, z, ry]) => {
			const lower = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.3), mat(wainscotColor, { roughness: 0.88 }));
			lower.position.set(x, 0.65, z); if (ry) lower.rotation.y = ry; scene.add(lower);
			const rail = new THREE.Mesh(new THREE.BoxGeometry(ry ? 0.07 : w, 0.055, ry ? w : 0.07), mat(trimColor, { roughness: 0.7 }));
			rail.position.set(x, 1.32, z); scene.add(rail);
		});

		// Skirting boards (back wall split around door)
		([
			[backWainL_W, new THREE.Vector3((-ROOM_W / 2 + DOOR_OPEN_X0) / 2, 0.09, -8.46), 0],
			[backWainR_W, new THREE.Vector3((ROOM_W / 2 + DOOR_OPEN_X1) / 2, 0.09, -8.46), 0],
			[ROOM_D, new THREE.Vector3(-4.97, 0.09, ROOM_CZ), Math.PI / 2],
			[ROOM_D, new THREE.Vector3(4.97, 0.09, ROOM_CZ), Math.PI / 2]
		] as any[]).forEach(([w, pos, ry]) => {
			const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, 0.06), mat(trimColor));
			m.position.copy(pos); m.rotation.y = ry; scene.add(m);
		});

		// Crown molding
		([[ROOM_W, new THREE.Vector3(0, 6.44, -8.46), 0], [ROOM_D, new THREE.Vector3(-4.97, 6.44, ROOM_CZ), Math.PI / 2], [ROOM_D, new THREE.Vector3(4.97, 6.44, ROOM_CZ), Math.PI / 2]] as any[]).forEach(([w, pos, ry]) => {
			const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.08), mat(trimColor));
			m.position.copy(pos); m.rotation.y = ry; scene.add(m);
		});

		// Ceiling light panel
		const ceilPanel = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.04, 0.7), emMat(0xffffff, 0xbbccff, 0.65));
		ceilPanel.position.set(0, 6.48, ROOM_CZ); scene.add(ceilPanel); ceilPanelRef = ceilPanel;

		// Window on left wall
		let winLight: THREE.PointLight;
		{
			const winX = -4.97, winY = 3.2, winZ = -5.8, winW = 2.6, winH = 2.2;
			const frameMat = mat(0x4a3520, { roughness: 0.6 });
			([[winW + 0.12, 0.08, 0.06, 0, winH / 2 + 0.04, 0], [winW + 0.12, 0.08, 0.06, 0, -winH / 2 - 0.04, 0], [0.08, winH, 0.06, -winW / 2 - 0.04, 0, 0], [0.08, winH, 0.06, winW / 2 + 0.04, 0, 0], [0.04, winH, 0.06, 0, 0, 0], [winW, 0.04, 0.06, 0, 0, 0]] as any[]).forEach(([w, h, d, ox, oy]) => {
				const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
				bar.position.set(winX + 0.04, winY + oy, winZ + ox); bar.rotation.y = Math.PI / 2; scene.add(bar);
			});
			([[-winW / 4, winH / 4], [winW / 4, winH / 4], [-winW / 4, -winH / 4], [winW / 4, -winH / 4]] as any[]).forEach(([ox, oy]) => {
				const paneMat = new THREE.MeshStandardMaterial({ color: 0x0a0a20, emissive: 0x0a0a20, emissiveIntensity: 0.3, roughness: 0.4 });
				winPaneMats.push(paneMat);
				const pane = new THREE.Mesh(new THREE.PlaneGeometry(winW / 2 - 0.06, winH / 2 - 0.06), paneMat);
				pane.position.set(winX + 0.03, winY + oy, winZ + ox); pane.rotation.y = Math.PI / 2; scene.add(pane);
			});

			// Moon (visible at night) — sits just in front of the upper-left pane
			winMoonMat = new THREE.MeshStandardMaterial({ color: 0xfff8dd, emissive: 0xffeeaa, emissiveIntensity: 2.4, roughness: 0.7, transparent: true, opacity: 0 });
			const moon = new THREE.Mesh(new THREE.CircleGeometry(0.22, 28), winMoonMat);
			moon.position.set(winX + 0.032, winY + winH * 0.22, winZ - winW * 0.22);
			moon.rotation.y = Math.PI / 2; scene.add(moon);

			// Stars — scattered across the pane area
			for (let i = 0; i < 24; i++) {
				const starMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.8, transparent: true, opacity: 0 });
				winStarMats.push(starMat);
				const star = new THREE.Mesh(new THREE.CircleGeometry(0.012 + Math.random() * 0.018, 6), starMat);
				const sx = (Math.random() - 0.5) * (winW - 0.25);
				const sy = (Math.random() - 0.2) * (winH - 0.25);
				star.position.set(winX + 0.032, winY + sy, winZ + sx);
				star.rotation.y = Math.PI / 2; scene.add(star);
			}

			winLight = new THREE.PointLight(0xaaccff, 0.05, 8);
			winLight.position.set(winX + 0.5, winY, winZ); scene.add(winLight); winLightRef = winLight;
		}

		// Area rug
		const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 3.2), mat(0x6b2a1f, { roughness: 0.95 }));
		rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.003, -3.2); scene.add(rug);
		const rugBorder = new THREE.Mesh(new THREE.PlaneGeometry(5.08, 3.48), mat(0x8a3d2a, { roughness: 0.95 }));
		rugBorder.rotation.x = -Math.PI / 2; rugBorder.position.set(0, 0.002, -3.2); scene.add(rugBorder);
		const rugPattern = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.2), mat(0x553020, { roughness: 0.95 }));
		rugPattern.rotation.x = -Math.PI / 2; rugPattern.position.set(0, 0.004, -3.2); scene.add(rugPattern);

		setProgress(42, 'Placing furniture…');

		/* ═══════════════════════════════════════════════════════════
		   DESK
		═══════════════════════════════════════════════════════════ */
		{
			const deskWood = gloss(0x3a2010, { roughness: 0.45, metalness: 0.05 });
			const deskFrame = gloss(0x2c1a0c, { roughness: 0.5 });
			const DX = -0.3, DZ = -3.2;
			const top = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 1.45), deskWood);
			top.position.set(DX, 1.08, DZ); top.castShadow = top.receiveShadow = true; scene.add(top);
			([[DX - 1.5, 0.65], [DX + 1.5, 0.65], [DX - 1.5, -0.65], [DX + 1.5, -0.65]] as any[]).forEach(([x, zo]) => {
				const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.08, 0.07), deskFrame);
				leg.position.set(x, 0.54, DZ + zo); leg.castShadow = true; scene.add(leg);
			});
		}

		/* ═══════════════════════════════════════════════════════════
		   DESK LAMP (clickable)
		═══════════════════════════════════════════════════════════ */
		const lampGroup = new THREE.Group();
		{
			const LX = 0.7, LY = 1.13, LZ = -2.85;
			const metalMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.25, metalness: 0.85 });
			const shadeMat = new THREE.MeshStandardMaterial({ color: 0xffeecc, emissive: 0xffaa44, emissiveIntensity: 1.8, roughness: 0.55, side: THREE.DoubleSide });
			lampShadeMat = shadeMat;

			const base = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.04, 16), metalMat);
			base.castShadow = true; lampGroup.add(base);
			const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.020, 0.74, 10), metalMat);
			pole.position.set(0, 0.39, 0); pole.castShadow = true; lampGroup.add(pole);
			const topJoint = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), metalMat);
			topJoint.position.set(0, 0.76, 0); lampGroup.add(topJoint);
			const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.30, 10), metalMat);
			arm.rotation.x = Math.PI / 2; arm.position.set(0, 0.76, 0.15); arm.castShadow = true; lampGroup.add(arm);
			const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.18, 0.20, 20, 1, true), shadeMat);
			shade.position.set(0, 0.65, 0.30); lampGroup.add(shade);
			const shadeCap = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }));
			shadeCap.rotation.x = -Math.PI / 2; shadeCap.position.set(0, 0.75, 0.30); lampGroup.add(shadeCap);
			const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffaa, emissiveIntensity: 3.0 }));
			bulb.position.set(0, 0.66, 0.30); lampGroup.add(bulb); lampBulbMesh = bulb;

			lampGroup.position.set(LX, LY, LZ); scene.add(lampGroup);
			lampGroup.traverse((c: any) => { if (c.isMesh) lampMeshes.push(c); });
		}

		/* ═══════════════════════════════════════════════════════════
		   LAPTOP → Projects
		═══════════════════════════════════════════════════════════ */
		const laptopGroup = new THREE.Group();
		{
			const alum = gloss(0x2c2c36, { roughness: 0.28, metalness: 0.65 });
			const keyMat = mat(0x1e1e26, { roughness: 0.82 });
			const base = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.055, 0.68), alum);
			base.castShadow = true; laptopGroup.add(base);
			for (let i = 0; i < 5; i++) {
				const slot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.008, 0.012), mat(0x111118));
				slot.position.set(-0.28 + i * 0.14, 0.03, 0.32); laptopGroup.add(slot);
			}
			const screen = new THREE.Mesh(new THREE.BoxGeometry(0.91, 0.59, 0.028), alum);
			screen.position.set(0, 0.312, -0.325); screen.rotation.x = -Math.PI * 0.175; screen.castShadow = true; laptopGroup.add(screen);
			const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.50, 0.006), mat(0x0a0a12));
			bezel.position.set(0, 0.312, -0.31); bezel.rotation.x = -Math.PI * 0.175; laptopGroup.add(bezel);
			const dispMat = emMat(0x0d1f3c, 0x2244cc, 1.4);
			(dispMat as any)._baseIntensity = dispMat.emissiveIntensity; laptopScreenMats.push(dispMat);
			const display = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.44, 0.004), dispMat);
			display.position.set(0, 0.312, -0.296); display.rotation.x = -Math.PI * 0.175; laptopGroup.add(display);
			const codeColors = [0x7c6af7, 0x5af778, 0xf7d96a, 0xf7916a, 0x55ccff, 0x7c6af7, 0x5af778];
			codeColors.forEach((col, i) => {
				const w = 0.12 + Math.random() * 0.25;
				const lm = emMat(col, col, 1.2); (lm as any)._baseIntensity = lm.emissiveIntensity; laptopScreenMats.push(lm);
				const line = new THREE.Mesh(new THREE.BoxGeometry(w, 0.018, 0.002), lm);
				const indent = i % 3 === 0 ? 0.02 : i % 3 === 1 ? 0.06 : 0.1;
				line.position.set(-0.28 + indent + w / 2, 0.145 - i * 0.058 + 0.312, -0.284); line.rotation.x = -Math.PI * 0.175; laptopGroup.add(line);
			});
			const kbd = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.009, 0.52), keyMat);
			kbd.position.set(0, 0.032, 0.02); laptopGroup.add(kbd);
			for (let row = 0; row < 3; row++) {
				for (let col = 0; col < 12; col++) {
					const key = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.01, 0.044), mat(0x262632));
					key.position.set(-0.37 + col * 0.067, 0.04, -0.08 + row * 0.065); laptopGroup.add(key);
				}
			}
			const logo = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), emMat(0xaaaacc, 0xffffff, 0.4));
			logo.position.set(0, 0.31, -0.34); logo.rotation.x = Math.PI * 0.825; laptopGroup.add(logo);
			const led = new THREE.Mesh(new THREE.CircleGeometry(0.008, 8), emMat(0x00ff88, 0x00ff88, 3));
			led.position.set(0.44, 0.032, 0.32); laptopGroup.add(led);
		}
		laptopGroup.position.set(-0.3, 1.135, -3.22); laptopGroup.rotation.y = Math.PI * 0.06; laptopGroup.scale.set(0.88, 0.88, 0.88); scene.add(laptopGroup);

		/* ═══════════════════════════════════════════════════════════
		   BOOKSHELF → Skills
		═══════════════════════════════════════════════════════════ */
		const bookshelfGroup = new THREE.Group();
		{
			const wood = mat(0x9a7c4a, { roughness: 0.75 }), dark = mat(0x6b5638, { roughness: 0.78 });
			const makePanel = (w: number, h: number, d: number, x: number, y: number, z: number) => {
				const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood);
				m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; bookshelfGroup.add(m);
			};
			makePanel(0.12, 3.2, 0.45, -0.73, 0, 0); makePanel(0.12, 3.2, 0.45, 0.73, 0, 0);
			makePanel(1.55, 0.12, 0.45, 0, -1.55, 0); makePanel(1.55, 0.12, 0.45, 0, 1.55, 0);
			makePanel(1.55, 0.08, 0.43, 0, -0.78, 0); makePanel(1.55, 0.08, 0.43, 0, 0.10, 0); makePanel(1.55, 0.08, 0.43, 0, 0.98, 0);
			const back = new THREE.Mesh(new THREE.BoxGeometry(1.46, 3.1, 0.04), dark);
			back.position.set(0, 0, -0.20); bookshelfGroup.add(back);
			const bookPalette = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0xe67e22, 0x1abc9c, 0xd35400, 0x27ae60, 0x8e44ad, 0xc0392b, 0x2980b9, 0xf1c40f, 0x16a085, 0x7f8c8d];
			let bi = 0;
			for (let row = 0; row < 3; row++) {
				const baseY = -1.48 + row * 0.88;
				let x = -0.62;
				while (x < 0.63) {
					const bw = 0.062 + Math.random() * 0.052, bh = 0.38 + Math.random() * 0.22;
					const tilted = Math.random() > 0.82;
					const book = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.30), mat(bookPalette[bi % bookPalette.length], { roughness: 0.85 }));
					book.position.set(x + bw / 2, baseY + bh / 2, 0.02); book.rotation.z = tilted ? (Math.random() - 0.5) * 0.25 : 0; book.castShadow = true; bookshelfGroup.add(book);
					const spine = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.7, bh * 0.15, 0.01), mat(0xffffff, { roughness: 0.95 }));
					spine.position.set(x + bw / 2, baseY + bh * 0.6, 0.162); bookshelfGroup.add(spine);
					x += bw + 0.008; bi++;
				}
			}
			// Top shelf décor
			const globeBase = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.08, 8), mat(0x8a6030));
			globeBase.position.set(-0.45, 1.67, 0.04); bookshelfGroup.add(globeBase);
			const globe = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), mat(0x2255aa, { roughness: 0.5 }));
			globe.position.set(-0.45, 1.83, 0.04); bookshelfGroup.add(globe);
			for (let i = 0; i < 3; i++) {
				const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.004, 4, 16), mat(0x88aaff));
				ring.position.set(-0.45, 1.83, 0.04); ring.rotation.y = (i / 3) * Math.PI; bookshelfGroup.add(ring);
			}
			const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.055, 0.13, 10), mat(0xcc7755));
			pot.position.set(0.5, 1.64, 0.04); bookshelfGroup.add(pot);
			const soil = new THREE.Mesh(new THREE.CircleGeometry(0.066, 10), mat(0x3d2b1f));
			soil.position.set(0.5, 1.706, 0.04); soil.rotation.x = -Math.PI / 2; bookshelfGroup.add(soil);
			for (let i = 0; i < 6; i++) {
				const angle = (i / 6) * Math.PI * 2;
				const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.062, 6, 5), mat(0x228844, { roughness: 0.9 }));
				leaf.scale.set(0.6, 1.3, 0.6); leaf.position.set(0.5 + Math.sin(angle) * 0.06, 1.82 + Math.random() * 0.06, 0.04 + Math.cos(angle) * 0.06); leaf.castShadow = true; bookshelfGroup.add(leaf);
			}
			const trophy = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.14, 8), mat(0xf0c040, { roughness: 0.3, metalness: 0.8 }));
			trophy.position.set(0.15, 1.73, 0.04); bookshelfGroup.add(trophy);
			const star = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 4), mat(0xf0c040, { roughness: 0.2, metalness: 0.9 }));
			star.position.set(0.15, 1.83, 0.04); bookshelfGroup.add(star);
			([[- 0.63, -2.15, -0.18], [-0.63, -2.15, 0.18], [0.63, -2.15, -0.18], [0.63, -2.15, 0.18]] as any[]).forEach(([x, y, z]) => {
				const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.08), wood);
				leg.position.set(x, y, z); leg.castShadow = leg.receiveShadow = true; bookshelfGroup.add(leg);
			});
		}
		bookshelfGroup.position.set(3.5, 1.85, -7.2); bookshelfGroup.scale.set(1.2, 1.2, 1.2); scene.add(bookshelfGroup);

		/* ═══════════════════════════════════════════════════════════
		   WALL FRAME → About Me
		═══════════════════════════════════════════════════════════ */
		const wallFrameGroup = new THREE.Group();
		{
			const goldMat = gloss(0xd4a048, { roughness: 0.25, metalness: 0.7 });
			const frameW = 1.6, frameH = 1.15, thick = 0.07, depth = 0.055;
			([[frameW + thick * 2, thick, depth, 0, frameH / 2 + thick / 2, 0], [frameW + thick * 2, thick, depth, 0, -frameH / 2 - thick / 2, 0], [thick, frameH, depth, -frameW / 2 - thick / 2, 0, 0], [thick, frameH, depth, frameW / 2 + thick / 2, 0, 0]] as any[]).forEach(([w, h, d, x, y]) => {
				const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), goldMat);
				bar.position.set(x, y, 0); bar.castShadow = true; wallFrameGroup.add(bar);
			});
			// Pixel-art canvas: girl with graduation cap
			const pxArt = [
				'................................',
				'................................',
				'........BBBBBBBBBBBBBBBB........',
				'......BBBBBBBBBBBBBBBBBBBB......',
				'......BBBBBBBBBBBBBBBBBBBB......',
				'.........CCCCCCCCCCCCCC.Y.......',
				'........HSSSSSSSSSSSSSSH.Y......',
				'........HSSSSSSSSSSSSSSHYY......',
				'........HSSEESSSSSSEESSH........',
				'........HSSSSSSSSSSSSSSH........',
				'........HSSSSSSMMMMSSSSH........',
				'........HSSSSSSSSSSSSSSH........',
				'........HHSSSSSSSSSSSSHH........',
				'.........HHSSSSSSSSSSHH.........',
				'...........HHSSSSSSHH...........',
				'..............NNNN..............',
				'..........GGGGGGGGGGGG..........',
				'.........GGGGGWWWWGGGGG.........',
				'.........GGGGGGWWGGGGGG.........',
				'........GGGGGGGGGGGGGGGG........',
				'.......GGGGGGGGGGGGGGGGGG.......',
				'......GGGGGGGGGGGGGGGGGGGG......',
				'.....GGGGGGGGGGGGGGGGGGGGGG.....',
				'....GGGGGGGGGGGGGGGGGGGGGGGG....'
			];
			const pxPalette: Record<string, string> = {
				'.': '#f4e8d8', B: '#17172a', C: '#1a1a30', Y: '#d4a048',
				H: '#5a3020', S: '#f8d4a8', E: '#1a1a1a', M: '#c85060',
				N: '#e8c098', G: '#1e2240', W: '#ffffff'
			};
			const pxCanvas = document.createElement('canvas');
			pxCanvas.width = 32; pxCanvas.height = 24;
			const pxCtx = pxCanvas.getContext('2d')!;
			pxCtx.imageSmoothingEnabled = false;
			for (let py = 0; py < 24; py++) {
				for (let px = 0; px < 32; px++) {
					pxCtx.fillStyle = pxPalette[pxArt[py][px]] ?? '#f4e8d8';
					pxCtx.fillRect(px, py, 1, 1);
				}
			}
			const pxTex = new THREE.CanvasTexture(pxCanvas);
			pxTex.magFilter = THREE.NearestFilter;
			pxTex.minFilter = THREE.NearestFilter;
			pxTex.colorSpace = THREE.SRGBColorSpace;
			const canvas3d = new THREE.Mesh(
				new THREE.PlaneGeometry(frameW, frameH),
				new THREE.MeshStandardMaterial({ map: pxTex, roughness: 0.85 })
			);
			canvas3d.position.z = 0.015; wallFrameGroup.add(canvas3d);
		}
		wallFrameGroup.position.set(-1.8, 4.0, -8.49); wallFrameGroup.scale.set(1.3, 1.3, 1.3); scene.add(wallFrameGroup);

		/* ═══════════════════════════════════════════════════════════
		   CHAIR (stays at desk permanently)
		═══════════════════════════════════════════════════════════ */
		const chairGroup = new THREE.Group();
		{
			const seatMat = mat(0x1a1a24, { roughness: 0.8 }), chromeMat = gloss(0x888898, { metalness: 0.9, roughness: 0.15 });
			const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.07, 0.55), seatMat);
			seat.position.y = 0.58; seat.castShadow = true; chairGroup.add(seat);
			const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.6, 0.06), seatMat);
			chairBack.position.set(0, 0.92, -0.24); chairBack.castShadow = true; chairGroup.add(chairBack);
			const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.06), seatMat);
			headrest.position.set(0, 1.27, -0.24); chairGroup.add(headrest);
			([-0.34, 0.34] as number[]).forEach(x => {
				const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.36), seatMat);
				arm.position.set(x, 0.74, 0.03); chairGroup.add(arm);
				const sup = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.17, 8), chromeMat);
				sup.position.set(x, 0.65, 0.09); chairGroup.add(sup);
			});
			const lift = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.4, 10), chromeMat);
			lift.position.set(0, 0.2, 0); chairGroup.add(lift);
			for (let i = 0; i < 5; i++) {
				const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.04, 0.04), chromeMat);
				spoke.rotation.y = (i / 5) * Math.PI * 2; spoke.position.y = 0.03; chairGroup.add(spoke);
				const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8), mat(0x111111));
				wheel.rotation.z = Math.PI / 2; wheel.position.set(Math.sin((i / 5) * Math.PI * 2) * 0.19, 0.03, Math.cos((i / 5) * Math.PI * 2) * 0.19); chairGroup.add(wheel);
			}
		}
		chairGroup.position.set(1.8, 0, -1.0); chairGroup.rotation.y = -Math.PI * 0.18; chairGroup.scale.set(1.18, 1.18, 1.18); scene.add(chairGroup);

		/* ═══════════════════════════════════════════════════════════
		   CHARACTER → Contact
		═══════════════════════════════════════════════════════════ */
		const charLapMeshes: THREE.Mesh[] = [];
		const charSittingLegs: THREE.Mesh[] = [];
		let charSmileMesh: THREE.Mesh | null = null;
		let charUpperPivot: THREE.Group | null = null;
		let charStandingLegsGroup: THREE.Group | null = null;
		const characterGroup = new THREE.Group();
		{
			const skin = mat(0xffccaa), shirt = mat(0x3a3acc, { roughness: 0.8 });
			const pants = mat(0x223355, { roughness: 0.85 }), hair = mat(0x1a0f05);
			const shoe = mat(0x111111), glass = gloss(0x222233, { metalness: 0.85, roughness: 0.08 });

			const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.46, 0.22), shirt);
			torso.position.set(0, 0.87, 0.02); torso.castShadow = true; characterGroup.add(torso);
			const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.30, 0.012), mat(0x5555dd));
			stripe.position.set(0, 0.87, 0.117); characterGroup.add(stripe);
			const collarL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.012), mat(0xfafafa));
			collarL.position.set(-0.05, 1.09, 0.116); collarL.rotation.z = 0.35; characterGroup.add(collarL);
			const collarR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.012), mat(0xfafafa));
			collarR.position.set(0.05, 1.09, 0.116); collarR.rotation.z = -0.35; characterGroup.add(collarR);

			([-0.11, 0.11] as number[]).forEach(lx => {
				const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.38), pants);
				thigh.position.set(lx, 0.64, 0.19); thigh.castShadow = true; characterGroup.add(thigh);
				const calf = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.44, 0.13), pants);
				calf.position.set(lx, 0.40, 0.38); calf.castShadow = true; characterGroup.add(calf);
				const shoe2 = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.22), shoe);
				shoe2.position.set(lx, 0.14, 0.47); characterGroup.add(shoe2);
				charSittingLegs.push(thigh, calf, shoe2);
			});

			([-0.21, 0.21] as number[]).forEach(ax => {
				const side = ax < 0 ? -1 : 1;
				const uArm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.28, 0.11), shirt);
				uArm.position.set(ax, 0.96, 0.04); uArm.rotation.z = side * 0.22; uArm.rotation.x = -0.55; uArm.castShadow = true; characterGroup.add(uArm);
				const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.058, 8, 6), shirt);
				elbow.position.set(ax, 0.841, 0.113); characterGroup.add(elbow);
				const fore = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.21, 0.088), skin);
				fore.position.set(ax * 0.89, 0.766, 0.184); fore.rotation.x = 2.38; fore.rotation.z = -side * 0.10; characterGroup.add(fore);
				const hand = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.036, 0.085), skin);
				hand.position.set(ax * 0.78, 0.690, 0.255); characterGroup.add(hand);
				for (let f = 0; f < 4; f++) {
					const fing = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.034), skin);
					fing.position.set(ax * 0.78 + (f - 1.5) * 0.020, 0.690, 0.296); characterGroup.add(fing);
				}
			});

			const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.060, 0.09, 10), skin);
			neck.position.set(0, 1.145, 0.02); characterGroup.add(neck);
			const head = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.225, 0.20), skin);
			head.position.set(0, 1.305, 0.02); head.castShadow = true; characterGroup.add(head);

			const eyeY = 1.315;
			([-0.056, 0.056] as number[]).forEach(ex => {
				const brow = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.010, 0.006), mat(0x1a0f05));
				brow.position.set(ex, eyeY + 0.022, 0.124); characterGroup.add(brow);
				const sclera = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.030, 0.006), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
				sclera.position.set(ex, eyeY, 0.128); characterGroup.add(sclera);
				const iris = new THREE.Mesh(new THREE.CircleGeometry(0.013, 12), new THREE.MeshStandardMaterial({ color: 0x1a1a2e }));
				iris.position.set(ex, eyeY, 0.132); characterGroup.add(iris);
				const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.007, 10), new THREE.MeshStandardMaterial({ color: 0x050508 }));
				pupil.position.set(ex, eyeY, 0.133); characterGroup.add(pupil);
				const shine = new THREE.Mesh(new THREE.CircleGeometry(0.004, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0 }));
				shine.position.set(ex + 0.006, eyeY + 0.006, 0.134); characterGroup.add(shine);
			});

			([-0.108, 0.108] as number[]).forEach(ex => {
				const ear = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.048, 0.042), skin);
				ear.position.set(ex, 1.30, 0.02); characterGroup.add(ear);
			});

			const hairCap = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.085, 0.21), hair);
			hairCap.position.set(0, 1.455, 0.01); characterGroup.add(hairCap);
			([-0.10, 0.10] as number[]).forEach(hx => {
				const side2 = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.14, 0.18), hair);
				side2.position.set(hx, 1.36, 0.01); characterGroup.add(side2);
			});
			const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.04), hair);
			fringe.position.set(0, 1.41, 0.105); characterGroup.add(fringe);

			([-0.054, 0.054] as number[]).forEach(gx => {
				const lens = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.007, 7, 18), glass);
				lens.position.set(gx, 1.30, 0.112); characterGroup.add(lens);
				const fill = new THREE.Mesh(new THREE.CircleGeometry(0.022, 16), new THREE.MeshStandardMaterial({ color: 0x88aacc, transparent: true, opacity: 0.35, roughness: 0.1 }));
				fill.position.set(gx, 1.30, 0.114); characterGroup.add(fill);
			});
			const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.007, 0.005), glass);
			bridge.position.set(0, 1.30, 0.113); characterGroup.add(bridge);
			([-0.08, 0.08] as number[]).forEach(tx => {
				const temple = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.006, 0.09), glass);
				temple.position.set(tx, 1.30, 0.067); characterGroup.add(temple);
			});

			([-0.11, 0.11] as number[]).forEach(hpx => {
				const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.022, 10), mat(0x1a1a22));
				cup.rotation.z = Math.PI / 2; cup.position.set(hpx, 1.345, 0.02); characterGroup.add(cup);
				const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.008, 10), mat(0x111118));
				pad.rotation.z = Math.PI / 2; pad.position.set(hpx * 1.06, 1.345, 0.02); characterGroup.add(pad);
			});
			const hpBand = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.010, 7, 20, Math.PI), mat(0x1a1a22));
			hpBand.position.set(0, 1.38, 0.02); hpBand.rotation.z = Math.PI / 2; characterGroup.add(hpBand);

			// Laptop on lap
			const lapBase = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.032, 0.30), gloss(0x2c2c36, { metalness: 0.6 }));
			lapBase.position.set(0, 0.66, 0.19); lapBase.rotation.x = -0.08; lapBase.castShadow = true; characterGroup.add(lapBase);
			charLapMeshes.push(lapBase);
			const lapScreen = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.27, 0.016), gloss(0x2c2c36, { metalness: 0.6 }));
			lapScreen.position.set(0, 0.86, 0.01); lapScreen.rotation.x = -1.05; characterGroup.add(lapScreen);
			charLapMeshes.push(lapScreen);
			const lapDispMat = emMat(0x0d1f3c, 0x2244ee, 0.9);
			(lapDispMat as any)._baseIntensity = lapDispMat.emissiveIntensity; laptopScreenMats.push(lapDispMat);
			const lapDisplay = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.21, 0.006), lapDispMat);
			lapDisplay.position.set(0, 0.86, 0.022); lapDisplay.rotation.x = -1.05; characterGroup.add(lapDisplay);
			charLapMeshes.push(lapDisplay);
			[0xf7916a, 0x5af778, 0x7c6af7, 0xffee88, 0x55ccff].forEach((col, i) => {
				const w = 0.055 + Math.random() * 0.10, indent = (i % 3) * 0.022;
				const clm = emMat(col, col, 1.5); (clm as any)._baseIntensity = clm.emissiveIntensity; laptopScreenMats.push(clm);
				const cl = new THREE.Mesh(new THREE.BoxGeometry(w, 0.013, 0.002), clm);
				cl.position.set(-0.08 + indent + w / 2, 0.88 + 0.04 - i * 0.038, 0.034); cl.rotation.x = -1.05; characterGroup.add(cl);
				charLapMeshes.push(cl);
			});

			// Easter egg: smile mouth (hidden by default)
			const smile = new THREE.Mesh(
				new THREE.TorusGeometry(0.038, 0.0055, 6, 14, Math.PI),
				new THREE.MeshStandardMaterial({ color: 0x5a1a10, roughness: 0.6 })
			);
			smile.position.set(0, 1.255, 0.122); smile.rotation.z = Math.PI;
			smile.visible = false; characterGroup.add(smile); charSmileMesh = smile;

			// Refactor: move all upper-body parts (y > 0.65) into a pivot group at hip,
			// so the bow rotates only the upper body.
			const HIP_Y = 0.65;
			const upperPivot = new THREE.Group();
			upperPivot.position.set(0, HIP_Y, 0);
			const upperParts = characterGroup.children.filter(c => c.position.y > HIP_Y);
			upperParts.forEach(p => { characterGroup.remove(p); p.position.y -= HIP_Y; upperPivot.add(p); });
			characterGroup.add(upperPivot); charUpperPivot = upperPivot;

			// Standing legs (vertical, feet flat on floor) — hidden by default
			const standingLegs = new THREE.Group();
			([-0.11, 0.11] as number[]).forEach(lx => {
				const thighS = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.30, 0.14), pants);
				thighS.position.set(lx, 0.51, 0); thighS.castShadow = true; standingLegs.add(thighS);
				const calfS = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.30, 0.13), pants);
				calfS.position.set(lx, 0.21, 0); calfS.castShadow = true; standingLegs.add(calfS);
				const shoeS = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.06, 0.22), shoe);
				shoeS.position.set(lx, 0.03, 0.04); standingLegs.add(shoeS);
			});
			standingLegs.visible = false; characterGroup.add(standingLegs); charStandingLegsGroup = standingLegs;
		}
		characterGroup.position.set(1.8, 0, -1.0); characterGroup.rotation.y = -Math.PI * 0.18; characterGroup.scale.set(1.18, 1.18, 1.18);
		scene.add(characterGroup); characterGroupRef = characterGroup;

		/* ═══════════════════════════════════════════════════════════
		   DOOR
		═══════════════════════════════════════════════════════════ */
		const DOOR_X = -3.5, DOOR_W = 1.4, DOOR_H = 2.6, DOOR_Z = -8.48;
		const doorPivot = new THREE.Group();
		{
			const jambMat = gloss(0x3a2410, { roughness: 0.55, metalness: 0.08 });
			const slabMat = gloss(0x5a3a1e, { roughness: 0.5, metalness: 0.1 });
			const panelMat = gloss(0x4a2f18, { roughness: 0.55 });
			const knobMat = gloss(0xc9a227, { roughness: 0.28, metalness: 0.85 });

			const jambT = 0.14, jambD = 0.10;
			const leftJamb = new THREE.Mesh(new THREE.BoxGeometry(jambT, DOOR_H + jambT, jambD), jambMat);
			leftJamb.position.set(DOOR_X - DOOR_W / 2 - jambT / 2, (DOOR_H + jambT) / 2, DOOR_Z);
			leftJamb.castShadow = true; scene.add(leftJamb);
			const rightJamb = new THREE.Mesh(new THREE.BoxGeometry(jambT, DOOR_H + jambT, jambD), jambMat);
			rightJamb.position.set(DOOR_X + DOOR_W / 2 + jambT / 2, (DOOR_H + jambT) / 2, DOOR_Z);
			rightJamb.castShadow = true; scene.add(rightJamb);
			const headJamb = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W + jambT * 2, jambT, jambD), jambMat);
			headJamb.position.set(DOOR_X, DOOR_H + jambT / 2, DOOR_Z);
			headJamb.castShadow = true; scene.add(headJamb);

			// Door pivot hinged on left jamb (swings inward when rotated -Y)
			doorPivot.position.set(DOOR_X - DOOR_W / 2, 0, DOOR_Z + 0.03);
			scene.add(doorPivot);

			const slab = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W - 0.04, DOOR_H - 0.04, 0.06), slabMat);
			slab.position.set(DOOR_W / 2, DOOR_H / 2, 0);
			slab.castShadow = true; slab.receiveShadow = true; doorPivot.add(slab);

			([0.72, 1.78] as number[]).forEach(py => {
				const panel = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W - 0.32, 0.72, 0.012), panelMat);
				panel.position.set(DOOR_W / 2, py, 0.037);
				doorPivot.add(panel);
			});

			const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 18, 14), knobMat);
			knob.position.set(DOOR_W - 0.16, 1.18, 0.07);
			knob.castShadow = true; doorPivot.add(knob);
			const knobStem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 14), knobMat);
			knobStem.rotation.x = Math.PI / 2;
			knobStem.position.set(DOOR_W - 0.16, 1.18, 0.04);
			doorPivot.add(knobStem);
			const knobPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 18), knobMat);
			knobPlate.rotation.x = Math.PI / 2;
			knobPlate.position.set(DOOR_W - 0.16, 1.18, 0.031);
			doorPivot.add(knobPlate);
		}

		/* ═══════════════════════════════════════════════════════════
		   PROFESSOR CHARACTER (enters through door every 5s)
		═══════════════════════════════════════════════════════════ */
		const professorGroup = new THREE.Group();
		const legPivotL = new THREE.Group(), legPivotR = new THREE.Group();
		const armPivotL = new THREE.Group(), armPivotR = new THREE.Group();
		{
			const suit = mat(0x3a4a6a, { roughness: 0.72 });
			const suitDark = mat(0x2a3a58, { roughness: 0.75 });
			const skin = mat(0xe8c6a0, { roughness: 0.82 });
			const hair = mat(0x110a06, { roughness: 0.85 });
			const pants = mat(0x24242c, { roughness: 0.85 });
			const shoe = gloss(0x140a06, { roughness: 0.55 });
			const glassM = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.35, metalness: 0.6 });
			const bookRed = mat(0x88222a, { roughness: 0.75 });
			const bookPg = mat(0xf0e8d0, { roughness: 0.9 });
			const tieM = mat(0xaa2230, { roughness: 0.7 });

			// Larger build — wider torso, thicker limbs
			const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.62, 0.32), suit);
			torso.position.set(0, 0.98, 0); torso.castShadow = true; professorGroup.add(torso);
			const belly = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.22, 0.34), suit);
			belly.position.set(0, 0.78, 0.02); professorGroup.add(belly);
			const lapelL = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.36, 0.01), suitDark);
			lapelL.position.set(-0.11, 1.10, 0.163); lapelL.rotation.z = 0.12; professorGroup.add(lapelL);
			const lapelR = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.36, 0.01), suitDark);
			lapelR.position.set(0.11, 1.10, 0.163); lapelR.rotation.z = -0.12; professorGroup.add(lapelR);
			const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.40, 0.01), mat(0xf4f0e8));
			shirt.position.set(0, 1.05, 0.162); professorGroup.add(shirt);
			const tie = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.34, 0.012), tieM);
			tie.position.set(0, 1.02, 0.167); professorGroup.add(tie);

			// Legs pivot at hip
			([[legPivotL, -0.14], [legPivotR, 0.14]] as [THREE.Group, number][]).forEach(([pivot, lx]) => {
				pivot.position.set(lx, 0.68, 0);
				const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.64, 0.24), pants);
				thigh.position.set(0, -0.32, 0); thigh.castShadow = true; pivot.add(thigh);
				const sh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.11, 0.34), shoe);
				sh.position.set(0, -0.64, 0.06); sh.castShadow = true; pivot.add(sh);
				professorGroup.add(pivot);
			});

			// Arms pivot at shoulder (wider shoulders for larger build)
			([[armPivotL, -0.36], [armPivotR, 0.36]] as [THREE.Group, number][]).forEach(([pivot, ax]) => {
				pivot.position.set(ax, 1.24, 0);
				const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.54, 0.18), suit);
				arm.position.set(0, -0.27, 0); arm.castShadow = true; pivot.add(arm);
				const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.045, 0.19), suitDark);
				cuff.position.set(0, -0.54, 0); pivot.add(cuff);
				const hand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.13, 0.15), skin);
				hand.position.set(0, -0.63, 0.03); pivot.add(hand);
				professorGroup.add(pivot);
			});

			// Book in right hand
			const bookBase = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.20), bookRed);
			bookBase.position.set(0.03, -0.56, 0.13); armPivotR.add(bookBase);
			const bookPages = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.185), bookPg);
			bookPages.position.set(0.03, -0.56, 0.13); armPivotR.add(bookPages);

			const neck = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.16), skin);
			neck.position.set(0, 1.32, 0); professorGroup.add(neck);
			const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.32), skin);
			head.position.set(0, 1.54, 0); head.castShadow = true; professorGroup.add(head);

			// Permed black hair — smooth ellipsoid scalp + forehead bangs (replaces boxy base)
			const mainHair = new THREE.Mesh(new THREE.SphereGeometry(0.20, 22, 16), hair);
			mainHair.position.set(0, 1.60, -0.06);
			mainHair.scale.set(1.10, 1.10, 1.08);
			mainHair.castShadow = true;
			professorGroup.add(mainHair);
			const bangsHair = new THREE.Mesh(new THREE.SphereGeometry(0.10, 18, 12), hair);
			bangsHair.position.set(0, 1.72, 0.13);
			bangsHair.scale.set(1.6, 0.45, 0.55);
			bangsHair.castShadow = true;
			professorGroup.add(bangsHair);

			// Subtle perm curls (wave bumps on top + sides, not voluminous)
			const curlGeom = new THREE.SphereGeometry(0.055, 10, 8);
			const curls: [number, number, number, number][] = [
				// Top gentle waves
				[-0.11, 1.83, 0.06, 1.00],
				[0.11, 1.83, 0.06, 1.00],
				[-0.05, 1.84, -0.06, 0.95],
				[0.05, 1.84, -0.06, 0.95],
				[0.00, 1.83, 0.12, 0.90],
				[-0.15, 1.81, -0.02, 0.90],
				[0.15, 1.81, -0.02, 0.90],
				// Side wave accents
				[-0.19, 1.64, 0.05, 0.80],
				[0.19, 1.64, 0.05, 0.80],
				[-0.19, 1.55, -0.06, 0.78],
				[0.19, 1.55, -0.06, 0.78],
				// Back wave accents
				[-0.09, 1.66, -0.19, 0.82],
				[0.09, 1.66, -0.19, 0.82],
				[0.00, 1.60, -0.20, 0.78],
				// Front bangs waves
				[-0.11, 1.74, 0.18, 0.75],
				[0.11, 1.74, 0.18, 0.75],
			];
			curls.forEach(([cx, cy, cz, s]) => {
				const curl = new THREE.Mesh(curlGeom, hair);
				curl.position.set(cx, cy, cz);
				curl.scale.setScalar(s);
				curl.castShadow = true;
				professorGroup.add(curl);
			});

			// Glasses
			([-0.082, 0.082] as number[]).forEach(gx => {
				const lens = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.085, 0.015), glassM);
				lens.position.set(gx, 1.54, 0.165); professorGroup.add(lens);
			});
			const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.014, 0.013), glassM);
			bridge.position.set(0, 1.548, 0.166); professorGroup.add(bridge);
			([-0.082, 0.082] as number[]).forEach(ex => {
				const eye = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.004), mat(0x0a0a0a));
				eye.position.set(ex, 1.54, 0.174); professorGroup.add(eye);
			});

			const brows = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.022, 0.012), hair);
			brows.position.set(0, 1.60, 0.167); professorGroup.add(brows);

			// Scale up for larger build
			professorGroup.scale.setScalar(1.12);
			professorGroup.position.set(DOOR_X, 0, -8.9);
			professorGroup.visible = false;
			scene.add(professorGroup);
		}

		/* ── Sweat drops on main character (shown while professor stares) ── */
		const sweatGroup = new THREE.Group();
		const sweatDropDefs: { node: THREE.Group; mat: THREE.MeshStandardMaterial; baseY: number; delay: number }[] = [];
		{
			const sphereGeom = new THREE.SphereGeometry(0.022, 12, 10);
			const coneGeom = new THREE.ConeGeometry(0.017, 0.036, 12);
			// y values are in characterGroup local space (head tops ≈ 1.50)
			const bases: [number, number, number, number][] = [
				[-0.17, 1.46, 0.08, 0.0],
				[0.16, 1.44, 0.10, 0.4],
				[-0.03, 1.50, 0.13, 0.8],
			];
			bases.forEach(([bx, by, bz, delay]) => {
				const m = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, emissive: 0x6bb3ea, emissiveIntensity: 1.1, roughness: 0.15, metalness: 0.0, transparent: true, opacity: 0 });
				const node = new THREE.Group();
				const sphere = new THREE.Mesh(sphereGeom, m);
				sphere.position.y = 0;
				node.add(sphere);
				const cone = new THREE.Mesh(coneGeom, m);
				cone.position.y = 0.022 + 0.018; // sphere top + half cone height
				node.add(cone);
				// upperPivot is at y=HIP_Y=0.65 within characterGroup
				node.position.set(bx, by - 0.65, bz);
				sweatGroup.add(node);
				sweatDropDefs.push({ node, mat: m, baseY: by - 0.65, delay });
			});
			sweatGroup.visible = false;
			(charUpperPivot ?? characterGroup).add(sweatGroup);
		}

		const sweatSubTls: gsap.core.Timeline[] = [];
		function startSweat() {
			sweatGroup.visible = true;
			sweatDropDefs.forEach(d => {
				const sub = gsap.timeline({ repeat: -1, delay: d.delay });
				sub.set(d.node.position, { y: d.baseY })
					.set(d.mat, { opacity: 0 })
					.to(d.mat, { opacity: 0.95, duration: 0.15 })
					.to(d.node.position, { y: d.baseY - 0.32, duration: 0.9, ease: 'power1.in' }, '<')
					.to(d.mat, { opacity: 0, duration: 0.25 }, '-=0.3')
					.to({}, { duration: 0.35 });
				sweatSubTls.push(sub);
			});
		}
		function stopSweat() {
			sweatSubTls.forEach(t => t.kill());
			sweatSubTls.length = 0;
			sweatDropDefs.forEach(d => { d.mat.opacity = 0; });
			sweatGroup.visible = false;
		}

		/* ── Professor entrance loop ──────────────────────────────── */
		const PROF_STOP_Z = -7.3;
		const STARE_ANGLE = Math.atan2(1.8 - DOOR_X, -1.0 - PROF_STOP_Z);
		function resetPose() {
			legPivotL.rotation.x = 0; legPivotR.rotation.x = 0;
			armPivotL.rotation.x = 0; armPivotR.rotation.x = 0;
			professorGroup.position.y = 0;
		}
		function runProfessorCycle() {
			const tl = gsap.timeline({ onComplete: () => { setTimeout(runProfessorCycle, 1500); } });

			tl.call(() => {
				professorGroup.position.set(DOOR_X, 0, -8.9);
				professorGroup.rotation.y = 0;
				resetPose();
				professorGroup.visible = true;
			});

			// Door opens
			tl.to(doorPivot.rotation, { y: -Math.PI * 0.55, duration: 0.6, ease: 'power2.out' });

			// Walk in — position + leg/arm swing driven by a proxy
			const walkInProxy = { t: 0 };
			tl.to(walkInProxy, {
				t: 1, duration: 1.7, ease: 'none',
				onUpdate() {
					const t = walkInProxy.t;
					professorGroup.position.z = -8.9 + t * (PROF_STOP_Z - (-8.9));
					const phase = t * Math.PI * 2 * 3; // ~3 strides
					legPivotL.rotation.x = Math.sin(phase) * 0.55;
					legPivotR.rotation.x = -Math.sin(phase) * 0.55;
					armPivotL.rotation.x = -Math.sin(phase) * 0.4;
					armPivotR.rotation.x = Math.sin(phase) * 0.4;
					professorGroup.position.y = Math.abs(Math.sin(phase)) * 0.035;
				}
			});
			tl.call(() => resetPose());

			// Turn to face the user's character
			tl.to(professorGroup.rotation, { y: STARE_ANGLE, duration: 0.45, ease: 'power2.inOut' });

			// Stare 5s — main character sweats
			tl.call(() => startSweat());
			tl.to({}, { duration: 5 });
			tl.call(() => stopSweat());

			// Turn toward door
			tl.to(professorGroup.rotation, { y: Math.PI, duration: 0.45, ease: 'power2.inOut' });

			// Walk out
			const walkOutProxy = { t: 0 };
			tl.to(walkOutProxy, {
				t: 1, duration: 1.6, ease: 'none',
				onUpdate() {
					const t = walkOutProxy.t;
					professorGroup.position.z = PROF_STOP_Z + t * (-8.95 - PROF_STOP_Z);
					const phase = t * Math.PI * 2 * 3;
					legPivotL.rotation.x = Math.sin(phase) * 0.55;
					legPivotR.rotation.x = -Math.sin(phase) * 0.55;
					armPivotL.rotation.x = -Math.sin(phase) * 0.4;
					armPivotR.rotation.x = Math.sin(phase) * 0.4;
					professorGroup.position.y = Math.abs(Math.sin(phase)) * 0.035;
				}
			});
			tl.call(() => { resetPose(); professorGroup.visible = false; });

			// Close door
			tl.to(doorPivot.rotation, { y: 0, duration: 0.55, ease: 'power2.inOut' });
		}
		setTimeout(runProfessorCycle, 1200);

		const DESK_ROT_Y = -Math.PI * 0.18;

		setProgress(60, 'Hanging clock…');

		/* ═══════════════════════════════════════════════════════════
		   WALL CLOCK
		═══════════════════════════════════════════════════════════ */
		const clockGroup = new THREE.Group();
		const handMat = new THREE.MeshStandardMaterial({ color: 0x111122 });
		const redMat = new THREE.MeshStandardMaterial({ color: 0xe84040 });
		const clockBody = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.065, 52), gloss(0x1a1a32, { roughness: 0.18, metalness: 0.6 }));
		clockBody.rotation.x = Math.PI / 2; clockGroup.add(clockBody);
		const clockFace = new THREE.Mesh(new THREE.CircleGeometry(0.325, 52), new THREE.MeshStandardMaterial({ color: 0xf2f0e8, roughness: 0.95 }));
		clockFace.position.z = 0.035; clockGroup.add(clockFace);
		const rim = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.026, 10, 52), gloss(0x999ab0, { metalness: 0.85, roughness: 0.18 }));
		rim.position.z = 0.028; clockGroup.add(rim);
		for (let i = 0; i < 12; i++) {
			const a = (i / 12) * Math.PI * 2, big = i % 3 === 0;
			const mark = new THREE.Mesh(new THREE.BoxGeometry(big ? 0.025 : 0.014, big ? 0.065 : 0.042, 0.01), new THREE.MeshStandardMaterial({ color: 0x1a1a2e }));
			mark.position.set(Math.sin(a) * 0.265, Math.cos(a) * 0.265, 0.04); mark.rotation.z = -a; clockGroup.add(mark);
		}
		function makeHand(w: number, len: number, m: THREE.Material, zOff: number) {
			const pivot = new THREE.Group(); pivot.position.z = zOff;
			const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.011), m); mesh.position.y = len / 2; pivot.add(mesh);
			const tail = new THREE.Mesh(new THREE.BoxGeometry(w * 1.1, len * 0.22, 0.011), m); tail.position.y = -(len * 0.22) / 2; pivot.add(tail);
			return pivot;
		}
		hourPivot = makeHand(0.019, 0.16, handMat, 0.048);
		minPivot = makeHand(0.013, 0.23, handMat, 0.055);
		secPivot = makeHand(0.008, 0.27, redMat, 0.062);
		clockGroup.add(hourPivot, minPivot, secPivot);
		const pin = new THREE.Mesh(new THREE.CircleGeometry(0.02, 14), redMat.clone()); pin.position.z = 0.068; clockGroup.add(pin);
		clockGroup.position.set(0.8, 4.4, -8.49); scene.add(clockGroup);

		/* ═══════════════════════════════════════════════════════════
		   PARTICLES
		═══════════════════════════════════════════════════════════ */
		const PARTICLE_COUNT = isMobile ? 60 : 200;
		const particleGeo = new THREE.BufferGeometry();
		const particlePos = new Float32Array(PARTICLE_COUNT * 3);
		for (let i = 0; i < PARTICLE_COUNT; i++) {
			particlePos[i * 3] = (Math.random() - 0.5) * 9;
			particlePos[i * 3 + 1] = Math.random() * 5.5 + 0.5;
			particlePos[i * 3 + 2] = Math.random() * -8 - 0.3;
		}
		particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
		scene.add(new THREE.Points(particleGeo, new THREE.PointsMaterial({ color: 0x9aafff, size: 0.042, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false })));
		particleGeoRef = particleGeo;

		/* ── Corner plants ────────────────────────────────────────── */
		function buildPlant(s: number) {
			const g = new THREE.Group();
			const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.14 * s, 0.28 * s, 10), mat(0xaa6633)); pot.castShadow = true; g.add(pot);
			const soil = new THREE.Mesh(new THREE.CircleGeometry(0.175 * s, 10), mat(0x3a2310)); soil.rotation.x = -Math.PI / 2; soil.position.y = 0.142 * s; g.add(soil);
			for (let i = 0; i < 7; i++) {
				const a = (i / 7) * Math.PI * 2, h = 0.3 + Math.random() * 0.28;
				const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.14 * s, 7, 5), mat(0x228844, { roughness: 0.88 }));
				leaf.scale.set(0.55, h / 0.28, 0.55); leaf.position.set(Math.sin(a) * 0.12 * s, (0.45 + h * 0.2) * s, Math.cos(a) * 0.12 * s); leaf.castShadow = true; g.add(leaf);
			}
			return g;
		}
		const plant1 = buildPlant(1.2); plant1.position.set(-4.6, 0, -1.5); scene.add(plant1);
		const plant2 = buildPlant(0.9); plant2.position.set(4.5, 0, -6.5); scene.add(plant2);

		/* ── Coffee mug ───────────────────────────────────────────── */
		const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.12, 12), mat(0xf0f0f0));
		mug.position.set(-1.0, 1.19, -3.25); mug.castShadow = true; scene.add(mug);
		const mugLiq = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), mat(0x3a1800));
		mugLiq.rotation.x = -Math.PI / 2; mugLiq.position.set(-1.0, 1.252, -3.25); scene.add(mugLiq);
		const mugHandle = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.014, 7, 14, Math.PI), mat(0xf0f0f0));
		mugHandle.position.set(-0.935, 1.19, -3.25); mugHandle.rotation.y = Math.PI / 2; scene.add(mugHandle);

		/* ── Sticky notes ─────────────────────────────────────────── */
		([[0xffee44, -2.2], [0xff9999, 0.0], [0xaaffaa, 2.2]] as any[]).forEach(([col, px]) => {
			const note = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.015), mat(col, { roughness: 0.9 }));
			note.position.set(px, 2.1, -8.47); note.rotation.z = (Math.random() - 0.5) * 0.1; scene.add(note);
			for (let r = 0; r < 3; r++) {
				const ln = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.014, 0.002), mat(0x33333333));
				ln.position.set(px, 2.18 - r * 0.07, -8.46); scene.add(ln);
			}
		});

		setProgress(86, 'Wiring interactions…');

		/* ═══════════════════════════════════════════════════════════
		   FLOATING LABELS
		═══════════════════════════════════════════════════════════ */
		labelDefs = [
			{ key: 'laptop', mesh: laptopGroup, icon: '💻', text: 'Projects', offset: new THREE.Vector3(0, 0.7, 0) },
			{ key: 'bookshelf', mesh: bookshelfGroup, icon: '📚', text: 'Skills', offset: new THREE.Vector3(0, 2.3, 0) },
			{ key: 'frame', mesh: wallFrameGroup, icon: '🖼️', text: 'About Me', offset: new THREE.Vector3(0, 1.0, 0) },
			{ key: 'character', mesh: characterGroup, icon: '👤', text: 'Contact', offset: new THREE.Vector3(0, 2.0, 0) },
			{ key: 'professor', mesh: professorGroup, icon: '🎓', text: 'Professor', offset: new THREE.Vector3(0, 2.2, 0), isVisible: () => professorGroup.visible },
		];
		labelDefs.forEach(def => {
			const div = document.createElement('div');
			div.className = 'scene-label';
			div.innerHTML = `<span class="label-emoji">${def.icon}</span><span class="label-text">${def.text}</span>`;
			if ('ontouchstart' in window) {
				div.style.pointerEvents = 'auto';
				div.addEventListener('click', (e: Event) => { e.stopPropagation(); const obj = interactiveObjects.find((o: any) => o.key === def.key); if (obj) focusObject(obj); });
			}
			labelsEl.appendChild(div);
			labelEls[def.key] = div;
		});

		/* ═══════════════════════════════════════════════════════════
		   INTERACTIVE OBJECTS MAP
		═══════════════════════════════════════════════════════════ */
		interactiveObjects = [
			{ mesh: laptopGroup, key: 'laptop', camPos: new THREE.Vector3(-0.1, 2.1, -1.2), camTarget: new THREE.Vector3(-0.3, 1.2, -3.2) },
			{ mesh: bookshelfGroup, key: 'bookshelf', camPos: new THREE.Vector3(1.6, 2.4, -5.5), camTarget: new THREE.Vector3(3.5, 2.0, -7.2) },
			{ mesh: wallFrameGroup, key: 'frame', camPos: new THREE.Vector3(-1.7, 4.0, -6.5), camTarget: new THREE.Vector3(-1.8, 4.0, -8.5) },
			{ mesh: characterGroup, key: 'character', camPos: new THREE.Vector3(-0.2, 2.0, 0.8), camTarget: new THREE.Vector3(1.6, 0.8, -2.2) },
			{ mesh: professorGroup, key: 'professor', camPos: new THREE.Vector3(-1.4, 2.0, -5.4), camTarget: new THREE.Vector3(-3.5, 1.3, -7.3) },
		];

		const meshToObject = new Map<THREE.Object3D, any>();
		function getAllMeshes(obj: THREE.Object3D) { const out: THREE.Object3D[] = []; obj.traverse((c: any) => { if (c.isMesh) out.push(c); }); return out; }

		interactiveObjects.forEach(o => getAllMeshes(o.mesh).forEach(m => { allInteractiveMeshes.push(m); meshToObject.set(m, o); }));

		function resolveHit(mesh: THREE.Object3D) {
			const obj = meshToObject.get(mesh);
			if (!obj) return null;
			if (obj.key === 'professor' && !professorGroup.visible) return null;
			return obj;
		}
		function setEmissive(group: THREE.Object3D, color: number, intensity: number) {
			group.traverse((c: any) => { if (!c.isMesh) return; (Array.isArray(c.material) ? c.material : [c.material]).forEach((m: any) => { if (m.emissive) { m.emissive.set(color); m.emissiveIntensity = intensity; } }); });
		}
		function clearEmissive(group: THREE.Object3D) { setEmissive(group, 0x000000, 0); }

		/* ═══════════════════════════════════════════════════════════
		   LIGHTING UPDATE
		═══════════════════════════════════════════════════════════ */
		function updateRoomLighting(now: Date) {
			const h24 = now.getHours() + now.getMinutes() / 60;
			let dayT = h24 < 5 ? 0 : h24 < 7 ? (h24 - 5) / 2 : h24 < 18 ? 1 : h24 < 20 ? 1 - (h24 - 18) / 2 : 0;
			const glowT = (h24 >= 5 && h24 < 8) ? Math.sin(((h24 - 5) / 3) * Math.PI) : (h24 >= 17 && h24 < 20) ? Math.sin(((h24 - 17) / 3) * Math.PI) : 0;

			ambient.color.set(0xc8d0ff);
			if (glowT > 0) ambient.color.lerp(new THREE.Color(0x6b3318), glowT * 0.4);
			ambient.intensity = 2.0;

			dirLight.color.set(0xfff8f0);
			if (glowT > 0) dirLight.color.lerp(new THREE.Color(0xff7722), glowT * 0.7);
			dirLight.intensity = 2.8;

			// Window: deep night → dawn/dusk glow → bright sky
			const nightPane = new THREE.Color(0x020616);
			const dayPane = new THREE.Color(0x9bc8ff);
			const paneColor = nightPane.clone().lerp(dayPane, dayT);
			if (glowT > 0) paneColor.lerp(new THREE.Color(0xff5522), glowT * 0.75);
			const paneEmissiveI = 0.08 + dayT * 1.4 + glowT * 0.6;
			winPaneMats.forEach(m => { m.color.copy(paneColor); m.emissive.copy(paneColor); m.emissiveIntensity = paneEmissiveI; });

			// Moon + stars fade in at night, hide by day
			const nightAlpha = Math.max(0, 1 - dayT * 2.2) * (1 - glowT * 0.8);
			if (winMoonMat) { winMoonMat.opacity = nightAlpha; winMoonMat.emissiveIntensity = 2.4 * nightAlpha; }
			winStarMats.forEach(m => { m.opacity = nightAlpha * 0.9; m.emissiveIntensity = 1.8 * nightAlpha; });

			winLight.color.set(0xaaccff);
			if (glowT > 0) winLight.color.lerp(new THREE.Color(0xff8844), glowT * 0.6);
			if (dayT < 0.2) winLight.color.lerp(new THREE.Color(0x8899cc), 1 - dayT * 5);
			winLight.intensity = 0.45 + dayT * 0.9 + glowT * 0.4;

			fillLeft.color.set(0x88aaff);
			fillLeft.intensity = 1.5;
			fillRight.intensity = 1.4;
			ceilBounce.intensity = 1.3;
			charLight.intensity = 2.0;
			deskGlowBase = 3.1;
			lampLightBase = lampOn ? 7.5 : 0;
			if (ceilPanel.material) (ceilPanel.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.0;

			laptopScreenMats.forEach((m: any) => { m.emissiveIntensity = m._baseIntensity ?? 1.2; });

			updateClock(now.getHours(), now.getMinutes(), dayT);
		}

		/* ═══════════════════════════════════════════════════════════
		   CLOCK TICK
		═══════════════════════════════════════════════════════════ */
		let simTime: Date | null = null;
		(window as any).setSimHour = (h: number, m = 0) => {
			simTime = new Date(2024, 0, 1, h, m, 0);
		};

		function tickScene() {
			const now = simTime ? new Date(simTime) : new Date();
			const h = now.getHours() % 12, m = now.getMinutes(), s = now.getSeconds(), ms = now.getMilliseconds();
			secPivot.rotation.z = -((s + ms / 1000) / 60) * Math.PI * 2;
			minPivot.rotation.z = -((m + (s + ms / 1000) / 60) / 60) * Math.PI * 2;
			hourPivot.rotation.z = -((h + m / 60) / 12) * Math.PI * 2;
			updateRoomLighting(now);
		}

		/* ═══════════════════════════════════════════════════════════
		   RAYCASTING + INTERACTIONS
		═══════════════════════════════════════════════════════════ */
		const raycaster = new THREE.Raycaster();
		const pointer = new THREE.Vector2();
		let lastTouchEndTime = 0;

		function updatePointer(e: MouseEvent | Touch) { pointer.x = (e.clientX / window.innerWidth) * 2 - 1; pointer.y = -(e.clientY / window.innerHeight) * 2 + 1; }

		function animateCamera(toPos: THREE.Vector3, toTarget: THREE.Vector3, onComplete?: () => void) {
			isAnimating = true; controls.enabled = false;
			const fromPos = camera.position.clone(), fromTarget = controls.target.clone();
			const proxy = { t: 0 };
			gsap.to(proxy, { t: 1, duration: 1.45, ease: 'power2.inOut',
				onUpdate() { camera.position.lerpVectors(fromPos, toPos, proxy.t); controls.target.lerpVectors(fromTarget, toTarget, proxy.t); camera.lookAt(controls.target); },
				onComplete() { isAnimating = false; onComplete?.(); }
			});
		}

		function getActiveMesh(obj: any) { return obj.getMesh ? obj.getMesh() : obj.mesh; }

		function activateCharPose() {
			if (charPoseActive || charState !== 'sitting' || !charUpperPivot) return;
			charPoseActive = true;
			charSittingLegs.forEach(m => { m.visible = false; });
			if (charStandingLegsGroup) charStandingLegsGroup.visible = true;
			charLapMeshes.forEach(m => { m.visible = false; });
			if (charSmileMesh) charSmileMesh.visible = true;
			chairGroup.visible = false;
			charUpperPivot.rotation.order = 'YXZ';
			gsap.to(charUpperPivot.rotation, { x: Math.PI / 4, duration: 0.7, ease: 'power2.out' });
		}
		function deactivateCharPose() {
			if (!charPoseActive || !charUpperPivot) return;
			charPoseActive = false;
			if (charSmileMesh) charSmileMesh.visible = false;
			gsap.to(charUpperPivot.rotation, { x: 0, duration: 0.5, ease: 'power2.inOut',
				onComplete() {
					charSittingLegs.forEach(m => { m.visible = true; });
					if (charStandingLegsGroup) charStandingLegsGroup.visible = false;
					charLapMeshes.forEach(m => { m.visible = true; });
					chairGroup.visible = true;
				}
			});
		}

		function focusObject(obj: any) {
			if (hoveredObject) { clearEmissive(getActiveMesh(hoveredObject)); hoveredObject = null; }
			focusedObject = obj;
			setFocus(obj.key);
			const camPos = obj.getCamPos ? obj.getCamPos() : obj.camPos;
			const camTarget = obj.getCamTarget ? obj.getCamTarget() : obj.camTarget;
			animateCamera(camPos, camTarget);
			setTimeout(() => openPanel(obj.key), 320);
			if (obj.key === 'character') activateCharPose();
		}
		focusObjectFn = focusObject;

		function doResetCamera() {
			if (focusedObject) { focusedObject = null; }
			setFocus(null); closePanel(); deactivateCharPose();
			animateCamera(DEFAULT_CAM_POS, DEFAULT_CAM_TARGET, () => { controls.enabled = true; });
		}

		canvasEl.addEventListener('mousemove', (e: MouseEvent) => {
			if (isAnimating || focusedObject) return;
			updatePointer(e); raycaster.setFromCamera(pointer, camera);
			const lampHover = raycaster.intersectObjects(lampMeshes, false);
			if (lampHover.length > 0) { if (hoveredObject) { clearEmissive(getActiveMesh(hoveredObject)); hoveredObject = null; } canvasEl.style.cursor = 'pointer'; return; }
			const hits = raycaster.intersectObjects(allInteractiveMeshes, false);
			const obj = hits.length > 0 ? resolveHit(hits[0].object) : null;
			if (obj) {
				if (obj !== hoveredObject) { if (hoveredObject) clearEmissive(getActiveMesh(hoveredObject)); hoveredObject = obj; setEmissive(getActiveMesh(hoveredObject), 0x9977ff, 0.4); }
				canvasEl.style.cursor = 'pointer';
			} else { if (hoveredObject) { clearEmissive(getActiveMesh(hoveredObject)); hoveredObject = null; } canvasEl.style.cursor = 'default'; }
		});

		window.addEventListener('click', (e: MouseEvent) => {
			if (isAnimating) return;
			if (Date.now() - lastTouchEndTime < 350) return;
			updatePointer(e); raycaster.setFromCamera(pointer, camera);
			const lampHits = raycaster.intersectObjects(lampMeshes, false);
			if (lampHits.length > 0) { import('$lib/stores/scene.svelte.js').then(({ toggleLamp }) => toggleLamp()); return; }
			const hits = raycaster.intersectObjects(allInteractiveMeshes, false);
			if (hits.length > 0) { const obj = resolveHit(hits[0].object); if (obj) { focusObject(obj); return; } }
			if (focusedObject) doResetCamera();
		});

		window.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Escape' && focusedObject) doResetCamera(); });

		window.addEventListener('touchstart', (e: TouchEvent) => {
			if (e.touches.length !== 1) return;
			const t = e.touches[0];
			pointer.x = (t.clientX / window.innerWidth) * 2 - 1; pointer.y = -(t.clientY / window.innerHeight) * 2 + 1;
		}, { passive: true });

		window.addEventListener('touchend', (e: TouchEvent) => {
			lastTouchEndTime = Date.now();
			const t = e.changedTouches[0];
			updatePointer(t); raycaster.setFromCamera(pointer, camera);
			const lampHits = raycaster.intersectObjects(lampMeshes, false);
			if (lampHits.length > 0) { import('$lib/stores/scene.svelte.js').then(({ toggleLamp }) => toggleLamp()); return; }
			const hits = raycaster.intersectObjects(allInteractiveMeshes, false);
			const obj = hits.length > 0 ? resolveHit(hits[0].object) : null;
			if (obj) { focusObject(obj); } else if (focusedObject) { doResetCamera(); }
		}, { passive: true });

		window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

		/* ═══════════════════════════════════════════════════════════
		   RENDER LOOP
		═══════════════════════════════════════════════════════════ */
		const _vProj = new THREE.Vector3();
		function updateLabels(hideDueToFocus: boolean) {
			labelDefs.forEach((def: any) => {
				const el = labelEls[def.key]; if (!el) return;
				if (hideDueToFocus) { el.style.opacity = '0'; return; }
				if (def.isVisible && !def.isVisible()) { el.style.opacity = '0'; return; }
				const srcMesh = def.getMesh ? def.getMesh() : def.mesh;
				const wp = new THREE.Vector3(); srcMesh.getWorldPosition(wp); wp.add(def.offset);
				_vProj.copy(wp).project(camera);
				if (_vProj.z > 1) { el.style.opacity = '0'; return; }
				const x = (_vProj.x * 0.5 + 0.5) * window.innerWidth;
				const y = (-_vProj.y * 0.5 + 0.5) * window.innerHeight;
				el.style.transform = `translate(-50%, -100%) translate(${x}px,${y}px)`; el.style.opacity = '1';
			});
		}

		// Initial lighting pass
		tickScene();

		setProgress(100, 'Ready!');

		// Intro fly-in
		gsap.to(camera.position, { x: DEFAULT_CAM_POS.x, y: DEFAULT_CAM_POS.y, z: DEFAULT_CAM_POS.z, duration: 2.2, ease: 'power3.inOut',
			onUpdate() { camera.lookAt(DEFAULT_CAM_TARGET); },
			onComplete() { controls.enabled = true; }
		});

		let lastTime = 0;
		function animate(time: number) {
			raf = requestAnimationFrame(animate);
			const dt = Math.min((time - lastTime) * 0.001, 0.05); lastTime = time;
			tickScene();
			deskGlowRef.intensity = deskGlowBase + Math.sin(time * 0.0028) * 0.06;
			if (lampOn) lampLightRef.intensity = lampLightBase + Math.sin(time * 0.0031 + 1.2) * 0.08;

			// Particle drift
			const posAttr = particleGeoRef.attributes.position;
			for (let i = 0; i < PARTICLE_COUNT; i++) {
				posAttr.setY(i, posAttr.getY(i) + dt * 0.05);
				if (posAttr.getY(i) > 6.2) posAttr.setY(i, 0.4);
				posAttr.setX(i, posAttr.getX(i) + Math.sin(time * 0.0004 + i) * dt * 0.012);
			}
			posAttr.needsUpdate = true;

			// Character sway at desk
			if (charState === 'sitting') { characterGroupRef.rotation.y = DESK_ROT_Y + Math.sin(time * 0.0009) * 0.035; }

			updateLabels(!!focusedObject);
			controls.update();
			renderer.render(scene, camera);
		}
		animate(0);

		return () => { cancelAnimationFrame(raf); renderer.dispose(); };
	});
</script>

<canvas bind:this={canvasEl} aria-label="Interactive 3D portfolio room — use mouse to orbit, click objects to explore"></canvas>
<div bind:this={labelsEl} class="labels-container" aria-hidden="true"></div>

<style>
	canvas {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		z-index: 0;
	}
	.labels-container {
		position: fixed;
		inset: 0;
		pointer-events: none;
		z-index: 1;
	}
	:global(.scene-label) {
		position: absolute;
		top: 0; left: 0;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 10px;
		background: rgba(0 0 0 / 0.55);
		backdrop-filter: blur(6px);
		border-radius: 20px;
		color: #fff;
		font-size: 13px;
		font-weight: 500;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.25s ease;
		white-space: nowrap;
	}
	:global(.label-emoji) { font-size: 15px; }
</style>
