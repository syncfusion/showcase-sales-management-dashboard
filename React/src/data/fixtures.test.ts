import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateFixtures } from '../domain/validateFixtures';
import { kpis, salesReps, teamLeads, unitsByMonthLocation } from '../domain/selectors';
import type { SalesData } from '../domain/types';

const dir = join(import.meta.dirname, '../../public/data');
const read = (n: string) => JSON.parse(readFileSync(join(dir, `${n}.json`), 'utf8'));
const data: SalesData = Object.fromEntries(
  ['manifest', 'jobTitles', 'employees', 'outlets', 'clients', 'productCategories', 'products', 'orders', 'orderItems', 'appointments'].map((n) => [n, read(n)]),
) as unknown as SalesData;
const anchorNow = new Date(2026, 9, 6, 18, 0, 0);

describe('shipped fixtures', () => {
  it('pass validation', () => expect(validateFixtures(data)).toEqual([]));
  it('give every scope non-empty dashboards', () => {
    expect(kpis(data, { kind: 'company' }, anchorNow).orders).toBeGreaterThan(300);
    for (const tl of teamLeads(data)) expect(kpis(data, { kind: 'team', leadId: tl.id }, anchorNow).orders).toBeGreaterThan(0);
    for (const sr of salesReps(data)) expect(kpis(data, { kind: 'rep', repId: sr.id }, anchorNow).orders).toBeGreaterThan(0);
    expect(unitsByMonthLocation(data, { kind: 'company' }, anchorNow).every((r) => r.TX + r.CA + r.NY + r.WA > 0)).toBe(true);
  });
  it('keep client 16 as a prospect with no orders', () => expect(data.orders.some((o) => o.clientId === 16)).toBe(false));
});
