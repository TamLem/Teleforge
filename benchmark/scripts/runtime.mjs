import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { generateKeyPairSync, sign } from "node:crypto";
import { Bench } from "tinybench";

import {
  createEventBus,
  validateInitDataBotToken,
  validateInitDataEd25519
} from "../../packages/core/dist/index.js";
import { useLaunch, useMainButton, useTelegram, useTheme } from "../../packages/web/dist/index.js";

import { writeJson } from "./common.mjs";

const botToken = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
const validBotTokenInitData =
  "auth_date=1710000000&query_id=AAHdF6IQAAAAAN0XohDhrOrc&start_param=checkout&user=%7B%22id%22%3A279058397%2C%22first_name%22%3A%22Vladislav%22%2C%22last_name%22%3A%22Kibenko%22%2C%22username%22%3A%22vdkfrost%22%2C%22language_code%22%3A%22ru%22%2C%22allows_write_to_pm%22%3Atrue%7D&hash=c0c04baa75d833b25f9f3fd95cdf040e6d66d74414739d71bc728d9fa80fa4be";

function createEd25519Vector() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const botId = 12_345_678;
  const params = new URLSearchParams();

  params.set("auth_date", "1710000000");
  params.set("query_id", "AAHdF6IQAAAAAN0XohDhrOrc");
  params.set(
    "user",
    JSON.stringify({
      first_name: "Benchmark",
      id: 279058397,
      username: "bench_user"
    })
  );

  const dataCheckString = [
    `${botId}:WebAppData`,
    ...[...params.entries()].map(([key, value]) => `${key}=${value}`).sort()
  ].join("\n");
  const signature = sign(null, Buffer.from(dataCheckString), privateKey)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  params.set("signature", signature);

  const publicKeyDer = publicKey.export({
    format: "der",
    type: "spki"
  });

  return {
    botId,
    initData: params.toString(),
    publicKeyHex: publicKeyDer.subarray(12).toString("hex")
  };
}

function renderHook(hook) {
  let renderer;

  function Harness() {
    hook();
    return null;
  }

  act(() => {
    renderer = TestRenderer.create(React.createElement(Harness));
  });
  act(() => {
    renderer.unmount();
  });
}

function summarizeBench(bench) {
  return Object.fromEntries(
    bench.tasks.map((task) => [
      task.name,
      {
        hz: task.result?.hz ?? 0,
        latencyMs: task.result?.latency?.mean ?? 0,
        meanMs: task.result?.mean ?? 0,
        samples: task.result?.samples?.length ?? 0
      }
    ])
  );
}

const vector = createEd25519Vector();
const eventBus = createEventBus();
eventBus.on("bench:event", () => {});

const runtimeBench = new Bench({ iterations: process.argv.includes("--ci") ? 200 : 50, time: 0 });

runtimeBench
  .add("validateInitDataBotToken", () => {
    validateInitDataBotToken(validBotTokenInitData, botToken, {
      maxAge: Number.MAX_SAFE_INTEGER
    });
  })
  .add("validateInitDataEd25519", async () => {
    await validateInitDataEd25519(vector.initData, vector.publicKeyHex, {
      botId: vector.botId,
      maxAge: Number.MAX_SAFE_INTEGER
    });
  })
  .add("eventBus.emit", () => {
    eventBus.emit({
      payload: { ok: true },
      source: "system",
      type: "bench:event"
    });
  })
  .add("eventBus.publishToBot.failure", () => {
    try {
      eventBus.publishToBot({ ok: true });
    } catch {
      // Outside Telegram this is expected and keeps the hot path deterministic.
    }
  })
  .add("useTelegram.render", () => {
    renderHook(() => useTelegram());
  })
  .add("useTheme.render", () => {
    renderHook(() => useTheme());
  })
  .add("useLaunch.render", () => {
    renderHook(() => useLaunch());
  })
  .add("useMainButton.render", () => {
    renderHook(() => useMainButton());
  });

await runtimeBench.run();

await writeJson("results/runtime.json", {
  generatedAt: new Date().toISOString(),
  runtime: summarizeBench(runtimeBench)
});

console.log("Runtime benchmarks written to benchmark/results/runtime.json");
