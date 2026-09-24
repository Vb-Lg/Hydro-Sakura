# Hydro Sakura Theme

HydroOJ 的动态樱花背景主题插件。插件通过 Hydro 的 `frontend/*.page.ts` 入口自动加载，不修改 Hydro 核心源码，也不覆盖默认页面模板。

## 特性

- 在所有 Hydro 页面注入固定定位的樱花背景
- 使用 TypeScript 和 Canvas 2D，避免依赖 Hydro 页面 DOM 结构
- 页面不可见时暂停动画，返回页面后自动恢复
- 支持高 DPI 屏幕，限制设备像素比最多为 2
- 尊重 `prefers-reduced-motion: reduce`，用户要求减少动画时不创建背景
- renderer 提供 `dispose()`，便于后续接入页面切换或热重载

## 环境

- Node.js >= 22
- HydroOJ 当前版本
- Yarn

## 安装插件

在开发机创建插件目录后安装开发依赖：

```bash
yarn install
```

把插件目录上传到 Hydro 服务器，然后执行：

```bash
hydrooj addon add /absolute/path/to/Hydro-Sakura
```

启用后重启 Hydro。实际重启命令按你的部署方式执行，例如：

```bash
systemctl restart hydro
```

## 从源码创建

也可以使用 Hydro CLI 创建 addon，再把本仓库文件复制进去：

```bash
hydrooj addon create
cd hydro-sakura-theme
yarn add hydrooj -D
```

插件入口是 `index.ts`。Hydro 会自动发现并打包 `frontend/` 下符合以下命名规则的文件：

```text
[a-zA-Z0-9_]+.page.ts
[a-zA-Z0-9_]+.page.tsx
```

本项目的前端入口是 `frontend/sakura.page.ts`。

## 目录结构

```text
Hydro-Sakura/
├── index.ts
├── package.json
├── frontend/
│   ├── sakura.css
│   ├── sakura.page.ts
│   ├── hydro-ui-default.d.ts
│   └── effects/sakura/
│       ├── config.ts
│       └── renderer.ts
└── README.md
```

## 调整效果

粒子数量、速度、大小和背景颜色位于 `frontend/effects/sakura/config.ts`。

建议先调整 `particleCount`：桌面端可以使用 `900` 到 `1600`，移动端或低配置设备可以降低到 `300` 到 `700`。

背景 canvas 的层级和响应式行为位于 `frontend/sakura.css`。

不要覆盖 Hydro 的完整模板。Hydro 官方文档建议优先使用 frontend 动态注入，这样升级 Hydro 时不容易产生模板冲突。

## 开发检查

在插件目录执行：

```bash
npx tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler \
	--lib ES2022,DOM \
	index.ts frontend/hydro-ui-default.d.ts frontend/sakura.page.ts \
	frontend/effects/sakura/config.ts frontend/effects/sakura/renderer.ts
```

如果本地还没有 `typescript`，可以临时执行：

```bash
yarn add -D typescript
```

`frontend/hydro-ui-default.d.ts` 只为独立仓库的本地检查提供 `@hydrooj/ui-default` 类型；Hydro 正式构建时会使用自己的 frontend 编译流程，因此本地检查命令只用于尽早发现 TypeScript 和 DOM API 错误。

## 相关文档

- [Hydro 前端修改](https://hydro.js.org/zh/docs/Hydro/system/frontend-modify)
- [使用 TypeScript 编写插件](https://hydro.js.org/zh/docs/Hydro/dev/typescript)
