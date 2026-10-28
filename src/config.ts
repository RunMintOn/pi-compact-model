import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ModelThinkingLevel } from "@earendil-works/pi-ai";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

export interface Config {
  provider: string;
  model: string;
  thinkingLevel: ModelThinkingLevel;
}

const levels = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

export function loadConfig(): Config | undefined {
  let raw: string;
  try { raw = readFileSync(join(getAgentDir(), "compact-model.json"), "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  const value = JSON.parse(raw);
  if (!value || typeof value.provider !== "string" || !value.provider.trim() ||
    typeof value.model !== "string" || !value.model.trim() || !levels.includes(value.thinkingLevel)) {
    throw new Error("Invalid compact-model.json. Run /compact-model.");
  }
  return value;
}

export function saveConfig(config: Config | undefined): void {
  const dir = getAgentDir();
  const path = join(dir, "compact-model.json");
  if (!config) {
    try { unlinkSync(path); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return;
  }
  mkdirSync(dir, { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}
