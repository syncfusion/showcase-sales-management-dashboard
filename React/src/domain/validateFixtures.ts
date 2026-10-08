import { LOCATIONS, ORDER_STATUSES, round2 } from './types';
import type { SalesData } from './types';

/** Structural and business checks run once at load. Returns human-readable problems; empty means valid. */
export function validateFixtures(d: SalesData): string[] {
  const p: string[] = [];
  if (d.manifest?.schemaVersion !== 1) p.push(`Unsupported schema version ${d.manifest?.schemaVersion}.`);
  const req = ['jobTitles', 'employees', 'outlets', 'clients', 'productCategories', 'products', 'orders', 'orderItems', 'appointments'] as const;
  for (const k of req) if (!Array.isArray(d[k])) p.push(`${k} is missing or not a list.`);
  if (p.length) return p;
  for (const k of req) {
    const ids = new Set<number>();
    for (const r of d[k] as Array<{ id: number }>) {
      if (!Number.isInteger(r.id) || r.id <= 0 || ids.has(r.id)) { p.push(`${k} has an invalid or duplicate id ${r.id}.`); break; }
      ids.add(r.id);
    }
  }
  const has = (k: (typeof req)[number], id: number) => (d[k] as Array<{ id: number }>).some((r) => r.id === id);
  if (d.employees.filter((e) => e.reportsToId == null).length !== 1) p.push('Exactly one employee must have no manager.');
  for (const o of d.outlets) if (!LOCATIONS.includes(o.location)) p.push(`Outlet ${o.id} has unknown location ${o.location}.`);
  for (const c of d.clients) if (!has('outlets', c.outletId)) p.push(`Client ${c.id} references missing outlet ${c.outletId}.`);
  for (const pr of d.products) if (!(pr.price > 0) || !has('productCategories', pr.categoryId)) p.push(`Product ${pr.id} is invalid.`);
  const items = new Map<number, { price: number; qty: number }>();
  for (const it of d.orderItems) {
    if (!has('products', it.productId)) p.push(`Order item ${it.id} references missing product.`);
    if (round2(it.unitPrice * it.qty) !== it.price) p.push(`Order item ${it.id} price does not equal unit price × quantity.`);
    const t = items.get(it.orderId) ?? { price: 0, qty: 0 };
    items.set(it.orderId, { price: round2(t.price + it.price), qty: t.qty + it.qty });
  }
  for (const o of d.orders) {
    if (!ORDER_STATUSES.includes(o.status)) p.push(`Order ${o.id} has unknown status.`);
    if (!has('clients', o.clientId) || !has('employees', o.employeeId)) p.push(`Order ${o.id} references a missing client or employee.`);
    const t = items.get(o.id);
    if (!t || t.price !== o.price || t.qty !== o.qty) p.push(`Order ${o.id} totals do not match its lines.`);
  }
  for (const a of d.appointments) if (a.endTime <= a.startTime) p.push(`Appointment ${a.id} ends before it starts.`);
  return p.slice(0, 20);
}
