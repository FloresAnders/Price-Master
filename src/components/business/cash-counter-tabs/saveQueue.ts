export type LatestCashCounterSaveQueue<T> = {
  enqueue: (value: T) => void;
  whenIdle: () => Promise<void>;
};

export function createLatestCashCounterSaveQueue<T>(
  persist: (value: T) => Promise<void>,
  onError: (error: unknown) => void | Promise<void>,
): LatestCashCounterSaveQueue<T> {
  let pending: T | undefined;
  let running = false;
  let idleWaiters: Array<() => void> = [];

  const resolveIdleWaiters = () => {
    const waiters = idleWaiters;
    idleWaiters = [];
    waiters.forEach((resolve) => resolve());
  };

  const drain = async () => {
    running = true;
    while (pending !== undefined) {
      const next = pending;
      pending = undefined;
      try {
        await persist(next);
      } catch (error) {
        pending = undefined;
        try {
          await onError(error);
        } catch {
          // El error original ya fue atendido; la cola debe quedar liberada.
        }
        break;
      }
    }
    running = false;
    resolveIdleWaiters();
  };

  return {
    enqueue(value) {
      pending = value;
      if (!running) void drain();
    },
    whenIdle() {
      if (!running && pending === undefined) return Promise.resolve();
      return new Promise<void>((resolve) => idleWaiters.push(resolve));
    },
  };
}
