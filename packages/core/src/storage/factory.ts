import { MemoryStorageAdapter } from "./adapters/memory.js";

import type { StorageAdapter, StorageBackend, StorageOptions } from "./types.js";

export interface FlowStorageOptions extends StorageOptions {
  backend: StorageBackend;
}

/**
 * Creates a storage adapter for coordinated flow state.
 *
 * Only the memory adapter is implemented in COORD-002. Other backend ids are reserved for later
 * coordination tasks.
 */
export function createStorage(type: StorageBackend, options: StorageOptions): StorageAdapter {
  switch (type) {
    case "memory":
      return new MemoryStorageAdapter(options);
    case "redis":
    case "durable-objects":
      throw new Error(`Storage backend "${type}" is not implemented in COORD-002.`);
  }
}

/**
 * Convenience factory for flow-storage backends.
 *
 * @example
 * ```ts
 * const storage = createFlowStorage({ backend: "memory", defaultTTL: 3600 });
 * ```
 */
export function createFlowStorage(options: FlowStorageOptions): StorageAdapter {
  return createStorage(options.backend, options);
}
