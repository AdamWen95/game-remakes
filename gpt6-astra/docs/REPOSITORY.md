# 源码仓库与本地资料

整理日期：2026-11-19。本文的开发和构建路径以 `gpt6-astra/` 为合集根目录。仓库根目录的 `.gitignore` 覆盖全部模型目录。

## 适合纳入 Git 的内容

- `games/<id>/src/`、`public/`、`tests/`：各游戏的逻辑、原创资源与测试。
- `site/`、`demos.json`、根目录 `scripts/` 和 `tests/`：合集首页、统一构建及验收。
- `package.json`、`package-lock.json` 和构建 / 测试配置：可复现的依赖与开发入口。
- `scripts/`：通用构建、打包和浏览器验收脚本，默认仅使用本地地址。
- `deploy/nginx.conf`：使用示例域名和目录的通用模板。
- README、架构文档、通用部署说明、带执行日期的验证摘要。
- 各游戏的 `docs/images/`：已人工审阅的纯游戏画面，原图不含浏览器地址栏、主机信息或私人数据。

## 仅在本地保留

`.gitignore` 排除了下列内容，文件仍可留在工作目录供开发和维护使用：

| 内容 | 忽略范围 |
| --- | --- |
| 依赖、构建与发布包 | `node_modules/`、`dist/`、`release/` |
| 浏览器安装、缓存和本地工具 | `.browsers/`、`.npm-cache/`、`.qa/`、`.local/` |
| 日志、trace、原始自动截图和报告 | `*.log`、`test-results/`、`playwright-report/`、`docs/screenshots/`、`docs/*-smoke.json` |
| 以数字编号命名的主机部署配置 | `deploy/[0-9]*/` |
| 主机运维记录 | `docs/SERVER-*.md` |
| 本地环境和凭据文件 | `.env`、`.env.*`、私钥 / 证书容器扩展名；已脱敏的 `.env.example` 等示例除外 |

以上规则也覆盖嵌套的游戏 workspace。GPT-6 Astra 合集统一维护 `gpt6-astra/package-lock.json`，每个游戏拥有自己的 `package.json`。

新增私有部署资料优先放在 `.local/`，不要把真实 IP、账号、网段、认证信息或绝对个人目录填入公共模板。实际部署配置应独立于公开源码管理。忽略规则不会修改已经运行的服务器，也不会删除本地文件。

## 自动验收产物

游戏目录内的 `scripts/production-smoke.mjs` 可能记录 `QA_URL` 指向的真实地址，默认把报告与截图写入本游戏的 `.qa/production-smoke/`。常规端到端测试产生的 `docs/screenshots/` 与 Playwright 报告也不参与提交。需要增加展示图时，先检查画面和文件元数据，再人工复制到游戏的 `docs/images/`；不要让自动测试覆盖公开展示图。

## 后续上传前复核

初始化自己的仓库后，可用下面的只读命令复核文件范围：

```bash
git status --short --untracked-files=all
git ls-files --cached --others --exclude-standard
git diff --cached --name-only
```

`.gitignore` 只影响未跟踪文件。如果之前已经跟踪私有资料，需要另行检查索引和历史；单纯新增忽略规则不会清除已有提交。不要使用强制添加绕过这些规则。

手动压缩整个工作目录或在网页上拖入整个目录也不会自动应用 `.gitignore`。上传源码时仅使用已审查的文件集合；`release/` 里旧的生产包、源码归档和日志应留在本地。`npm run package` 生成的是部署用静态包，不是 Git 源码备份。

`npm run build:single` 生成的各游戏 `release/*.html` 也是构建产物，默认不纳入 Git；它们可作为单独文件分发。构建入口、独立测试配置和 [游戏分享说明](../games/bubble-journey/docs/SHARING.md) 属于公共源码。不要将原始测试记录或私有运维资料附在分享文件旁一并发送。

按当前发布约定，经过校验的 HTML 成品、仅包含该 HTML 的 ZIP 及校验清单纳入根目录 [downloads/](../downloads/README.md)，由普通 Git 提交记录其更新，不创建标签或 Release。原始 `dist/`、各游戏 `release/`、缓存和运维资料仍被忽略。每次更新成品需核对 ZIP 内 HTML 与构建文件完全一致，并同步 README 和校验清单。

源码仓库发布与服务器部署分别进行。提交和推送源码不会自动更新既有站点；实际部署应使用单独生成并验证的产物。
