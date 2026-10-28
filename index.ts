import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import { compact, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadConfig, saveConfig } from "./src/config.js";
import { select } from "./src/select.js";

const followMain = "Follow main conversation model (default)";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI) return;
    try {
      const config = loadConfig();
      ctx.ui.notify(config
        ? `Compaction model: ${config.provider}/${config.model} · ${config.thinkingLevel}`
        : "Compaction follows the main model and thinking level. Use /compact-model to customize.", "info");
    } catch (error) {
      ctx.ui.notify(`Cannot load compaction settings: ${error instanceof Error ? error.message : String(error)} Run /compact-model.`, "error");
    }
  });

  pi.registerCommand("compact-model", {
    description: "Choose the compaction model and thinking level (global; leaves the main model unchanged)",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("/compact-model requires an interactive terminal.", "error");
        return;
      }
      try {
        // 损坏的配置仍允许通过选择器修复，压缩路径则严格拒绝它。
        let current;
        let label;
        try {
          current = loadConfig();
          label = current ? `${current.provider}/${current.model} · ${current.thinkingLevel}` : followMain;
        } catch { label = "Invalid configuration"; }
        const models = ctx.modelRegistry.getAvailable();
        const key = (m: { provider: string; id: string }) => `${m.provider}/${m.id}`;
        const modelKey = await select(ctx, `Compaction model (current: ${label})`,
          [{ value: "default", label: followMain },
            ...models.map((m) => ({ value: key(m), label: key(m), description: m.name }))],
          current ? `${current.provider}/${current.model}` : "default");
        if (!modelKey) return;
        if (modelKey === "default") {
          saveConfig(undefined);
          ctx.ui.notify("Compaction follows the main model and thinking level.", "info");
          return;
        }
        const model = models.find((m) => key(m) === modelKey)!;
        const levels = getSupportedThinkingLevels(model);
        if (!levels.length) throw new Error("This model has no available thinking levels.");
        const previousLevel = current?.thinkingLevel ?? pi.getThinkingLevel();
        const preferred = levels.includes(previousLevel) ? previousLevel
          : levels.includes("medium") ? "medium" : levels[0];
        const thinkingLevel = !model.reasoning ? "off" : await select(ctx,
          `${modelKey}: Choose thinking level (current: ${label})`,
          levels.map((level) => ({ value: level, label: level })), preferred);
        if (!thinkingLevel) return;
        saveConfig({ provider: model.provider, model: model.id, thinkingLevel: levels.find((l) => l === thinkingLevel)! });
        ctx.ui.notify(`Compaction model set: ${modelKey} · ${thinkingLevel}`, "info");
      } catch (error) {
        ctx.ui.notify(`Compaction settings not saved: ${error instanceof Error ? error.message : String(error)}`, "error");
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
      const saved = loadConfig();
      const model = saved ? ctx.modelRegistry.find(saved.provider, saved.model) : ctx.model;
      if (!model) throw new Error(saved
        ? `Cannot find ${saved.provider}/${saved.model}. Run /compact-model.`
        : "No main conversation model is selected.");
      const config = saved ?? { provider: model.provider, model: model.id, thinkingLevel: pi.getThinkingLevel() };
      if (!ctx.modelRegistry.hasConfiguredAuth(model)) throw new Error("Compaction model has no authentication. Run /compact-model.");
      if (!getSupportedThinkingLevels(model).includes(config.thinkingLevel)) {
        throw new Error(`Compaction model does not support ${config.thinkingLevel}. Run /compact-model.`);
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
      ctx.ui.notify(`Compaction model: ${config.provider}/${config.model} · ${config.thinkingLevel}`, "info");
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
        ctx.ui.notify(`Compaction failed: ${error instanceof Error ? error.message : String(error)}`, "error");
      }
      return { cancel: true };
    }
  });

  pi.on("session_compact", (event, ctx) => {
    const details = event.compactionEntry.details as {
      compactModel?: boolean; provider?: string; model?: string; thinkingLevel?: string;
    } | undefined;
    if (!event.fromExtension || !details?.compactModel) {
      ctx.ui.notify("This compaction did not use compact-model. Check other compaction extensions.", "warning");
      return;
    }
    const usage = event.compactionEntry.usage;
    ctx.ui.notify(`Compaction saved: ${details.provider}/${details.model} · ${details.thinkingLevel}\n` +
      (usage ? `Input ${usage.input} · Output ${usage.output} · Total ${usage.totalTokens} tokens` : "Usage unavailable"), "info");
  });
}
