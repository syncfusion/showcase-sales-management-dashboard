import { daysBetween, monthKey, parseLocal, trailingMonths } from './dates';
import { LOCATIONS, ORDER_STATUSES, round2 } from './types';
import type { Employee, Location, Order, OrderItem, OrderStatus, SalesData, Scope } from './types';

export interface Lookups {
  employee: Map<number, Employee>;
  clientOutletLocation: Map<number, Location>;
  productCategory: Map<number, number>;
  itemsByOrder: Map<number, OrderItem[]>;
}

const lookupCache = new WeakMap<SalesData, Lookups>();
export function lookups(data: SalesData): Lookups {
  const cached = lookupCache.get(data);
  if (cached) return cached;
  const outletLoc = new Map(data.outlets.map((o) => [o.id, o.location]));
  const itemsByOrder = new Map<number, OrderItem[]>();
  for (const it of data.orderItems) {
    const list = itemsByOrder.get(it.orderId);
    if (list) list.push(it); else itemsByOrder.set(it.orderId, [it]);
  }
  const l: Lookups = {
    employee: new Map(data.employees.map((e) => [e.id, e])),
    clientOutletLocation: new Map(data.clients.map((c) => [c.id, outletLoc.get(c.outletId)!])),
    productCategory: new Map(data.products.map((p) => [p.id, p.categoryId])),
    itemsByOrder,
  };
  lookupCache.set(data, l);
  return l;
}

export const roleOf = (data: SalesData, employeeId: number) =>
  data.jobTitles.find((j) => j.id === data.employees.find((e) => e.id === employeeId)?.jobTitleId)?.code;
export const directReports = (data: SalesData, leadId: number) =>
  data.employees.filter((e) => e.reportsToId === leadId).sort((a, b) => a.lastName.localeCompare(b.lastName));
export const teamLeads = (data: SalesData) => data.employees.filter((e) => roleOf(data, e.id) === 'TL');
export const salesReps = (data: SalesData) => data.employees.filter((e) => roleOf(data, e.id) === 'SR');
export const fullName = (e: Pick<Employee, 'firstName' | 'lastName'>) => `${e.firstName} ${e.lastName}`;

/** Orders counted by analytics: in scope and not cancelled (BR5, contract status rule). */
export function scopedOrders(data: SalesData, scope: Scope): Order[] {
  const live = data.orders.filter((o) => o.status !== 'Cancelled');
  if (scope.kind === 'company') return live;
  if (scope.kind === 'rep') return live.filter((o) => o.employeeId === scope.repId);
  const team = new Set(directReports(data, scope.leadId).map((e) => e.id));
  return live.filter((o) => team.has(o.employeeId));
}

function inWindow(orders: Order[], now: Date): Order[] {
  const months = new Set(trailingMonths(now));
  return orders.filter((o) => months.has(monthKey(o.orderDateTime)) && parseLocal(o.orderDateTime) <= now);
}

function scopedItems(data: SalesData, orders: Order[]): Array<OrderItem & { order: Order }> {
  const { itemsByOrder } = lookups(data);
  return orders.flatMap((o) => (itemsByOrder.get(o.id) ?? []).map((it) => ({ ...it, order: o })));
}

export interface Kpis { gross: number; units: number; orders: number; avgOrderValue: number }
export function kpis(data: SalesData, scope: Scope, now: Date): Kpis {
  const orders = inWindow(scopedOrders(data, scope), now);
  const gross = round2(orders.reduce((s, o) => s + o.price, 0));
  const units = orders.reduce((s, o) => s + o.qty, 0);
  return { gross, units, orders: orders.length, avgOrderValue: orders.length ? round2(gross / orders.length) : 0 };
}

export type CategoryRow = { location: Location } & Record<string, number | string>;
/** Units by location × category; every location and category present. Category keys are `c<id>`. */
export function unitsByLocationCategory(data: SalesData, scope: Scope, now: Date): CategoryRow[] {
  const { clientOutletLocation, productCategory } = lookups(data);
  const rows = new Map<Location, CategoryRow>(LOCATIONS.map((l) => [l, { location: l, ...Object.fromEntries(data.productCategories.map((c) => [`c${c.id}`, 0])) }]));
  for (const it of scopedItems(data, inWindow(scopedOrders(data, scope), now))) {
    const row = rows.get(clientOutletLocation.get(it.order.clientId)!)!;
    const key = `c${productCategory.get(it.productId)}`;
    row[key] = (row[key] as number) + it.qty;
  }
  return [...rows.values()];
}

export interface KeyValue { key: string; label: string; value: number }
export function unitsByLocation(data: SalesData, scope: Scope, now: Date): KeyValue[] {
  return unitsByLocationCategory(data, scope, now).map((r) => ({
    key: r.location, label: r.location,
    value: data.productCategories.reduce((s, c) => s + (r[`c${c.id}`] as number), 0),
  }));
}

