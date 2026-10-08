import { addDays, daysBetween, parseLocal } from './dates';
import type { SalesData } from './types';

/** Whole-week offset from the scenario anchor to `today`, so weekdays are preserved. */
export function rebaseOffsetDays(scenarioAnchor: string, today: Date): number {
  const days = daysBetween(parseLocal(`${scenarioAnchor}T00:00:00`), today);
  return 7 * Math.round(days / 7);
}

export function rebase(data: SalesData, today: Date): SalesData {
  const offset = rebaseOffsetDays(data.manifest.scenarioAnchor, today);
  if (offset === 0) return data;
  return {
    ...data,
    orders: data.orders.map((o) => ({ ...o, orderDateTime: addDays(o.orderDateTime, offset), statusChangedAt: addDays(o.statusChangedAt, offset) })),
    appointments: data.appointments.map((a) => ({ ...a, startTime: addDays(a.startTime, offset), endTime: addDays(a.endTime, offset) })),
  };
}
