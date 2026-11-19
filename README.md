# Game Remakes

按生成模型归档网页游戏 Demo。每个模型有独立的目录，游戏源码、构建入口和可下载成品随该模型维护。

| 模型 | 作品 | 入口 |
| --- | --- | --- |
| GPT-6 Astra | 泡泡奇旅、疾风竞速、运输船 | [作品与开发说明](gpt6-astra/README.md) · [离线下载](gpt6-astra/downloads/README.md) |
| GPT-6.2 Sol | 泡泡奇旅、疾风竞速、运输船 | [作品与开发说明](gpt6.2-sol/README.md) · [离线下载](gpt6.2-sol/downloads/README.md) |

## 泡泡奇旅对照测试

| 模型 | HTML 原文件 | ZIP |
| --- | --- | --- |
| GPT-6 Astra | [bubble-journey.html](gpt6-astra/downloads/bubble-journey.html?raw=true) | [下载 ZIP](gpt6-astra/downloads/bubble-journey.zip?raw=true) |
| GPT-6.2 Sol | [bubble-journey.html](gpt6.2-sol/downloads/bubble-journey.html?raw=true) | [下载 ZIP](gpt6.2-sol/downloads/bubble-journey.zip?raw=true) |

两个版本同名，建议保留各自的模型目录以便区分。ZIP 解压后用浏览器打开 HTML 即可离线游玩。

## 疾风竞速对照测试

| 模型 | HTML 原文件 | ZIP | 源码与玩法 |
| --- | --- | --- | --- |
| GPT-6 Astra | [apex-rush.html](gpt6-astra/downloads/apex-rush.html?raw=true) | [下载 ZIP](gpt6-astra/downloads/apex-rush.zip?raw=true) | [GPT-6 Astra](gpt6-astra/games/apex-rush/README.md) |
| GPT-6.2 Sol | [apex-rush.html](gpt6.2-sol/downloads/apex-rush.html?raw=true) | [下载 ZIP](gpt6.2-sol/downloads/apex-rush.zip?raw=true) | [GPT-6.2 Sol](gpt6.2-sol/games/apex-rush/README.md) |

两个版本均使用 `apex-rush.html`。分别解压至不同目录，在支持 WebGL 2 的同一个浏览器中对照三条赛道、三辆车、两圈竞速赛和两圈计时挑战。驾驶使用 WASD 或方向键，Shift 漂移，空格释放氮气。

## 运输船对照测试

| 模型 | HTML 原文件 | ZIP | 源码与玩法 |
| --- | --- | --- | --- |
| GPT-6 Astra | [cargo-strike.html](gpt6-astra/downloads/cargo-strike.html?raw=true) | [下载 ZIP](gpt6-astra/downloads/cargo-strike.zip?raw=true) | [GPT-6 Astra](gpt6-astra/games/cargo-strike/README.md) |
| GPT-6.2 Sol | [cargo-strike.html](gpt6.2-sol/downloads/cargo-strike.html?raw=true) | [下载 ZIP](gpt6.2-sol/downloads/cargo-strike.zip?raw=true) | [GPT-6.2 Sol](gpt6.2-sol/games/cargo-strike/README.md) |

两个版本均使用 `cargo-strike.html`，解压时分别保留在各自的模型目录。在同一个支持 WebGL 2 的浏览器中选用相同武器、AI 难度和击杀目标即可比较两版的 4 对 4 对局。自由练枪可单独比较镜头、移动、后坐力和换弹手感。

## 本地预览

进入已有作品的模型目录，再执行该模型的安装和运行命令。例如，预览 GPT-6 Astra 合集：

```bash
cd gpt6-astra
npm ci
npm run dev
```

浏览器打开 `http://127.0.0.1:4173/`。离线游玩时，在对应模型的下载页保存 ZIP，解压后用浏览器打开 HTML。

新增模型时，在仓库根目录新增一个同级目录，并在上表登记作品入口。同一款游戏的不同模型版本可以分别放在各自的模型目录下。
