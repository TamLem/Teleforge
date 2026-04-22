import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const packageRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const nodeOnlyModules = [
  "assert",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "dgram",
  "diagnostics_channel",
  "dns",
  "domain",
  "events",
  "fs",
  "http",
  "http2",
  "https",
  "inspector",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "string_decoder",
  "sys",
  "timers",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
  "zlib"
];

async function readBuiltEntry(name) {
  return readFile(path.join(distDir, `${name}.js`), "utf8");
}

function hasNodeImport(source, moduleName) {
  const patterns = [
    new RegExp(`from "node:${moduleName}"`, "g"),
    new RegExp(`from "${moduleName}"`, "g"),
    new RegExp(`require\\("node:${moduleName}"\\)`, "g"),
    new RegExp(`require\\("${moduleName}"\\)`, "g")
  ];
  return patterns.some((pattern) => pattern.test(source));
}

function findNodeImports(source) {
  return nodeOnlyModules.filter((moduleName) => hasNodeImport(source, moduleName));
}

test("teleforge/web does not import Node-only modules", async () => {
  const source = await readBuiltEntry("web");
  const imports = findNodeImports(source);
  assert.deepEqual(
    imports,
    [],
    `teleforge/web contained unexpected Node-only imports: ${imports.join(", ")}`
  );
});

test("teleforge/core/browser does not import Node-only modules", async () => {
  const source = await readBuiltEntry("core-browser");
  const imports = findNodeImports(source);
  assert.deepEqual(
    imports,
    [],
    `teleforge/core/browser contained unexpected Node-only imports: ${imports.join(", ")}`
  );
});

test("teleforge/server-hooks can import server-only modules", async () => {
  const source = await readBuiltEntry("server-hooks");
  const imports = findNodeImports(source);
  assert.ok(
    imports.length > 0,
    "teleforge/server-hooks should contain at least one Node-only module import"
  );
});

test("teleforge does not expose internal core or devtools subpaths", async () => {
  const packageJson = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
  assert.equal(packageJson.exports["./core"], undefined);
  assert.equal(packageJson.exports["./devtools"], undefined);
  assert.equal(packageJson.exports["./bff"], undefined);
});
