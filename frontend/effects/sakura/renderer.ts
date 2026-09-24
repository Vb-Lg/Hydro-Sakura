import { sakuraConfig } from './config';

/*
着色器源码移植自 vblg.top 首页的樱花效果，视觉参数未作改动。
分成「背景」「花瓣」「后处理」三组，便于对照排查。
*/

const commonVertex = `
uniform vec3 uResolution;
attribute vec2 aPosition;

varying vec2 texCoord;
varying vec2 screenCoord;

void main(void) {
    gl_Position = vec4(aPosition, 0.0, 1.0);
    texCoord = aPosition.xy * 0.5 + vec2(0.5, 0.5);
    screenCoord = aPosition.xy * vec2(uResolution.z, 1.0);
}
`;

const backgroundFragment = `
#ifdef GL_ES
precision highp float;
#endif

uniform vec2 uTimes;
uniform float uIntensity;

varying vec2 texCoord;
varying vec2 screenCoord;

void main(void) {
    vec3 col;
    float c;
    vec2 tmpv = texCoord * vec2(0.8, 1.0) - vec2(0.95, 1.0);
    c = exp(-pow(length(tmpv) * 1.8, 2.0));
    col = mix(vec3(0.02, 0.0, 0.03), vec3(0.96, 0.98, 1.0) * 1.5, c);
    gl_FragColor = vec4(col * uIntensity, 1.0);
}
`;

const brightBufferFragment = `
#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D uSrc;
uniform vec2 uDelta;

varying vec2 texCoord;
varying vec2 screenCoord;

void main(void) {
    vec4 col = texture2D(uSrc, texCoord);
    gl_FragColor = vec4(col.rgb * 2.0 - vec3(0.5), 1.0);
}
`;

const directionalBlurFragment = `
#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D uSrc;
uniform vec2 uDelta;
uniform vec4 uBlurDir;

varying vec2 texCoord;
varying vec2 screenCoord;

void main(void) {
    vec4 col = texture2D(uSrc, texCoord);
    col = col + texture2D(uSrc, texCoord + uBlurDir.xy * uDelta);
    col = col + texture2D(uSrc, texCoord - uBlurDir.xy * uDelta);
    col = col + texture2D(uSrc, texCoord + (uBlurDir.xy + uBlurDir.zw) * uDelta);
    col = col + texture2D(uSrc, texCoord - (uBlurDir.xy + uBlurDir.zw) * uDelta);
    gl_FragColor = col / 5.0;
}
`;

const finalCompositeVertex = `
uniform vec3 uResolution;
attribute vec2 aPosition;

varying vec2 texCoord;
varying vec2 screenCoord;

void main(void) {
    gl_Position = vec4(aPosition, 0.0, 1.0);
    texCoord = aPosition.xy * 0.5 + vec2(0.5, 0.5);
    screenCoord = aPosition.xy * vec2(uResolution.z, 1.0);
}
`;

const finalCompositeFragment = `
#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D uSrc;
uniform sampler2D uBloom;
uniform vec2 uDelta;

varying vec2 texCoord;
varying vec2 screenCoord;

void main(void) {
    vec4 srccol = texture2D(uSrc, texCoord) * 2.0;
    vec4 bloomcol = texture2D(uBloom, texCoord);
    vec4 col;
    col = srccol + bloomcol * (vec4(1.0) + srccol);
    col *= smoothstep(1.0, 0.0, pow(length((texCoord - vec2(0.5)) * 2.0), 1.2) * 0.5);
    col = pow(col, vec4(0.45454545454545));

    gl_FragColor = vec4(col.rgb, 1.0);
    gl_FragColor.a = 1.0;
}
`;

const pointVertex = `
uniform mat4 uProjection;
uniform mat4 uModelview;
uniform vec3 uResolution;
uniform vec3 uOffset;
uniform vec3 uDOF;
uniform vec3 uFade;

attribute vec3 aPosition;
attribute vec3 aEuler;
attribute vec2 aMisc;

varying vec3 pposition;
varying float psize;
varying float palpha;
varying float pdist;

varying vec3 normX;
varying vec3 normY;
varying vec3 normZ;
varying vec3 normal;

varying float diffuse;
varying float specular;
varying float rstop;
varying float distancefade;

void main(void) {
    vec4 pos = uModelview * vec4(aPosition + uOffset, 1.0);
    gl_Position = uProjection * pos;
    gl_PointSize = aMisc.x * uProjection[1][1] / -pos.z * uResolution.y * 0.5;

    pposition = pos.xyz;
    psize = aMisc.x;
    pdist = length(pos.xyz);
    palpha = smoothstep(0.0, 1.0, (pdist - 0.1) / uFade.z);

    vec3 elrsn = sin(aEuler);
    vec3 elrcs = cos(aEuler);
    mat3 rotx = mat3(
        1.0, 0.0, 0.0,
        0.0, elrcs.x, elrsn.x,
        0.0, -elrsn.x, elrcs.x
    );
    mat3 roty = mat3(
        elrcs.y, 0.0, -elrsn.y,
        0.0, 1.0, 0.0,
        elrsn.y, 0.0, elrcs.y
    );
    mat3 rotz = mat3(
        elrcs.z, elrsn.z, 0.0,
        -elrsn.z, elrcs.z, 0.0,
        0.0, 0.0, 1.0
    );
    mat3 rotmat = rotx * roty * rotz;
    normal = rotmat[2];

    mat3 trrotm = mat3(
        rotmat[0][0], rotmat[1][0], rotmat[2][0],
        rotmat[0][1], rotmat[1][1], rotmat[2][1],
        rotmat[0][2], rotmat[1][2], rotmat[2][2]
    );
    normX = trrotm[0];
    normY = trrotm[1];
    normZ = trrotm[2];

    const vec3 lit = vec3(0.6917144638660746, 0.6917144638660746, -0.20751433915982237);

    float tmpdfs = dot(lit, normal);
    if(tmpdfs < 0.0) {
        normal = -normal;
        tmpdfs = dot(lit, normal);
    }
    diffuse = 0.4 + tmpdfs;

    vec3 eyev = normalize(-pos.xyz);
    if(dot(eyev, normal) > 0.0) {
        vec3 hv = normalize(eyev + lit);
        specular = pow(max(dot(hv, normal), 0.0), 20.0);
    }
    else {
        specular = 0.0;
    }

    rstop = clamp((abs(pdist - uDOF.x) - uDOF.y) / uDOF.z, 0.0, 1.0);
    rstop = pow(rstop, 0.5);
    distancefade = min(1.0, exp((uFade.x - pdist) * 0.69315 / uFade.y));
}
`;

