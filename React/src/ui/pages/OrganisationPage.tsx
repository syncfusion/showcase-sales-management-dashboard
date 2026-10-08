import { useMemo, useRef } from 'react';
import { DiagramComponent, Inject, HierarchicalTree, DiagramTools } from '@syncfusion/ej2-react-diagrams';
import type { NodeModel, ConnectorModel } from '@syncfusion/ej2-react-diagrams';
import { ButtonComponent } from '@syncfusion/ej2-react-buttons';
import { Maximize2 } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useSalesData } from '../../state/SalesStore';
import { hierarchy } from '../../domain/selectors';
import type { OrgNode } from '../../domain/selectors';
import { assetUrl } from '../../basePath';
import { useTheme, useTokenColors } from '../theme';

type OrgRecord = OrgNode & { photoUrl: string; teamText: string };

// Module-level node template reading only the bound record.
const nodeTemplate = (node: NodeModel) => {
  const d = node.addInfo as OrgRecord;
  return (
    <div className="org-node">
      <img src={d.photoUrl} alt="" />
      <div><div className="n">{d.name}</div><div className="t">{d.title}</div>{d.teamText && <div className="t">{d.teamText}</div>}</div>
    </div>
  );
};
const NODE_HEIGHT = 76;
const V_SPACING = 20;
const nodeDefaults = (node: NodeModel): NodeModel => {
  node.width = 220; node.height = NODE_HEIGHT;
  node.shape = { type: 'HTML' };
  node.style = { strokeWidth: 0, fill: 'transparent' };
  return node;
};
// SVG attributes cannot resolve CSS variables, so the connector colour is read from the active theme's token.
const connectorDefaults = (stroke: string) => (c: ConnectorModel): ConnectorModel => {
  c.type = 'Orthogonal';
  c.cornerRadius = 6;
  c.style = { strokeColor: stroke, strokeWidth: 1.5, strokeDashArray: '5 4' };
  c.targetDecorator = { shape: 'None' };
  return c;
};

export function OrganisationPage() {
  const data = useSalesData();
  const diagram = useRef<DiagramComponent>(null);
  const { theme } = useTheme();
  const [stroke] = useTokenColors(['--color-sf-fg-secondary']);
  const records = useMemo<OrgRecord[]>(() => hierarchy(data).map((n) => ({
    ...n, photoUrl: assetUrl(n.imagePath), teamText: n.teamSize ? `${n.teamSize} direct report${n.teamSize === 1 ? '' : 's'}` : '',
  })), [data]);
  // Explicit nodes and connectors (no DataManager): the layout arranges them from the reports-to links.
  const nodes = useMemo<NodeModel[]>(() => records.map((r) => ({ id: `n${r.id}`, addInfo: r })), [records]);
  const connectors = useMemo<ConnectorModel[]>(() => records.filter((r) => r.parentId).map((r) => ({ id: `c${r.id}`, sourceID: `n${r.parentId}`, targetID: `n${r.id}` })), [records]);
  // Team edits (names, titles, reporting lines) re-create the diagram so the layout re-runs on the new hierarchy.
  const shape = useMemo(() => records.map((r) => `${r.id}:${r.parentId ?? ''}:${r.name}:${r.title}:${r.imagePath}`).join('|'), [records]);

  // Size the canvas to the tallest column (the reps) so the chart fits the width at full size and the page scrolls,
  // instead of shrinking every name to ~7px to fit a fixed 640px box.
  const leaves = records.filter((r) => !r.teamSize).length;
  const height = Math.max(480, leaves * (NODE_HEIGHT + V_SPACING) + 64);
  const fit = () => diagram.current?.fitToPage({ mode: 'Width', region: 'Content', margin: { left: 24, right: 24, top: 24, bottom: 24 }, canZoomIn: false });

  return (
    <>
      <PageHeader title="Organisation" description="Reporting structure from the sales manager through team leads to sales reps. Drag to pan; hold Ctrl and scroll to zoom."
        actions={<ButtonComponent cssClass="e-outline" onClick={fit}><Maximize2 size={16} aria-hidden="true" /><span className="btn-text">Fit to page</span></ButtonComponent>} />
      <div className="surface diagram-host" role="img" aria-label={`Organisation chart with ${records.length} people`}>
        <DiagramComponent key={`${theme}-${stroke}-${shape}`} id="org-chart" ref={diagram} width="100%" height={`${height}px`} backgroundColor="transparent" snapSettings={{ constraints: 0 }}
          tool={DiagramTools.ZoomPan} scrollSettings={{ scrollLimit: 'Diagram' }}
          layout={{ type: 'HierarchicalTree', orientation: 'LeftToRight', horizontalSpacing: 64, verticalSpacing: V_SPACING, margin: { left: 24, top: 24 } }}
          nodes={nodes} connectors={connectors}
          getNodeDefaults={nodeDefaults} getConnectorDefaults={connectorDefaults(stroke)} nodeTemplate={nodeTemplate as never}
          created={() => setTimeout(fit, 0)}>
          <Inject services={[HierarchicalTree]} />
        </DiagramComponent>
      </div>
    </>
  );
}
