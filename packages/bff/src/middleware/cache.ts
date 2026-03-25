import type { BffCacheStore } from "../route/types.js";
import type { CachePolicy } from "../route/types.js";

export async function runWithCache<T>(
  cacheStore: BffCacheStore | undefined,
  policy: CachePolicy | undefined,
  defaultKey: string,
  execute: () => Promise<T> | T
): Promise<T> {
  if (!cacheStore || !policy) {
    return await execute();
  }

  const cacheKey = policy.key ?? defaultKey;
  const cached = await cacheStore.get(cacheKey);

  if (cached !== undefined) {
    return cached as T;
  }

  const result = await execute();
  await cacheStore.set(cacheKey, result, policy.maxAgeMs);

  return result;
}
