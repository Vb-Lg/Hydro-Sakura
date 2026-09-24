import { sakuraConfig } from './config';

type Particle = {
	x: number;
	y: number;
	z: number;
	velocityX: number;
	velocityY: number;
	velocityZ: number;
	rotation: number;
	rotationSpeed: number;
	size: number;
};

type Locations = Record<string, number>;

const backgroundVertex = `
	attribute vec2 aPosition;
	varying vec2 vUv;
	void main() {
		vUv = aPosition * 0.5 + 0.5;
		gl_Position = vec4(aPosition, 0.0, 1.0);
	}
`;

const backgroundFragment = `
	precision highp float;
	uniform vec3 uDeep;
	uniform vec3 uGlow;
	uniform vec2 uCenter;
	uniform float uStrength;
	uniform float uAlpha;
	varying vec2 vUv;
	void main() {
		vec2 offset = vUv - uCenter;
		vec2 shaped = offset * vec2(0.8, 1.15);
		float glow = exp(-dot(shaped, shaped) * 3.2);
		vec3 color = mix(uDeep, uGlow, glow * uStrength);
		color += vec3(0.03, 0.0, 0.04) * (1.0 - vUv.y);
		gl_FragColor = vec4(color, uAlpha);
	}
`;

const petalVertex = `
	precision highp float;
	attribute vec3 aPosition;
	attribute float aSize;
	attribute float aRotation;
	uniform vec2 uResolution;
	uniform vec3 uDepth;
	varying float vDepth;
	varying float vRotation;
	void main() {
		float depth = max(1.0, aPosition.z - uDepth.x + uDepth.y);
		vec2 projected = aPosition.xy * uDepth.y / depth;
		gl_Position = vec4(projected.x / (uResolution.x / uResolution.y), projected.y, 0.0, 1.0);
		gl_PointSize = aSize * (uResolution.y / depth) * 0.95;
		vDepth = clamp((depth - uDepth.x) / uDepth.z, 0.0, 1.0);
		vRotation = aRotation;
	}
`;

