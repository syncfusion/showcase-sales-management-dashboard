export type RoleCode = 'SM' | 'TL' | 'SR';
export type Location = 'TX' | 'CA' | 'NY' | 'WA';
export type OrderStatus = 'New' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';

export const LOCATIONS: Location[] = ['TX', 'CA', 'NY', 'WA'];
export const ORDER_STATUSES: OrderStatus[] = ['New', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

export interface FixtureManifest { schemaVersion: number; fixtureVersion: string; scenarioAnchor: string; generatorSeed: number }
export interface JobTitle { id: number; code: RoleCode; name: string }
export interface Employee {
  id: number; firstName: string; lastName: string; email: string; gender: 'Male' | 'Female';
  dateOfBirth: string; reportsToId: number | null; jobTitleId: number; imagePath: string;
}
export interface Outlet { id: number; name: string; location: Location }
export interface Client { id: number; firstName: string; lastName: string; jobTitle: string; phone: string; email: string; outletId: number }
export interface ProductCategory { id: number; name: string }
export interface Product { id: number; name: string; description: string; imagePath: string; price: number; categoryId: number }
export interface Order {
  id: number; orderDateTime: string; employeeId: number; clientId: number; price: number; qty: number;
  status: OrderStatus; statusChangedAt: string;
}
export interface OrderItem { id: number; orderId: number; productId: number; qty: number; unitPrice: number; price: number }
export interface Appointment {
  id: number; employeeId: number; subject: string; location: string | null; startTime: string; endTime: string;
  isAllDay: boolean; description: string | null; recurrenceRule: string | null; recurrenceException: string | null; recurrenceId: number | null;
}

export interface SalesData {
  manifest: FixtureManifest;
  jobTitles: JobTitle[];
  employees: Employee[];
  outlets: Outlet[];
  clients: Client[];
  productCategories: ProductCategory[];
  products: Product[];
  orders: Order[];
  orderItems: OrderItem[];
  appointments: Appointment[];
}

export type Scope = { kind: 'company' } | { kind: 'team'; leadId: number } | { kind: 'rep'; repId: number };

export const round2 = (n: number): number => Math.round(n * 100) / 100;
