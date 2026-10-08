import { useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { KanbanComponent, ColumnsDirective, ColumnDirective } from '@syncfusion/ej2-react-kanban';
import type { ActionEventArgs, DialogEventArgs } from '@syncfusion/ej2-react-kanban';
import { DropDownListComponent } from '@syncfusion/ej2-react-dropdowns';
import { useSalesData, useSalesStore } from '../../../state/SalesStore';
import { allowedNextStatuses, moveOrderStatus } from '../../../domain/commands';
import { fullName, pipeline, salesReps } from '../../../domain/selectors';
import { LOCATIONS } from '../../../domain/types';
import type { OrderStatus } from '../../../domain/types';
import { usd, num, relativeDays, dateTime } from '../../format';
import type { Notify } from '../../components/useNotifier';

interface Card {
  cardId: string; id: number; status: OrderStatus; client: string; outlet: string; location: string; rep: string;
  unitsText: string; totalText: string; whenText: string; whenTitle: string; moves: Array<{ to: OrderStatus; label: string }>;
}
const COLUMNS: Array<{ key: OrderStatus; title: string }> = [
  { key: 'New', title: 'New' }, { key: 'Processing', title: 'Processing' }, { key: 'Shipped', title: 'Shipped' },
  { key: 'Delivered', title: 'Delivered (14 days)' }, { key: 'Cancelled', title: 'Cancelled' },
];
const moveLabel = (to: OrderStatus) => (to === 'Cancelled' ? 'Cancel order' : `Move to ${to}`);

// Module-level card template; every displayed value is precomputed on the card record.
const cardTemplate = (c: Card) => (
  <div className={`order-card edge-${c.status}`}>
    <div className="row"><strong>Order #{c.id}</strong></div>
    <div>{c.client} <span className="muted">· {c.location}</span></div>
    <div className="muted">{c.outlet}</div>
    <div className="row"><span className="muted">Rep: {c.rep}</span></div>
    <div className="row nowrap"><span>{c.unitsText}</span><strong>{c.totalText}</strong></div>
    <div className="row"><span className="muted" title={c.whenTitle}>{c.whenText}</span></div>
    {c.moves.length > 0 && (
      <div className="card-actions">
        {c.moves.map((m) => (
          <button key={m.to} type="button" className={`card-move${m.to === 'Cancelled' ? ' danger' : ''}`} data-order={c.id} data-to={m.to}
            aria-label={`${m.label}: order ${c.id}`}>{m.to === 'Cancelled' ? 'Cancel' : m.label}</button>
        ))}
      </div>
    )}
  </div>
);

export function PipelineTab({ notify }: { notify: Notify }) {
  const data = useSalesData();
  const { run, clock } = useSalesStore();
  const [repFilter, setRepFilter] = useState(0);
  const [locFilter, setLocFilter] = useState('All');
  const [refresh, setRefresh] = useState(0);
  const [message, setMessage] = useState('');
  const kanban = useRef<KanbanComponent>(null);

  const reps = useMemo(() => [{ value: 0, text: 'All reps' }, ...salesReps(data).map((e) => ({ value: e.id, text: fullName(e) }))], [data]);
  const locations = [{ value: 'All', text: 'All locations' }, ...LOCATIONS.map((l) => ({ value: l, text: l }))];

  // Fresh objects on every data change or refused drop: Kanban mutates its records, the store stays the source of truth.
  const cards = useMemo<Card[]>(() => {
    const now = clock.now();
    return pipeline(data, now)
      .filter((r) => (repFilter === 0 || r.employeeId === repFilter) && (locFilter === 'All' || r.location === locFilter))
      .map((r) => ({
        cardId: String(r.id), id: r.id, status: r.status, client: r.clientName, outlet: r.outletName, location: r.location, rep: r.repName,
        unitsText: `${num(r.qty)} unit${r.qty === 1 ? '' : 's'} · ${r.lines} line${r.lines === 1 ? '' : 's'}`, totalText: usd(r.price),
        whenText: `Placed ${relativeDays(r.date, now)}`, whenTitle: dateTime(r.date),
        moves: allowedNextStatuses(r.status).map((to) => ({ to, label: moveLabel(to) })),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, repFilter, locFilter, refresh, clock]);

  const move = (orderId: number, to: OrderStatus) => {
    const result = run((d, now) => moveOrderStatus(d, orderId, to, now));
    if (result.ok) {
      const text = to === 'Cancelled' ? `Order #${orderId} cancelled. It no longer counts toward dashboard totals.` : `Order #${orderId} moved to ${to}.`;
      setMessage(text);
      notify('Order updated', text, 'success');
    } else {
      const text = result.errors[0]?.message ?? 'That move is not allowed.';
      setMessage(text);
      notify('Move not allowed', text, 'danger');
      setRefresh((n) => n + 1);
    }
  };

  // Drag-and-drop: validate the requested change against the store and let the store re-render the board.
  const onActionBegin = (args: ActionEventArgs) => {
    const changed = (args.changedRecords ?? []) as Card[];
    if (!changed.length) return;
    args.cancel = true;
    const card = changed[0];
    const current = data.orders.find((o) => o.id === card.id)?.status;
    if (current && current !== card.status) move(card.id, card.status);
    else setRefresh((n) => n + 1);
  };

  const onBoardClick = (e: MouseEvent<HTMLDivElement>) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button.card-move');
    if (!btn) return;
    e.stopPropagation();
    move(Number(btn.dataset.order), btn.dataset.to as OrderStatus);
  };

  return (
    <>
      <div className="toolbar-row">
        <div className="field">
          <label htmlFor="pipeline-rep">Sales rep</label>
          <DropDownListComponent id="pipeline-rep" dataSource={reps} fields={{ value: 'value', text: 'text' }} value={repFilter} change={(e) => setRepFilter(e.value as number)} />
        </div>
        <div className="field">
          <label htmlFor="pipeline-loc">Location</label>
          <DropDownListComponent id="pipeline-loc" dataSource={locations} fields={{ value: 'value', text: 'text' }} value={locFilter} change={(e) => setLocFilter(e.value as string)} />
        </div>
        <p className="muted toolbar-note">Orders placed in the last 30 days. Drag a card one step forward, or use its buttons. Delivered and cancelled orders are final.</p>
      </div>
      <div className="inline-status" role="status" aria-live="polite">{message}</div>
      <div className="kanban-wrap" onClickCapture={onBoardClick}>
        <KanbanComponent id="order-pipeline" ref={kanban} keyField="status" dataSource={cards as unknown as Record<string, unknown>[]}
          cardSettings={{ headerField: 'cardId', template: cardTemplate as never, showHeader: false }}
          actionBegin={onActionBegin} dialogOpen={(e: DialogEventArgs) => { e.cancel = true; }} height="640px">
          <ColumnsDirective>
            {COLUMNS.map((c) => (
              <ColumnDirective key={c.key} keyField={c.key} headerText={c.title} showItemCount allowDrag={c.key !== 'Delivered' && c.key !== 'Cancelled'} />
            ))}
          </ColumnsDirective>
        </KanbanComponent>
      </div>
    </>
  );
}
