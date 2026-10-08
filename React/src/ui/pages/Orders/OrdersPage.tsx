import { useSearchParams } from 'react-router';
import { TabComponent } from '@syncfusion/ej2-react-navigations';
import { PageHeader } from '../../components/PageHeader';
import { useNotifier } from '../../components/useNotifier';
import { NewOrderTab } from './NewOrderTab';
import { PipelineTab } from './PipelineTab';
import { HistoryTab } from './HistoryTab';

const TABS = ['new', 'pipeline', 'history'] as const;
type TabKey = (typeof TABS)[number];

export function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const tab: TabKey = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as TabKey) : 'new';
  const { notify, host } = useNotifier();
  return (
    <>
      <PageHeader title="Orders" description="Capture orders from the product catalog, move them through fulfilment and review order history." />
      <TabComponent id="orders-tabs" selectedItem={TABS.indexOf(tab)} heightAdjustMode="Auto"
        selected={(e) => { if (e.isInteracted) setParams({ tab: TABS[e.selectedIndex] }, { replace: true }); }}>
        <div className="e-tab-header">
          <div>New order</div>
          <div>Pipeline</div>
          <div>History</div>
        </div>
        <div className="e-content">
          <div><div className="tab-panel">{tab === 'new' && <NewOrderTab notify={notify} />}</div></div>
          <div><div className="tab-panel">{tab === 'pipeline' && <PipelineTab notify={notify} />}</div></div>
          <div><div className="tab-panel">{tab === 'history' && <HistoryTab />}</div></div>
        </div>
      </TabComponent>
      {host}
    </>
  );
}
