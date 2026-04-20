import { MemoryStorageAdapter } from "./adapters/memory.js";

import type { StorageAdapter, StorageBackend, StorageOptions } from "./types.js";

export interface FlowStorageOptions extends StorageOptions {
  backend: StorageBackend;
}

export function createStorage(type: StorageBackend, options: StorageOptions): StorageAdapter {
  switch (type) {
    case "memory":
      return new MemoryStorageAdapter(options);
    case "redis":
    case "durable-objects":
      throw new Error(`Storage backend "${type}" is not implemented.`);
  }
}

export function createFlowStorage(options: FlowStorageOptions): StorageAdapter {
  return createStorage(options.backend, options);
}
