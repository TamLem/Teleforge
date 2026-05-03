import { gzipSizeSync } from "gzip-size";
import { build } from "esbuild";

import { repoRoot, writeJson } from "./common.mjs";

const bundleTargets = [
  {
    id: "@teleforge/core",
    entry: "./packages/core/dist/index.js",
    platform: "node"
  },
  {
    id: "@teleforge/core/browser",
    entry: "./packages/core/dist/browser.js",
    platform: "browser"
  },
  {
    id: "@teleforge/web",
    entry: "./packages/web/dist/index.js",
    platform: "browser"
  },
  {
    id: "@teleforge/bot",
    entry: "./packages/bot/dist/index.js",
    platform: "node"
  },
  {
    id: "@teleforge/ui",
    entry: "./packages/ui/dist/index.js",
    platform: "browser"
  },
  {
    id: "teleforge",
    entry: "./packages/teleforge/dist/cli.js",
    platform: "node"
  }
];

async function measureBundle(target) {
  const result = await build({
    absWorkingDir: repoRoot,
    bundle: true,
    format: "esm",
    logLevel: "silent",
    minify: true,
    platform: target.platform,
    target: target.platform === "node" ? "node18" : "es2022",
    write: false,
    stdin: {
      contents: `import * as subject from ${JSON.stringify(target.entry)};\nconsole.log(Object.keys(subject).length);\n`,
      resolveDir: repoRoot,
      sourcefile: `${target.id.replace(/[^a-z0-9]+/gi, "-")}.js`
    }
  });

  const code = result.outputFiles[0]?.contents ?? Buffer.from("");

  return {
    gzipBytes: gzipSizeSync(code),
    rawBytes: code.byteLength
  };
}

async function measureTreeShake() {
  const result = await build({
    absWorkingDir: repoRoot,
    bundle: true,
    format: "esm",
    logLevel: "silent",
    minify: true,
    platform: "browser",
    target: "es2022",
    write: false,
    stdin: {
      contents:
        'import { useTelegram } from "./packages/web/dist/index.js";\nconsole.log(typeof useTelegram);\n',
      resolveDir: repoRoot,
      sourcefile: "tree-shake-web.js"
    }
  });

  const code = result.outputFiles[0]?.contents ?? Buffer.from("");

  return {
    gzipBytes: gzipSizeSync(code),
    rawBytes: code.byteLength
  };
}

const bundles = {};
for (const target of bundleTargets) {
  bundles[target.id] = await measureBundle(target);
}

const treeShaking = {
  "@teleforge/web/useTelegram": await measureTreeShake()
};

await writeJson("results/size.json", {
  bundles,
  generatedAt: new Date().toISOString(),
  treeShaking
});

console.log("Bundle size benchmarks written to benchmark/results/size.json");
