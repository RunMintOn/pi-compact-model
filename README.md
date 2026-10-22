# pi-compact-model

独立设置 Pi 上下文压缩使用的模型与思考等级，不改变主对话模型。

## 使用

运行 `/compact-model`：

1. 输入模型名或提供商名搜索，在已配置认证的模型中选择。
2. 选择该模型支持的思考等级。默认选中原等级；不支持时优先选中 `medium`，否则选中首个可用等级。不支持思考的模型直接保存为 `off`。
3. 确认后全局保存。任一步按 Esc 取消，原配置不变。

当前配置显示在选择器标题中。配置保存在 Pi 用户目录的 `compact-model.json`（通常为 `~/.pi/agent/compact-model.json`），跨项目、会话、重载和重启生效。没有配置时默认使用 `openai-codex/gpt-6-luna`、`xhigh`。其他会话在下一次压缩时读取最新配置。

自动 threshold、手动 `/compact` 和 overflow 恢复都使用所选配置。模型缺失、认证缺失、等级失效、配置损坏或模型调用失败时取消本次压缩，不自动回退。可用 `/compact-model` 修复配置。

调用 Pi 原生 `compact()`，保留摘要格式、压缩边界、近期消息保留、分段摘要、文件追踪和用量统计。继承旧 `compact-suit` 摘要的文件记录。触发阈值仍由主模型和 Pi 设置决定，不接管 `/tree` 分支摘要。

压缩保存后才显示成功通知。会话摘要的 `details` 记录 `compactModel`、`provider`、`model`、`thinkingLevel` 和 `reason`，用量保存在 `usage` 中。

## 安装与组合

```bash
pi install /path/to/26-pi-compact-model
```

已打开的终端运行 `/reload`。命令需要交互式终端；非交互式压缩仍使用全局配置。

可独立使用，也可与 `27-pi-compact-handoff` 组合。组合时先交接再压缩，不依赖加载顺序。不要同时加载旧 `24-compact-suit`。

两插件通过同步事件 `compact-handoff:before-compact` 协作：模型插件在生成摘要前发送 `{ event, ctx, gate }`，交接插件可设置 `gate.cancel` 或 `gate.handoffEntryId`。交接插件也处理 Pi 原生压缩事件。事件只协调交接门控，不选择模型；不需要安装共享包。

## 验证

需要 PATH 中的 Pi 1.4.0 或兼容版本。

```bash
npm install --ignore-scripts --legacy-peer-deps
npm run check
npm test
```

测试通过实际选择器输入及压缩事件接口运行，使用真实 Pi 摘要逻辑，仅模拟提供商响应，不发起收费请求。

已安装 `expect` 时，可重复运行真实终端检查（使用隔离的用户目录和假提供商，不发起请求）：

```bash
expect scripts/selector-smoke.exp "$(mktemp -d /tmp/pi-compact-selector.XXXXXX)"
```

检查 Slash 命令、搜索、思考等级、保存、取消、`/reload` 和新进程恢复配置；ANSI 终端日志保存在指定临时目录。
