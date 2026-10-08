import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Clock } from '../clock';
import type { SalesData } from '../domain/types';
import type { Result } from '../domain/commands';
import { loadFixtures } from '../data/loadFixtures';
import { applyOverlay, diffOverlay } from './overlay';
import type { PersistenceAdapter } from './persistence';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' };

interface SalesStoreValue {
  load: LoadState;
  data: SalesData | null;
  clock: Clock;
  persistenceKind: PersistenceAdapter['kind'];
  storageWarning: string | null;
  /** Runs a pure command against current data; commits only when it succeeds. */
  run<T>(command: (data: SalesData, now: Date) => Result<T>): Result<T>;
  reset(): void;
  retry(): void;
  changeCount: number;
}

const Ctx = createContext<SalesStoreValue | null>(null);

export function SalesStoreProvider({ clock, persistence, children }: { clock: Clock; persistence: PersistenceAdapter; children: ReactNode }) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [base, setBase] = useState<SalesData | null>(null);
  const [data, setData] = useState<SalesData | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const dataRef = useRef<SalesData | null>(null);
  dataRef.current = data;

  useEffect(() => {
    const ctrl = new AbortController();
    setLoad({ status: 'loading' });
    loadFixtures(clock.now(), ctrl.signal)
      .then((baseline) => {
        const overlay = persistence.load(baseline.manifest.fixtureVersion);
        setBase(baseline);
        setData(overlay ? applyOverlay(baseline, overlay) : baseline);
        setLoad({ status: 'ready' });
      })
      .catch((e: unknown) => { if (!ctrl.signal.aborted) setLoad({ status: 'error', message: e instanceof Error ? e.message : 'The demo data could not be loaded.' }); });
    return () => ctrl.abort();
  }, [clock, persistence, attempt]);

  const run = useCallback(<T,>(command: (d: SalesData, now: Date) => Result<T>): Result<T> => {
    const current = dataRef.current;
    if (!current || !base) return { ok: false, errors: [{ code: 'UNKNOWN_ORDER', message: 'Data is still loading.' }] } as Result<T>;
    const result = command(current, clock.now());
    if (result.ok) {
      dataRef.current = result.data;
      setData(result.data);
      const saved = persistence.save(base.manifest.fixtureVersion, diffOverlay(base, result.data));
      setStorageWarning(saved.ok ? null : saved.message ?? null);
    }
    return result;
  }, [base, clock, persistence]);

  const reset = useCallback(() => {
    if (!base) return;
    persistence.clear(base.manifest.fixtureVersion);
    dataRef.current = base;
    setData(base);
    setStorageWarning(null);
  }, [base, persistence]);

  const changeCount = useMemo(() => {
    if (!base || !data || base === data) return 0;
    const o = diffOverlay(base, data);
    return o.addedOrders.length + Object.keys(o.statusChanges).length + (o.employees ? 1 : 0) + (o.appointments ? 1 : 0);
  }, [base, data]);

  const value = useMemo<SalesStoreValue>(() => ({
    load, data, clock, persistenceKind: persistence.kind, storageWarning, run, reset, retry: () => setAttempt((n) => n + 1), changeCount,
  }), [load, data, clock, persistence.kind, storageWarning, run, reset, changeCount]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSalesStore(): SalesStoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSalesStore must be used inside SalesStoreProvider');
  return v;
}
/** For pages rendered only once data is ready. */
export function useSalesData(): SalesData {
  const { data } = useSalesStore();
  if (!data) throw new Error('Sales data not ready');
  return data;
}
