import { describe, expect, it } from 'vitest';
import { SampleInsightsProvider, FALLBACK } from './SampleInsightsProvider';
import { miniFixture, CLOCK } from '../domain/testFixture';
import { createOrder } from '../domain/commands';

const p = new SampleInsightsProvider(0);
const req = (prompt: string, data = miniFixture()) => ({ prompt, scope: { kind: 'company' } as const, scopeLabel: 'the company', data, now: CLOCK });

describe('sample insights', () => {
  it('top location is grounded in session data', () => {
    expect(p.compute(req('Top location by units')).text).toContain('**TX** leads the company with 4 units');
    const r = createOrder(miniFixture(), { repId: 5, clientId: 2, lines: [{ productId: 13, qty: 5 }] }, CLOCK);
    if (!r.ok) throw new Error();
    expect(p.compute(req('top location', r.data)).text).toContain('**CA** leads the company with 8 units');
  });
  it('average order value', () => expect(p.compute(req('Average order value')).text).toContain('$272.00'));
  it('falls back for unsupported prompts', () => expect(p.compute(req('write me a poem')).text).toBe(FALLBACK));
  it('can be cancelled', async () => {
    const slow = new SampleInsightsProvider(1000); const c = new AbortController();
    const pr = slow.answer(req('top location'), c.signal); c.abort();
    await expect(pr).rejects.toThrow('Cancelled');
  });
});