const petalFragment = `
	precision highp float;
	uniform vec3 uPetalDeep;
	uniform vec3 uPetalLight;
	varying float vDepth;
	varying float vRotation;
	void main() {
		vec2 point = gl_PointCoord - 0.5;
		float sine = sin(vRotation);
		float cosine = cos(vRotation);
		vec2 rotated = vec2(point.x * cosine - point.y * sine, point.x * sine + point.y * cosine);
		vec2 petal = rotated * vec2(1.0, 1.55);
		float edge = length(petal);
		float notch = smoothstep(0.04, 0.0, length(petal - vec2(0.0, -0.34)));
		float alpha = smoothstep(0.54, 0.22, edge) * (1.0 - notch * 0.55) * (0.25 + vDepth * 0.75);
		if (alpha < 0.01) discard;
		gl_FragColor = vec4(mix(uPetalDeep, uPetalLight, vDepth), alpha);
	}
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) throw new Error('Unable to create WebGL shader.');
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const message = gl.getShaderInfoLog(shader) || 'Unknown shader error.';
		gl.deleteShader(shader);
		throw new Error(message);
	}
	return shader;
}

function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
	const program = gl.createProgram();
	if (!program) throw new Error('Unable to create WebGL program.');
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
	const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	gl.deleteShader(vertexShader);
	gl.deleteShader(fragmentShader);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const message = gl.getProgramInfoLog(program) || 'Unknown program error.';
		gl.deleteProgram(program);
		throw new Error(message);
	}
	return program;
}

function getUniforms(gl: WebGLRenderingContext, program: WebGLProgram, names: string[]): Locations {
	const uniforms: Locations = {};
	for (const name of names) {
		const location = gl.getUniformLocation(program, name);
		if (location) uniforms[name] = location as unknown as number;
	}
	return uniforms;
}

function getAttributes(gl: WebGLRenderingContext, program: WebGLProgram, names: string[]): Locations {
	const attributes: Locations = {};
	for (const name of names) {
		attributes[name] = gl.getAttribLocation(program, name);
	}
	return attributes;
}

function randomSigned(): number {
	return Math.random() * 2 - 1;
}

export class SakuraRenderer {
	private readonly canvas: HTMLCanvasElement;
	private readonly gl: WebGLRenderingContext;
	private readonly backgroundProgram: WebGLProgram;
	private readonly petalProgram: WebGLProgram;
	private readonly quadBuffer: WebGLBuffer;
	private readonly particleBuffer: WebGLBuffer;
	private readonly backgroundUniforms: Locations;
	private readonly backgroundAttributes: Locations;
	private readonly petalUniforms: Locations;
	private readonly petalAttributes: Locations;
	private readonly particles: Particle[] = [];
	private readonly particleData: Float32Array;
	private animationFrame = 0;
	private previousTime = 0;
	private running = false;
	private resizeQueued = false;
	private readonly resizeObserver: ResizeObserver;
	private readonly handleResize = (): void => this.queueResize();
	private readonly handleVisibilityChange = (): void => {
		if (document.hidden) this.stop();
		else this.start();
	};

	constructor(canvas: HTMLCanvasElement) {
		const gl = canvas.getContext('webgl', {
			alpha: true,
			antialias: true,
			depth: true,
			powerPreference: 'high-performance',
		});
		if (!gl) throw new Error('WebGL is not supported.');

		this.canvas = canvas;
		this.gl = gl;
		this.backgroundProgram = createProgram(gl, backgroundVertex, backgroundFragment);
		this.petalProgram = createProgram(gl, petalVertex, petalFragment);
		this.backgroundUniforms = getUniforms(gl, this.backgroundProgram, [
			'uDeep',
			'uGlow',
			'uCenter',
			'uStrength',
			'uAlpha',
		]);
		this.backgroundAttributes = getAttributes(gl, this.backgroundProgram, ['aPosition']);
		this.petalUniforms = getUniforms(gl, this.petalProgram, [
			'uResolution',
			'uDepth',
			'uPetalDeep',
			'uPetalLight',
		]);
		this.petalAttributes = getAttributes(gl, this.petalProgram, ['aPosition', 'aSize', 'aRotation']);
		const quadBuffer = gl.createBuffer();
		const particleBuffer = gl.createBuffer();
		if (!quadBuffer || !particleBuffer) throw new Error('Unable to create WebGL buffers.');
		this.quadBuffer = quadBuffer;
		this.particleBuffer = particleBuffer;
		this.particleData = new Float32Array(sakuraConfig.particleCount * 5);
		this.resizeObserver = new ResizeObserver(() => this.queueResize());
		this.createParticles();
	}

	init(): void {
		const { gl } = this;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.particleData.byteLength, gl.DYNAMIC_DRAW);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LEQUAL);
		window.addEventListener('resize', this.handleResize, { passive: true });
		document.addEventListener('visibilitychange', this.handleVisibilityChange);
		this.resizeObserver.observe(this.canvas);
		this.resize();
		this.start();
	}

	start(): void {
		if (this.running || document.hidden) return;
		this.running = true;
		this.previousTime = performance.now();
		this.animationFrame = requestAnimationFrame((time) => this.animate(time));
	}

	stop(): void {
		if (!this.running) return;
		this.running = false;
		cancelAnimationFrame(this.animationFrame);
	}

	dispose(): void {
		this.stop();
		window.removeEventListener('resize', this.handleResize);
		document.removeEventListener('visibilitychange', this.handleVisibilityChange);
		this.resizeObserver.disconnect();
		this.gl.deleteBuffer(this.quadBuffer);
		this.gl.deleteBuffer(this.particleBuffer);
		this.gl.deleteProgram(this.backgroundProgram);
		this.gl.deleteProgram(this.petalProgram);
	}

	private createParticles(): void {
		const { area, depth, velocity, size, rotation } = sakuraConfig;
		for (let index = 0; index < sakuraConfig.particleCount; index += 1) {
			const directionX = randomSigned() * velocity.variance.x + velocity.base.x;
			const directionY = randomSigned() * velocity.variance.y + velocity.base.y;
			const directionZ = randomSigned() * velocity.variance.z + velocity.base.z;
			const length = Math.hypot(directionX, directionY, directionZ) || 1;
			const speed = velocity.speed.min + Math.random() * velocity.speed.range;
			this.particles.push({
				x: randomSigned() * area.x,
				y: randomSigned() * area.y,
				z: depth.near + Math.random() * depth.range,
				velocityX: (directionX / length) * speed,
				velocityY: (directionY / length) * speed,
				velocityZ: (directionZ / length) * speed,
				rotation: Math.random() * Math.PI * 2,
				rotationSpeed: randomSigned() * rotation.speed,
				size: size.min + Math.random() * size.range,
			});
		}
	}

	private animate(time: number): void {
		if (!this.running) return;
		const delta = Math.min((time - this.previousTime) / 1000, 0.05);
		this.previousTime = time;
		this.update(delta);
		this.render();
		this.animationFrame = requestAnimationFrame((nextTime) => this.animate(nextTime));
	}

	private update(delta: number): void {
		const { area } = sakuraConfig;
		for (const particle of this.particles) {
			particle.x += particle.velocityX * delta;
			particle.y += particle.velocityY * delta;
			particle.z += particle.velocityZ * delta;
			particle.rotation += particle.rotationSpeed * delta;
			if (particle.x > area.x) particle.x = -area.x;
			if (particle.y < -area.y) particle.y = area.y;
			if (particle.z > area.z) particle.z = -area.z;
		}
	}

	private render(): void {
		const { gl } = this;
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		this.renderBackground();
		this.renderParticles();
	}

	private renderBackground(): void {
		const { gl } = this;
		const { background } = sakuraConfig;
		gl.disable(gl.DEPTH_TEST);
		gl.useProgram(this.backgroundProgram);
		gl.uniform3fv(this.backgroundUniforms.uDeep, background.deep);
		gl.uniform3fv(this.backgroundUniforms.uGlow, background.glow);
		gl.uniform2fv(this.backgroundUniforms.uCenter, background.center);
		gl.uniform1f(this.backgroundUniforms.uStrength, background.strength);
		gl.uniform1f(this.backgroundUniforms.uAlpha, background.alpha);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
		const position = this.backgroundAttributes.aPosition;
		gl.enableVertexAttribArray(position);
		gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		gl.disableVertexAttribArray(position);
	}

	private renderParticles(): void {
		const { gl } = this;
		const { depth, petal } = sakuraConfig;
		gl.enable(gl.DEPTH_TEST);
		gl.useProgram(this.petalProgram);
		gl.uniform2f(this.petalUniforms.uResolution, this.canvas.width, this.canvas.height);
		gl.uniform3f(this.petalUniforms.uDepth, depth.near, depth.scale, depth.fade);
		gl.uniform3fv(this.petalUniforms.uPetalDeep, petal.deep);
		gl.uniform3fv(this.petalUniforms.uPetalLight, petal.light);
		for (let index = 0; index < this.particles.length; index += 1) {
			const particle = this.particles[index];
			const offset = index * 5;
			this.particleData[offset] = particle.x;
			this.particleData[offset + 1] = particle.y;
			this.particleData[offset + 2] = particle.z;
			this.particleData[offset + 3] = particle.size;
			this.particleData[offset + 4] = particle.rotation;
		}
		gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.particleData);
		const { aPosition, aSize, aRotation } = this.petalAttributes;
		gl.enableVertexAttribArray(aPosition);
		gl.enableVertexAttribArray(aSize);
		gl.enableVertexAttribArray(aRotation);
		gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 20, 0);
		gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, 20, 12);
		gl.vertexAttribPointer(aRotation, 1, gl.FLOAT, false, 20, 16);
		gl.drawArrays(gl.POINTS, 0, this.particles.length);
		gl.disableVertexAttribArray(aPosition);
		gl.disableVertexAttribArray(aSize);
		gl.disableVertexAttribArray(aRotation);
	}

	private resize(): void {
		const bounds = this.canvas.getBoundingClientRect();
		const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
		const width = Math.max(1, Math.floor((bounds.width || window.innerWidth) * pixelRatio));
		const height = Math.max(1, Math.floor((bounds.height || window.innerHeight) * pixelRatio));
		if (this.canvas.width === width && this.canvas.height === height) return;
		this.canvas.width = width;
		this.canvas.height = height;
		this.gl.viewport(0, 0, width, height);
	}

	private queueResize(): void {
		if (this.resizeQueued) return;
		this.resizeQueued = true;
		requestAnimationFrame(() => {
			this.resizeQueued = false;
			this.resize();
		});
	}
}

export function createSakuraRenderer(canvas: HTMLCanvasElement): SakuraRenderer {
	const renderer = new SakuraRenderer(canvas);
	renderer.init();
	return renderer;
}
