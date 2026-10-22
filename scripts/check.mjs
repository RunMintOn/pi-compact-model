import { dirname, join, resolve } from "node:path";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { piRoot } from "../tests/pi-host.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packages = ["pi-ai", "pi-coding-agent", "pi-tui"];
const sources = [join(root, "index.ts"), ...readdirSync(join(root, "tests"))
  .filter((name) => name.endsWith(".ts")).map((name) => join(root, "tests", name))];
const program = ts.createProgram(sources, {
  noEmit: true, strict: true, skipLibCheck: true, target: ts.ScriptTarget.ES2023,
  module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
  baseUrl: root,
  paths: Object.fromEntries(packages.map((name) => [`@earendil-works/${name}`,
    [join(piRoot, "..", name, "dist/index.d.ts")]])),
  typeRoots: [join(piRoot, "../../@types")],
});
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (path) => path, getCurrentDirectory: () => root, getNewLine: () => "\n",
  }));
  process.exitCode = 1;
} else console.log("Typecheck passed.");
