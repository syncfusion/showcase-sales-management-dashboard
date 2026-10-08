import { useMemo, useRef, useState } from 'react';
import { ComboBoxComponent, DropDownListComponent } from '@syncfusion/ej2-react-dropdowns';
import { ListViewComponent } from '@syncfusion/ej2-react-lists';
import type { SelectEventArgs } from '@syncfusion/ej2-react-lists';
import { NumericTextBoxComponent, TextBoxComponent } from '@syncfusion/ej2-react-inputs';
import { ButtonComponent } from '@syncfusion/ej2-react-buttons';
import { Search } from 'lucide-react';
import { useSalesData, useSalesStore } from '../../../state/SalesStore';
import { useViewState } from '../../viewState';
import { createOrder } from '../../../domain/commands';
import { fullName, salesReps } from '../../../domain/selectors';
import { round2 } from '../../../domain/types';
import { assetUrl } from '../../../basePath';
import { usd } from '../../format';
import { EmptyState } from '../../components/States';
import type { Notify } from '../../components/useNotifier';

interface CatalogItem { id: string; productId: number; text: string; category: string; description: string; priceText: string; imageUrl: string; checked: boolean }

// Module-level template: reads only fields precomputed on the record.
const catalogTemplate = (item: CatalogItem) => (
  <div className="catalog-item">
    <img src={item.imageUrl} alt="" loading="lazy" />
    <div className="catalog-text">
      <div className="name">{item.text}</div>
      <div className="desc">{item.description}</div>
    </div>
    <div className="price">{item.priceText}</div>
  </div>
);

