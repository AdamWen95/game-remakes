# 新增一个游戏

当前约定核对日期：2026-11-13。新游戏是独立 npm workspace，无需依赖《泡泡奇旅》的代码。

1. 新建 `games/<id>/`。`id` 使用小写字母、数字和连字符，以字母开头，长度 2–61。
2. 在该目录声明 `package.json`，`name` 与 id 一致，提供 `build:single`、`test`、`test:single` 脚本；按实际需要提供 `dev`、常规 `build` 和浏览器测试。所有依赖写在本游戏清单内，使用根目录锁文件安装。
3. `build:single` 必须生成完整 HTML：没有伴随资源、远程依赖或开发诊断入口，能通过 `file://` 直接运行。保留第三方许可。失败必须返回非零退出码。
4. 准备经过人工审查的 PNG 预览图，放在游戏内；原始自动截图留在忽略目录。
5. 在根目录 `demos.json` 的 `games` 数组添加一项。根目录不需要新增针对该游戏的特判。

清单示例（路径相对于对应游戏目录）：

```json
{
  "id": "my-new-game",
  "title": "新游戏",
  "subtitle": "My New Game",
  "description": "说明实际可玩的内容。",
  "category": "解谜",
  "tags": ["独立运行", "原创素材"],
  "controls": "按实际操作填写",
  "technology": "按实际技术栈填写",
  "singleFile": "release/my-new-game.html",
  "preview": "docs/images/preview.png",
  "accent": "mint"
}
```

`accent` 支持 `mint`、`lilac`、`peach`。构建会检查重复 id、字段、越界路径、文件实路径、包名及构建入口。只登记已经可玩的游戏，不把未实现的条目当作完成作品。

从根目录执行 `npm install` 更新 workspace 链接与统一锁文件，再运行 `npm test`、`npm run build` 和相关浏览器测试。根构建按清单顺序调用游戏构建，全部成功后才替换合集 `dist/`；不支持单文件的游戏需先完成该输出契约，不能静默降级为缺文件的网站。

已有游戏的运行时不相互引用，不建立无实际用例的共享游戏框架。需要共享能力时先明确真实的第二个使用者，再决定是否抽取。
