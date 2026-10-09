import { describe, expect, it } from 'vitest';
import { miniFixture, CLOCK } from './testFixture';
import { grossByMember, grossByMonth, kpis, unitsByCategory, unitsByLocation, unitsByLocationCategory, pipeline } from './selectors';
import { allowedNextStatuses, createOrder, deleteAppointment, deleteEmployee, moveOrderStatus, pipelineTransitions, upsertAppointment, upsertEmployee } from './commands';
import { rebase, rebaseOffsetDays } from './rebase';
import { validateFixtures } from './validateFixtures';

const company = { kind: 'company' } as const;

describe('contract vectors', () => {
  const d = miniFixture();
  it('kpis(company)', () => expect(kpis(d, company, CLOCK)).toEqual({ gross: 816, units: 7, orders: 3, avgOrderValue: 272 }));
  it('unitsByLocation', () => expect(unitsByLocation(d, company, CLOCK).map((r) => [r.key, r.value])).toEqual([['TX', 4], ['CA', 3], ['NY', 0], ['WA', 0]]));
  it('unitsByLocationCategory', () => {
    const rows = unitsByLocationCategory(d, company, CLOCK);
    expect(rows[0]).toMatchObject({ location: 'TX', c2: 3, c4: 1, c1: 0 });
    expect(rows[1]).toMatchObject({ location: 'CA', c4: 3, c2: 0 });
  });
  it('grossByMember(2)', () => expect(grossByMember(d, 2, CLOCK).map((r) => [r.label, r.value])).toEqual([['Jamie Fisher', 0], ['Elijah Hamilton', 0], ['Noah Robinson', 552]]));
  it('grossByMonth(rep 5)', () => {
    const m = Object.fromEntries(grossByMonth(d, { kind: 'rep', repId: 5 }, CLOCK).map((r) => [r.key, r.value]));
    expect(m['2026-09']).toBe(552); expect(m['2026-10']).toBe(0); expect(Object.keys(m)).toHaveLength(12);
  });
  it('unitsByCategory(team 3)', () => {
    const m = Object.fromEntries(unitsByCategory(d, { kind: 'team', leadId: 3 }, CLOCK).map((r) => [r.label, r.value]));
    expect(m).toMatchObject({ 'Road Bikes': 1, Hiking: 1, Camping: 0 });
  });
});

describe('order commands', () => {
  it('createOrder totals, status New, and aggregate update', () => {
    const r = createOrder(miniFixture(), { repId: 5, clientId: 1, lines: [{ productId: 3, qty: 2 }, { productId: 13, qty: 1 }] }, CLOCK);
    if (!r.ok) throw new Error('expected ok');
    expect(r.value).toMatchObject({ id: 4, price: 504, qty: 3, status: 'New', employeeId: 5 });
    expect(kpis(r.data, company, CLOCK)).toEqual({ gross: 1320, units: 10, orders: 4, avgOrderValue: 330 });
    expect(r.data.orderItems.filter((i) => i.orderId === 4)).toHaveLength(2);
  });
  it('rejects qty 0 and leaves data unchanged', () => {
    const d = miniFixture();
    const r = createOrder(d, { repId: 5, clientId: 1, lines: [{ productId: 3, qty: 0 }] }, CLOCK);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.code)).toContain('QTY_RANGE');
    expect(d.orders).toHaveLength(3);
  });
  it('requires a client, lines and a sales rep', () => {
    const r = createOrder(miniFixture(), { repId: 2, clientId: null, lines: [] }, CLOCK);
    expect(r.ok ? [] : r.errors.map((e) => e.code)).toEqual(['REP_NOT_SR', 'CLIENT_REQUIRED', 'LINES_REQUIRED']);
  });
  it('board moves equal the order life cycle', () => {
    expect(pipelineTransitions('New')).toEqual(['Processing', 'Cancelled']);
    expect(pipelineTransitions('Processing')).toEqual(['Shipped', 'Cancelled']);
    expect(pipelineTransitions('Shipped')).toEqual(['Delivered']);
    expect(pipelineTransitions('Delivered')).toEqual(['Delivered']);
    expect(pipelineTransitions('Cancelled')).toEqual(['Cancelled']);
    for (const status of ['New', 'Processing', 'Shipped', 'Delivered', 'Cancelled'] as const) {
      const allowed = allowedNextStatuses(status);
      expect(pipelineTransitions(status)).toEqual(allowed.length ? allowed : [status]);
    }
  });
  it('status transitions', () => {
    const created = createOrder(miniFixture(), { repId: 5, clientId: 1, lines: [{ productId: 3, qty: 2 }, { productId: 13, qty: 1 }] }, CLOCK);
    if (!created.ok) throw new Error();
    const bad = moveOrderStatus(created.data, 4, 'Shipped', CLOCK);
    expect(bad.ok ? '' : bad.errors[0].code).toBe('INVALID_TRANSITION');
    const p = moveOrderStatus(created.data, 4, 'Processing', CLOCK);
    if (!p.ok) throw new Error();
    const c = moveOrderStatus(p.data, 4, 'Cancelled', CLOCK);
    if (!c.ok) throw new Error();
    expect(kpis(c.data, company, CLOCK)).toMatchObject({ gross: 816, orders: 3 });
    const final = moveOrderStatus(c.data, 1, 'New', CLOCK);
    expect(final.ok ? '' : final.errors[0].code).toBe('ORDER_FINAL');
  });
  it('pipeline includes recent orders only', () => {
    const ids = pipeline(miniFixture(), CLOCK).map((r) => r.id);
    expect(ids).toEqual([3, 2]); // order 1 placed 26 days ago but delivered 21 days ago -> hidden
  });
});

