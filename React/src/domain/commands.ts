// Pure, validated commands over SalesData. An invalid command returns errors and leaves data untouched.
import { toLocalIso, parseLocal } from './dates';
import { roleOf } from './selectors';
import { round2 } from './types';
import type { Appointment, Employee, Order, OrderItem, OrderStatus, SalesData } from './types';

export type ErrorCode =
  | 'CLIENT_REQUIRED' | 'LINES_REQUIRED' | 'QTY_RANGE' | 'UNKNOWN_PRODUCT' | 'REP_NOT_SR'
  | 'INVALID_TRANSITION' | 'ORDER_FINAL' | 'UNKNOWN_ORDER'
  | 'NAME_LENGTH' | 'EMAIL_INVALID' | 'EMAIL_DUPLICATE' | 'GENDER_REQUIRED' | 'MANAGER_CYCLE' | 'MANAGER_NOT_ELIGIBLE' | 'SM_SINGLETON'
  | 'HAS_REPORTS' | 'HAS_ORDERS' | 'SUBJECT_REQUIRED' | 'END_BEFORE_START';
export interface ValidationError { code: ErrorCode; field?: string; message: string }
export type Result<T> = { ok: true; data: SalesData; value: T } | { ok: false; errors: ValidationError[] };

const fail = <T>(...errors: ValidationError[]): Result<T> => ({ ok: false, errors });
const nextId = (rows: Array<{ id: number }>) => rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;

export interface OrderDraft { repId: number; clientId: number | null; lines: Array<{ productId: number; qty: number }> }

export function validateOrder(data: SalesData, d: OrderDraft): ValidationError[] {
  const errors: ValidationError[] = [];
  if (roleOf(data, d.repId) !== 'SR') errors.push({ code: 'REP_NOT_SR', field: 'repId', message: 'Orders are created by a sales rep.' });
  if (d.clientId == null || !data.clients.some((c) => c.id === d.clientId)) errors.push({ code: 'CLIENT_REQUIRED', field: 'clientId', message: 'Choose a client.' });
  if (d.lines.length === 0) errors.push({ code: 'LINES_REQUIRED', field: 'lines', message: 'Select at least one product.' });
  for (const l of d.lines) {
    if (!data.products.some((p) => p.id === l.productId)) errors.push({ code: 'UNKNOWN_PRODUCT', field: 'lines', message: `Product ${l.productId} is not in the catalog.` });
    if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > 99) errors.push({ code: 'QTY_RANGE', field: 'lines', message: 'Quantity must be a whole number from 1 to 99.' });
  }
  return errors;
}

/** BR1–BR4: header totals from lines, price snapshot, acting rep, appended atomically. */
export function createOrder(data: SalesData, d: OrderDraft, now: Date): Result<Order> {
  const errors = validateOrder(data, d);
  if (errors.length) return fail(...errors);
  const orderId = nextId(data.orders);
  let itemId = nextId(data.orderItems);
  const items: OrderItem[] = d.lines.map((l) => {
    const unitPrice = data.products.find((p) => p.id === l.productId)!.price;
    return { id: itemId++, orderId, productId: l.productId, qty: l.qty, unitPrice, price: round2(unitPrice * l.qty) };
  });
  const stamp = toLocalIso(now);
  const order: Order = {
    id: orderId, orderDateTime: stamp, employeeId: d.repId, clientId: d.clientId!,
    price: round2(items.reduce((s, i) => s + i.price, 0)), qty: items.reduce((s, i) => s + i.qty, 0),
    status: 'New', statusChangedAt: stamp,
  };
  return { ok: true, value: order, data: { ...data, orders: [...data.orders, order], orderItems: [...data.orderItems, ...items] } };
}

