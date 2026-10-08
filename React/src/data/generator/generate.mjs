// Deterministic synthetic fixture generator for the Outdoor Excellence sales showcase.
// Run: npm run generate-data. Output: public/data/*.json. Same seed => byte-identical files.
// Reference entities (employees, outlets, categories, products) come from the original Blazor seed;
// orders/appointments are synthetic. All people and companies are fictional.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SCHEMA_VERSION = 1;
const FIXTURE_VERSION = '2026.10.06-1';
const ANCHOR = '2026-10-06';
const SEED = 20261006;

const outDir = join(dirname(fileURLToPath(import.meta.url)), '../../../public/data');

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pickWeighted = (items, weight) => {
  const total = items.reduce((s, i) => s + weight(i), 0);
  let r = rand() * total;
  for (const i of items) { r -= weight(i); if (r <= 0) return i; }
  return items[items.length - 1];
};
const round2 = (n) => Math.round(n * 100) / 100;
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
const anchor = new Date(`${ANCHOR}T00:00:00`);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysBetween = (a, b) => Math.floor((b - a) / 86400000);

const jobTitles = [
  { id: 1, code: 'SM', name: 'Sales Manager' },
  { id: 2, code: 'TL', name: 'Team Leader' },
  { id: 3, code: 'SR', name: 'Sales Rep' },
];

