# Hydro Sakura Theme

HydroOJ 的动态樱花背景主题插件。插件通过 Hydro 的 `frontend/*.page.ts` 入口自动加载，不修改 Hydro 核心源码，也不覆盖默认页面模板。

## 特性

渲染管线移植自 [vblg.top](https://vblg.top) 首页，两处看到的画面使用同一套着色器与参数。

- 在所有 Hydro 页面注入固定定位的樱花背景，不依赖 Hydro 页面 DOM 结构
- 相机透视投影：花瓣按景深改变大小，水平范围随视口宽高比缩放，宽屏两侧同样铺满
- 花瓣基于欧拉角旋转，按法线做漫反射与高光计算，并用椭圆切口拼出樱花瓣形状
- 距离淡出：远处花瓣颜色向背景色收敛，形成纵深：靠近相机的花瓣自动淡出，避免糊脸
- 景深模糊（DOF）：离焦花瓣边缘变软
- 五层偏移叠加，形成看不到边界的立体花瓣场
- 后处理链：高亮提取 + 横纵分离模糊两次迭代 + 径向暗角 + gamma 提亮，即花瓣的辉光
- 把 Hydro 主题的不透明页面层改成磨砂玻璃，背景才能真正透出来
- 页面不可见或被 bfcache 缓存时暂停动画，返回页面后自动恢复
- 支持高 DPI 屏幕，限制设备像素比最多为 2
- 尊重 `prefers-reduced-motion: reduce`，用户要求减少动画时不创建背景
- WebGL 不可用时只输出一条警告，不影响 OJ 正常使用
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

所有视觉效果参数都在 `frontend/effects/sakura/config.ts`，与首页保持同一套命名。

常用参数：

- `particle.count`：花瓣数量，桌面端 `1200` 到 `1800`，移动端或低配设备降到 `400` 到 `800`
- `render.backgroundIntensity`：背景亮度倍率。`0.5` 与首页完全一致；
  OJ 页面内容较密，调到 `0.3` 到 `0.4` 可弱化亮部，文字区的背景更安静
- `particle.size`：花瓣大小，`min` 为基准值，`range` 为随机浮动范围
- `particle.velocity`：运动方向和速度，`base` 是主方向，`variance` 是随机扰动
- `particle.fade`：`start` 与 `halfDistance` 控制多远开始淡出，`nearStart` 控制多近开始淡出
- `camera.dof`：`x` 清晰距离、`y` 清晰半径、`z` 模糊过渡宽度
- `postProcess.blurIterations`：辉光迭代次数，减到 `1` 可以明显降低 GPU 占用
- `pixelRatioCap`：设备像素比上限，默认 `2`，低配设备可以设为 `1`

背景画布的层级和卡片透明度在 `frontend/sakura.css`。

## 背景为什么需要改 CSS

Hydro 默认主题给页面骨架写了不透明背景，固定定位的画布会被完全盖住：

| 选择器 | 主题默认值 |
| --- | --- |
| `#panel` | `#edf0f2` |
| `.section` | `#fff`（深色主题 `#323334`） |
| `.footer` | `#fff` |
| `.nav` | `#fffffffa` |

`frontend/sakura.css` 因此把 `#panel` 设为完全透明，并把 `.section`、`.nav`、`.footer`
改成基于 `--mantine-color-body` 的磨砂层，这样浅色与深色主题下正文对比度都正常。

可调变量：

- `--hydro-sakura-panel`：内容卡片不透明度，越低樱花越明显（默认 `84%`）
- `--hydro-sakura-chrome`：导航与页脚不透明度（默认 `74%`）
- `--hydro-sakura-blur`：磨砂强度（默认 `12px`）

不建议直接覆盖 Hydro 的完整模板。官方文档推荐优先使用 frontend 动态注入，这样升级 Hydro 时不容易产生模板冲突。

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