describe('employee and appointment rules', () => {
  it('blocks manager cycles and deleting managers', () => {
    const d = miniFixture();
    const jenny = d.employees.find((e) => e.id === 2)!;
    const r = upsertEmployee(d, { ...jenny, jobTitleId: 2, reportsToId: 2 });
    expect(r.ok ? [] : r.errors.map((e) => e.code)).toContain('MANAGER_CYCLE');
    const del = deleteEmployee(d, 2);
    expect(del.ok ? '' : del.errors[0].code).toBe('HAS_REPORTS');
    expect(deleteEmployee(d, 5).ok).toBe(false);
    expect(deleteEmployee(d, 6).ok).toBe(true);
  });
  it('validates names, email and reports-to', () => {
    const r = upsertEmployee(miniFixture(), { id: 0, firstName: 'A', lastName: 'Smith', email: 'bad', gender: 'Female', dateOfBirth: '1995-01-01', reportsToId: 5, jobTitleId: 3, imagePath: '' });
    expect(r.ok ? [] : r.errors.map((e) => e.code)).toEqual(['NAME_LENGTH', 'EMAIL_INVALID', 'MANAGER_NOT_ELIGIBLE']);
    const ok = upsertEmployee(miniFixture(), { id: 0, firstName: 'Ana', lastName: 'Smith', email: 'ana.smith@oexl.example.com', gender: 'Female', dateOfBirth: '1995-01-01', reportsToId: 2, jobTitleId: 3, imagePath: '' });
    expect(ok.ok && ok.value.id).toBe(9);
  });
  it('appointment end must be after start', () => {
    const r = upsertAppointment(miniFixture(), { id: 0, employeeId: 1, subject: 'x', location: null, startTime: '2026-10-06T10:00:00', endTime: '2026-10-06T09:00:00', isAllDay: false, description: null, recurrenceRule: null, recurrenceException: null, recurrenceId: null });
    expect(r.ok ? '' : r.errors[0].code).toBe('END_BEFORE_START');
  });
  it('rejects a deletion of a rep who has orders', () => {
    const del = deleteEmployee(miniFixture(), 5);
    expect(del.ok ? '' : del.errors[0].code).toBe('HAS_ORDERS');
  });
  const appt = { id: 0, employeeId: 1, subject: 'Review', location: null, startTime: '2026-10-06T10:00:00', endTime: '2026-10-06T11:00:00', isAllDay: false, description: null, recurrenceRule: null, recurrenceException: null, recurrenceId: null };
  it('appointment subject is required', () => {
    const r = upsertAppointment(miniFixture(), { ...appt, subject: '  ' });
    expect(r.ok ? '' : r.errors[0].code).toBe('SUBJECT_REQUIRED');
  });
  it('adds, edits and deletes a recurring series with its exceptions', () => {
    const added = upsertAppointment(miniFixture(), { ...appt, recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU;COUNT=4' });
    if (!added.ok) throw new Error('add failed');
    const id = added.value.id;
    const exception = upsertAppointment(added.data, { ...appt, startTime: '2026-10-13T14:00:00', endTime: '2026-10-13T15:00:00', recurrenceId: id });
    if (!exception.ok) throw new Error('exception failed');
    const edited = upsertAppointment(exception.data, { ...added.value, subject: 'Weekly review', recurrenceException: '20261013T100000' });
    expect(edited.ok && edited.data.appointments.find((a) => a.id === id)?.subject).toBe('Weekly review');
    const removed = deleteAppointment(edited.ok ? edited.data : exception.data, id);
    expect(removed.ok && removed.data.appointments.length).toBe(0);
  });
});

describe('rebase and fixture validation', () => {
  it('rebases in whole weeks', () => {
    expect(rebaseOffsetDays('2026-10-06', new Date(2026, 9, 6))).toBe(0);
    expect(rebaseOffsetDays('2026-10-06', new Date(2026, 9, 16))).toBe(7);
    expect(rebaseOffsetDays('2026-10-06', new Date(2026, 9, 9))).toBe(0);
    const d = rebase(miniFixture(), new Date(2026, 9, 20));
    expect(d.orders[0].orderDateTime).toBe('2026-09-24T10:00:00');
  });
  it('accepts the mini fixture and rejects broken totals', () => {
    expect(validateFixtures(miniFixture())).toEqual([]);
    const bad = miniFixture(); bad.orders[0].price = 1;
    expect(validateFixtures(bad).join(' ')).toContain('totals do not match');
  });
});