export function NewOrderTab({ notify }: { notify: Notify }) {
  const data = useSalesData();
  const { run } = useSalesStore();
  const { repId, setRepId } = useViewState();
  const [clientId, setClientId] = useState<number | null>(null);
  const [filter, setFilter] = useState('');
  const [lines, setLines] = useState<Map<number, number>>(new Map());
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const list = useRef<ListViewComponent>(null);
  const [submitted, setSubmitted] = useState(false);

  const reps = useMemo(() => salesReps(data).map((e) => ({ value: e.id, text: fullName(e) })), [data]);
  const clients = useMemo(() => {
    const outlets = new Map(data.outlets.map((o) => [o.id, o.name]));
    return [...data.clients].sort((a, b) => a.lastName.localeCompare(b.lastName)).map((c) => ({ value: c.id, text: `${c.firstName} ${c.lastName} — ${outlets.get(c.outletId)}` }));
  }, [data]);
  const products = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data]);

  // The list's data depends only on the filter; checked flags come from the current selection so filtering keeps them.
  const catalog = useMemo<CatalogItem[]>(() => {
    const cats = new Map(data.productCategories.map((c) => [c.id, c.name]));
    const q = filter.trim().toLowerCase();
    return data.products
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || (cats.get(p.categoryId) ?? '').toLowerCase().includes(q))
      .map((p) => ({ id: String(p.id), productId: p.id, text: p.name, category: cats.get(p.categoryId) ?? '', description: p.description, priceText: usd(p.price), imageUrl: assetUrl(p.imagePath), checked: linesRef.current.has(p.id) }));
  }, [data, filter]);

  const onSelect = (e: SelectEventArgs) => {
    const item = e.data as unknown as CatalogItem | undefined;
    if (!item?.productId) return;
    setLines((prev) => {
      const next = new Map(prev);
      if (e.isChecked) { if (!next.has(item.productId)) next.set(item.productId, 1); } else next.delete(item.productId);
      return next;
    });
  };
  const setQty = (productId: number, qty: number | null) => setLines((prev) => new Map(prev).set(productId, qty ?? 1));

  const summary = [...lines.entries()].map(([productId, qty]) => {
    const p = products.get(productId)!;
    return { productId, name: p.name, unitPrice: p.price, qty, total: round2(p.price * qty) };
  });
  const total = round2(summary.reduce((s, l) => s + l.total, 0));
  const client = clients.find((c) => c.value === clientId);
  const canCreate = clientId != null && summary.length > 0;

  const create = () => {
    setSubmitted(true);
    const result = run((d, now) => createOrder(d, { repId, clientId, lines: summary.map((l) => ({ productId: l.productId, qty: l.qty })) }, now));
    if (!result.ok) {
      notify('Order not created', result.errors.map((x) => x.message).join(' '), 'danger');
      return;
    }
    notify('Order created', `Order #${result.value.id} created for ${client?.text.split(' — ')[0]} — ${usd(result.value.price)}.`, 'success');
    setLines(new Map());
    list.current?.uncheckAllItems();
    setClientId(null);
    setSubmitted(false);
  };

  return (
    <div className="orders-layout">
      <section className="surface catalog-panel" aria-labelledby="catalog-title">
        <div className="panel-header"><h2 id="catalog-title">Product catalog</h2><span className="muted">{data.products.length} products</span></div>
        <div className="catalog-filter">
          <TextBoxComponent placeholder="Filter by name, description or category" value={filter} showClearButton
            input={(e: { value: string }) => setFilter(e.value ?? '')} change={(e: { value: string }) => setFilter(e.value ?? '')}
            htmlAttributes={{ 'aria-label': 'Filter products' }} />
          <Search size={16} aria-hidden="true" className="catalog-filter-icon" />
        </div>
        {catalog.length === 0
          ? <EmptyState message={`No products match "${filter}".`} />
          : <ListViewComponent id="catalog" ref={list} dataSource={catalog as unknown as { [key: string]: object }[]} showCheckBox checkBoxPosition="Left"
              fields={{ id: 'id', text: 'text', groupBy: 'category', isChecked: 'checked' }} template={catalogTemplate as never}
              select={onSelect} height="560px" aria-label="Product catalog" />}
      </section>

      <section className="surface summary-panel" aria-labelledby="summary-title">
        <div className="panel-header"><h2 id="summary-title">New order</h2></div>
        <div className="summary-fields">
          <div className="field">
            <label htmlFor="acting-rep">Acting sales rep</label>
            <DropDownListComponent id="acting-rep" dataSource={reps} fields={{ value: 'value', text: 'text' }} value={repId} change={(e) => e.isInteracted && setRepId(e.value as number)} />
          </div>
          <div className="field">
            <label htmlFor="client">Client</label>
            <ComboBoxComponent id="client" dataSource={clients} fields={{ value: 'value', text: 'text' }} value={clientId ?? undefined}
              placeholder="Choose a client" allowFiltering filterType="Contains" change={(e) => setClientId((e.value as number | null) ?? null)} />
            {submitted && clientId == null && <span className="field-error">Choose a client.</span>}
          </div>
        </div>
        {summary.length === 0
          ? <p className="muted summary-empty">Select products in the catalog to add them to this order.</p>
          : (
            <div className="summary-lines" role="list" aria-label="Order lines">
              <div className="summary-line summary-head" aria-hidden="true"><span>Product</span><span>Quantity</span><span>Total</span></div>
              {summary.map((l) => (
                <div className="summary-line" role="listitem" key={l.productId}>
                  <span><strong>{l.name}</strong><br /><span className="muted">{usd(l.unitPrice)} each</span></span>
                  <NumericTextBoxComponent value={l.qty} min={1} max={99} step={1} format="n0" decimals={0} validateDecimalOnType strictMode
                    htmlAttributes={{ 'aria-label': `Quantity for ${l.name}` }} change={(e) => setQty(l.productId, e.value as number | null)} />
                  <span className="line-total">{usd(l.total)}</span>
                </div>
              ))}
            </div>
          )}
        <div className="summary-total"><span>Order total</span><span aria-live="polite">{usd(total)}</span></div>
        <ButtonComponent isPrimary disabled={!canCreate} onClick={create} cssClass="create-order">Create order</ButtonComponent>
        {!canCreate && <p className="muted hint">{clientId == null ? 'Choose a client' : 'Select at least one product'} to create the order.</p>}
      </section>
    </div>
  );
}
