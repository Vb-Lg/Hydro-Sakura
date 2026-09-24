/*
樱花背景配置。
3D 场景的粒子数量、景深、运动和后处理配色集中在此维护。
*/
export const sakuraConfig = {
	canvasId: 'hydro-sakura-canvas',
	particleCount: 1400,
	area: { x: 16, y: 12, z: 11 },
	depth: { near: -10, range: 21, scale: 36, fade: 20 },
	velocity: {
		base: { x: 0.25, y: -0.45, z: 0.25 },
		variance: { x: 0.2, y: 0.25, z: 0.2 },
		speed: { min: 0.5, range: 0.8 },
	},
	size: { min: 0.7, range: 0.75 },
	rotation: { speed: 2.5 },
	background: {
		deep: new Float32Array([0.005, 0.0, 0.05]),
		glow: new Float32Array([0.42, 0.08, 0.22]),
		center: new Float32Array([0.22, 0.82]),
		strength: 0.42,
		alpha: 0.9,
	},
	petal: {
		deep: new Float32Array([0.86, 0.19, 0.38]),
		light: new Float32Array([1.0, 0.74, 0.82]),
	},
} as const;
