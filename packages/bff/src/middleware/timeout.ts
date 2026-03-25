export async function withExecutionTimeout<T>(
  operation: () => Promise<T> | T,
  timeoutMs?: number
): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) {
    return await operation();
  }

  return await new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      reject(new Error(`BFF route timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    Promise.resolve(operation())
      .then((result) => {
        globalThis.clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        globalThis.clearTimeout(timeoutId);
        reject(error);
      });
  });
}
