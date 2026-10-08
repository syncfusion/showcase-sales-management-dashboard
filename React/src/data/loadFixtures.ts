import { assetUrl } from '../basePath';
import { rebase } from '../domain/rebase';
import { validateFixtures } from '../domain/validateFixtures';
import type { SalesData } from '../domain/types';

const FILES = ['manifest', 'jobTitles', 'employees', 'outlets', 'clients', 'productCategories', 'products', 'orders', 'orderItems', 'appointments'] as const;

export class FixtureError extends Error {}

/** Fetches the shipped JSON baseline, validates it, and rebases dates to `today`. */
export async function loadFixtures(today: Date, signal?: AbortSignal): Promise<SalesData> {
  const entries = await Promise.all(FILES.map(async (name) => {
    const res = await fetch(assetUrl(`data/${name}.json`), { signal });
    if (!res.ok) throw new FixtureError(`The demo data file ${name}.json could not be loaded (${res.status}).`);
    return [name, await res.json()] as const;
  }));
  const data = Object.fromEntries(entries) as unknown as SalesData;
  const problems = validateFixtures(data);
  if (problems.length) throw new FixtureError(`The demo data is invalid: ${problems[0]}`);
  return Object.freeze(rebase(data, today)) as SalesData;
}
