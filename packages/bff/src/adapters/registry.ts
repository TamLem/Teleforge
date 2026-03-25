import { BffError } from "../errors/base.js";
import { BffErrorCodes } from "../errors/codes.js";

import type { ServiceAdapter } from "./types.js";
import type { FieldError } from "../errors/validation.js";

export class ServiceAdapterRegistry {
  private readonly adapters = new Map<string, ServiceAdapter>();

  constructor(adapters: Iterable<ServiceAdapter> = []) {
    for (const adapter of adapters) {
      this.register(adapter);
    }
  }

  get(name: string) {
    return this.adapters.get(name);
  }

  has(name: string) {
    return this.adapters.has(name);
  }

  list() {
    return [...this.adapters.keys()];
  }

  register(adapter: ServiceAdapter) {
    if (this.adapters.has(adapter.name)) {
      const fields: FieldError[] = [
        {
          code: "duplicate",
          message: `A service adapter named ${adapter.name} is already registered.`,
          path: `services.${adapter.name}`
        }
      ];

      throw BffError.fromCode(BffErrorCodes.CONFIG_INVALID, {
        fields,
        message: `Duplicate service adapter registration for ${adapter.name}.`
      });
    }

    this.adapters.set(adapter.name, adapter);
  }
}
