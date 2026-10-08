import { AccumulationChartComponent, AccumulationSeriesCollectionDirective, AccumulationSeriesDirective, AccumulationLegend, AccumulationDataLabel, AccumulationTooltip, PieSeries, Inject as AccInject } from '@syncfusion/ej2-react-charts';
import { ChartComponent, SeriesCollectionDirective, SeriesDirective, Inject, ColumnSeries, StackingColumnSeries, LineSeries, Category, Legend, Tooltip, DataLabel } from '@syncfusion/ej2-react-charts';
import type { ChartTheme, AccumulationTheme } from '@syncfusion/ej2-react-charts';
import { useTheme } from '../../theme';
import { useReducedMotion } from '../../useMediaQuery';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { num, usd0 } from '../../format';

export interface SeriesSpec { field: string; name: string; color: string }
const font = { fontFamily: 'inherit' };
/** Panel body (340px) minus the "View data" row. Charts get a fixed pixel height: with "100%" they
 *  measure before the flex layout settles, fall back to 450px and spill out of the panel. */
export const CHART_HEIGHT = 300;
const chartHeight = `${CHART_HEIGHT}px`;

/** Chart with a "View data" toggle that swaps in an accessible table of the same numbers. */
function ChartFrame({ title, head, rows, children }: { title: string; head: string[]; rows: string[][]; children: ReactNode }) {
  const [showData, setShowData] = useState(false);
  return (
    <div className="chart-frame">
      <button type="button" className="e-btn e-flat e-small chart-toggle" aria-pressed={showData} onClick={() => setShowData((v) => !v)}>
        {showData ? 'View chart' : 'View data'}
      </button>
      {showData ? (
        <div className="chart-table" role="region" aria-label={`${title} data`} tabIndex={0}>
          <table className="data-table">
            <caption className="sr-only">{title}</caption>
            <thead><tr>{head.map((h, i) => <th key={h} scope="col" className={i ? 'num' : undefined}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r) => <tr key={r[0]}>{r.map((c, i) => (i ? <td key={i} className="num">{c}</td> : <th key={i} scope="row">{c}</th>))}</tr>)}</tbody>
          </table>
        </div>
      ) : <div className="chart-body">{children}</div>}
    </div>
  );
}

function useChartBase() {
  const { theme } = useTheme();
  const reduced = useReducedMotion();
  return { theme, chartTheme: (theme === 'dark' ? 'Tailwind3Dark' : 'Tailwind3') as ChartTheme, animation: { enable: !reduced } };
}

/** Column / stacked column / line chart over category rows (month or location on the x axis). */
export function CategoryChart({ id, title, data, xField, series, type, yFormat, yTitle }: {
  id: string; title: string; data: object[]; xField: string; series: SeriesSpec[];
  type: 'Column' | 'StackingColumn' | 'Line'; yFormat?: string; yTitle: string;
}) {
  const { theme, chartTheme, animation } = useChartBase();
  const currency = yFormat?.startsWith('$');
  const fmt = currency ? usd0 : num;
  const labelFormat = currency ? 'c0' : 'n0';
  const rows = (data as Array<Record<string, string | number>>).map((r) => [String(r[xField]), ...series.map((s) => fmt(Number(r[s.field] ?? 0)))]);
  return (
    <ChartFrame title={title} head={[xField === 'month' ? 'Month' : xField === 'location' ? 'Location' : 'Name', ...series.map((s) => s.name)]} rows={rows}>
    {/* Keyed on theme: changing the theme prop alone leaves labels and legend text in the old colours. */}
    <ChartComponent key={theme} id={id} height={chartHeight} width="100%" theme={chartTheme} background="transparent" title="" description={title} useGroupingSeparator
      primaryXAxis={{ valueType: 'Category', majorGridLines: { width: 0 }, labelIntersectAction: 'Rotate45', labelStyle: font }}
      primaryYAxis={{ title: yTitle, labelFormat, lineStyle: { width: 0 }, majorTickLines: { width: 0 }, labelStyle: font, titleStyle: font }}
      chartArea={{ border: { width: 0 } }} tooltip={{ enable: true, shared: type !== 'Column' || series.length > 1 }}
      legendSettings={{ visible: series.length > 1, position: 'Bottom', textStyle: font }}>
      <Inject services={[ColumnSeries, StackingColumnSeries, LineSeries, Category, Legend, Tooltip, DataLabel]} />
      <SeriesCollectionDirective>
        {series.map((s) => (
          <SeriesDirective key={s.field} dataSource={data} xName={xField} yName={s.field} name={s.name} type={type} fill={s.color}
            width={type === 'Line' ? 2 : undefined} marker={type === 'Line' ? { visible: true, width: 6, height: 6 } : { dataLabel: { visible: series.length === 1 && data.length <= 6, position: 'Top', font, format: labelFormat } }}
            columnWidth={0.6} cornerRadius={type === 'Column' ? { topLeft: 4, topRight: 4 } : undefined} animation={animation} />
        ))}
      </SeriesCollectionDirective>
    </ChartComponent>
    </ChartFrame>
  );
}

export function DoughnutChart({ id, title, data, colors }: { id: string; title: string; data: Array<{ label: string; value: number }>; colors: string[] }) {
  const { theme, chartTheme, animation } = useChartBase();
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const rows = data.map((d) => ({ ...d, text: `${Math.round((d.value / total) * 100)}%` }));
  return (
    <ChartFrame title={title} head={['Name', 'Units', 'Share']} rows={rows.map((r) => [r.label, num(r.value), r.text])}>
    <figure className="chart-figure" aria-label={title}>
    <AccumulationChartComponent key={theme} id={id} height={chartHeight} width="100%" theme={chartTheme as unknown as AccumulationTheme} background="transparent"
      legendSettings={{ visible: true, position: 'Right', textStyle: font }} tooltip={{ enable: true, format: '${point.x}: <b>${point.y} units</b>' }} enableSmartLabels>
      <AccInject services={[PieSeries, AccumulationLegend, AccumulationDataLabel, AccumulationTooltip]} />
      <AccumulationSeriesCollectionDirective>
        <AccumulationSeriesDirective dataSource={rows} xName="label" yName="value" innerRadius="55%" palettes={colors} animation={animation}
          dataLabel={{ visible: true, name: 'text', position: 'Outside', connectorStyle: { length: '12px' }, font }} />
      </AccumulationSeriesCollectionDirective>
    </AccumulationChartComponent>
    </figure>
    </ChartFrame>
  );
}
