# 合集静态部署

说明日期：2026-11-13。以下均为通用模板，不包含实际服务器地址或账号。

## 构建和文件

```bash
npm ci
npm run package
```

输出：`release/gpt6-astra-demos-1.0.0.tar.gz` 及 SHA-256 校验文件。归档中只有合集首页、各游戏的独立 HTML 和 `manifest.json`；不包含源码、依赖、私有部署资料或测试结果。

目录结构必须保持：

```text
index.html
bubble-journey/index.html
manifest.json
```

仅需单个游戏时，可直接分发其 `index.html`；整个合集首页还需要同目录下的游戏子目录。

## Nginx

使用 [示例配置](../deploy/nginx.conf)，把 `demos.example.com` 和 `/var/www/gpt6-astra-demos/current` 替换为实际值。目录须对目标 Nginx 运行用户可读。使用现有部署方式配置 TLS，先 `nginx -t` 再按该环境的正常方式 reload。

合集和游戏都含内联内容，示例响应头允许内联脚本 / 样式；每个游戏仍可通过自己的 meta CSP 进一步约束。不要直接套用旧多文件游戏版仅允许 `script-src 'self'` 的响应头，否则单 HTML 的脚本会被拦截。

所有页面链接都是相对路径，已通过 `/gpt6-astra-demos/` 子路径测试。按现有站点目录结构托管即可，缺失文件应返回 404，不要把不存在的 JS 或 HTML 请求改成另一个页面。

## 发布与恢复

1. 校验归档 `.sha256` 和 manifest 的逐文件 SHA-256。
2. 解压到独立版本目录并检查访问权限，不覆盖正在提供服务的目录。
3. 用现有站点的原子目录 / 软链接切换方式发布，保留上一版本。
4. 验证合集入口、搜索、游戏入口、下载离线 HTML、暂停和结算。
5. 异常时切回上一个已验证版本。无服务端数据库或数据迁移；战绩保存在各浏览器。

本次工程结构调整只在本地执行，没有连接服务器、替换已有发布目录、修改服务或防火墙。游戏本身的多文件构建与通用 Nginx 模板仍保存在 `games/bubble-journey/`，可按 [游戏原部署说明](../games/bubble-journey/docs/DEPLOYMENT.md) 单独使用。
