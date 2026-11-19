# Linux / Nginx 静态部署

说明整理日期：2026-11-13。本文针对本游戏的常规多文件输出，目录均相对于 `games/bubble-journey/`。整个合集的部署见 [合集部署说明](../../../docs/DEPLOYMENT.md)。域名和目录均为示例；实际主机配置与运维记录保存在本地，不纳入源码仓库。

## 1. 本地构建与校验

```bash
npm ci
npm run test --workspace=bubble-journey
npm run package --workspace=bubble-journey
```

`release/` 含压缩包、`.sha256` 和逐文件 SHA-256 的 `manifest.json`。压缩包根目录就是 `index.html`、`favicon.svg`、`THIRD-PARTY-NOTICES.txt` 与 `assets/`，不含源代码、依赖、测试缓存、浏览器二进制、环境配置或个人数据。

上述命令从合集根目录执行。游戏的 `dist/` 与 `release/` 均由构建生成并已加入 `.gitignore`，不需要从仓库下载这些目录。

上传压缩包和校验文件到服务器的临时发布目录，使用你的正常 SSH / SFTP 认证流程。游戏无需任何密钥。

```bash
sha256sum -c bubble-journey-1.0.0.tar.gz.sha256
tar -tzf bubble-journey-1.0.0.tar.gz
```

## 2. 独立目录发布

以下命令为部署模板，执行前核对站点域名、权限和路径，避免影响其他站点。以已有 Nginx 为前提，不自动安装、升级或重启整机。

```bash
release_dir=/var/www/bubble-journey/releases/1.0.0
sudo mkdir -p "$release_dir"
sudo tar -xzf bubble-journey-1.0.0.tar.gz -C "$release_dir"
sudo find "$release_dir" -type d -exec chmod 755 {} \;
sudo find "$release_dir" -type f -exec chmod 644 {} \;
```

先保存已有 `current` 链接指向用于回退。确认 `current` 不是真实业务目录，再使用临时软链接和同文件系统原子替换：

```bash
readlink /var/www/bubble-journey/current
sudo ln -s /var/www/bubble-journey/releases/1.0.0 /var/www/bubble-journey/current.next
sudo mv -Tf /var/www/bubble-journey/current.next /var/www/bubble-journey/current
```

如果 `current.next` 已存在，先查明来源，不覆盖其他部署进程的链接。以后每次使用独立版本目录，保留至少一个已验证版本；不要直接覆盖正在提供服务的 `assets/`。

## 3. Nginx 站点

复制 [nginx.conf](../deploy/nginx.conf) 到该环境已有的独立站点配置目录，将：

- `game.example.com` 替换为实际域名。
- `root` 替换为当前静态版本的软链接路径。
- HTTPS 按现有证书 / 反向代理方案配置；本模板为 HTTP，未包含证书签发或防火墙修改。

```bash
sudo nginx -t
sudo systemctl reload nginx
curl -I http://game.example.com/
```

只有 `nginx -t` 成功后才 reload。无需 PM2、Node 服务、数据库、WebSocket 或后台进程。`vite preview` 仅用于本地构建检查，不作为生产服务。[Vite 静态部署说明](https://vite.dev/guide/static-deploy.html)

示例配置为 HTML 禁缓存、哈希资源一年缓存、gzip、MIME 类型保护和内容安全策略。DOM / SVG 使用动态内联样式，因此 `style-src` 允许内联；脚本只允许同源。Phaser 将 SVG 转为 `data:` / `blob:` 图像，不能移除这两个 `img-src` 来源。

## 4. 子路径部署

构建设置 `base: './'`，没有客户端路由。可以把 `dist` 内容放入现有静态根目录的 `games/bubble/`，使用尾部斜杠 URL：

```text
https://example.com/games/bubble/
```

为该子路径匹配相同的缓存策略：HTML 必须及时更新，`games/bubble/assets/` 可以长期缓存。所有资源都是相对路径，不需要重新构建。不要把不存在的 JS 请求重写为 HTML；应返回 404。

## 5. 上线验收与回退

1. 检查首页、CSS、JS、SVG 与版权说明 HTTP 状态正确；缺失文件返回 404。
2. 打开浏览器开发者工具，确认没有 CSP、资源加载或 JavaScript 错误。
3. 完成一局，检查键盘、触屏、声音、暂停、结算与战绩；声音要先点一次页面。
4. 检查手机纵向 / 横向布局，首次加载和刷新后的缓存行为。
5. 出错时将 `current` 原子指回已验证目录，刷新页面复验。无需恢复数据库；浏览器 v1 战绩保留。

旧页面可能继续使用旧资源，发布时应保留上一版本资源的可用性，或提醒用户刷新。当前方案没有 Service Worker，不存在额外离线缓存更新步骤。原子替换仅保护单次文件路径切换，不能保证用户在加载 HTML 与加载 JS 之间恰好遇到发布时永远不请求旧哈希；高流量站点可在新版本 assets 中保留上个版本的哈希文件一个缓存周期。