const pointFragment = `
#ifdef GL_ES
precision highp float;
#endif

uniform vec3 uDOF;
uniform vec3 uFade;

const vec3 fadeCol = vec3(0.08, 0.03, 0.06);

varying vec3 pposition;
varying float psize;
varying float palpha;
varying float pdist;

varying vec3 normX;
varying vec3 normY;
varying vec3 normZ;
varying vec3 normal;

varying float diffuse;
varying float specular;
varying float rstop;
varying float distancefade;

float ellipse(vec2 p, vec2 o, vec2 r) {
    vec2 lp = (p - o) / r;
    return length(lp) - 1.0;
}

void main(void) {
    vec3 p = vec3(gl_PointCoord - vec2(0.5, 0.5), 0.0) * 2.0;
    vec3 d = vec3(0.0, 0.0, -1.0);
    float nd = normZ.z;
    if(abs(nd) < 0.0001) discard;

    float np = dot(normZ, p);
    vec3 tp = p + d * np / nd;
    vec2 coord = vec2(dot(normX, tp), dot(normY, tp));

    const float flwrsn = 0.258819045102521;
    const float flwrcs = 0.965925826289068;
    mat2 flwrm = mat2(flwrcs, -flwrsn, flwrsn, flwrcs);
    vec2 flwrp = vec2(abs(coord.x), coord.y) * flwrm;

    float r;
    if(flwrp.x < 0.0) {
        r = ellipse(flwrp, vec2(0.065, 0.024) * 0.5, vec2(0.36, 0.96) * 0.5);
    }
    else {
        r = ellipse(flwrp, vec2(0.065, 0.024) * 0.5, vec2(0.58, 0.96) * 0.5);
    }

    if(r > rstop) discard;

    vec3 col = mix(vec3(1.0, 0.8, 0.75), vec3(1.0, 0.9, 0.87), r);
    float grady = mix(0.0, 1.0, pow(coord.y * 0.5 + 0.5, 0.35));
    col *= vec3(1.0, grady, grady);
    col *= mix(0.8, 1.0, pow(abs(coord.x), 0.3));
    col = col * diffuse + specular;

    col = mix(fadeCol, col, distancefade);

    float alpha = (rstop > 0.001)? (0.5 - r / (rstop * 2.0)) : 1.0;
    alpha = smoothstep(0.0, 1.0, alpha) * palpha;

    gl_FragColor = vec4(col * 0.5, alpha);
}
`;

/* ---------------------------------- 数学 ---------------------------------- */

type Vector3 = { x: number; y: number; z: number; array: Float32Array };

function createVector3(x: number, y: number, z: number): Vector3 {
	return { x, y, z, array: new Float32Array([x, y, z]) };
}

function syncVector(vector: Vector3): Float32Array {
	vector.array[0] = vector.x;
	vector.array[1] = vector.y;
	vector.array[2] = vector.z;
	return vector.array;
}

function setVector(vector: Vector3, x: number, y: number, z: number): Float32Array {
	vector.x = x;
	vector.y = y;
	vector.z = z;
	return syncVector(vector);
}

function normalizeVector(vector: Vector3): void {
	let length = vector.x * vector.x + vector.y * vector.y + vector.z * vector.z;
	if (length > 0.00001) {
		length = 1.0 / Math.sqrt(length);
		vector.x *= length;
		vector.y *= length;
		vector.z *= length;
		syncVector(vector);
	}
}

const frontVector = createVector3(0, 0, 0);
const sideVector = createVector3(0, 0, 0);
const topVector = createVector3(0, 0, 0);

