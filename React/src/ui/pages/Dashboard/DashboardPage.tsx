import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DropDownListComponent } from '@syncfusion/ej2-react-dropdowns';
import { DashboardLayoutComponent } from '@syncfusion/ej2-react-layouts';
import { ButtonComponent } from '@syncfusion/ej2-react-buttons';
import { CircleDollarSign, Package, Receipt, TrendingUp } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/States';
import { useSalesData, useSalesStore } from '../../../state/SalesStore';
import { useViewState } from '../../viewState';
import type { Privilege } from '../../viewState';
import { useTheme } from '../../theme';
import { palette } from '../../palette';
import { usd, num } from '../../format';
import { monthLabel } from '../../../domain/dates';
import { LOCATIONS } from '../../../domain/types';
import { fullName, grossByMember, grossByMonth, kpis, salesReps, teamLeads, unitsByCategory, unitsByLocation, unitsByLocationCategory, unitsByMonth, unitsByMonthLocation } from '../../../domain/selectors';
import { CategoryChart, DoughnutChart } from './charts';
import { useCellRatio } from './useCellRatio';

const PRIVILEGES: Array<{ value: Privilege; text: string }> = [
  { value: 'SM', text: 'Sales Manager' }, { value: 'TL', text: 'Team Lead' }, { value: 'SR', text: 'Sales Rep' },
];
const PANEL_HEIGHT = 400;
const SPACING = 16;
/** Panel header plus bottom padding; the chart area gets the rest of the measured panel height. */
const PANEL_CHROME = 60;

