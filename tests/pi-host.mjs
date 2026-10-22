import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

let cli = realpathSync(execFileSync("which", ["pi"], { encoding: "utf8" }).trim());
// Managed Pi uses a shell launcher rather than a symlink to the package CLI.
const install = join(dirname(dirname(cli)), "install");
if (existsSync(join(install, "current-version"))) {
  const version = readFileSync(join(install, "current-version"), "utf8").trim();
  cli = realpathSync(join(install, "releases", version, "node_modules/.bin/pi"));
}
let piRoot = dirname(cli);
while (!existsSync(join(piRoot, "package.json"))) {
  const parent = dirname(piRoot);
  if (parent === piRoot) throw new Error("Cannot locate the installed Pi package");
  piRoot = parent;
}
export const requirePi = createRequire(join(piRoot, "package.json"));
export const host = await import(pathToFileURL(join(piRoot, "dist/index.js")).href);
export const ai = await import(pathToFileURL(join(piRoot, "../pi-ai/dist/index.js")).href);
const { createJiti } = requirePi("jiti");
const jiti = createJiti(import.meta.url, {
  alias: Object.fromEntries(["pi-coding-agent", "pi-ai", "pi-tui"].map((name) =>
    [`@earendil-works/${name}`, join(piRoot, "..", name, "dist/index.js")])),
});
export const loadExtension = async (path = "../index.ts") => (await jiti.import(path)).default;
export const extension = await loadExtension();
export const tui = await import(pathToFileURL(join(piRoot, "../pi-tui/dist/index.js")).href);
export { piRoot };
