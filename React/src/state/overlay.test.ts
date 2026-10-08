import { describe, expect, it } from 'vitest';
import { miniFixture, CLOCK } from '../domain/testFixture';
import { createOrder, moveOrderStatus } from '../domain/commands';
import { applyOverlay, diffOverlay } from './overlay';
import { emptyOverlay } from './persistence';

describe('session overlay', () => {
  it('round-trips created orders and status changes over the baseline', () => {
    const base = miniFixture();
    const a = createOrder(base, { repId: 5, clientId: 1, lines: [{ productId: 3, qty: 1 }] }, CLOCK);
    if (!a.ok) throw new Error();
    const b = moveOrderStatus(a.data, 3, 'Shipped', CLOCK);
    if (!b.ok) throw new Error();
    const overlay = JSON.parse(JSON.stringify(diffOverlay(base, b.data)));
    const restored = applyOverlay(base, overlay);
    expect(restored.orders).toEqual(b.data.orders);
    expect(restored.orderItems).toEqual(b.data.orderItems);
    expect(base.orders).toHaveLength(3); // baseline untouched
  });
  it('empty overlay returns the baseline', () => {
    const base = miniFixture();
    expect(applyOverlay(base, emptyOverlay()).orders).toEqual(base.orders);
  });
});