function loadLookAt(matrix: Float32Array, position: Vector3, lookAt: Vector3, up: Vector3): void {
	setVector(frontVector, position.x - lookAt.x, position.y - lookAt.y, position.z - lookAt.z);
	normalizeVector(frontVector);

	sideVector.x = up.y * frontVector.z - up.z * frontVector.y;
	sideVector.y = up.z * frontVector.x - up.x * frontVector.z;
	sideVector.z = up.x * frontVector.y - up.y * frontVector.x;
	normalizeVector(sideVector);

	topVector.x = frontVector.y * sideVector.z - frontVector.z * sideVector.y;
	topVector.y = frontVector.z * sideVector.x - frontVector.x * sideVector.z;
	topVector.z = frontVector.x * sideVector.y - frontVector.y * sideVector.x;
	normalizeVector(topVector);

	matrix[0] = sideVector.x;
	matrix[1] = topVector.x;
	matrix[2] = frontVector.x;
	matrix[3] = 0.0;

	matrix[4] = sideVector.y;
	matrix[5] = topVector.y;
	matrix[6] = frontVector.y;
	matrix[7] = 0.0;

	matrix[8] = sideVector.z;
	matrix[9] = topVector.z;
	matrix[10] = frontVector.z;
	matrix[11] = 0.0;

	matrix[12] = -(position.x * matrix[0] + position.y * matrix[4] + position.z * matrix[8]);
	matrix[13] = -(position.x * matrix[1] + position.y * matrix[5] + position.z * matrix[9]);
	matrix[14] = -(position.x * matrix[2] + position.y * matrix[6] + position.z * matrix[10]);
	matrix[15] = 1.0;
}

function loadProjection(
	matrix: Float32Array,
	aspect: number,
	viewAngle: number,
	nearPlane: number,
	farPlane: number,
): void {
	const height = nearPlane * Math.tan(((viewAngle * Math.PI) / 180.0) * 0.5) * 2.0;
	const width = height * aspect;

	matrix[0] = (2.0 * nearPlane) / width;
	matrix[1] = 0.0;
	matrix[2] = 0.0;
	matrix[3] = 0.0;

	matrix[4] = 0.0;
	matrix[5] = (2.0 * nearPlane) / height;
	matrix[6] = 0.0;
	matrix[7] = 0.0;

	matrix[8] = 0.0;
	matrix[9] = 0.0;
	matrix[10] = -(farPlane + nearPlane) / (farPlane - nearPlane);
	matrix[11] = -1.0;

	matrix[12] = 0.0;
	matrix[13] = 0.0;
	matrix[14] = (-2.0 * farPlane * nearPlane) / (farPlane - nearPlane);
	matrix[15] = 0.0;
}

/* -------------------------------- WebGL 工具 -------------------------------- */

type Uniforms = Record<string, WebGLUniformLocation | null>;
type Attributes = Record<string, number>;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
	const shader = gl.createShader(type);
	if (!shader) return null;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error('[hydro-sakura-theme]', gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}
	return shader;
}

type Program = {
	handle: WebGLProgram;
	attributeList: number[];
	attributes: Attributes;
	uniforms: Uniforms;
};

function createProgram(
	gl: WebGLRenderingContext,
	vertexSource: string,
	fragmentSource: string,
	uniformNames: string[],
	attributeNames: string[],
): Program | null {
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
	const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
	if (!vertexShader || !fragmentShader) return null;

	const handle = gl.createProgram();
	if (!handle) return null;
	gl.attachShader(handle, vertexShader);
	gl.attachShader(handle, fragmentShader);
	gl.deleteShader(vertexShader);
	gl.deleteShader(fragmentShader);
	gl.linkProgram(handle);

	if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) {
		console.error('[hydro-sakura-theme]', gl.getProgramInfoLog(handle));
		gl.deleteProgram(handle);
		return null;
	}

	const program: Program = { handle, attributeList: [], attributes: {}, uniforms: {} };
	for (const name of uniformNames) program.uniforms[name] = gl.getUniformLocation(handle, name);
	for (const name of attributeNames) {
		const location = gl.getAttribLocation(handle, name);
		program.attributes[name] = location;
		if (location >= 0) program.attributeList.push(location);
	}
	return program;
}

function deleteProgram(gl: WebGLRenderingContext, program: Program | null): void {
	if (program) gl.deleteProgram(program.handle);
}

type RenderTarget = {
	dtxArray: Float32Array;
	frameBuffer: WebGLFramebuffer;
	height: number;
	renderBuffer: WebGLRenderbuffer;
	sizeArray: Float32Array;
	texture: WebGLTexture;
	width: number;
};

function createRenderTarget(gl: WebGLRenderingContext, width: number, height: number): RenderTarget {
	const target: RenderTarget = {
		dtxArray: new Float32Array([1.0 / width, 1.0 / height]),
		frameBuffer: gl.createFramebuffer() as WebGLFramebuffer,
		height,
		renderBuffer: gl.createRenderbuffer() as WebGLRenderbuffer,
		sizeArray: new Float32Array([width, height, width / height]),
		texture: gl.createTexture() as WebGLTexture,
		width,
	};

	gl.bindTexture(gl.TEXTURE_2D, target.texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

	gl.bindFramebuffer(gl.FRAMEBUFFER, target.frameBuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.texture, 0);

	gl.bindRenderbuffer(gl.RENDERBUFFER, target.renderBuffer);
	gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
	gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, target.renderBuffer);

	gl.bindTexture(gl.TEXTURE_2D, null);
	gl.bindRenderbuffer(gl.RENDERBUFFER, null);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	return target;
}

function deleteRenderTarget(gl: WebGLRenderingContext, target: RenderTarget | null): void {
	if (!target) return;
	gl.deleteFramebuffer(target.frameBuffer);
	gl.deleteRenderbuffer(target.renderBuffer);
	gl.deleteTexture(target.texture);
}

