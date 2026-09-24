export const sakuraConfig = {
	canvasId: 'hydro-sakura-canvas',
	particleCount: 900,
	particleArea: { x: 24, y: 18, z: 12 },
	particleSpeed: { min: 0.8, range: 0.8 },
	particleSize: { min: 8, range: 10 },
	background: [0.012, 0.006, 0.018, 0.92] as const,
} as const;
