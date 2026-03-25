import assert from "node:assert/strict";
import test from "node:test";

import {
  BffContextError,
  BffError,
  BffErrorCodes,
  BffValidationError,
  createBffRequestContext
} from "../../dist/index.js";

test("BffError serializes to the standard error envelope", () => {
  const error = BffError.fromCode(BffErrorCodes.TOKEN_INVALID, {
    message: "Token was rejected.",
    meta: {
      source: "session"
    }
  });
  const serialized = error.toJSON("req_123", "2026-03-25T00:00:00.000Z");

  assert.deepEqual(serialized, {
    error: {
      code: "TOKEN_INVALID",
      message: "Token was rejected.",
      meta: {
        source: "session"
      },
      requestId: "req_123",
      timestamp: "2026-03-25T00:00:00.000Z"
    }
  });
});

test("BffValidationError includes field violations in serialized output", () => {
  const error = new BffValidationError(BffErrorCodes.MALFORMED_BODY, "Validation failed.", [
    {
      code: "required",
      message: "refreshToken is required",
      path: "refreshToken"
    },
    {
      code: "format",
      message: "deviceInfo.platform must be a string",
      path: "deviceInfo.platform"
    }
  ]);
  const serialized = error.toJSON("req_456", "2026-03-25T00:00:00.000Z");

  assert.equal(serialized.error.code, "MALFORMED_BODY");
  assert.equal(serialized.error.fields?.length, 2);
  assert.equal(serialized.error.fields?.[0]?.path, "refreshToken");
});

test("context.toResponse serializes BffError instances with request metadata", async () => {
  const context = await createBffRequestContext(new Request("https://example.com/api/test"), {
    validateInitData: false
  });

  context.response.body = new BffContextError("INVALID_INIT_DATA", 401, "Bad initData");

  const response = context.toResponse();
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.error.code, "INVALID_INIT_DATA");
  assert.equal(payload.error.requestId, context.id);
  assert.equal(typeof payload.error.timestamp, "string");
});

test("context.toResponse wraps plain errors as INTERNAL_ERROR without leaking stack traces", async () => {
  const context = await createBffRequestContext(new Request("https://example.com/api/test"), {
    validateInitData: false
  });

  context.response.body = new Error("database unavailable");

  const response = context.toResponse();
  const payload = await response.json();

  assert.equal(response.status, 500);
  assert.equal(payload.error.code, "INTERNAL_ERROR");
  assert.equal(payload.error.message, "An internal BFF error occurred.");
  assert.equal("stack" in payload.error, false);
});