function useProgram(gl: WebGLRenderingContext, program: Program): void {
	gl.useProgram(program.handle);
	for (const location of program.attributeList) gl.enableVertexAttribArray(location);
}

function unuseProgram(gl: WebGLRenderingContext, program: Program): void {
	for (const location of program.attributeList) gl.disableVertexAttribArray(location);
	gl.useProgram(null);
}

/* --------------------------------- 花瓣数据 --------------------------------- */

class BlossomParticle {
	alpha = 1.0;
	eulerX = 0.0;
	eulerY = 0.0;
	eulerZ = 0.0;
	positionX = 0.0;
	positionY = 0.0;
	positionZ = 0.0;
	rotationX = 0.0;
	rotationY = 0.0;
	rotationZ = 0.0;
	size = 1.0;
	velocityX = 0.0;
	velocityY = 0.0;
	velocityZ = 0.0;
	zkey = 0.0;

	update(delta: number): void {
		this.positionX += this.velocityX * delta;
		this.positionY += this.velocityY * delta;
		this.positionZ += this.velocityZ * delta;

		this.eulerX += this.rotationX * delta;
		this.eulerY += this.rotationY * delta;
		this.eulerZ += this.rotationZ * delta;
	}
}

function symmetryRandom(): number {
	return Math.random() * 2.0 - 1.0;
}

function compareByDepth(left: BlossomParticle, right: BlossomParticle): number {
	return left.zkey - right.zkey;
}

const TWO_PI = Math.PI * 2.0;

/* --------------------------------- 渲染器 --------------------------------- */

export class SakuraRenderer {
	private readonly canvas: HTMLCanvasElement;
	private gl: WebGLRenderingContext | null = null;

	private readonly camera = {
		dof: createVector3(
			sakuraConfig.camera.dof.x,
			sakuraConfig.camera.dof.y,
			sakuraConfig.camera.dof.z,
		),
		lookAt: createVector3(
			sakuraConfig.camera.lookAt.x,
			sakuraConfig.camera.lookAt.y,
			sakuraConfig.camera.lookAt.z,
		),
		matrix: new Float32Array(16),
		position: createVector3(
			sakuraConfig.camera.position.x,
			sakuraConfig.camera.position.y,
			sakuraConfig.camera.position.z,
		),
		up: createVector3(sakuraConfig.camera.up.x, sakuraConfig.camera.up.y, sakuraConfig.camera.up.z),
	};

	private readonly projection = {
		angle: 60,
		matrix: new Float32Array(16),
		nearfar: new Float32Array([sakuraConfig.projection.near, sakuraConfig.projection.far]),
	};

	private readonly pointFlower = {
		area: createVector3(0, sakuraConfig.particle.area.y, sakuraConfig.particle.area.z),
		buffer: null as WebGLBuffer | null,
		data: null as Float32Array | null,
		eulerOffset: 0,
		eulerByteOffset: 0,
		fader: createVector3(0, 0, 0),
		miscOffset: 0,
		miscByteOffset: 0,
		offset: new Float32Array([0, 0, 0]),
		particles: [] as BlossomParticle[],
		positionOffset: 0,
		positionByteOffset: 0,
		program: null as Program | null,
	};

	private readonly effects = {
		brightBuffer: null as Program | null,
		directionalBlur: null as Program | null,
		finalComposite: null as Program | null,
		sceneBackground: null as Program | null,
	};

	private readonly targets = {
		main: null as RenderTarget | null,
		halfA: null as RenderTarget | null,
		halfB: null as RenderTarget | null,
	};

