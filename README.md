# Game Remakes

按生成模型归档网页游戏 Demo。每个模型有独立的目录，游戏源码、构建入口和可下载成品随该模型维护。

三款游戏均可在线试玩，无需下载。“在线试玩”打开 Cloudflare Pages 上的独立游戏页面，“下载 ZIP”用于离线游玩。

| 模型 | 作品 | 入口 |
| --- | --- | --- |
| GPT-6 Astra | 泡泡奇旅、疾风竞速、运输船 | [作品与开发说明](gpt6-astra/README.md) · [离线下载](gpt6-astra/downloads/README.md) |
| GPT-6.2 Sol | 泡泡奇旅、疾风竞速、运输船 | [作品与开发说明](gpt6.2-sol/README.md) · [离线下载](gpt6.2-sol/downloads/README.md) |

## 泡泡奇旅对照测试

| 模型 | 在线试玩 | 离线 ZIP | HTML 原文件 |
| --- | --- | --- | --- |
| GPT-6 Astra | [在线试玩](https://bubble-journey-compare.pages.dev/astra/) | [下载 ZIP](gpt6-astra/downloads/bubble-journey.zip?raw=true) | [bubble-journey.html](gpt6-astra/downloads/bubble-journey.html?raw=true) |
| GPT-6.2 Sol | [在线试玩](https://bubble-journey-compare.pages.dev/sol/) | [下载 ZIP](gpt6.2-sol/downloads/bubble-journey.zip?raw=true) | [bubble-journey.html](gpt6.2-sol/downloads/bubble-journey.html?raw=true) |

两版同名。离线游玩时，可将各版 ZIP 解压到不同目录，再用浏览器打开 HTML。

## 疾风竞速对照测试

| 模型 | 在线试玩 | 离线 ZIP | HTML 原文件 | 源码与玩法 |
| --- | --- | --- | --- | --- |
| GPT-6 Astra | [在线试玩](https://bubble-journey-compare.pages.dev/apex-rush/astra/) | [下载 ZIP](gpt6-astra/downloads/apex-rush.zip?raw=true) | [apex-rush.html](gpt6-astra/downloads/apex-rush.html?raw=true) | [GPT-6 Astra](gpt6-astra/games/apex-rush/README.md) |
| GPT-6.2 Sol | [在线试玩](https://bubble-journey-compare.pages.dev/apex-rush/sol/) | [下载 ZIP](gpt6.2-sol/downloads/apex-rush.zip?raw=true) | [apex-rush.html](gpt6.2-sol/downloads/apex-rush.html?raw=true) | [GPT-6.2 Sol](gpt6.2-sol/games/apex-rush/README.md) |

两版均需支持 WebGL 2 的浏览器。可用同一浏览器对照三条赛道、三辆车、两圈竞速赛和两圈计时挑战。驾驶使用 WASD 或方向键，Shift 漂移，空格释放氮气。

## 运输船对照测试

| 模型 | 在线试玩 | 离线 ZIP | HTML 原文件 | 源码与玩法 |
| --- | --- | --- | --- | --- |
| GPT-6 Astra | [在线试玩](https://bubble-journey-compare.pages.dev/cargo-strike/astra/) | [下载 ZIP](gpt6-astra/downloads/cargo-strike.zip?raw=true) | [cargo-strike.html](gpt6-astra/downloads/cargo-strike.html?raw=true) | [GPT-6 Astra](gpt6-astra/games/cargo-strike/README.md) |
| GPT-6.2 Sol | [在线试玩](https://bubble-journey-compare.pages.dev/cargo-strike/sol/) | [下载 ZIP](gpt6.2-sol/downloads/cargo-strike.zip?raw=true) | [cargo-strike.html](gpt6.2-sol/downloads/cargo-strike.html?raw=true) | [GPT-6.2 Sol](gpt6.2-sol/games/cargo-strike/README.md) |

两版均需支持 WebGL 2 的浏览器。选择相同武器、AI 难度和击杀目标，即可比较两版的 4 对 4 对局。自由练枪可单独比较镜头、移动、后坐力和换弹手感。

## 本地预览

进入已有作品的模型目录，再执行该模型的安装和运行命令。例如，预览 GPT-6 Astra 合集：

```bash
cd gpt6-astra
npm ci
npm run dev
```

浏览器打开 `http://127.0.0.1:4173/`。离线游玩时，在对应模型的下载页保存 ZIP，解压后用浏览器打开 HTML。

新增模型时，在仓库根目录新增一个同级目录，并在上表登记作品入口。同一款游戏的不同模型版本可以分别放在各自的模型目录下。

## 在线试玩发布

Cloudflare Pages 上的游戏使用各模型 `downloads/` 下的单文件 HTML，目前通过 Direct Upload 单独发布。更新在线版时，上传包含全部已公开试玩路径的静态目录，再检查新旧入口。GitHub 仓库更新后，Cloudflare Pages 上的版本需另行发布。
