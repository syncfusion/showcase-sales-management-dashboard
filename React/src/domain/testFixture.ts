import type { SalesData } from './types';

// Mini-fixture from contracts/data-contract.md "Expected-value vectors".
export function miniFixture(): SalesData {
  const e = (id: number, firstName: string, lastName: string, reportsToId: number | null, jobTitleId: number) =>
    ({ id, firstName, lastName, email: `${firstName}.${lastName}@oexl.example.com`.toLowerCase(), gender: 'Male' as const, dateOfBirth: '1990-01-01', reportsToId, jobTitleId, imagePath: '' });
  return {
    manifest: { schemaVersion: 1, fixtureVersion: 'test', scenarioAnchor: '2026-10-06', generatorSeed: 1 },
    jobTitles: [{ id: 1, code: 'SM', name: 'Sales Manager' }, { id: 2, code: 'TL', name: 'Team Leader' }, { id: 3, code: 'SR', name: 'Sales Rep' }],
    employees: [
      e(1, 'Bob', 'Jones', null, 1), e(2, 'Jenny', 'Marks', 1, 2), e(3, 'Henry', 'Andrews', 1, 2),
      e(5, 'Noah', 'Robinson', 2, 3), e(6, 'Elijah', 'Hamilton', 2, 3), e(7, 'Jamie', 'Fisher', 2, 3), e(8, 'Olivia', 'Mills', 3, 3),
    ],
    outlets: [{ id: 1, name: 'Texas Outdoor Store', location: 'TX' }, { id: 2, name: 'California Outdoor Store', location: 'CA' }, { id: 3, name: 'New York Outdoor Store', location: 'NY' }, { id: 4, name: 'Washington Outdoor Store', location: 'WA' }],
    clients: [
      { id: 1, firstName: 'James', lastName: 'Tailor', jobTitle: 'Buyer', phone: '555-0110', email: 'james.tailor@example.com', outletId: 1 },
      { id: 2, firstName: 'Jill', lastName: 'Hutton', jobTitle: 'Buyer', phone: '555-0111', email: 'jill.hutton@example.com', outletId: 2 },
    ],
    productCategories: [{ id: 1, name: 'Mountain Bikes' }, { id: 2, name: 'Road Bikes' }, { id: 3, name: 'Camping' }, { id: 4, name: 'Hiking' }, { id: 5, name: 'Boots' }],
    products: [
      { id: 3, name: 'Road Bike 1', description: '', imagePath: '', price: 240, categoryId: 2 },
      { id: 13, name: 'Pack 1', description: '', imagePath: '', price: 24, categoryId: 4 },
    ],
    orders: [
      { id: 1, orderDateTime: '2026-09-10T10:00:00', employeeId: 5, clientId: 1, price: 480, qty: 2, status: 'Delivered', statusChangedAt: '2026-09-15T10:00:00' },
      { id: 2, orderDateTime: '2026-09-22T10:00:00', employeeId: 5, clientId: 2, price: 72, qty: 3, status: 'Delivered', statusChangedAt: '2026-09-28T10:00:00' },
      { id: 3, orderDateTime: '2026-10-02T10:00:00', employeeId: 8, clientId: 1, price: 264, qty: 2, status: 'Processing', statusChangedAt: '2026-10-03T10:00:00' },
    ],
    orderItems: [
      { id: 1, orderId: 1, productId: 3, qty: 2, unitPrice: 240, price: 480 },
      { id: 2, orderId: 2, productId: 13, qty: 3, unitPrice: 24, price: 72 },
      { id: 3, orderId: 3, productId: 3, qty: 1, unitPrice: 240, price: 240 },
      { id: 4, orderId: 3, productId: 13, qty: 1, unitPrice: 24, price: 24 },
    ],
    appointments: [],
  };
}
export const CLOCK = new Date(2026, 9, 6, 12, 0, 0);
