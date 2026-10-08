import type { Appointment, Employee, Order, OrderItem, OrderStatus } from '../domain/types';

/** Private changes layered over the immutable shipped baseline. */
export interface Overlay {
  addedOrders: Order[];
  addedItems: OrderItem[];
  statusChanges: Record<number, { status: OrderStatus; statusChangedAt: string }>;
  employees: Employee[] | null;
  appointments: Appointment[] | null;
}
export const emptyOverlay = (): Overlay => ({ addedOrders: [], addedItems: [], statusChanges: {}, employees: null, appointments: null });

export interface PersistenceAdapter {
  readonly kind: 'session' | 'browser';
  load(fixtureVersion: string): Overlay | null;
  save(fixtureVersion: string, overlay: Overlay): { ok: boolean; message?: string };
  clear(fixtureVersion: string): void;
}

const PREFIX = 'oexl-sales:v1:';
function storageAdapter(kind: 'session' | 'browser', get: () => Storage): PersistenceAdapter {
  return {
    kind,
    load(version) {
      try {
        const s = get();
        // Drop overlays written against another fixture version (stale-dataset invalidation).
        for (let i = s.length - 1; i >= 0; i--) { const k = s.key(i); if (k?.startsWith(PREFIX) && k !== PREFIX + version) s.removeItem(k); }
        const raw = s.getItem(PREFIX + version);
        return raw ? { ...emptyOverlay(), ...(JSON.parse(raw) as Overlay) } : null;
      } catch { return null; }
    },
    save(version, overlay) {
      try { get().setItem(PREFIX + version, JSON.stringify(overlay)); return { ok: true }; }
      catch { return { ok: false, message: 'Your browser storage is full, so changes will last only until you leave this page.' }; }
    },
    clear(version) { try { get().removeItem(PREFIX + version); } catch { /* storage unavailable */ } },
  };
}
export const sessionPersistence = (): PersistenceAdapter => storageAdapter('session', () => window.sessionStorage);
export const browserPersistence = (): PersistenceAdapter => storageAdapter('browser', () => window.localStorage);
export const memoryPersistence = (): PersistenceAdapter => ({ kind: 'session', load: () => null, save: () => ({ ok: true }), clear: () => {} });
