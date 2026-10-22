import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerProvider("compact-smoke", {
    api: "openai-completions",
    apiKey: "test-only",
    baseUrl: "https://unused.invalid",
    models: [
      { id: "reasoner", name: "Smoke reasoner", reasoning: true,
        thinkingLevelMap: { xhigh: null, max: null },
        input: ["text"], contextWindow: 40000, maxTokens: 4000,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } },
      { id: "plain", name: "Smoke plain", reasoning: false,
        input: ["text"], contextWindow: 40000, maxTokens: 4000,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } },
    ],
    streamSimple() { throw new Error("TUI smoke must not make model requests"); },
  });
}
