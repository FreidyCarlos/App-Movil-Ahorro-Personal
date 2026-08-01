import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { ImportPreview } from "../../application/backup/backup-service.js";
import type {
  CreateSimpleGoalInput,
  SimpleGoalView,
} from "../../application/mobile-savings-service.js";
import {
  createMobileRuntime,
  type MobileRuntime,
} from "../infrastructure/mobile-runtime.js";
import { safeUserMessage } from "./safe-error.js";

interface AppContextValue {
  readonly ready: boolean;
  readonly busy: boolean;
  readonly error?: string;
  readonly goals: readonly SimpleGoalView[];
  refresh(): Promise<void>;
  createSimpleGoal(input: CreateSimpleGoalInput): Promise<void>;
  exportBackup(): Promise<{ readonly name: string; readonly shared: boolean }>;
  previewImport(): Promise<ImportPreview | undefined>;
  confirmImport(token: string): Promise<void>;
  clearError(): void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  const [runtime, setRuntime] = useState<MobileRuntime>();
  const [goals, setGoals] = useState<readonly SimpleGoalView[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string>();

  const loadGoals = useCallback(async (activeRuntime: MobileRuntime) => {
    setGoals(await activeRuntime.listGoals());
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const created = await createMobileRuntime();
        const initialGoals = await created.listGoals();
        if (active) {
          setRuntime(created);
          setGoals(initialGoals);
        }
      } catch (caught) {
        if (active) {
          setError(safeUserMessage(caught));
        }
      } finally {
        if (active) {
          setBusy(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const requireRuntime = useCallback((): MobileRuntime => {
    if (runtime === undefined) {
      throw new Error("La aplicación aún se está iniciando.");
    }
    return runtime;
  }, [runtime]);

  const refresh = useCallback(async () => {
    const activeRuntime = requireRuntime();
    setBusy(true);
    try {
      await loadGoals(activeRuntime);
    } catch (caught) {
      setError(safeUserMessage(caught));
      throw caught;
    } finally {
      setBusy(false);
    }
  }, [loadGoals, requireRuntime]);

  const createSimpleGoal = useCallback(
    async (input: CreateSimpleGoalInput) => {
      const activeRuntime = requireRuntime();
      setBusy(true);
      setError(undefined);
      try {
        await activeRuntime.createSimpleGoal(input);
        await loadGoals(activeRuntime);
      } catch (caught) {
        setError(safeUserMessage(caught));
        throw caught;
      } finally {
        setBusy(false);
      }
    },
    [loadGoals, requireRuntime],
  );

  const exportBackup = useCallback(async () => {
    const activeRuntime = requireRuntime();
    setBusy(true);
    setError(undefined);
    try {
      const stored = await activeRuntime.exportBackup();
      const shared = await activeRuntime.shareBackup(stored);
      return { name: stored.displayName, shared };
    } catch (caught) {
      setError(safeUserMessage(caught));
      throw caught;
    } finally {
      setBusy(false);
    }
  }, [requireRuntime]);

  const previewImport = useCallback(async () => {
    const activeRuntime = requireRuntime();
    setBusy(true);
    setError(undefined);
    try {
      return await activeRuntime.selectAndPreviewImport();
    } catch (caught) {
      setError(safeUserMessage(caught));
      throw caught;
    } finally {
      setBusy(false);
    }
  }, [requireRuntime]);

  const confirmImport = useCallback(
    async (token: string) => {
      const activeRuntime = requireRuntime();
      setBusy(true);
      setError(undefined);
      try {
        await activeRuntime.confirmImport(token);
        await loadGoals(activeRuntime);
      } catch (caught) {
        setError(safeUserMessage(caught));
        throw caught;
      } finally {
        setBusy(false);
      }
    },
    [loadGoals, requireRuntime],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      ready: runtime !== undefined,
      busy,
      ...(error === undefined ? {} : { error }),
      goals,
      refresh,
      createSimpleGoal,
      exportBackup,
      previewImport,
      confirmImport,
      clearError: () => setError(undefined),
    }),
    [
      runtime,
      busy,
      error,
      goals,
      refresh,
      createSimpleGoal,
      exportBackup,
      previewImport,
      confirmImport,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (value === undefined) {
    throw new Error("useApp debe usarse dentro de AppProvider.");
  }
  return value;
}