const FLOW: OrderStatus[] = ['New', 'Processing', 'Shipped', 'Delivered'];
export function allowedNextStatuses(status: OrderStatus): OrderStatus[] {
  if (status === 'Delivered' || status === 'Cancelled') return [];
  const next = FLOW[FLOW.indexOf(status) + 1];
  return status === 'New' || status === 'Processing' ? [next, 'Cancelled'] : [next];
}
export function moveOrderStatus(data: SalesData, orderId: number, to: OrderStatus, now: Date): Result<Order> {
  const order = data.orders.find((o) => o.id === orderId);
  if (!order) return fail({ code: 'UNKNOWN_ORDER', message: `Order ${orderId} was not found.` });
  if (order.status === 'Delivered' || order.status === 'Cancelled') return fail({ code: 'ORDER_FINAL', message: `Order #${orderId} is ${order.status.toLowerCase()} and can't move.` });
  if (!allowedNextStatuses(order.status).includes(to)) {
    return fail({ code: 'INVALID_TRANSITION', message: `Order #${orderId} can move from ${order.status} to ${allowedNextStatuses(order.status).join(' or ')} only.` });
  }
  const updated: Order = { ...order, status: to, statusChangedAt: toLocalIso(now) };
  return { ok: true, value: updated, data: { ...data, orders: data.orders.map((o) => (o.id === orderId ? updated : o)) } };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function validateEmployee(data: SalesData, e: Employee): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const f of ['firstName', 'lastName'] as const) {
    const v = (e[f] ?? '').trim();
    if (v.length < 2 || v.length > 100) errors.push({ code: 'NAME_LENGTH', field: f, message: `${f === 'firstName' ? 'First' : 'Last'} name must be 2 to 100 characters.` });
  }
  if (!EMAIL.test(e.email ?? '')) errors.push({ code: 'EMAIL_INVALID', field: 'email', message: 'Enter a valid email address.' });
  else if (data.employees.some((x) => x.id !== e.id && x.email.toLowerCase() === e.email.toLowerCase())) errors.push({ code: 'EMAIL_DUPLICATE', field: 'email', message: 'Another employee already uses this email.' });
  if (e.gender !== 'Male' && e.gender !== 'Female') errors.push({ code: 'GENDER_REQUIRED', field: 'gender', message: 'Choose a gender.' });
  const isSM = data.jobTitles.find((j) => j.id === e.jobTitleId)?.code === 'SM';
  if (isSM && data.employees.some((x) => x.id !== e.id && data.jobTitles.find((j) => j.id === x.jobTitleId)?.code === 'SM')) {
    errors.push({ code: 'SM_SINGLETON', field: 'jobTitleId', message: 'There is already a Sales Manager.' });
  }
  if (e.reportsToId != null) {
    const mgrRole = roleOf(data, e.reportsToId);
    if (mgrRole !== 'SM' && mgrRole !== 'TL') errors.push({ code: 'MANAGER_NOT_ELIGIBLE', field: 'reportsToId', message: 'Reports to must be a Sales Manager or Team Leader.' });
    let cursor: number | null = e.reportsToId;
    const seen = new Set<number>();
    while (cursor != null && !seen.has(cursor)) {
      if (cursor === e.id) { errors.push({ code: 'MANAGER_CYCLE', field: 'reportsToId', message: 'An employee cannot report to themselves or to someone who reports to them.' }); break; }
      seen.add(cursor);
      cursor = data.employees.find((x) => x.id === cursor)?.reportsToId ?? null;
    }
  } else if (!isSM) {
    errors.push({ code: 'MANAGER_NOT_ELIGIBLE', field: 'reportsToId', message: 'Choose who this employee reports to.' });
  }
  return errors;
}
export function upsertEmployee(data: SalesData, e: Employee): Result<Employee> {
  const isNew = !data.employees.some((x) => x.id === e.id);
  const row: Employee = { ...e, firstName: e.firstName.trim(), lastName: e.lastName.trim(), id: isNew ? nextId(data.employees) : e.id };
  const errors = validateEmployee(data, row);
  if (errors.length) return fail(...errors);
  const employees = isNew ? [...data.employees, row] : data.employees.map((x) => (x.id === row.id ? row : x));
  return { ok: true, value: row, data: { ...data, employees } };
}
export function deleteEmployee(data: SalesData, id: number): Result<number> {
  const reports = data.employees.filter((x) => x.reportsToId === id);
  if (reports.length) return fail({ code: 'HAS_REPORTS', message: `Reassign ${reports.map((r) => `${r.firstName} ${r.lastName}`).join(', ')} before deleting.` });
  if (data.orders.some((o) => o.employeeId === id)) return fail({ code: 'HAS_ORDERS', message: 'This rep has orders on record, so they stay in the team list.' });
  return { ok: true, value: id, data: { ...data, employees: data.employees.filter((x) => x.id !== id) } };
}

export function validateAppointment(a: Appointment): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!a.subject?.trim()) errors.push({ code: 'SUBJECT_REQUIRED', field: 'subject', message: 'Add a subject.' });
  if (parseLocal(a.endTime) <= parseLocal(a.startTime)) errors.push({ code: 'END_BEFORE_START', field: 'endTime', message: 'End must be after start.' });
  return errors;
}
export function upsertAppointment(data: SalesData, a: Appointment): Result<Appointment> {
  const isNew = !data.appointments.some((x) => x.id === a.id);
  const row = { ...a, id: isNew ? nextId(data.appointments) : a.id };
  const errors = validateAppointment(row);
  if (errors.length) return fail(...errors);
  const appointments = isNew ? [...data.appointments, row] : data.appointments.map((x) => (x.id === row.id ? row : x));
  return { ok: true, value: row, data: { ...data, appointments } };
}
export function deleteAppointment(data: SalesData, id: number): Result<number> {
  return { ok: true, value: id, data: { ...data, appointments: data.appointments.filter((x) => x.id !== id && x.recurrenceId !== id) } };
}
