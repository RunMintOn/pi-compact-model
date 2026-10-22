import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ModelThinkingLevel } from "@earendil-works/pi-ai";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

export interface Config {
  provider: string;
  model: string;
  thinkingLevel: ModelThinkingLevel;
}

const defaults: Config = { provider: "openai-codex", model: "gpt-6-luna", thinkingLevel: "xhigh" };
const levels = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

export function loadConfig(): Config {
  let raw: string;
  try { raw = readFileSync(join(getAgentDir(), "compact-model.json"), "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { ...defaults };
    throw error;
  }
  const value = JSON.parse(raw);
  if (!value || typeof value.provider !== "string" || !value.provider.trim() ||
    typeof value.model !== "string" || !value.model.trim() || !levels.includes(value.thinkingLevel)) {
    throw new Error("compact-model.json 配置无效，请运行 /compact-model");
  }
  return value;
}

export function saveConfig(config: Config): void {
  const dir = getAgentDir();
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "compact-model.json");
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}
