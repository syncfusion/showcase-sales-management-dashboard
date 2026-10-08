import type { SalesData, Scope } from '../domain/types';

export interface InsightRequest { prompt: string; scope: Scope; scopeLabel: string; data: SalesData; now: Date }
export interface InsightEvidence { selector: string; key: string; value: number }
export interface InsightResponse { text: string; kind: 'sample' | 'live'; evidence: InsightEvidence[] }

/** Replaceable AI boundary. A customer implementation calls its own server, which holds any model credentials. */
export interface InsightsProvider {
  readonly label: string;
  suggestions(scope: Scope): string[];
  answer(request: InsightRequest, signal: AbortSignal): Promise<InsightResponse>;
}
