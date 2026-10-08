import type { OrderStatus } from '../../domain/types';
export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`status-badge status-${status}`}>{status}</span>;
}
