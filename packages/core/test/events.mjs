import test from "node:test";
import assert from "node:assert/strict";
import {
  EventTypes,
  TeleforgeEventBus,
  createEventBus,
  createOrderEvent,
  getGlobalEventBus,
  resetGlobalEventBus
} from "../dist/index.js";

test("emits typed events with generated metadata and telemetry collection", async () => {
  const collected = [];
  const received = [];
  const bus = createEventBus({
    sessionId: "session-1",
    telemetry: {
      collect(event) {
        collected.push(event);
      }
    }
  });

  bus.on(EventTypes.ORDER_CREATED, (event) => {
    received.push(event);
  });

  bus.emit(
    createOrderEvent({
      currency: "USD",
      items: [{ id: "sku-1", quantity: 1 }],
      total: 10,
      type: "order"
    })
  );

  await flush();

  assert.equal(received.length, 1);
  assert.equal(received[0].type, EventTypes.ORDER_CREATED);
  assert.equal(received[0].sessionId, "session-1");
  assert.equal(typeof received[0].id, "string");
  assert.equal(typeof received[0].timestamp, "number");
  assert.equal(collected.length, 1);
});

test("supports once, off, and wildcard handlers", async () => {
  const bus = new TeleforgeEventBus({
    sessionId: "session-2"
  });
  const onceEvents = [];
  const wildcardEvents = [];
  const persistentEvents = [];

  const unsubscribe = bus.on(EventTypes.USER_ACTION, (event) => {
    persistentEvents.push(event.type);
  });
  bus.once(EventTypes.USER_ACTION, (event) => {
    onceEvents.push(event.type);
  });
  bus.on("*", (event) => {
    wildcardEvents.push(event.type);
  });

  bus.emit({
    payload: {
      action: "click"
    },
    source: "miniapp",
    type: EventTypes.USER_ACTION
  });
  bus.emit({
    payload: {
      action: "submit"
    },
    source: "miniapp",
    type: EventTypes.USER_ACTION
  });
  unsubscribe();
  bus.emit({
    payload: {
      action: "ignored"
    },
    source: "miniapp",
    type: EventTypes.USER_ACTION
  });

  await flush();

  assert.deepEqual(onceEvents, [EventTypes.USER_ACTION]);
  assert.deepEqual(persistentEvents, [EventTypes.USER_ACTION, EventTypes.USER_ACTION]);
  assert.deepEqual(wildcardEvents, [
    EventTypes.USER_ACTION,
    EventTypes.USER_ACTION,
    EventTypes.USER_ACTION
  ]);
});

test("isolates handler failures so other listeners still receive events", async () => {
  const bus = createEventBus();
  const received = [];

  bus.on(EventTypes.APP_READY, () => {
    throw new Error("boom");
  });
  bus.on(EventTypes.APP_READY, (event) => {
    received.push(event.type);
  });

  bus.emit({
    payload: {
      ready: true
    },
    source: "system",
    type: EventTypes.APP_READY
  });

  await flush();

  assert.deepEqual(received, [EventTypes.APP_READY]);
});

test("publishToBot sends JSON through Telegram WebApp and errors outside Telegram", () => {
  const bus = createEventBus();
  const previousWindow = globalThis.window;
  const sent = [];

  globalThis.window = {
    Telegram: {
      WebApp: {
        sendData(data) {
          sent.push(data);
        }
      }
    }
  };

  bus.publishToBot({
    ok: true
  });

  assert.deepEqual(sent, ['{"ok":true}']);

  delete globalThis.window;

  assert.throws(() => {
    bus.publishToBot({
      ok: false
    });
  }, /publishToBot/);

  if (previousWindow) {
    globalThis.window = previousWindow;
  }
});

test("global event bus acts as a singleton until reset", () => {
  resetGlobalEventBus();
  const first = getGlobalEventBus();
  const second = getGlobalEventBus();

  assert.equal(first, second);

  resetGlobalEventBus();
  const third = getGlobalEventBus();

  assert.notEqual(first, third);
});

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
