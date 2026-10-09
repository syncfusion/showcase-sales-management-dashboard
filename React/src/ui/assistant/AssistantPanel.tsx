import { useEffect, useRef } from 'react';
import { AIAssistViewComponent } from '@syncfusion/ej2-react-interactive-chat';
import type { PromptRequestEventArgs } from '@syncfusion/ej2-react-interactive-chat';
import { useInsights } from '../insights';
import { useSalesStore } from '../../state/SalesStore';
import type { Scope } from '../../domain/types';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** Renders the provider's light markdown (**bold**) safely, followed by the sample label. */
function toHtml(text: string, label: string): string {
  const body = escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return `<div class="ai-answer"><p>${body}</p><span class="sample-badge">${escapeHtml(label)}</span></div>`;
}

/**
 * The conversation inside the assistant panel. Loaded on first open, then kept mounted so the conversation
 * survives closing the panel and changing page. `open` going false aborts an answer that is still in flight.
 */
export default function AssistantPanel({ scope, scopeLabel, open }: { scope: Scope; scopeLabel: string; open: boolean }) {
  const provider = useInsights();
  const { data, clock } = useSalesStore();
  const ref = useRef<AIAssistViewComponent>(null);
  const inflight = useRef<AbortController | null>(null);
  // The prompt handler reads the latest scope and data through a ref, so the view keeps one stable callback.
  const latest = useRef({ scope, scopeLabel, data });
  latest.current = { scope, scopeLabel, data };
  useEffect(() => () => inflight.current?.abort(), []);
  useEffect(() => { if (!open) inflight.current?.abort(); }, [open]);

  const onPrompt = (args: PromptRequestEventArgs) => {
    const { scope: s, scopeLabel: label, data: d } = latest.current;
    if (!d) return;
    inflight.current?.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    provider.answer({ prompt: args.prompt ?? '', scope: s, scopeLabel: label, data: d, now: clock.now() }, ctrl.signal)
      .then((res) => { if (!ctrl.signal.aborted) ref.current?.addPromptResponse(toHtml(res.text, provider.label)); })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') ref.current?.addPromptResponse(toHtml('Stopped. Ask another question when you are ready.', provider.label));
        else ref.current?.addPromptResponse(toHtml('Something went wrong while computing that answer. Try again.', provider.label));
      });
  };

  return (
    <AIAssistViewComponent id="sales-insights" ref={ref} height="100%" width="100%" promptPlaceholder={`Ask about ${scopeLabel}…`}
      promptSuggestions={provider.suggestions(scope)} promptSuggestionsHeader="Try asking" promptRequest={onPrompt} showClearButton showHeader={false}
      stopRespondingClick={() => inflight.current?.abort()} />
  );
}
