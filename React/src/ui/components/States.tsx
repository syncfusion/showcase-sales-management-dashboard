import { AlertTriangle, Inbox } from 'lucide-react';
import { ButtonComponent } from '@syncfusion/ej2-react-buttons';

export function LoadingState({ label = 'Loading demo data…', height = 320 }: { label?: string; height?: number }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="kpi-grid" aria-hidden="true">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 136 }} />)}</div>
      <div className="skeleton" aria-hidden="true" style={{ height }} />
    </div>
  );
}
export function EmptyState({ message }: { message: string }) {
  return <div className="state"><Inbox size={28} aria-hidden="true" /><p>{message}</p></div>;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state error" role="alert">
      <AlertTriangle size={28} aria-hidden="true" />
      <p>{message}</p>
      {onRetry && <ButtonComponent onClick={onRetry}>Try again</ButtonComponent>}
    </div>
  );
}
