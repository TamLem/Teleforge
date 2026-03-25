import { BffContextError } from "./errors.js";

interface BodyState {
  bytes: Promise<ArrayBuffer>;
  parsedBody: unknown;
  parsedJson: boolean;
  parsedText: boolean;
  request: Request;
  textValue: string | null;
}

export function createBodyParser(request: Request) {
  const state: BodyState = {
    bytes: readBodyBytes(request),
    parsedBody: null,
    parsedJson: false,
    parsedText: false,
    request,
    textValue: null
  };

  return {
    getCachedBody() {
      return state.parsedBody;
    },
    async arrayBuffer() {
      const bytes = await state.bytes;
      return bytes.slice(0);
    },
    async json<T>() {
      if (state.parsedJson) {
        return state.parsedBody as T;
      }

      const rawText = await readBodyText(state);

      if (rawText.length === 0) {
        throw new BffContextError(
          "MISSING_REQUIRED_BODY",
          400,
          "Expected a request body but none was provided."
        );
      }

      try {
        const parsed = JSON.parse(rawText) as T;
        state.parsedBody = parsed;
        state.parsedJson = true;
        return parsed;
      } catch {
        throw new BffContextError("MALFORMED_BODY", 400, "Request body is not valid JSON.");
      }
    },
    async text() {
      const rawText = await readBodyText(state);
      state.parsedBody = rawText.length > 0 ? rawText : null;
      state.parsedText = true;
      return rawText;
    }
  };
}

async function readBodyBytes(request: Request): Promise<ArrayBuffer> {
  if (request.body === null) {
    return new ArrayBuffer(0);
  }

  return await request.clone().arrayBuffer();
}

async function readBodyText(state: BodyState): Promise<string> {
  if (state.textValue !== null) {
    return state.textValue;
  }

  const bytes = await state.bytes;
  state.textValue = bytes.byteLength > 0 ? new TextDecoder().decode(new Uint8Array(bytes)) : "";

  return state.textValue;
}