	private quadBuffer: WebGLBuffer | null = null;
	private readonly quadData = new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0]);
	private readonly spec = {
		array: new Float32Array(3),
		aspect: 1,
		halfArray: new Float32Array(3),
		halfHeight: 0,
		halfWidth: 0,
		height: 0,
		width: 0,
	};

	private animationFrameId = 0;
	private readonly clock = { delta: 0, elapsed: 0, prev: 0 };
	private isAnimating = false;
	private isSceneReady = false;
	private resizeQueued = false;
	private visibilityPaused = false;
	private pixelRatio = 1;

	private readonly boundAnimate = (time: number): void => this.animate(time);
	private readonly boundHandleResize = (): void => this.queueResize();
	private readonly boundHandlePageHide = (): void => this.stop();
	private readonly boundHandlePageShow = (): void => {
		this.resetClock(false);
		this.start();
	};
	private readonly boundHandleVisibilityChange = (): void => this.handleVisibilityChange();
	private readonly boundHandleContextLost = (event: Event): void => this.handleContextLost(event);
	private readonly boundHandleContextRestored = (): void => this.handleContextRestored();

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
	}

	init(): boolean {
		if (!this.initializeContext()) return false;

		this.quadBuffer = this.gl!.createBuffer();
		this.gl!.bindBuffer(this.gl!.ARRAY_BUFFER, this.quadBuffer);
		this.gl!.bufferData(this.gl!.ARRAY_BUFFER, this.quadData, this.gl!.STATIC_DRAW);
		this.gl!.bindBuffer(this.gl!.ARRAY_BUFFER, null);

		if (!this.createSceneResources()) return false;

		window.addEventListener('resize', this.boundHandleResize, false);
		window.addEventListener('orientationchange', this.boundHandleResize, false);
		window.addEventListener('pagehide', this.boundHandlePageHide, false);
		window.addEventListener('pageshow', this.boundHandlePageShow, false);
		document.addEventListener('visibilitychange', this.boundHandleVisibilityChange, false);
		this.canvas.addEventListener('webglcontextlost', this.boundHandleContextLost, false);
		this.canvas.addEventListener('webglcontextrestored', this.boundHandleContextRestored, false);

		this.resize();
		this.resetClock(true);
		this.start();
		return true;
	}

	start(): void {
		if (this.isAnimating || !this.isSceneReady) return;
		this.isAnimating = true;
		this.animationFrameId = requestAnimationFrame(this.boundAnimate);
	}

	stop(): void {
		if (!this.isAnimating) return;
		this.isAnimating = false;
		cancelAnimationFrame(this.animationFrameId);
		this.animationFrameId = 0;
	}

	dispose(): void {
		this.stop();
		window.removeEventListener('resize', this.boundHandleResize, false);
		window.removeEventListener('orientationchange', this.boundHandleResize, false);
		window.removeEventListener('pagehide', this.boundHandlePageHide, false);
		window.removeEventListener('pageshow', this.boundHandlePageShow, false);
		document.removeEventListener('visibilitychange', this.boundHandleVisibilityChange, false);
		this.canvas.removeEventListener('webglcontextlost', this.boundHandleContextLost, false);
		this.canvas.removeEventListener('webglcontextrestored', this.boundHandleContextRestored, false);

		const gl = this.gl;
		if (!gl) return;

		this.deleteRenderTargets();
		this.deletePrograms();
		if (this.pointFlower.buffer) gl.deleteBuffer(this.pointFlower.buffer);
		if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer);

		this.pointFlower.buffer = null;
		this.quadBuffer = null;
		this.isSceneReady = false;
		this.gl = null;
	}

	private initializeContext(): boolean {
		const gl = (this.canvas.getContext('webgl', sakuraConfig.contextAttributes) ||
			this.canvas.getContext('experimental-webgl', sakuraConfig.contextAttributes)) as
			| WebGLRenderingContext
			| null;

		if (!gl) {
			console.warn('[hydro-sakura-theme] WebGL 不可用，已跳过樱花背景。');
			return false;
		}

		this.gl = gl;
		return true;
	}

	private createEffectProgram(
		vertexSource: string,
		fragmentSource: string,
		extraUniforms?: string[],
		extraAttributes?: string[],
	): Program | null {
		let uniformNames = ['uResolution', 'uSrc', 'uDelta'];
		let attributeNames = ['aPosition'];
		if (extraUniforms && extraUniforms.length) uniformNames = uniformNames.concat(extraUniforms);
		if (extraAttributes && extraAttributes.length) attributeNames = attributeNames.concat(extraAttributes);
		return createProgram(this.gl!, vertexSource, fragmentSource, uniformNames, attributeNames);
	}

	private createSceneResources(): boolean {
		const gl = this.gl!;

		this.effects.sceneBackground = this.createEffectProgram(commonVertex, backgroundFragment, [
			'uTimes',
			'uIntensity',
		]);
		this.effects.brightBuffer = this.createEffectProgram(commonVertex, brightBufferFragment);
		this.effects.directionalBlur = this.createEffectProgram(commonVertex, directionalBlurFragment, [
			'uBlurDir',
		]);
		this.effects.finalComposite = this.createEffectProgram(
			finalCompositeVertex,
			finalCompositeFragment,
			['uBloom'],
		);

		if (
			!this.effects.sceneBackground ||
			!this.effects.brightBuffer ||
			!this.effects.directionalBlur ||
			!this.effects.finalComposite
		) {
			console.error('[hydro-sakura-theme] 后处理着色器创建失败。');
			return false;
		}

		const flower = this.pointFlower;
		flower.program = createProgram(
			gl,
			pointVertex,
			pointFragment,
			['uProjection', 'uModelview', 'uResolution', 'uOffset', 'uDOF', 'uFade'],
			['aPosition', 'aEuler', 'aMisc'],
		);

		flower.data = new Float32Array(sakuraConfig.particle.count * (3 + 3 + 2));
		flower.positionOffset = 0;
		flower.eulerOffset = sakuraConfig.particle.count * 3;
		flower.miscOffset = sakuraConfig.particle.count * 6;
		flower.positionByteOffset = 0;
		flower.eulerByteOffset = flower.eulerOffset * Float32Array.BYTES_PER_ELEMENT;
		flower.miscByteOffset = flower.miscOffset * Float32Array.BYTES_PER_ELEMENT;
		flower.buffer = gl.createBuffer();

		if (!flower.program || !flower.buffer) {
			console.error('[hydro-sakura-theme] 花瓣着色器创建失败。');
			return false;
		}

		gl.bindBuffer(gl.ARRAY_BUFFER, flower.buffer);
		gl.bufferData(gl.ARRAY_BUFFER, flower.data.byteLength, gl.DYNAMIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);

		for (let index = flower.particles.length; index < sakuraConfig.particle.count; index += 1) {
			flower.particles.push(new BlossomParticle());
		}

		this.isSceneReady = true;
		return true;
	}

	private deletePrograms(): void {
		const gl = this.gl;
		if (!gl) return;
		deleteProgram(gl, this.effects.sceneBackground);
		deleteProgram(gl, this.effects.brightBuffer);
		deleteProgram(gl, this.effects.directionalBlur);
		deleteProgram(gl, this.effects.finalComposite);
		deleteProgram(gl, this.pointFlower.program);

		this.effects.sceneBackground = null;
		this.effects.brightBuffer = null;
		this.effects.directionalBlur = null;
		this.effects.finalComposite = null;
		this.pointFlower.program = null;
	}

	private deleteRenderTargets(): void {
		const gl = this.gl;
		if (!gl) return;
		deleteRenderTarget(gl, this.targets.main);
		deleteRenderTarget(gl, this.targets.halfA);
		deleteRenderTarget(gl, this.targets.halfB);
		this.targets.main = null;
		this.targets.halfA = null;
		this.targets.halfB = null;
	}

	private initializePointFlowers(): void {
		const flower = this.pointFlower;
		const velocity = sakuraConfig.particle.velocity;
		const size = sakuraConfig.particle.size;
		const temporary = createVector3(0, 0, 0);

		/* x 方向按视口宽高比展开，保证宽屏两侧同样有花瓣 */
		flower.area.x = flower.area.y * this.spec.aspect;
		syncVector(flower.area);

		flower.fader.x = sakuraConfig.particle.fade.start;
		flower.fader.y = flower.area.z;
		flower.fader.z = sakuraConfig.particle.fade.nearStart;
		syncVector(flower.fader);

		for (const particle of flower.particles) {
			temporary.x = symmetryRandom() * velocity.variance.x + velocity.base.x;
			temporary.y = symmetryRandom() * velocity.variance.y + velocity.base.y;
			temporary.z = symmetryRandom() * velocity.variance.z + velocity.base.z;
			normalizeVector(temporary);

			const speed = velocity.speed.min + Math.random() * velocity.speed.range;
			particle.velocityX = temporary.x * speed;
			particle.velocityY = temporary.y * speed;
			particle.velocityZ = temporary.z * speed;

			particle.rotationX = symmetryRandom() * sakuraConfig.particle.rotationRange;
			particle.rotationY = symmetryRandom() * sakuraConfig.particle.rotationRange;
			particle.rotationZ = symmetryRandom() * sakuraConfig.particle.rotationRange;

			particle.positionX = symmetryRandom() * flower.area.x;
			particle.positionY = symmetryRandom() * flower.area.y;
			particle.positionZ = symmetryRandom() * flower.area.z;

			particle.eulerX = Math.random() * TWO_PI;
			particle.eulerY = Math.random() * TWO_PI;
			particle.eulerZ = Math.random() * TWO_PI;

			particle.size = size.min + Math.random() * size.range;
		}
	}

	private initializeScene(): void {
		this.initializePointFlowers();

		const flower = this.pointFlower;
		this.camera.position.z = flower.area.z + this.projection.nearfar[0];
		this.projection.angle =
			((Math.atan2(flower.area.y, this.camera.position.z + flower.area.z) * 180.0) / Math.PI) * 2.0;

		loadProjection(
			this.projection.matrix,
			this.spec.aspect,
			this.projection.angle,
			this.projection.nearfar[0],
			this.projection.nearfar[1],
		);
	}

	private rebuildRenderTargets(): void {
		const gl = this.gl!;
		this.deleteRenderTargets();
		this.targets.main = createRenderTarget(gl, Math.max(1, this.spec.width), Math.max(1, this.spec.height));
		this.targets.halfA = createRenderTarget(gl, this.spec.halfWidth, this.spec.halfHeight);
		this.targets.halfB = createRenderTarget(gl, this.spec.halfWidth, this.spec.halfHeight);
	}

	private resize(): void {
		const bounds = this.canvas.getBoundingClientRect();
		const logicalWidth = Math.max(1, Math.round(bounds.width || window.innerWidth));
		const logicalHeight = Math.max(1, Math.round(bounds.height || window.innerHeight));
		this.pixelRatio = Math.min(window.devicePixelRatio || 1, sakuraConfig.pixelRatioCap);

		const width = Math.max(1, Math.floor(logicalWidth * this.pixelRatio));
		const height = Math.max(1, Math.floor(logicalHeight * this.pixelRatio));

		this.canvas.width = width;
		this.canvas.height = height;

		this.spec.width = width;
		this.spec.height = height;
		this.spec.aspect = width / height;
		this.spec.array[0] = width;
		this.spec.array[1] = height;
		this.spec.array[2] = this.spec.aspect;
		this.spec.halfWidth = Math.max(1, Math.floor(width / 2));
		this.spec.halfHeight = Math.max(1, Math.floor(height / 2));
		this.spec.halfArray[0] = this.spec.halfWidth;
		this.spec.halfArray[1] = this.spec.halfHeight;
		this.spec.halfArray[2] = this.spec.halfWidth / this.spec.halfHeight;

		this.rebuildRenderTargets();
		this.initializeScene();
		this.render();
	}

	private queueResize(): void {
		if (this.resizeQueued) return;
		this.resizeQueued = true;
		requestAnimationFrame(() => {
			this.resizeQueued = false;
			if (this.gl) this.resize();
		});
	}

	private resetClock(resetElapsed: boolean): void {
		this.clock.delta = 0.0;
		this.clock.prev = performance.now();
		if (resetElapsed) this.clock.elapsed = 0.0;
	}

	private handleVisibilityChange(): void {
		if (document.hidden) {
			this.visibilityPaused = true;
			this.stop();
			return;
		}
		if (this.visibilityPaused) {
			this.visibilityPaused = false;
			this.resetClock(false);
			this.start();
		}
	}

	private handleContextLost(event: Event): void {
		event.preventDefault();
		this.stop();
		this.isSceneReady = false;
		this.effects.sceneBackground = null;
		this.effects.brightBuffer = null;
		this.effects.directionalBlur = null;
		this.effects.finalComposite = null;
		this.pointFlower.buffer = null;
		this.pointFlower.program = null;
		this.quadBuffer = null;
		this.targets.main = null;
		this.targets.halfA = null;
		this.targets.halfB = null;
	}

	private handleContextRestored(): void {
		if (!this.initializeContext()) return;

		const gl = this.gl!;
		this.quadBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.quadData, gl.STATIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);

		if (!this.createSceneResources()) return;
		this.resize();
		this.resetClock(true);
		this.start();
	}

	private animate(time: number): void {
		if (!this.isAnimating) return;

		const deltaMilliseconds = time - this.clock.prev;
		this.clock.delta = deltaMilliseconds / 1000.0;
		this.clock.elapsed += this.clock.delta;
		this.clock.prev = time;

		this.render();
		this.animationFrameId = requestAnimationFrame(this.boundAnimate);
	}

	/* ------------------------------ 渲染流程 ------------------------------ */

	private bindRenderTarget(target: RenderTarget, shouldClear: boolean): void {
		const gl = this.gl!;
		gl.bindFramebuffer(gl.FRAMEBUFFER, target.frameBuffer);
		gl.viewport(0, 0, target.width, target.height);
		if (shouldClear) {
			const color = sakuraConfig.render.framebufferClearColor;
			gl.clearColor(color[0], color[1], color[2], color[3]);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		}
	}

	private drawFullscreenQuad(program: Program): void {
		const gl = this.gl!;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
		gl.vertexAttribPointer(program.attributes.aPosition, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}

	private useEffect(program: Program, sourceTexture: RenderTarget | null): void {
		const gl = this.gl!;
		useProgram(gl, program);
		gl.uniform3fv(program.uniforms.uResolution, this.spec.array);
		if (!sourceTexture) return;
		gl.uniform2fv(program.uniforms.uDelta, sourceTexture.dtxArray);
		gl.uniform1i(program.uniforms.uSrc, 0);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, sourceTexture.texture);
	}

	private unuseEffect(program: Program): void {
		unuseProgram(this.gl!, program);
	}

	private render(): void {
		if (!this.isSceneReady) return;
		const main = this.targets.main;
		if (!main) return;

		const gl = this.gl!;
		const color = sakuraConfig.render.clearColor;

		loadLookAt(this.camera.matrix, this.camera.position, this.camera.lookAt, this.camera.up);
		gl.enable(gl.DEPTH_TEST);
		gl.bindFramebuffer(gl.FRAMEBUFFER, main.frameBuffer);
		gl.viewport(0, 0, main.width, main.height);
		gl.clearColor(color[0], color[1], color[2], color[3]);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		this.renderBackground();
		this.renderPointFlowers();
		this.renderPostProcess();
	}

	private renderBackground(): void {
		const gl = this.gl!;
		const program = this.effects.sceneBackground!;

		gl.disable(gl.DEPTH_TEST);
		this.useEffect(program, null);
		gl.uniform2f(program.uniforms.uTimes, this.clock.elapsed, this.clock.delta);
		gl.uniform1f(program.uniforms.uIntensity, sakuraConfig.render.backgroundIntensity);
		this.drawFullscreenQuad(program);
		this.unuseEffect(program);
		gl.enable(gl.DEPTH_TEST);
	}

	private renderPointFlowers(): void {
		const gl = this.gl!;
		const flower = this.pointFlower;
		const program = flower.program!;
		const data = flower.data!;
		const area = flower.area;
		const cameraMatrix = this.camera.matrix;

		let positionIndex = flower.positionOffset;
		let eulerIndex = flower.eulerOffset;
		let miscIndex = flower.miscOffset;

		for (const particle of flower.particles) {
			particle.update(this.clock.delta);

			if (Math.abs(particle.positionX) - particle.size * 0.5 > area.x) {
				particle.positionX += particle.positionX > 0.0 ? -area.x * 2.0 : area.x * 2.0;
			}
			if (Math.abs(particle.positionY) - particle.size * 0.5 > area.y) {
				particle.positionY += particle.positionY > 0.0 ? -area.y * 2.0 : area.y * 2.0;
			}
			if (Math.abs(particle.positionZ) - particle.size * 0.5 > area.z) {
				particle.positionZ += particle.positionZ > 0.0 ? -area.z * 2.0 : area.z * 2.0;
			}

			particle.eulerX %= TWO_PI;
			particle.eulerY %= TWO_PI;
			particle.eulerZ %= TWO_PI;
			if (particle.eulerX < 0.0) particle.eulerX += TWO_PI;
			if (particle.eulerY < 0.0) particle.eulerY += TWO_PI;
			if (particle.eulerZ < 0.0) particle.eulerZ += TWO_PI;

			particle.zkey =
				cameraMatrix[2] * particle.positionX +
				cameraMatrix[6] * particle.positionY +
				cameraMatrix[10] * particle.positionZ +
				cameraMatrix[14];
		}

		/* 透明花瓣必须从远到近绘制，否则叠加顺序会闪烁 */
		flower.particles.sort(compareByDepth);

		for (const particle of flower.particles) {
			data[positionIndex] = particle.positionX;
			data[positionIndex + 1] = particle.positionY;
			data[positionIndex + 2] = particle.positionZ;
			positionIndex += 3;

			data[eulerIndex] = particle.eulerX;
			data[eulerIndex + 1] = particle.eulerY;
			data[eulerIndex + 2] = particle.eulerZ;
			eulerIndex += 3;

			data[miscIndex] = particle.size;
			data[miscIndex + 1] = particle.alpha;
			miscIndex += 2;
		}

		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		useProgram(gl, program);
		gl.uniformMatrix4fv(program.uniforms.uProjection, false, this.projection.matrix);
		gl.uniformMatrix4fv(program.uniforms.uModelview, false, this.camera.matrix);
		gl.uniform3fv(program.uniforms.uResolution, this.spec.array);
		gl.uniform3fv(program.uniforms.uDOF, syncVector(this.camera.dof));
		gl.uniform3fv(program.uniforms.uFade, syncVector(flower.fader));

		gl.bindBuffer(gl.ARRAY_BUFFER, flower.buffer);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
		gl.vertexAttribPointer(program.attributes.aPosition, 3, gl.FLOAT, false, 0, flower.positionByteOffset);
		gl.vertexAttribPointer(program.attributes.aEuler, 3, gl.FLOAT, false, 0, flower.eulerByteOffset);
		gl.vertexAttribPointer(program.attributes.aMisc, 2, gl.FLOAT, false, 0, flower.miscByteOffset);

		/* 五层偏移叠加，形成没有边界的立体花瓣场 */
		this.drawPointFlowerLayer(program, -area.x, -area.y, area.z * -2.0);
		this.drawPointFlowerLayer(program, -area.x, area.y, area.z * -2.0);
		this.drawPointFlowerLayer(program, area.x, -area.y, area.z * -2.0);
		this.drawPointFlowerLayer(program, area.x, area.y, area.z * -2.0);
		this.drawPointFlowerLayer(program, 0.0, 0.0, 0.0);

		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		unuseProgram(gl, program);
		gl.disable(gl.BLEND);
	}

	private drawPointFlowerLayer(program: Program, offsetX: number, offsetY: number, offsetZ: number): void {
		const gl = this.gl!;
		const offset = this.pointFlower.offset;
		offset[0] = offsetX;
		offset[1] = offsetY;
		offset[2] = offsetZ;
		gl.uniform3fv(program.uniforms.uOffset, offset);
		gl.drawArrays(gl.POINTS, 0, this.pointFlower.particles.length);
	}

	private renderPostProcess(): void {
		const gl = this.gl!;
		const halfA = this.targets.halfA!;
		const halfB = this.targets.halfB!;
		const main = this.targets.main!;
		const postProcess = sakuraConfig.postProcess;

		gl.disable(gl.DEPTH_TEST);

		/* 提取高亮 */
		this.bindRenderTarget(halfA, true);
		this.useEffect(this.effects.brightBuffer!, main);
		this.drawFullscreenQuad(this.effects.brightBuffer!);
		this.unuseEffect(this.effects.brightBuffer!);

		/* 横纵两方向分离模糊，迭代次数控制辉光范围 */
		for (let index = 0; index < postProcess.blurIterations; index += 1) {
			const blurPass = postProcess.directionPassBase + postProcess.directionPassStep * index;
			const blurStride = postProcess.strideBase + postProcess.strideStep * index;

			this.bindRenderTarget(halfB, true);
			this.useEffect(this.effects.directionalBlur!, halfA);
			gl.uniform4f(this.effects.directionalBlur!.uniforms.uBlurDir, blurPass, 0.0, blurStride, 0.0);
			this.drawFullscreenQuad(this.effects.directionalBlur!);
			this.unuseEffect(this.effects.directionalBlur!);

			this.bindRenderTarget(halfA, true);
			this.useEffect(this.effects.directionalBlur!, halfB);
			gl.uniform4f(this.effects.directionalBlur!.uniforms.uBlurDir, 0.0, blurPass, 0.0, blurStride);
			this.drawFullscreenQuad(this.effects.directionalBlur!);
			this.unuseEffect(this.effects.directionalBlur!);
		}

		/* 合成：原图 + 辉光，叠加径向暗角与 gamma 提亮 */
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, this.spec.width, this.spec.height);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		this.useEffect(this.effects.finalComposite!, main);
		gl.uniform1i(this.effects.finalComposite!.uniforms.uBloom, 1);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, halfA.texture);
		this.drawFullscreenQuad(this.effects.finalComposite!);
		this.unuseEffect(this.effects.finalComposite!);

		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.enable(gl.DEPTH_TEST);
	}
}

export function createSakuraRenderer(canvas: HTMLCanvasElement): SakuraRenderer | null {
	const renderer = new SakuraRenderer(canvas);
	return renderer.init() ? renderer : null;
}
