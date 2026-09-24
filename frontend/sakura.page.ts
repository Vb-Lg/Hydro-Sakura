import './sakura.css';

import { addPage, AutoloadPage } from '@hydrooj/ui-default';
import { sakuraConfig } from './effects/sakura/config';
import { createSakuraRenderer, SakuraRenderer } from './effects/sakura/renderer';

const canvasId = sakuraConfig.canvasId;
let renderer: SakuraRenderer | null = null;

function ensureCanvas(): HTMLCanvasElement {
	const existingCanvas = document.getElementById(canvasId);
	if (existingCanvas instanceof HTMLCanvasElement) {
		return existingCanvas;
	}

	const canvas = document.createElement('canvas');
	canvas.id = canvasId;
	canvas.setAttribute('aria-hidden', 'true');
	document.body.prepend(canvas);
	return canvas;
}

function mount(): void {
	if (renderer || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		return;
	}

	try {
		renderer = createSakuraRenderer(ensureCanvas());
	} catch (error) {
		console.warn('[hydro-sakura-theme] Unable to start background.', error);
	}
}

addPage(new AutoloadPage('hydro-sakura-theme', mount));
