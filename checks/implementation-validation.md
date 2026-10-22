# Compact 拆分验证

环境：2026-10-22，Pi 1.4.0，Node.js，macOS。

## 已执行

- `npm run check`：两个新包的严格类型检查通过。
- `npm test`：模型插件 16 项通过；Handoff 插件 30 项通过（含 12 个真实宿主集成场景）。
- 真实终端 smoke：Slash 命令、模型搜索、思考等级选择、保存、Esc 取消、`/reload`、退出后新进程读取全局配置、非思考模型跳过等级选择均通过。
- 集成场景覆盖 Handoff 单独使用、两个插件的两种加载顺序、多轮工具调用、请求前阈值检查、完整保留交接回复、自动续跑、失败与取消，以及 overflow 优先恢复。
- `PI_OFFLINE=1 pi list` 确认全局包配置包含 26、27，不再包含 24。
- 真实资源加载器通过两个包的 manifest 加载入口，发现 `/compact-model`，无加载错误。
- 全局设置差异仅包含旧包替换为两个新包及文件末尾换行。未手动建立生产 `compact-model.json`，默认 luna/xhigh 保持有效。
- `22-pi-compact-tool` 的已有改动保持不动。

所有模型响应均由假提供商提供，没有发起真实模型请求。

## 可检查的结果

- 模型测试日志：`/tmp/pi-compact-model-final-tests.log`
- Handoff 测试日志（包含每个场景的 evidence.json 路径）：`/tmp/pi-compact-handoff-final-tests.log`
- 真实终端日志与隔离配置：`/tmp/pi-compact-selector.gRraPj/`
- manifest 加载结果：`/tmp/pi-compact-manifest-load.log`
- 全局配置迁移前备份：`/tmp/pi-settings-before-compact-split.ltNY35`

临时目录会受系统清理影响。可按两个包 README 中的命令重复验证。

## Standards review

直接检查新包完整源码、测试、manifest、文档及归档修改；未使用子代理。新仓库以空目录为基线。

- 沿用 Pi 原生摘要和 UI 基础模块；没有新增运行时依赖或共享包。
- 配置只在命令完整确认后原子替换。压缩异常显式取消，避免 hook 抛错触发默认模型回退。
- 两包不相互导入；协作事件仅负责交接门控。Pi 会在替换运行时清理事件订阅。
- 未发现需要修复的规范问题。

## Spec review

对照本地两个 ticket 和会话中确认的方案，检查模型与等级选择、全局保存、默认配置、取消、失败、独立使用、组合使用、加载顺序、旧插件归档和全局安装迁移。

未发现缺失或超出范围的行为。真实模型是否遵循交接提示词未在本次测试中验证。

旧 24 目录与全局设置不在 Git 仓库内；两个新包分别建立仓库并提交。当前用户会话需自行执行 `/reload` 才会替换已加载的旧运行时。
