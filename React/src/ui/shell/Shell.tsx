import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { ButtonComponent } from '@syncfusion/ej2-react-buttons';
import { CalendarDays, LayoutDashboard, Moon, Network, RotateCcw, ShoppingCart, Sun, Users } from 'lucide-react';
import { AppShell } from './AppShell';
import type { NavItem } from './AppShell';
import { AssistantHost } from '../assistant/AssistantHost';
import { useSalesStore } from '../../state/SalesStore';
import { useTheme } from '../theme';
import { useViewState } from '../viewState';
import { fullName } from '../../domain/selectors';
import { LoadingState, ErrorState } from '../components/States';
import { assetUrl, resolveBasename } from '../../basePath';

const PAGES = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'appointments', label: 'Appointments', icon: CalendarDays },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'organisation', label: 'Organisation', icon: Network },
];
const base = resolveBasename().replace(/\/$/, '');
const NAV: NavItem[] = PAGES.map((p) => ({ ...p, href: `${base}/${p.id}` }));

export function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { load, data, retry, reset, changeCount, persistenceKind, storageWarning } = useSalesStore();
  const { theme, toggle } = useTheme();
  const { privilege, leadId, repId } = useViewState();
  const [announce, setAnnounce] = useState('');
  const [resetCount, setResetCount] = useState(0);

  const current = PAGES.find((p) => location.pathname.startsWith(`/${p.id}`)) ?? PAGES[0];
  useEffect(() => { document.title = `${current.label} · Outdoor Excellence Sales Management`; }, [current.label]);

  const acting = (() => {
    if (!data) return '';
    const name = (id: number) => { const e = data.employees.find((x) => x.id === id); return e ? fullName(e) : ''; };
    if (privilege === 'SM') return 'Sales Manager view';
    if (privilege === 'TL') return `Team Lead view · ${name(leadId)}`;
    return `Sales Rep view · ${name(repId)}`;
  })();
  const notice = persistenceKind === 'browser' ? 'Changes are kept in this browser.' : 'Changes stay in this tab.';

  const onReset = () => {
    reset();
    setResetCount((n) => n + 1); // also starts a new assistant conversation
    setAnnounce('Demo data reset to the original sample.');
  };

  return (
    <>
      <AppShell appName="Outdoor Excellence" appSubtitle="Sales Management" logo={<img src={assetUrl('images/brand/oexl.png')} alt="" />}
        items={NAV} currentId={current.id} storageKey="sales-management-nav-collapsed"
        onNavigate={(id, event) => { event.preventDefault(); navigate(`/${id}`); }}
        headerStart={<span className="app-page-title" aria-hidden="true">{current.label}</span>}
        headerEnd={<>
          {acting && <span className="app-acting">{acting}</span>}
          <span className="app-notice">{notice}{changeCount > 0 ? ` ${changeCount} change${changeCount === 1 ? '' : 's'} so far.` : ''}</span>
          <ButtonComponent cssClass="e-outline app-reset" disabled={load.status !== 'ready'} onClick={onReset} title="Restore the original demo data" aria-label="Reset demo data">
            <RotateCcw size={16} aria-hidden="true" /><span className="btn-text">Reset demo data</span>
          </ButtonComponent>
          <button type="button" className="app-shell-icon-button" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
            {theme === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
          </button>
        </>}>
        <div className="app-content">
          {storageWarning && <div className="inline-alert" role="alert">{storageWarning}</div>}
          {load.status === 'loading' && <LoadingState />}
          {load.status === 'error' && <ErrorState message={load.message} onRetry={retry} />}
          {load.status === 'ready' && <Outlet />}
        </div>
      </AppShell>
      <AssistantHost resetCount={resetCount} />
      <div className="sr-only" role="status" aria-live="polite">{announce}</div>
    </>
  );
}
