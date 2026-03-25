import type { BffRequestContext } from "../context/types.js";
import type { BffMiddleware } from "../route/types.js";

export async function runMiddlewares<T>(
  middlewares: readonly BffMiddleware[] | undefined,
  context: BffRequestContext,
  handler: () => Promise<T>
): Promise<T> {
  const stack = middlewares ?? [];

  let index = -1;

  const dispatch = async (currentIndex: number): Promise<T> => {
    if (currentIndex <= index) {
      throw new Error("BFF middleware next() called multiple times.");
    }

    index = currentIndex;
    const middleware = stack[currentIndex];

    if (!middleware) {
      return await handler();
    }

    return (await middleware(context, () => dispatch(currentIndex + 1))) as T;
  };

  return await dispatch(0);
}