const emp = (id, firstName, lastName, gender, dateOfBirth, reportsToId, jobTitleId) => ({
  id, firstName, lastName,
  email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@oexl.example.com`,
  gender, dateOfBirth, reportsToId, jobTitleId,
  imagePath: `images/profile/${firstName}${lastName}.jpg`,
});
const employees = [
  emp(1, 'Bob', 'Jones', 'Male', '1974-02-10', null, 1),
  emp(2, 'Jenny', 'Marks', 'Female', '1976-05-06', 1, 2),
  emp(3, 'Henry', 'Andrews', 'Male', '1981-05-06', 1, 2),
  emp(4, 'John', 'Jameson', 'Male', '1984-04-17', 1, 2),
  emp(5, 'Noah', 'Robinson', 'Male', '1993-02-12', 2, 3),
  emp(6, 'Elijah', 'Hamilton', 'Male', '1993-06-17', 2, 3),
  emp(7, 'Jamie', 'Fisher', 'Male', '1992-07-13', 2, 3),
  emp(8, 'Olivia', 'Mills', 'Female', '1990-04-17', 3, 3),
  emp(9, 'Benjamin', 'Lucas', 'Male', '1993-02-12', 3, 3),
  emp(10, 'Sarah', 'Henderson', 'Female', '1991-09-23', 3, 3),
  emp(11, 'Emma', 'Lee', 'Female', '1994-11-02', 4, 3),
  emp(12, 'Ava', 'Williams', 'Female', '1995-03-28', 4, 3),
  emp(13, 'Angela', 'Moore', 'Female', '1989-08-14', 4, 3),
];

const outlets = [
  { id: 1, name: 'Texas Outdoor Store', location: 'TX' },
  { id: 2, name: 'California Outdoor Store', location: 'CA' },
  { id: 3, name: 'New York Outdoor Store', location: 'NY' },
  { id: 4, name: 'Washington Outdoor Store', location: 'WA' },
];

const clientNames = [
  ['James', 'Tailor', 'Buyer'], ['Maria', 'Delgado', 'Store Manager'], ['Kevin', 'Brooks', 'Assistant Buyer'], ['Priya', 'Nair', 'Merchandiser'],
  ['Jill', 'Hutton', 'Buyer'], ['Marcus', 'Chen', 'Store Manager'], ['Rosa', 'Alvarez', 'Category Lead'], ['Tom', 'Becker', 'Assistant Buyer'],
  ['Craig', 'Rice', 'Buyer'], ['Hannah', 'Klein', 'Store Manager'], ['Darnell', 'Price', 'Merchandiser'], ['Lucy', 'Ford', 'Assistant Buyer'],
  ['Amy', 'Smith', 'Buyer'], ['Erik', 'Lindqvist', 'Store Manager'], ['Grace', 'Okafor', 'Category Lead'], ['Owen', 'Park', 'Merchandiser'],
];
const clients = clientNames.map(([firstName, lastName, jobTitle], i) => ({
  id: i + 1, firstName, lastName, jobTitle,
  phone: `555-01${pad(i + 10)}`,
  email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
  outletId: Math.floor(i / 4) + 1,
}));
const PROSPECT_CLIENT_ID = 16; // no orders: "prospect" edge case

const productCategories = [
  { id: 1, name: 'Mountain Bikes' }, { id: 2, name: 'Road Bikes' }, { id: 3, name: 'Camping' }, { id: 4, name: 'Hiking' }, { id: 5, name: 'Boots' },
];
const prod = (id, name, categoryId, price, image, description) => ({ id, name, description, imagePath: `images/products/${image}.jpg`, price, categoryId });
const products = [
  prod(1, 'Mountain Bike 1', 1, 200, 'MountainBike1', 'Hardtail trail bike with 100 mm fork and 21-speed drivetrain.'),
  prod(2, 'Mountain Bike 2', 1, 210, 'MountainBike2', 'Trail bike with hydraulic disc brakes and tubeless-ready rims.'),
  prod(3, 'Road Bike 1', 2, 240, 'RoadBike1', 'Lightweight aluminum road frame with carbon fork.'),
  prod(4, 'Road Bike 2', 2, 250, 'RoadBike2', 'Endurance geometry for long rides, 2x11 gearing.'),
  prod(5, 'Road Bike 3', 2, 252, 'RoadBike3', 'Aero race frame with internal cable routing.'),
  prod(6, 'Road Bike 4', 2, 230, 'RoadBike4', 'All-road bike with clearance for 35 mm tires.'),
  prod(7, 'Tent 1', 3, 230, 'Tent1', 'Three-person, three-season dome tent with vestibule.'),
  prod(8, 'Tent 2', 3, 230, 'Tent2', 'Two-person ultralight backpacking tent, 1.4 kg.'),
  prod(9, 'Air Mattress 1', 3, 11, 'Mattress1', 'Compact inflatable sleeping pad for day trips.'),
  prod(10, 'Air Mattress 2', 3, 40, 'Mattress2', 'Insulated pad rated for cold nights, R-value 3.5.'),
  prod(11, 'Air Mattress 3', 3, 54, 'Mattress3', 'Double-width self-inflating camp mattress.'),
  prod(12, 'Air Mattress 4', 3, 15, 'Mattress4', 'Foam-core pad with built-in pillow.'),
  prod(13, 'Pack 1', 4, 24, 'Pack1', '20 L daypack with hydration sleeve.'),
  prod(14, 'Pack 2', 4, 30, 'Pack2', '35 L hiking pack with ventilated back panel.'),
  prod(15, 'Pack 3', 4, 35, 'Pack3', '50 L trekking pack with rain cover.'),
  prod(16, 'Boot 1', 5, 20, 'Boot1', 'Low-cut trail shoe with grippy rubber outsole.'),
  prod(17, 'Boot 2', 5, 38, 'Boot2', 'Waterproof mid-height hiking boot.'),
  prod(18, 'Boot 3', 5, 35, 'Boot3', 'Leather hiking boot with cushioned midsole.'),
  prod(19, 'Boot 4', 5, 31, 'Boot4', 'Lightweight approach shoe for rocky trails.'),
];

// Seasonality: bikes and camping peak Mar–Aug.
const categoryWeight = (categoryId, month) => {
  const peak = month >= 2 && month <= 7;
  return ({ 1: peak ? 1.3 : 0.8, 2: peak ? 1.3 : 0.8, 3: peak ? 1.4 : 0.7, 4: 1, 5: 1.1 })[categoryId];
};
const reps = employees.filter((e) => e.jobTitleId === 3);
const repWeight = (r) => (r.id === 9 ? 0.4 : r.id === 5 ? 1.25 : 1);
const orderClients = clients.filter((c) => c.id !== PROSPECT_CLIENT_ID);

const orders = [];
const orderItems = [];
const firstMonth = new Date(anchor.getFullYear(), anchor.getMonth() - 11, 1);
for (let m = 0; m < 12; m++) {
  const monthStart = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + m, 1);
  const month = monthStart.getMonth();
  const daysInMonth = new Date(monthStart.getFullYear(), month + 1, 0).getDate();
  const isAnchorMonth = m === 11;
  const lastDay = isAnchorMonth ? anchor.getDate() : daysInMonth;
  const base = int(30, 45) * (month >= 2 && month <= 7 ? 1.15 : 1);
  // The anchor month is busier so the order pipeline has live work in every column.
  const count = Math.max(3, Math.round(base * (lastDay / daysInMonth) * (isAnchorMonth ? 2.5 : 1)));
  const monthOrders = [];
  for (let i = 0; i < count; i++) {
    const day = int(1, lastDay);
    const d = new Date(monthStart.getFullYear(), month, day, int(8, 17), int(0, 59));
    if (d > new Date(anchor.getTime() + 17 * 3600000)) d.setTime(anchor.getTime() + 9 * 3600000);
    monthOrders.push(d);
  }
  monthOrders.sort((a, b) => a - b);
  for (const d of monthOrders) {
    const id = orders.length + 1;
    const rep = pickWeighted(reps, repWeight);
    const client = orderClients[int(0, orderClients.length - 1)];
    const lineCount = pickWeighted([1, 2, 3], (n) => (n === 1 ? 5 : n === 2 ? 3 : 1));
    const used = new Set();
    let price = 0; let qty = 0;
    for (let l = 0; l < lineCount; l++) {
      const cat = pickWeighted(productCategories, (c) => categoryWeight(c.id, month));
      const options = products.filter((p) => p.categoryId === cat.id && !used.has(p.id));
      if (!options.length) continue;
      const p = options[int(0, options.length - 1)];
      used.add(p.id);
      const q = pickWeighted([1, 2, 3], (n) => (n === 1 ? 6 : n === 2 ? 3 : 1));
      const linePrice = round2(p.price * q);
      orderItems.push({ id: orderItems.length + 1, orderId: id, productId: p.id, qty: q, unitPrice: p.price, price: linePrice });
      price = round2(price + linePrice); qty += q;
    }
    const age = daysBetween(d, anchor);
    let status; let changeOffset;
    if (age > 14) { status = rand() < 0.03 ? 'Cancelled' : 'Delivered'; changeOffset = Math.min(age, int(3, 10)); }
    else if (age <= 2) { status = 'New'; changeOffset = 0; }
    else if (age <= 6) { status = rand() < 0.1 ? 'Cancelled' : 'Processing'; changeOffset = int(1, 2); }
    else if (age <= 10) { status = 'Shipped'; changeOffset = int(2, 4); }
    else { status = 'Delivered'; changeOffset = int(5, 9); }
    const changed = changeOffset === 0 ? d : addDays(d, changeOffset);
    orders.push({ id, orderDateTime: iso(d), employeeId: rep.id, clientId: client.id, price, qty, status, statusChangedAt: iso(changed > anchor ? d : changed) });
  }
}

// Appointments for the demo Sales Manager (employee 1) around the anchor date.
const appointments = [];
const appt = (dayOffset, hour, minutes, duration, subject, location, description, extra = {}) => {
  const start = addDays(anchor, dayOffset); start.setHours(hour, minutes);
  const end = new Date(start.getTime() + duration * 60000);
  appointments.push({ id: appointments.length + 1, employeeId: 1, subject, location, startTime: iso(start), endTime: iso(end), isAllDay: false, description, recurrenceRule: null, recurrenceException: null, recurrenceId: null, ...extra });
};
const allDay = (dayOffset, days, subject, location, description) => {
  const start = addDays(anchor, dayOffset);
  appointments.push({ id: appointments.length + 1, employeeId: 1, subject, location, startTime: iso(start), endTime: iso(addDays(start, days)), isAllDay: true, description, recurrenceRule: null, recurrenceException: null, recurrenceId: null });
};
// Weekly 1:1s with each team lead (recurring), starting three weeks back.
const monday = addDays(anchor, -((anchor.getDay() + 6) % 7));
const weekdayOffset = (weekShift, weekday) => daysBetween(anchor, addDays(monday, weekShift * 7 + weekday));
appt(weekdayOffset(-3, 1), 10, 0, 30, '1:1 Jenny Marks', 'Head office', 'Weekly team-lead check-in.', { recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU;COUNT=8' });
appt(weekdayOffset(-3, 1), 11, 0, 30, '1:1 Henry Andrews', 'Head office', 'Weekly team-lead check-in.', { recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU;COUNT=8' });
appt(weekdayOffset(-3, 3), 10, 0, 30, '1:1 John Jameson', 'Head office', 'Weekly team-lead check-in.', { recurrenceRule: 'FREQ=WEEKLY;BYDAY=TH;COUNT=8' });
appt(weekdayOffset(-3, 0), 9, 0, 15, 'Morning standup', null, 'Daily sales standup with team leads.', { recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=21' });
const oneOffs = [
  [-20, 14, 0, 60, 'Client review - Texas', 'TX', 'Quarterly review with the Texas outlet buyer.'],
  [-18, 13, 30, 60, 'Team sync - West Coast', 'CA', 'California and Washington reps sync.'],
  [-17, 15, 0, 45, 'Pricing update', null, 'Review supplier price changes for camping.'],
  [-15, 10, 30, 90, 'Product demo - New York', 'NY', 'Road bike line demo for NY buyers.'],
  [-13, 14, 0, 60, 'Vendor meeting', 'WA', 'Camping gear vendor negotiation.'],
  [-11, 9, 30, 60, 'Sales pipeline review', 'TX', 'Review open orders and late shipments.'],
  [-10, 16, 0, 30, 'Call with Maria Delgado', 'TX', 'Store reset timeline.'],
  [-8, 13, 0, 60, 'Lunch - Jill Hutton', 'CA', 'Working lunch with California buyer.'],
  [-6, 15, 30, 60, 'Hiking range planning', null, 'Spring hiking range shortlist.'],
  [-4, 11, 0, 60, 'Client call - California', 'CA', 'Follow-up on bike order volumes.'],
  [-3, 14, 0, 45, 'Returns review', null, 'Monthly returns and warranty claims.'],
  [-1, 16, 0, 60, 'Forecast prep', null, 'Prepare quarterly forecast inputs.'],
  [0, 11, 30, 60, 'Client call - Washington', 'WA', 'Follow-up call with Washington buyer.'],
  [0, 15, 0, 60, 'Quarterly forecast', null, 'Q4 forecast planning session.'],
  [1, 13, 0, 90, 'Team training', 'NY', 'New product training for NY reps.'],
  [2, 12, 0, 60, 'Lunch - James Tailor', 'TX', 'Working lunch with Texas buyer.'],
  [3, 10, 0, 60, 'Interview - sales rep', 'Head office', 'Candidate for the Washington team.'],
  [6, 14, 0, 60, 'Inventory review', 'TX', 'Texas outlet inventory check.'],
  [7, 9, 30, 120, 'Strategy workshop', null, 'Annual strategy workshop.'],
  [9, 14, 0, 60, 'Client onboarding', 'WA', 'Onboard new Washington client.'],
  [11, 11, 0, 60, 'Marketing sync', null, 'Holiday campaign alignment.'],
  [13, 10, 0, 60, 'Client review - New York', 'NY', 'Quarterly review with the New York buyer.'],
  [15, 15, 0, 60, 'Budget review', null, 'Next-year budget draft.'],
  [17, 13, 30, 60, 'Vendor call - boots', null, 'Boot supplier lead times.'],
  [20, 14, 0, 90, 'Year-end planning', null, 'Year-end sales planning.'],
];
for (const a of oneOffs) appt(...a);
allDay(-9, 1, 'Regional sales conference', 'CA', 'All-day regional sales conference.');
allDay(4, 1, 'Store visit day - Texas', 'TX', 'Visit all Texas store floors.');
allDay(16, 2, 'Outdoor trade show', 'NY', 'Two-day outdoor trade show.');

const manifest = { schemaVersion: SCHEMA_VERSION, fixtureVersion: FIXTURE_VERSION, scenarioAnchor: ANCHOR, generatorSeed: SEED };
const files = { manifest, jobTitles, employees, outlets, clients, productCategories, products, orders, orderItems, appointments };
mkdirSync(outDir, { recursive: true });
for (const [name, data] of Object.entries(files)) writeFileSync(join(outDir, `${name}.json`), `${JSON.stringify(data, null, 1)}\n`);
console.log(JSON.stringify({ orders: orders.length, orderItems: orderItems.length, appointments: appointments.length, statuses: orders.reduce((m, o) => ((m[o.status] = (m[o.status] || 0) + 1), m), {}) }));