export function DashboardPage() {
  const data = useSalesData();
  const { clock } = useSalesStore();
  const now = clock.now();
  const { privilege, setPrivilege, leadId, setLeadId, repId, setRepId, scope } = useViewState();
  const leads = useMemo(() => teamLeads(data).map((e) => ({ value: e.id, text: fullName(e) })), [data]);
  const reps = useMemo(() => salesReps(data).map((e) => ({ value: e.id, text: fullName(e) })), [data]);
  const person = (id: number) => { const e = data.employees.find((x) => x.id === id); return e ? fullName(e) : 'Unknown'; };
  const scopeLabel = privilege === 'SM' ? 'the company' : privilege === 'TL' ? `${person(leadId)}'s team` : person(repId);

  const k = kpis(data, scope, now);
  // Categories and locations are told apart with the chart series, each colour tied to its category or
  // location (never a status tone); values come from the palette module because charts draw SVG.
  const { theme } = useTheme();
  const series = palette(theme).series;
  const catColors = data.productCategories.map((_, i) => series[i % series.length]);
  const catColorByName = Object.fromEntries(data.productCategories.map((c, i) => [c.name, catColors[i]]));
  const locColors = LOCATIONS.map((_, i) => series[i]);
  const locColorByName = Object.fromEntries(LOCATIONS.map((l, i) => [l, locColors[i]]));
  const brand = series[0];

  const layoutHost = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<DashboardLayoutComponent>(null);
  // Charts measure their container when created, so panel bodies render once the layout has placed the panels.
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const { ratio } = useCellRatio(layoutHost, PANEL_HEIGHT, SPACING, () => layoutRef.current?.refresh());
  const empty = k.orders === 0;
  const emptyMsg = `No orders in the last 12 months for ${scopeLabel}.`;
  const months = (rows: Array<{ key: string; value: number }>) => rows.map((r) => ({ month: monthLabel(r.key), value: r.value }));

  let panels: Array<{ id: string; title: string; body: ReactNode }>;
  if (privilege === 'SM') {
    const cats = data.productCategories.map((c, i) => ({ field: `c${c.id}`, name: c.name, color: catColors[i] }));
    panels = [
      { id: 'loc-cat', title: 'Units by location and category', body: <CategoryChart id="chart-loc-cat" title="Units by location and category" data={unitsByLocationCategory(data, scope, now)} xField="location" series={cats} type="StackingColumn" yTitle="Units" /> },
      { id: 'loc-share', title: 'Units share by location', body: <DoughnutChart id="chart-loc-share" title="Units share by location" data={unitsByLocation(data, scope, now)} colorOf={locColorByName} /> },
      { id: 'month-loc', title: 'Units per month by location', body: <CategoryChart id="chart-month-loc" title="Units per month by location" data={unitsByMonthLocation(data, scope, now).map((r) => ({ ...r, month: monthLabel(r.month) }))} xField="month" series={LOCATIONS.map((l, i) => ({ field: l, name: l, color: locColors[i] }))} type="Line" yTitle="Units" /> },
    ];
  } else if (privilege === 'TL') {
    panels = [
      { id: 'member-gross', title: 'Gross sales per team member', body: <CategoryChart id="chart-member-gross" title="Gross sales per team member" data={grossByMember(data, leadId, now).map((r) => ({ member: r.label, value: r.value }))} xField="member" series={[{ field: 'value', name: 'Gross sales', color: brand }]} type="Column" yFormat="${value}" yTitle="Gross sales (USD)" /> },
      { id: 'team-cat', title: 'Team units by category', body: <DoughnutChart id="chart-team-cat" title="Team units by category" data={unitsByCategory(data, scope, now)} colorOf={catColorByName} /> },
      { id: 'team-units', title: 'Team units per month', body: <CategoryChart id="chart-team-units" title="Team units per month" data={months(unitsByMonth(data, scope, now))} xField="month" series={[{ field: 'value', name: 'Units', color: brand }]} type="Column" yTitle="Units" /> },
    ];
  } else {
    panels = [
      { id: 'rep-gross', title: 'Gross sales per month', body: <CategoryChart id="chart-rep-gross" title="Gross sales per month" data={months(grossByMonth(data, scope, now))} xField="month" series={[{ field: 'value', name: 'Gross sales', color: brand }]} type="Column" yFormat="${value}" yTitle="Gross sales (USD)" /> },
      { id: 'rep-cat', title: 'Units by category', body: <DoughnutChart id="chart-rep-cat" title="Units by category" data={unitsByCategory(data, scope, now)} colorOf={catColorByName} /> },
      { id: 'rep-units', title: 'Units per month', body: <CategoryChart id="chart-rep-units" title="Units per month" data={months(unitsByMonth(data, scope, now))} xField="month" series={[{ field: 'value', name: 'Units', color: brand }]} type="Line" yTitle="Units" /> },
    ];
  }
  // Three panels: two share the first row and the monthly trend spans both columns of the second.
  const place = (i: number) => (i < 2 ? { row: 0, col: i, sizeX: 1 } : { row: 1, col: 0, sizeX: 2 });

  const resetLayout = () => {
    const layout = layoutRef.current;
    if (!layout) return;
    panels.forEach((p, i) => layout.movePanel(`panel-${p.id}`, place(i).row, place(i).col));
  };

  return (
    <>
      <PageHeader title="Dashboard" description={`Sales performance for ${scopeLabel} over the last 12 months.`}
        actions={<>
          <div className="field">
            <label htmlFor="privilege">View as</label>
            <DropDownListComponent id="privilege" dataSource={PRIVILEGES} fields={{ value: 'value', text: 'text' }} value={privilege}
              change={(e) => e.isInteracted && setPrivilege(e.value as Privilege)} />
          </div>
          {privilege === 'TL' && (
            <div className="field">
              <label htmlFor="lead-picker">Team lead</label>
              <DropDownListComponent id="lead-picker" dataSource={leads} fields={{ value: 'value', text: 'text' }} value={leadId} change={(e) => e.isInteracted && setLeadId(e.value as number)} />
            </div>
          )}
          {privilege === 'SR' && (
            <div className="field">
              <label htmlFor="rep-picker">Sales rep</label>
              <DropDownListComponent id="rep-picker" dataSource={reps} fields={{ value: 'value', text: 'text' }} value={repId} change={(e) => e.isInteracted && setRepId(e.value as number)} />
            </div>
          )}
        </>} />

      <section className="kpi-grid" aria-label="Key figures" aria-live="polite">
        <Kpi label="Gross sales" value={usd(k.gross)} icon={<CircleDollarSign size={20} />} note="Last 12 months" />
        <Kpi label="Units sold" value={num(k.units)} icon={<Package size={20} />} note="Excludes cancelled orders" />
        <Kpi label="Orders" value={num(k.orders)} icon={<Receipt size={20} />} note="Last 12 months" />
        <Kpi label="Average order value" value={usd(k.avgOrderValue)} icon={<TrendingUp size={20} />} note="Gross sales ÷ orders" />
      </section>

      <div className="dashboard-toolbar">
        <h2 className="sr-only">Charts</h2>
        <ButtonComponent cssClass="e-flat" onClick={resetLayout}>Reset layout</ButtonComponent>
      </div>
      <div ref={layoutHost}>
        <DashboardLayoutComponent key={privilege} id="dashboard-layout" ref={layoutRef} columns={2} cellSpacing={[SPACING, SPACING]}
          cellAspectRatio={ratio} mediaQuery="max-width: 600px" allowResizing={false} draggableHandle=".panel-header" created={() => setReadyFor(privilege)}>
          {panels.map((p, i) => (
            <div key={p.id} id={`panel-${p.id}`} className="e-panel" data-row={place(i).row} data-col={place(i).col} data-sizex={place(i).sizeX} data-sizey={1}>
              <div className="e-panel-container">
                <div className="panel-header"><h3>{p.title}</h3></div>
                <div className="panel-body" style={{ height: PANEL_HEIGHT - PANEL_CHROME }}>{readyFor !== privilege ? null : empty ? <EmptyState message={emptyMsg} /> : p.body}</div>
              </div>
            </div>
          ))}
        </DashboardLayoutComponent>
      </div>
    </>
  );
}

/** Display-only KPI card. These figures count; none is judged against a target, so the icon is always the info tone. */
function Kpi({ label, value, note, icon }: { label: string; value: string; note: string; icon: ReactNode }) {
  return (
    <div className="e-card kpi-card">
      <div className="kpi-body">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-note">{note}</div>
      </div>
      <span className="kpi-icon" aria-hidden="true">{icon}</span>
    </div>
  );
}