export type MonthLocationRow = { month: string } & Record<Location, number>;
export function unitsByMonthLocation(data: SalesData, scope: Scope, now: Date): MonthLocationRow[] {
  const { clientOutletLocation } = lookups(data);
  const rows = new Map(trailingMonths(now).map((m) => [m, { month: m, TX: 0, CA: 0, NY: 0, WA: 0 } as MonthLocationRow]));
  for (const o of inWindow(scopedOrders(data, scope), now)) {
    const row = rows.get(monthKey(o.orderDateTime));
    if (row) row[clientOutletLocation.get(o.clientId)!] += o.qty;
  }
  return [...rows.values()];
}

function byMonth(data: SalesData, scope: Scope, now: Date, value: (o: Order) => number): KeyValue[] {
  const rows = new Map(trailingMonths(now).map((m) => [m, 0]));
  for (const o of inWindow(scopedOrders(data, scope), now)) {
    const k = monthKey(o.orderDateTime);
    if (rows.has(k)) rows.set(k, rows.get(k)! + value(o));
  }
  return [...rows.entries()].map(([key, v]) => ({ key, label: key, value: round2(v) }));
}
export const grossByMonth = (data: SalesData, scope: Scope, now: Date) => byMonth(data, scope, now, (o) => o.price);
export const unitsByMonth = (data: SalesData, scope: Scope, now: Date) => byMonth(data, scope, now, (o) => o.qty);

export function unitsByCategory(data: SalesData, scope: Scope, now: Date): KeyValue[] {
  const { productCategory } = lookups(data);
  const totals = new Map(data.productCategories.map((c) => [c.id, 0]));
  for (const it of scopedItems(data, inWindow(scopedOrders(data, scope), now))) {
    const c = productCategory.get(it.productId)!;
    totals.set(c, totals.get(c)! + it.qty);
  }
  return data.productCategories.map((c) => ({ key: `c${c.id}`, label: c.name, value: totals.get(c.id)! }));
}

export function grossByMember(data: SalesData, leadId: number, now: Date): KeyValue[] {
  const orders = inWindow(scopedOrders(data, { kind: 'team', leadId }), now);
  return directReports(data, leadId).map((e) => ({
    key: String(e.id), label: fullName(e),
    value: round2(orders.filter((o) => o.employeeId === e.id).reduce((s, o) => s + o.price, 0)),
  }));
}

export interface OrderRow {
  id: number; orderDateTime: string; date: Date; status: OrderStatus; statusChangedAt: string;
  clientId: number; clientName: string; outletName: string; location: Location;
  employeeId: number; repName: string; lines: number; qty: number; price: number;
  items: Array<{ productId: number; productName: string; qty: number; unitPrice: number; price: number }>;
}
export function orderRows(data: SalesData): OrderRow[] {
  const { itemsByOrder, employee } = lookups(data);
  const clients = new Map(data.clients.map((c) => [c.id, c]));
  const outlets = new Map(data.outlets.map((o) => [o.id, o]));
  const products = new Map(data.products.map((p) => [p.id, p]));
  return data.orders
    .map((o) => {
      const c = clients.get(o.clientId)!;
      const outlet = outlets.get(c.outletId)!;
      const rep = employee.get(o.employeeId);
      const items = (itemsByOrder.get(o.id) ?? []).map((it) => ({ productId: it.productId, productName: products.get(it.productId)?.name ?? `#${it.productId}`, qty: it.qty, unitPrice: it.unitPrice, price: it.price }));
      return {
        id: o.id, orderDateTime: o.orderDateTime, date: parseLocal(o.orderDateTime), status: o.status, statusChangedAt: o.statusChangedAt,
        clientId: c.id, clientName: `${c.firstName} ${c.lastName}`, outletName: outlet.name, location: outlet.location,
        employeeId: o.employeeId, repName: rep ? fullName(rep) : 'Former employee', lines: items.length, qty: o.qty, price: o.price, items,
      };
    })
    .sort((a, b) => (b.orderDateTime.localeCompare(a.orderDateTime)) || b.id - a.id);
}

/** Kanban: orders placed within 30 days; Delivered only when delivered within 14 days. */
export function pipeline(data: SalesData, now: Date): OrderRow[] {
  return orderRows(data).filter((r) => {
    if (daysBetween(r.date, now) > 30) return false;
    if (r.status === 'Delivered') return daysBetween(parseLocal(r.statusChangedAt), now) <= 14;
    return true;
  });
}
export const statusCounts = (rows: OrderRow[]) =>
  Object.fromEntries(ORDER_STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length])) as Record<OrderStatus, number>;

export interface OrgNode { id: string; parentId: string | null; name: string; title: string; imagePath: string; teamSize: number; email: string }
export function hierarchy(data: SalesData): OrgNode[] {
  return [...data.employees]
    .sort((a, b) => a.lastName.localeCompare(b.lastName))
    .map((e) => ({
      id: String(e.id), parentId: e.reportsToId == null ? null : String(e.reportsToId), name: fullName(e),
      title: data.jobTitles.find((j) => j.id === e.jobTitleId)?.name ?? '', imagePath: e.imagePath,
      teamSize: data.employees.filter((x) => x.reportsToId === e.id).length, email: e.email,
    }));
}
