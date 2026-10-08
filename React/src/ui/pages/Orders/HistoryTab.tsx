import { useMemo, useState } from 'react';
import { GridComponent, ColumnsDirective, ColumnDirective, Inject, Sort, Page, Toolbar, Search, DetailRow } from '@syncfusion/ej2-react-grids';
import { CheckBoxComponent } from '@syncfusion/ej2-react-buttons';
import { useSalesData } from '../../../state/SalesStore';
import { useViewState } from '../../viewState';
import { orderRows, fullName } from '../../../domain/selectors';
import type { OrderRow } from '../../../domain/selectors';
import { usd } from '../../format';
import { useMediaQuery } from '../../useMediaQuery';

type HistoryRow = OrderRow;

// Module-level templates reading only row fields.
const statusTemplate = (r: HistoryRow) => <span className={`status-badge status-${r.status}`}>{r.status}</span>;
const detailTemplate = (r: HistoryRow) => (
  <div className="detail-wrap">
  <p className="muted">Outlet: {r.outletName}</p>
  <table className="data-table detail-lines">
    <caption className="sr-only">Lines for order {r.id}</caption>
    <thead><tr><th scope="col">Product</th><th scope="col">Quantity</th><th scope="col">Unit price</th><th scope="col">Line total</th></tr></thead>
    <tbody>{r.items.map((it) => <tr key={it.productId}><td>{it.productName}</td><td>{it.qty}</td><td>{usd(it.unitPrice)}</td><td>{usd(it.price)}</td></tr>)}</tbody>
  </table>
  </div>
);

export function HistoryTab() {
  const data = useSalesData();
  const { repId } = useViewState();
  const [mine, setMine] = useState(false);
  const phone = useMediaQuery('(max-width: 599px)');
  const rep = data.employees.find((e) => e.id === repId);
  const rows = useMemo<HistoryRow[]>(() => orderRows(data).filter((r) => !mine || r.employeeId === repId), [data, mine, repId]);

  return (
    <>
      <div className="toolbar-row">
        <CheckBoxComponent label={`Only ${rep ? fullName(rep) : 'the acting rep'}'s orders`} checked={mine} change={(e) => setMine(!!e?.checked)} />
        <p className="muted toolbar-note">{rows.length} orders. Expand a row to see its lines. Cancelled orders stay listed but don't count toward totals.</p>
      </div>
      <GridComponent key={phone ? 'phone' : 'wide'} id="order-history" dataSource={rows} enableAdaptiveUI={phone} rowRenderingMode={phone ? 'Vertical' : 'Horizontal'} allowSorting allowPaging pageSettings={{ pageSize: 10, pageSizes: [10, 25, 50] }}
        toolbar={['Search']} detailTemplate={detailTemplate as never} sortSettings={{ columns: [{ field: 'date', direction: 'Descending' }] }}>
        <ColumnsDirective>
          <ColumnDirective field="id" headerText="Order #" isPrimaryKey width={90} textAlign="Right" />
          <ColumnDirective field="date" headerText="Date" type="date" format={{ type: 'dateTime', format: 'MMM d, yyyy h:mm a' }} width={160} />
          <ColumnDirective field="status" headerText="Status" template={statusTemplate as never} width={120} />
          {/* Total sits next to Status so the order value stays in view at 1366px; line items live in the expanded row. */}
          <ColumnDirective field="price" headerText="Total" format="C2" width={110} textAlign="Right" />
          <ColumnDirective field="clientName" headerText="Client" width={140} clipMode="EllipsisWithTooltip" />
          <ColumnDirective field="location" headerText="Location" width={90} />
          <ColumnDirective field="repName" headerText="Sales rep" width={140} clipMode="EllipsisWithTooltip" />
          <ColumnDirective field="qty" headerText="Units" width={70} textAlign="Right" />
        </ColumnsDirective>
        <Inject services={[Sort, Page, Toolbar, Search, DetailRow]} />
      </GridComponent>
    </>
  );
}
