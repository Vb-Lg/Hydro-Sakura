/*
外观设置的前端侧。

管理面板（域设置）里配置的不透明度与模糊强度由服务端接口下发，
这里把它们写入 :root 的 CSS 变量，覆盖 sakura.css 里的默认值。

接口路径必须与仓库根目录 index.ts 的 THEME_CONFIG_PATH 保持一致 ——
服务端入口与前端入口分属两套构建，无法共享模块。
*/
export const THEME_CONFIG_PATH = '/hydro-sakura/theme.json';

/** 与 index.ts 的 themeDefaults、sakura.css 的变量初始值保持一致。 */
export const themeDefaults = {
	panelOpacity: 62,
	chromeOpacity: 52,
	blur: 14,
} as const;

type ThemeSettings = {
	panelOpacity: number;
	chromeOpacity: number;
	blur: number;
};

const STORAGE_KEY = 'hydro-sakura-theme';

function normalize(raw: unknown): ThemeSettings | null {
	if (!raw || typeof raw !== 'object') return null;
	const source = raw as Partial<Record<keyof ThemeSettings, unknown>>;
	const pick = (key: keyof ThemeSettings, fallback: number, min: number, max: number): number | null => {
		const value = Number(source[key]);
		if (!Number.isFinite(value)) return null;
		return Math.min(max, Math.max(min, Math.round(value)));
	};
	const panelOpacity = pick('panelOpacity', themeDefaults.panelOpacity, 0, 100);
	const chromeOpacity = pick('chromeOpacity', themeDefaults.chromeOpacity, 0, 100);
	const blur = pick('blur', themeDefaults.blur, 0, 40);
	if (panelOpacity === null || chromeOpacity === null || blur === null) return null;
	return { panelOpacity, chromeOpacity, blur };
}

function writeVariables(settings: ThemeSettings): void {
	const root = document.documentElement.style;
	root.setProperty('--hydro-sakura-panel', `${settings.panelOpacity}%`);
	root.setProperty('--hydro-sakura-chrome', `${settings.chromeOpacity}%`);
	root.setProperty('--hydro-sakura-blur', `${settings.blur}px`);
}

/**
 * 应用管理面板里的外观设置。
 * 先用上次缓存的值渲染，避免每次加载都闪一下默认透明度；随后再拉取最新值。
 * 任何一步失败都静默退回默认值，不影响樱花背景本身。
 */
export function applyThemeSettings(): void {
	try {
		const cached = localStorage.getItem(STORAGE_KEY);
		const settings = cached ? normalize(JSON.parse(cached)) : null;
		if (settings) writeVariables(settings);
	} catch {
		/* 隐私模式下 localStorage 可能不可用，忽略 */
	}

	fetch(THEME_CONFIG_PATH, { credentials: 'same-origin' })
		.then((response) => (response.ok ? response.json() : null))
		.then((data) => {
			const settings = normalize(data);
			if (!settings) return;
			writeVariables(settings);
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
			} catch {
				/* 同上 */
			}
		})
		.catch(() => {
			/* 接口不可用时沿用缓存或 CSS 默认值 */
		});
}
