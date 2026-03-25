import { expect, test } from "vitest";

import { createEventBus } from "../../packages/core/dist/index.js";

test("event bus memory growth stays below the configured threshold", () => {
  if (typeof global.gc !== "function") {
    throw new Error("Memory tests require Node to run with --expose-gc.");
  }

  const limitBytes = 10 * 1024 * 1024;
  const bus = createEventBus();
  bus.on("memory:test", () => {});

  global.gc();
  const heapBefore = process.memoryUsage().heapUsed;

  for (let index = 0; index < 100_000; index += 1) {
    bus.emit({
      payload: { index },
      source: "system",
      type: "memory:test"
    });
  }

  global.gc();
  const heapAfter = process.memoryUsage().heapUsed;

  expect(heapAfter - heapBefore).toBeLessThan(limitBytes);
});
