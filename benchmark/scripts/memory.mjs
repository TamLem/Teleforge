import { createEventBus } from "../../packages/core/dist/index.js";

import { writeJson } from "./common.mjs";

if (typeof global.gc !== "function") {
  throw new Error("Memory benchmark requires Node to run with --expose-gc.");
}

const EVENT_COUNT = 100_000;
const LIMIT_BYTES = 10 * 1024 * 1024;

const bus = createEventBus();
bus.on("memory:event", () => {});

global.gc();
const heapBefore = process.memoryUsage().heapUsed;

for (let index = 0; index < EVENT_COUNT; index += 1) {
  bus.emit({
    payload: { index },
    source: "system",
    type: "memory:event"
  });
}

global.gc();
const heapAfter = process.memoryUsage().heapUsed;
const growthBytes = heapAfter - heapBefore;

const result = {
  eventCount: EVENT_COUNT,
  generatedAt: new Date().toISOString(),
  growthBytes,
  heapAfter,
  heapBefore,
  limitBytes: LIMIT_BYTES,
  passed: growthBytes < LIMIT_BYTES
};

await writeJson("results/memory.json", result);

if (!result.passed) {
  throw new Error(
    `Memory growth ${growthBytes} bytes exceeded limit ${LIMIT_BYTES} bytes for ${EVENT_COUNT} events.`
  );
}

console.log("Memory benchmark written to benchmark/results/memory.json");
