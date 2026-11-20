# 泡泡奇旅 · Bubble Journey

GPT-6.2 Sol 版，一位玩家和三位 AI 的原创泡泡竞技网页游戏。可选择四位领航员、三张主题地图或随机地图。每局时限 150 秒。

[在线试玩《泡泡奇旅》GPT-6.2 Sol 版](https://bubble-journey-compare.pages.dev/sol/)

## 玩法

- **电脑**　WASD 或方向键移动，空格放置泡泡，Esc 暂停。
- **手机**　屏幕方向键移动，按粉色按钮放置泡泡。
- 泡泡倒计时 2.45 秒，沿十字方向爆开并引爆遇到的泡泡。固定墙和可破坏砖块会挡住火焰。炸开的砖块可能掉落泡泡容量、爆炸范围或移动速度强化。
- 砖块 20 分，强化 35 分，淘汰对手 250 分，胜利 500 分。存活到最后获胜。时间耗尽时，存活者按积分判定胜负，同分并列第一为平局。
- 暂停菜单的「重开本局」重用当前地图种子。结算的「再来一局」会生成新布局。切换到其他浏览器标签时会暂停对局。

## 开发与构建

~~~powershell
npm ci
npm run dev
npm test
npm run build
npm run build:single
~~~

使用 Node.js 22.12 或以上版本。开发入口为 `http://127.0.0.1:4186/`，常规生产构建位于 `dist/`。单文件构建更新 `../../downloads/bubble-journey.html`，内嵌游戏代码、样式、主视觉与第三方许可证。更新下载包时，将构建得到的 HTML 作为唯一文件放入 ZIP 根目录，并同步更新成品清单和 SHA-256。

规则模型使用固定模拟步长，并独立维护格子碰撞、炸弹与计分。AI 在共享规则上使用广度优先寻路，预测炸弹计时和连锁波及范围，评估可达的避险格、道具和攻击机会。Phaser 3 使用 Canvas 渲染。地图底层与角色帧预绘制，单局复用纹理，粒子数量有上限。HTML 界面负责大厅、触屏控制、暂停、结算与战绩。声音用 Web Audio 即时合成，首次交互后启用。

## 验证记录

核对日期为 2026-11-19。

| 验证 | 结果 |
| --- | --- |
| TypeScript 和 Vite 构建 | 常规生产构建与独立 HTML 构建通过 |
| 规则测试 | 9 项通过，覆盖随机地图、十字爆炸、连锁、砖块、碰撞、强化、胜负及 AI 主动攻击与规避 |
| Vite 浏览器 | 桌面 Chromium 通过 |
| 独立 HTML 断网测试 | 桌面 Chromium、桌面 WebKit、Pixel 7 模拟竖屏与横屏、iPhone 13 模拟竖屏，共 5 个通过。验证了选角、地图选择、移动、放泡泡、暂停、自然结算、重开、设置留存及零网络请求 |
| 声音 | 桌面 Chromium 验证了交互后 AudioContext 进入运行状态并生成音符。当前 Windows WebKit 浏览器未暴露 AudioContext |
| Firefox 与真机 | 本机 Playwright Firefox 在加载页面前退出。手机验证使用设备视口与触屏事件模拟，未覆盖实体设备和原生 Safari |

复测独立 HTML 可运行以下命令。默认包含 Firefox，可用 `BUBBLE_BROWSER` 选取环境可运行的内核和视口。

~~~powershell
npx playwright install chromium firefox webkit
$env:BUBBLE_BROWSER = 'Chromium,WebKit,Chromium Android viewport,WebKit iPhone viewport,Chromium Android landscape'
npm run test:browser
~~~

## 素材

主视觉 [key-art.jpg](src/art/key-art.jpg) 通过内置 ImageGen 生成，画面内容为草莓领航员、粉色泡泡和青柠花园。角色帧、地图块、道具、粒子、背景音乐和音效由项目代码生成。

<details>
<summary>主视觉原始生成提示（使用当时的暂名）</summary>

> Create one production-ready 3:2 landscape key art illustration for an ORIGINAL polished casual arcade video game named Bubble Circuit (absolutely NO text, letters, signage, logos or watermark). This is a crisp designer 3D clay/vinyl toy render with beautifully tactile molded rubber, vivid candy pink and teal, rich deep forest greens with cinematic shadows, soft sunshine from left top. Main subject at around x=48%, y=53% is a striking super-cute chubby little coral strawberry astronaut mascot (pink helmet shaped like a single berry with small green leaf crown, dark plum clear face opening with warm cream face and dark eyes, coral overalls and tiny mittens), runs toward camera slightly angled, happy confident expression, thick silhouette, shiny large magenta translucent bubble with short cartoon fuse to left foreground, bubbles floating around. In the background two separate small toy astronaut competitors, a lime frog hood bubble pilot and a lavender kitten hood pilot, tiny and out of focus for scale. Environment mint green square tiled arena on living grass, squat chunky rounded mint machinery blocks and apricot orange crates, a few tiny white flowers, misty lush rounded foliage behind. Low perspective diorama, generous breathing room around main mascot, foreground tucked in lower half, all over rich color in green with pink hero pop, art should fill the frame edge to edge. High end Nintendo-like toy photography aesthetic but fully original character design with no franchise references. Bright legible composition and great depth. Art only, no UI and no typography.

</details>
