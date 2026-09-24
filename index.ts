import { Context, DomainModel, SettingModel } from 'hydrooj';

/**
 * 外观设置接口路径。
 * 必须与 frontend/effects/sakura/theme.ts 中的 THEME_CONFIG_PATH 保持一致 ——
 * 服务端入口与前端入口分属两套构建，无法共享模块。
 */
export const THEME_CONFIG_PATH = '/hydro-sakura/theme.json';

const ROUTE_PREFIX = '/hydro-sakura/';

/** 默认值，需与 frontend/sakura.css 里的 CSS 变量初始值一致。 */
export const themeDefaults = {
	panelOpacity: 62,
	chromeOpacity: 52,
	blur: 14,
} as const;

const LIMITS = {
	opacity: { min: 0, max: 100 },
	blur: { min: 0, max: 40 },
} as const;

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
	// 域设置表单提交的是字符串，这里统一转成数字并夹到安全范围，
	// 避免填错的值把主题弄坏。
	const parsed = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(max, Math.max(min, Math.round(parsed)));
}

async function readThemeSettings(domainId: string) {
	const ddoc = await DomainModel.get(domainId).catch(() => null);
	return {
		panelOpacity: clampNumber(
			ddoc?.sakuraPanelOpacity,
			themeDefaults.panelOpacity,
			LIMITS.opacity.min,
			LIMITS.opacity.max,
		),
		chromeOpacity: clampNumber(
			ddoc?.sakuraChromeOpacity,
			themeDefaults.chromeOpacity,
			LIMITS.opacity.min,
			LIMITS.opacity.max,
		),
		blur: clampNumber(ddoc?.sakuraBlur, themeDefaults.blur, LIMITS.blur.min, LIMITS.blur.max),
	};
}

export async function apply(ctx: Context): Promise<void> {
	/*
	 * 注册到「域设置」，管理面板里可以随时调整。
	 * 域设置的保存路径是扁平键（handler/domain.ts 直接按 key 取值并写入域文档），
	 * 因此这里用扁平 key，读取时也从域文档顶层取。
	 */
	await ctx.inject(['setting'], (c) => {
		c.setting.DomainSetting(
			SettingModel.Setting(
				'setting_domain',
				'sakuraPanelOpacity',
				themeDefaults.panelOpacity,
				'number',
				'sakuraPanelOpacity',
				'Sakura content card opacity (%). Lower value shows more background.',
			),
			SettingModel.Setting(
				'setting_domain',
				'sakuraChromeOpacity',
				themeDefaults.chromeOpacity,
				'number',
				'sakuraChromeOpacity',
				'Sakura navbar and footer opacity (%).',
			),
			SettingModel.Setting(
				'setting_domain',
				'sakuraBlur',
				themeDefaults.blur,
				'number',
				'sakuraBlur',
				'Backdrop blur strength in px.',
			),
		);
	});

	/* 前端通过这个接口读取当前域的外观设置 */
	await ctx.inject(['server'], ({ server }) => {
		server.addCaptureRoute(ROUTE_PREFIX, async (c) => {
			if (c.path !== THEME_CONFIG_PATH) {
				c.status = 404;
				c.body = 'Not Found';
				return;
			}
			c.type = 'application/json';
			c.set('Cache-Control', 'no-cache');
			c.body = JSON.stringify(await readThemeSettings(c.domainId));
		});
	});
}
