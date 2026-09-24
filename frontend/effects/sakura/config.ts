/*
樱花背景配置。

参数与 vblg.top 首页保持一致，因此两处看到的画面是同一套效果；
调整这里可以改变花瓣数量、运动、景深模糊和后处理强度。
*/
export const sakuraConfig = {
	canvasId: 'hydro-sakura-canvas',
	contextAttributes: {
		alpha: false,
		antialias: true,
		depth: true,
		powerPreference: 'high-performance',
	},
	/* 设备像素比上限，2 已经足够清晰，再高只是白烧 GPU */
	pixelRatioCap: 2,
	projection: {
		far: 100.0,
		near: 0.1,
	},
	camera: {
		/* 景深：x 为清晰距离，y 为清晰半径，z 为模糊过渡宽度 */
		dof: { x: 10.0, y: 4.0, z: 8.0 },
		lookAt: { x: 0.0, y: 0.0, z: 0.0 },
		position: { x: 0.0, y: 0.0, z: 100.0 },
		up: { x: 0.0, y: 1.0, z: 0.0 },
	},
	particle: {
		/* 花瓣活动区域，x 由 y 乘以视口宽高比推导 */
		area: { y: 20.0, z: 20.0 },
		count: 1600,
		fade: {
			/* 距离淡出的半衰距离，越大花瓣能在越远的地方保持可见 */
			halfDistance: 10.0,
			/* 太靠近相机的花瓣淡出，避免出现巨大的糊脸花瓣 */
			nearStart: 0.1,
			/* 淡出起点 */
			start: 10.0,
		},
		rotationRange: Math.PI * 2.0 * 0.5,
		size: { min: 0.9, range: 0.1 },
		velocity: {
			base: { x: 0.8, y: -1.0, z: 0.5 },
			variance: { x: 0.3, y: 0.2, z: 0.3 },
			speed: { min: 2.0, range: 1.0 },
		},
	},
	postProcess: {
		blurIterations: 2,
		directionPassBase: 1.5,
		directionPassStep: 1.0,
		strideBase: 2.0,
		strideStep: 1.0,
	},
	render: {
		clearColor: new Float32Array([0.005, 0.0, 0.05, 0.0]),
		framebufferClearColor: new Float32Array([0.0, 0.0, 0.0, 0.0]),
		/* 背景亮度倍率。0.5 与 vblg.top 首页完全一致；
		   OJ 页面内容较密，调到 0.3~0.4 可弱化亮部以便阅读。 */
		backgroundIntensity: 0.5,
	},
} as const;
