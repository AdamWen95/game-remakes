# 在线试玩与成品校验

本目录保存已构建的游戏成品，直接纳入 Git 仓库。无需安装 Node.js、依赖或构建工具。

| 游戏 | 在线试玩 |
| --- | --- |
| 泡泡奇旅 | [在线试玩](https://bubble-journey-compare.pages.dev/astra/) |
| 疾风竞速 | [在线试玩](https://bubble-journey-compare.pages.dev/apex-rush/astra/) |
| 运输船 | [在线试玩](https://bubble-journey-compare.pages.dev/cargo-strike/astra/) |

文件大小、构建源码提交及 SHA-256 见 [manifest.json](manifest.json)，纯文本校验清单见 [SHA256SUMS.txt](SHA256SUMS.txt)。声音需首次交互后开启，战绩仅保存在使用者自己的浏览器。

## 维护成品

《疾风竞速》包含三条 3D 赛道、五位 AI 对手、漂移与氮气、触屏及计时挑战，需要 WebGL 2。成品构建核对日期为 2026-11-13。

《运输船》提供 4 对 4 单机 AI 团竞、三种主武器、手枪与手雷、开镜、复活和练枪模式，支持键鼠与触屏，需要 WebGL 2。成品构建核对日期为 2026-11-14。这是非官方重制，场景、武器、材质与声音在本地生成，不包含原游戏提取的资产。

疾风竞速和运输船的源码与成品在同一提交内归档。清单中的 `sourceCommit: null` 和 `sourceState: uncommitted-working-tree` 记录其构建时输入来自尚未提交的工作区。可在 `gpt6-astra/` 内执行 `git log --follow -- downloads/<id>.html` 追溯归档提交，并用清单中的 SHA-256 校验成品。

1. 从 `gpt6-astra/` 目录运行 `npm run build:single`，根据 `demos.json` 检查所有已登记游戏。
2. 将每个游戏生成的独立 HTML 复制为本目录 `<id>.html`。
3. 使用标准 ZIP 工具压缩该文件为 `<id>.zip`；归档根目录只能有这一个 HTML，不能附带源码、日志或运维资料。
4. 核对归档内 HTML 与构建文件逐字节一致，更新 `manifest.json` 和 `SHA256SUMS.txt`。
5. 经审查后提交推送这些文件。不要强制添加其他被忽略的构建目录。

此流程使用普通仓库文件，不需要创建 Git 标签或 GitHub Release。目录中的 HTML 与 ZIP 都是公开分发文件，不应包含访问凭据、内网地址或个人数据。

成品按原始字节保存在 Git 中，保留第三方许可的原有换行及内嵌着色器文本，不做文本转换或自动合并。修改游戏时应更新源码后重建，不能直接编辑压缩后的 HTML。
