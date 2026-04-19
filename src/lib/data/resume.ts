// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResumeLink {
	label: string;
	url: string;
	type: 'primary' | 'secondary';
}

export interface ResumeAbout {
	name: string;
	role: string;
	bio: string;
	facts: string[];
	links: ResumeLink[];
}

export interface ResumeProject {
	name: string;
	desc: string;
	tech: string[];
	url?: string;
}

export interface ResumeSkills {
	frontend: string[];
	backend: string[];
	tools: string[];
}

export interface ResumeContact {
	email: string;
	github: string;
	linkedin: string;
	twitter: string;
	location: string;
	available: boolean;
}

export interface ResumeProfessor {
	name: string;
	title: string;
	university: string;
	department: string;
	lab: string;
	research: string;
	email?: string;
	website?: string;
}

export interface ResumeData {
	about: ResumeAbout;
	projects: ResumeProject[];
	skills: ResumeSkills;
	contact: ResumeContact;
	professor: ResumeProfessor;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
// Edit this file to update your portfolio content.
// The 3D scene reads from this same source, so changes here update both the
// interactive room labels AND the SEO-friendly HTML fallback pages.

export const resume: ResumeData = {
	about: {
		name: 'Sunghee Choi',
		role: 'Lab Automation & Full-Stack Developer',
		bio: 'Chemistry researcher turned full-stack developer. My path: pharmaceutical engineering → research assistant at SK Biopharm → MS at Sogang, where I now build web-based control systems (Vue.js, FastAPI, Raspberry Pi) for automated LC–MS sample preparation. Wet-lab instincts, shipped as software.',
		facts: [
			'MS Chemistry · Sogang Univ. · GPA 4.11',
			'Research Assistant · SK Biopharm · 2023.07 – 2024.06',
			'BS Pharmaceutical Eng. · Mokwon Univ. · GPA 3.62 / 4.5',
			'KSMS 2025 · First author',
			'Open-source contributor'
		],
		links: [
			{ label: 'GitHub', url: 'https://github.com/sunghee-sketch', type: 'primary' },
			{ label: 'KSMS 2025 Poster', url: '#', type: 'secondary' },
			{ label: 'Resume PDF', url: '#', type: 'secondary' }
		]
	},

	projects: [
		{
			name: 'NovaDash',
			desc: 'Real-time analytics dashboard with WebSocket streaming, D3 charts, and drag-and-drop layout builder.',
			tech: ['React', 'Node.js', 'WebSocket', 'D3']
		},
		{
			name: 'ArcAPI',
			desc: 'Type-safe REST & GraphQL gateway with auto-generated docs, rate-limiting, and OAuth2.',
			tech: ['TypeScript', 'GraphQL', 'PostgreSQL', 'Redis']
		},
		{
			name: 'ShiftCMS',
			desc: 'Headless CMS with live preview, multi-locale support, and a visual block editor.',
			tech: ['Next.js', 'Prisma', 'tRPC', 'S3']
		},
		{
			name: 'LumaUI',
			desc: 'Accessible component library (WCAG 2.1 AA) with zero-runtime CSS and Storybook docs.',
			tech: ['React', 'Radix UI', 'Vanilla Extract']
		}
	],

	skills: {
		frontend: ['React / Next.js', 'TypeScript', 'Three.js / WebGL', 'Tailwind CSS', 'Framer Motion', 'Vite'],
		backend: ['Node.js / Bun', 'PostgreSQL', 'Redis', 'GraphQL', 'Prisma', 'Docker'],
		tools: ['Git / GitHub', 'Figma', 'Vercel / AWS', 'Playwright', 'Storybook', 'CI/CD']
	},

	contact: {
		email: 'csh5145@gmail.com',
		github: 'https://github.com/sunghee-sketch',
		linkedin: 'linkedin.com/in/alexmorgan',
		twitter: '@sunghee_dev',
		location: 'Seoul, South Korea',
		available: true
	},

	professor: {
		name: 'Prof. Han bin Oh',
		title: 'MS Advisor',
		university: 'Sogang University',
		department: 'Department of Chemistry',
		lab: 'Natural Product Mass Spectrometry Lab',
		research: 'HPLC / LC–MS analysis of natural products, automated sample preparation workflows.',
		email: 'advisor@sogang.ac.kr',
		website: '#'
	}
};
