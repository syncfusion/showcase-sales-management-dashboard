import type { SalesData } from '../domain/types';
import type { Overlay } from './persistence';

export function applyOverlay(base: SalesData, o: Overlay): SalesData {
  const orders = [...base.orders, ...o.addedOrders].map((ord) => (o.statusChanges[ord.id] ? { ...ord, ...o.statusChanges[ord.id] } : ord));
  return {
    ...base,
    orders,
    orderItems: o.addedItems.length ? [...base.orderItems, ...o.addedItems] : base.orderItems,
    employees: o.employees ?? base.employees,
    appointments: o.appointments ?? base.appointments,
  };
}

/** Derives the overlay that turns `base` into `next` (orders/items are append-only). */
export function diffOverlay(base: SalesData, next: SalesData): Overlay {
  const baseOrderIds = new Set(base.orders.map((x) => x.id));
  const baseItemIds = new Set(base.orderItems.map((x) => x.id));
  const baseById = new Map(base.orders.map((x) => [x.id, x]));
  const statusChanges: Overlay['statusChanges'] = {};
  for (const ord of next.orders) {
    const b = baseById.get(ord.id);
    if (b && (b.status !== ord.status || b.statusChangedAt !== ord.statusChangedAt)) statusChanges[ord.id] = { status: ord.status, statusChangedAt: ord.statusChangedAt };
  }
  return {
    addedOrders: next.orders.filter((x) => !baseOrderIds.has(x.id)),
    addedItems: next.orderItems.filter((x) => !baseItemIds.has(x.id)),
    statusChanges: Object.fromEntries(Object.entries(statusChanges).filter(([id]) => baseOrderIds.has(Number(id)))),
    employees: next.employees === base.employees ? null : next.employees,
    appointments: next.appointments === base.appointments ? null : next.appointments,
  };
}
