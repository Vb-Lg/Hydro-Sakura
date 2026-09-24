/*
樱花背景配置。
3D 场景的粒子数量、相机、景深和配色集中在此维护，调整效果只需要改这个文件。
*/
export const sakuraConfig = {
	canvasId: 'hydro-sakura-canvas',
	particleCount: 1400,
	/* 花瓣垂直分布范围（世界单位）；水平范围由它乘以视口宽高比推导，保证宽屏两侧也被铺满 */
	area: { y: 12 },
	/* 花瓣沿 Z 轴的活动范围，数值越大离相机越近 */
	zRange: { min: -14, max: 2 },
	/* 相机：distance 决定透视强度，coverage 决定画面被花瓣填充的比例 */
	camera: { distance: 34, coverage: 1.05 },
	velocity: {
		base: { x: 0.25, y: -0.45, z: 0.25 },
		variance: { x: 0.2, y: 0.25, z: 0.2 },
		speed: { min: 0.5, range: 0.8 },
	},
	petal: {
		size: { min: 0.7, range: 0.75 },
		sizeScale: 0.46,
		rotationSpeed: 2.5,
		deep: new Float32Array([0.86, 0.19, 0.38]),
		light: new Float32Array([1.0, 0.74, 0.82]),
	},
	background: {
		deep: new Float32Array([0.005, 0.0, 0.05]),
		glow: new Float32Array([0.42, 0.08, 0.22]),
		center: new Float32Array([0.22, 0.82]),
		strength: 0.42,
	},
} as const;
