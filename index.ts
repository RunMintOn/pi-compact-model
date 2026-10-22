import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import { compact, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadConfig, saveConfig } from "./src/config.js";
import { select } from "./src/select.js";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("compact-model", {
    description: "选择 Compact 模型与思考等级（全局保存，不改变主对话模型）",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("/compact-model 需要交互式终端。", "error");
        return;
      }
      try {
        // 损坏的配置仍允许通过选择器修复，压缩路径则严格拒绝它。
        let current;
        try { current = loadConfig(); } catch { current = undefined; }
        const label = current ? `${current.provider}/${current.model} · ${current.thinkingLevel}` : "配置无效";
        const models = ctx.modelRegistry.getAvailable();
        if (!models.length) throw new Error("没有已配置认证的可用模型");
        const key = (m: { provider: string; id: string }) => `${m.provider}/${m.id}`;
        const modelKey = await select(ctx, `Compact 模型（当前：${label}）`,
          models.map((m) => ({ value: key(m), label: key(m), description: m.name })),
          current ? `${current.provider}/${current.model}` : undefined);
        if (!modelKey) return;
        const model = models.find((m) => key(m) === modelKey)!;
        const levels = getSupportedThinkingLevels(model);
        if (!levels.length) throw new Error("该模型没有可用的思考等级");
        const preferred = current && levels.includes(current.thinkingLevel) ? current.thinkingLevel
          : levels.includes("medium") ? "medium" : levels[0];
        const thinkingLevel = !model.reasoning ? "off" : await select(ctx,
          `${modelKey}：选择思考等级（当前：${label}）`,
          levels.map((level) => ({ value: level, label: level })), preferred);
        if (!thinkingLevel) return;
        saveConfig({ provider: model.provider, model: model.id, thinkingLevel: levels.find((l) => l === thinkingLevel)! });
        ctx.ui.notify(`Compact 已设置：${modelKey} · ${thinkingLevel}`, "info");
      } catch (error) {
        ctx.ui.notify(`Compact 设置未保存：${error instanceof Error ? error.message : String(error)}`, "error");
      }
    },
  });

  pi.on("session_before_compact", async (event, ctx) => {
    try {
      // Pi 的取消只阻止后续 hook；先询问交接插件，保证两种加载顺序都先交接再压缩。
      const gate = { cancel: false, handoffEntryId: undefined as string | undefined };
      pi.events.emit("compact-handoff:before-compact", { event, ctx, gate });
      if (gate.cancel) return { cancel: true };
      event.signal.throwIfAborted();
      const config = loadConfig();
      const model = ctx.modelRegistry.find(config.provider, config.model);
      if (!model) throw new Error(`找不到 ${config.provider}/${config.model}，请运行 /compact-model`);
      if (!ctx.modelRegistry.hasConfiguredAuth(model)) throw new Error("压缩模型缺少认证，请运行 /compact-model");
      if (!getSupportedThinkingLevels(model).includes(config.thinkingLevel)) {
        throw new Error(`压缩模型不支持 ${config.thinkingLevel}，请运行 /compact-model 重新选择`);
      }
      const preparation = {
        ...event.preparation,
        fileOps: {
          read: new Set(event.preparation.fileOps.read),
          written: new Set(event.preparation.fileOps.written),
          edited: new Set(event.preparation.fileOps.edited),
        },
      };
      // Pi 不自动继承 fromHook 摘要的文件列表；同时接续旧插件的历史摘要。
      const previous = event.branchEntries.findLast((entry) => entry.type === "compaction");
      const details = previous?.details as {
        compactModel?: boolean; compactSuit?: boolean; readFiles?: string[]; modifiedFiles?: string[];
      } | undefined;
      if (details?.compactModel || details?.compactSuit) {
        for (const file of details.readFiles ?? []) preparation.fileOps.read.add(file);
        for (const file of details.modifiedFiles ?? []) preparation.fileOps.edited.add(file);
      }
      ctx.ui.notify(`压缩模型：${config.provider}/${config.model} · ${config.thinkingLevel}`, "info");
      const result = await compact(preparation, model, undefined, undefined,
        event.customInstructions, event.signal, config.thinkingLevel,
        (target, context, options) => ctx.modelRegistry.streamSimple(target, context, options));
      return {
        compaction: {
          ...result,
          details: {
            ...(result.details as object), compactModel: true,
            provider: model.provider, model: model.id, thinkingLevel: config.thinkingLevel, reason: event.reason,
            ...(gate.handoffEntryId ? { handoffEntryId: gate.handoffEntryId } : {}),
          },
        },
      };
    } catch (error) {
      // 抛出 hook 异常会让 Pi 回退到默认压缩，必须显式取消。
      if (!event.signal.aborted) {
        ctx.ui.notify(`压缩未完成：${error instanceof Error ? error.message : String(error)}`, "error");
      }
      return { cancel: true };
    }
  });

  pi.on("session_compact", (event, ctx) => {
    const details = event.compactionEntry.details as {
      compactModel?: boolean; provider?: string; model?: string; thinkingLevel?: string;
    } | undefined;
    if (!event.fromExtension || !details?.compactModel) {
      ctx.ui.notify("本次压缩未使用 compact-model，请检查其他压缩扩展。", "warning");
      return;
    }
    const usage = event.compactionEntry.usage;
    ctx.ui.notify(`压缩已保存：${details.provider}/${details.model} · ${details.thinkingLevel}\n` +
      (usage ? `输入 ${usage.input} · 输出 ${usage.output} · 总计 ${usage.totalTokens} tokens` : "用量未提供"), "info");
  });
}
