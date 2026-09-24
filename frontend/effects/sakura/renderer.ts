import { sakuraConfig } from './config';

type Petal = {
	x: number;
	y: number;
	z: number;
	size: number;
	rotation: number;
	rotationSpeed: number;
	speed: number;
	sway: number;
	phase: number;
};

export class SakuraRenderer {
	private readonly canvas: HTMLCanvasElement;
	private readonly context: CanvasRenderingContext2D;
	private readonly petals: Petal[] = [];
	private animationFrame = 0;
	private previousTime = 0;
	private running = false;
	private resizeQueued = false;
	private readonly resizeObserver: ResizeObserver;
	private width = 1;
	private height = 1;
	private readonly handleResize = (): void => this.queueResize();
	private readonly handleVisibilityChange = (): void => {
		if (document.hidden) {
			this.stop();
		} else {
			this.start();
		}
	};

	constructor(canvas: HTMLCanvasElement) {
		const context = canvas.getContext('2d');
		if (!context) {
			throw new Error('Canvas 2D is not supported.');
		}

		this.canvas = canvas;
		this.context = context;
		this.resizeObserver = new ResizeObserver(() => this.queueResize());
		this.createPetals();
	}

	init(): void {
		window.addEventListener('resize', this.handleResize, { passive: true });
		document.addEventListener('visibilitychange', this.handleVisibilityChange);
		this.resizeObserver.observe(this.canvas);
		this.resize();
		this.start();
	}

	start(): void {
		if (this.running || document.hidden) {
			return;
		}

		this.running = true;
		this.previousTime = performance.now();
		this.animationFrame = requestAnimationFrame((time) => this.animate(time));
	}

	stop(): void {
		if (!this.running) {
			return;
		}

		this.running = false;
		cancelAnimationFrame(this.animationFrame);
	}

	dispose(): void {
		this.stop();
		window.removeEventListener('resize', this.handleResize);
		document.removeEventListener('visibilitychange', this.handleVisibilityChange);
		this.resizeObserver.disconnect();
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}

	private animate(time: number): void {
		if (!this.running) {
			return;
		}

		const delta = Math.min((time - this.previousTime) / 1000, 0.05);
		this.previousTime = time;
		this.update(delta);
		this.render(time / 1000);
		this.animationFrame = requestAnimationFrame((nextTime) => this.animate(nextTime));
	}

	private createPetals(): void {
		for (let index = 0; index < sakuraConfig.particleCount; index += 1) {
			this.petals.push(this.createPetal(true));
		}
	}

	private createPetal(randomizeDepth: boolean): Petal {
		return {
			x: Math.random(),
			y: randomizeDepth ? Math.random() : -0.08,
			z: 0.35 + Math.random() * 0.65,
			size:
				sakuraConfig.particleSize.min + Math.random() * sakuraConfig.particleSize.range,
			rotation: Math.random() * Math.PI * 2,
			rotationSpeed: (Math.random() - 0.5) * 3,
			speed:
				sakuraConfig.particleSpeed.min + Math.random() * sakuraConfig.particleSpeed.range,
			sway: 0.12 + Math.random() * 0.24,
			phase: Math.random() * Math.PI * 2,
		};
	}

	private update(delta: number): void {
		for (const petal of this.petals) {
			petal.y += (petal.speed / sakuraConfig.particleArea.y) * delta * (1.2 - petal.z * 0.35);
			petal.x += Math.sin(petal.phase + petal.y * 9) * petal.sway * delta * 0.08;
			petal.rotation += petal.rotationSpeed * delta;

			if (petal.y > 1.08) {
				Object.assign(petal, this.createPetal(false));
			}
		}
	}

	private render(time: number): void {
		const width = this.width;
		const height = this.height;
		const context = this.context;

		context.clearRect(0, 0, width, height);
		context.fillStyle = 'rgba(9, 5, 18, 0.14)';
		context.fillRect(0, 0, width, height);

		for (const petal of this.petals) {
			const x = (petal.x + Math.sin(time * 0.25 + petal.phase) * 0.025) * width;
			const y = petal.y * height;
			const size = petal.size * (0.5 + petal.z * 0.75);
			const alpha = 0.18 + petal.z * 0.65;

			context.save();
			context.translate(x, y);
			context.rotate(petal.rotation);
			context.scale(1, 0.62);
			context.fillStyle = `rgba(255, 188, 213, ${alpha})`;
			context.beginPath();
			context.moveTo(0, -size * 0.6);
			context.bezierCurveTo(size * 0.7, -size * 0.45, size * 0.72, size * 0.45, 0, size * 0.6);
			context.bezierCurveTo(-size * 0.72, size * 0.45, -size * 0.7, -size * 0.45, 0, -size * 0.6);
			context.fill();
			context.restore();
		}
	}

	private resize(): void {
		const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
		const bounds = this.canvas.getBoundingClientRect();
		const width = Math.max(1, bounds.width || window.innerWidth);
		const height = Math.max(1, bounds.height || window.innerHeight);
		this.width = width;
		this.height = height;
		this.canvas.width = Math.floor(width * pixelRatio);
		this.canvas.height = Math.floor(height * pixelRatio);
		this.canvas.style.width = `${width}px`;
		this.canvas.style.height = `${height}px`;
		this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
	}

	private queueResize(): void {
		if (this.resizeQueued) {
			return;
		}

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
