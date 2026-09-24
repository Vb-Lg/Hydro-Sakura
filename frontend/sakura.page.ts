import './sakura.css';

import { addPage, AutoloadPage } from '@hydrooj/ui-default';
import { sakuraConfig } from './effects/sakura/config';
import { createSakuraRenderer, SakuraRenderer } from './effects/sakura/renderer';
import { applyThemeSettings } from './effects/sakura/theme';

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
	// 卡片透明度与模糊强度来自管理面板的域设置，与动效偏好无关，因此先应用。
	applyThemeSettings();

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
