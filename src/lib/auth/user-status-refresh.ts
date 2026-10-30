import type { User } from "@/types/firestore";
import type { UserStatusSnapshot } from "@/services/user-status.client";

export type UserStatusRefreshResult = {
  status: number;
  user?: User;
  expiresAt?: number;
  sourceUpdateTime?: string | null;
};

type Scheduler = (callback: () => void, delay: number) => unknown;

type UserStatusRefreshControllerOptions = {
  refresh: () => Promise<UserStatusRefreshResult>;
  apply: (result: UserStatusRefreshResult) => void;
  logout: () => void;
  warn: (error: unknown) => void;
  schedule?: Scheduler;
  cancelSchedule?: (handle: unknown) => void;
  baselineSourceUpdateTime?: string | null;
};

export type UserStatusRefreshController = {
  observe: (status: UserStatusSnapshot) => void;
  retryPending: () => void;
  dispose: () => void;
};

const RETRY_DELAYS_MS = [1_000, 5_000, 30_000] as const;

export function createUserStatusRefreshController(
  options: UserStatusRefreshControllerOptions,
): UserStatusRefreshController {
  const schedule: Scheduler = options.schedule ?? ((callback, delay) => setTimeout(callback, delay));
  const cancelSchedule =
    options.cancelSchedule ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let baselineObserved = false;
  let appliedRevision = 0;
  let pendingRevision = 0;
  let inFlight = false;
  let retryIndex = 0;
  let retryHandle: unknown = null;
  let disposed = false;
  let terminalLogout = false;
  let refreshRequired = false;

  const logoutOnce = () => {
    if (disposed || terminalLogout) return;
    terminalLogout = true;
    options.logout();
  };

  const clearRetry = () => {
    if (retryHandle === null) return;
    cancelSchedule(retryHandle);
    retryHandle = null;
  };

  const pump = async (): Promise<void> => {
    if (
      disposed ||
      terminalLogout ||
      inFlight ||
      retryHandle !== null ||
      (pendingRevision <= appliedRevision && !refreshRequired)
    ) {
      return;
    }

    inFlight = true;
    const targetRevision = pendingRevision;
    let succeeded = false;
    try {
      const result = await options.refresh();
      if (disposed || terminalLogout) return;
      if (result.status === 401) {
        logoutOnce();
        return;
      }
      if (result.status < 200 || result.status >= 300 || !result.user) {
        throw new Error(`User status refresh failed with HTTP ${result.status}`);
      }

      options.apply(result);
      appliedRevision = targetRevision;
      refreshRequired = false;
      retryIndex = 0;
      succeeded = true;
    } catch (error) {
      if (disposed || terminalLogout) return;
      options.warn(error);
      const delay = RETRY_DELAYS_MS[retryIndex];
      if (delay !== undefined) {
        retryIndex += 1;
        retryHandle = schedule(() => {
          retryHandle = null;
          void pump();
        }, delay);
      }
    } finally {
      inFlight = false;
      if (succeeded && pendingRevision > appliedRevision) void pump();
    }
  };

  return {
    observe(status) {
      if (disposed || terminalLogout) return;
      if (!status.isActive && status.exists) {
        logoutOnce();
        return;
      }

      if (!baselineObserved) {
        baselineObserved = true;
        appliedRevision = status.revision;
        pendingRevision = status.revision;
        if (
          status.exists &&
          Object.prototype.hasOwnProperty.call(options, "baselineSourceUpdateTime") &&
          status.sourceUpdateTime !== options.baselineSourceUpdateTime
        ) {
          refreshRequired = true;
          void pump();
        }
        return;
      }

      if (status.revision <= pendingRevision) return;
      clearRetry();
      retryIndex = 0;
      pendingRevision = status.revision;
      void pump();
    },
    retryPending() {
      if (
        disposed ||
        terminalLogout ||
        (pendingRevision <= appliedRevision && !refreshRequired)
      ) return;
      clearRetry();
      retryIndex = 0;
      void pump();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearRetry();
    },
  };
}
