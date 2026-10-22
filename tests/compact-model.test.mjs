import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { beforeEach } from "node:test";
import { extension, tui } from "./pi-host.mjs";

beforeEach(() => {
  process.env.PI_CODING_AGENT_DIR = mkdtempSync(join(tmpdir(), "compact-model-test-"));
});
const luna = { provider: "openai-codex", id: "gpt-6-luna", reasoning: true,
  thinkingLevelMap: { xhigh: "xhigh" }, maxTokens: 32768 };
const small = { provider: "test", id: "compact-small", reasoning: true, maxTokens: 8192 };
const plain = { provider: "test", id: "plain", reasoning: false, maxTokens: 8192 };

function setup({ keys = [], models = [luna, small, plain], failure, split = false } = {}) {
  const handlers = new Map(), commands = new Map(), notices = [], requests = [], screens = [];
  const pi = { on: (name, fn) => handlers.set(name, fn),
    registerCommand: (name, command) => commands.set(name, command), events: new EventEmitter() };
  extension(pi);
  const main = { provider: "test-main", id: "main" };
  const ctx = {
    mode: "tui", hasUI: true, model: main,
    ui: {
      notify: (...args) => notices.push(args),
      async custom(factory) {
        const input = keys.shift();
        assert.ok(input, "unexpected selector");
        let value, finished = false;
        const theme = { fg: (_color, s) => s, bold: (s) => s };
        const component = factory({ requestRender() {} }, theme, tui.getKeybindings(),
          (selected) => { value = selected; finished = true; });
        component.focused = true;
        screens.push(component.render(80).join("\n"));
        for (const key of input) component.handleInput(key);
        assert.ok(finished, "selector did not finish");
        return value;
      },
    },
    modelRegistry: {
      getAvailable: () => models,
      find: (provider, id) => models.find((m) => m.provider === provider && m.id === id),
      hasConfiguredAuth: () => true,
      streamSimple(model, context, options) {
        requests.push({ model, context, options });
        return { result: async () => {
          if (failure) throw new Error(failure);
          return { role: "assistant", content: [{ type: "text", text: "## Goal\nContinue implementation." }],
            stopReason: "stop", timestamp: Date.now(),
            usage: { input: 100, output: 20, cacheRead: 0, cacheWrite: 0, totalTokens: 120,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
        } };
      },
    },
  };
  const event = {
    reason: "manual", customInstructions: "Keep the deployment decision", signal: new AbortController().signal,
    branchEntries: [],
    preparation: {
      firstKeptEntryId: "recent", tokensBefore: 50000, previousSummary: "Previous progress",
      messagesToSummarize: [{ role: "user", content: "Implement this", timestamp: 1 }],
      isSplitTurn: split,
      turnPrefixMessages: split ? [{ role: "user", content: "Continue", timestamp: 2 }] : [],
      fileOps: { read: new Set(["read.ts"]), written: new Set(["write.ts"]), edited: new Set() },
      settings: { enabled: true, reserveTokens: 16384, keepRecentTokens: 20000 },
    },
  };
  return { pi, ctx, event, notices, requests, screens,
    choose: () => commands.get("compact-model")?.handler("", ctx),
    compact: () => handlers.get("session_before_compact")?.(event, ctx),
    saved: (entry) => handlers.get("session_compact")?.({ compactionEntry: entry, fromExtension: true }, ctx) };
}

test("command searches models, confirms thinking, persists globally and leaves conversation model unchanged", async () => {
  const s = setup({ keys: [[..."compact-small", "\r"], ["\r"]] });
  await s.choose();
  assert.ok(!s.notices.some(([, level]) => level === "error"), JSON.stringify(s.notices));
  assert.match(s.screens[0], /openai-codex\/gpt-6-luna.*xhigh/);
  assert.match(s.screens[1], /medium/);
  const freshSession = setup();
  const { compaction } = await freshSession.compact();
  assert.equal(freshSession.requests[0].model.id, "compact-small");
  assert.equal(freshSession.requests[0].options.reasoning, "medium");
  assert.equal(freshSession.ctx.model.id, "main");
  assert.equal(compaction.firstKeptEntryId, "recent");
  assert.equal(compaction.usage.totalTokens, 120);
  assert.equal(compaction.details.thinkingLevel, "medium");
});

for (const reason of ["manual", "threshold", "overflow"]) {
  test(`${reason} without saved settings keeps luna/xhigh and native summary behavior`, async () => {
    const s = setup({ split: true });
    s.event.reason = reason;
    const { compaction } = await s.compact();
    assert.ok(s.requests.every((r) => r.model.id === "gpt-6-luna" && r.options.reasoning === "xhigh"));
    assert.equal(compaction.usage.totalTokens, 240);
    assert.match(compaction.summary, /Turn Context \(split turn\)/);
    assert.match(JSON.stringify(s.requests), /Keep the deployment decision/);
    assert.ok(!s.notices.some(([message]) => message.includes("压缩已保存")));
    await s.saved(compaction);
    assert.ok(s.notices.some(([message]) => message.includes("总计 240 tokens")));
    assert.equal(compaction.details.reason, reason);
    assert.equal(s.ctx.model.id, "main");
  });
}

for (const keys of [[["\x1b"]], [[..."compact-small", "\r"], ["\x1b"]]]) {
  test(`cancel at step ${keys.length} leaves persisted settings unchanged`, async () => {
    const s = setup({ keys });
    await s.choose();
    const freshSession = setup();
    await freshSession.compact();
    assert.equal(freshSession.requests[0].model.id, "gpt-6-luna");
    assert.equal(freshSession.requests[0].options.reasoning, "xhigh");
  });
}

test("non-reasoning model skips thinking selection and compacts without reasoning", async () => {
  const s = setup({ keys: [[..."test/plain", "\r"]] });
  await s.choose();
  assert.ok(!s.notices.some(([, level]) => level === "error"), JSON.stringify(s.notices));
  const freshSession = setup();
  const { compaction } = await freshSession.compact();
  assert.equal(freshSession.requests[0].model.id, "plain");
  assert.equal(freshSession.requests[0].options.reasoning, undefined);
  assert.equal(compaction.details.thinkingLevel, "off");
});

test("changing model preserves a supported thinking level and the selector hides unsupported levels", async () => {
  const first = setup({ keys: [[..."compact-small", "\r"], ["\x1b[B", "\r"]] });
  await first.choose(); // medium → high
  const next = setup({ keys: [[..."gpt-6-luna", "\r"], ["\r"]] });
  await next.choose();
  assert.match(first.screens[1], /→ medium/);
  assert.ok(!first.screens[1].includes("→ xhigh"));
  assert.match(next.screens[1], /→ high/);
  const fresh = setup();
  await fresh.compact();
  assert.equal(fresh.requests[0].options.reasoning, "high");
});

for (const scenario of ["missing", "auth", "invalid", "unsupported", "failure", "aborted"]) {
  test(`${scenario} cancels compaction without fallback`, async () => {
    const s = setup({ models: scenario === "missing" ? [small] : undefined,
      failure: scenario === "failure" ? "provider unavailable" : undefined });
    if (scenario === "auth") s.ctx.modelRegistry.hasConfiguredAuth = () => false;
    if (scenario === "invalid") writeFileSync(join(process.env.PI_CODING_AGENT_DIR, "compact-model.json"), "{");
    if (scenario === "unsupported") writeFileSync(join(process.env.PI_CODING_AGENT_DIR, "compact-model.json"),
      JSON.stringify({ provider: "test", model: "compact-small", thinkingLevel: "xhigh" }));
    if (scenario === "aborted") s.event.signal = AbortSignal.abort();
    assert.deepEqual(await s.compact(), { cancel: true });
    if (scenario !== "failure") assert.equal(s.requests.length, 0);
  });
}

for (const marker of ["compactSuit", "compactModel"]) {
  test(`keeps cumulative file tracking from ${marker} summaries`, async () => {
    const s = setup();
    s.event.branchEntries.push({ type: "compaction", details: {
      [marker]: true, readFiles: ["old-read.ts"], modifiedFiles: ["old-edit.ts"],
    } });
    const { compaction } = await s.compact();
    assert.deepEqual(compaction.details.readFiles, ["old-read.ts", "read.ts"]);
    assert.deepEqual(compaction.details.modifiedFiles, ["old-edit.ts", "write.ts"]);
    assert.ok(!s.event.preparation.fileOps.read.has("old-read.ts"));
  });
}
