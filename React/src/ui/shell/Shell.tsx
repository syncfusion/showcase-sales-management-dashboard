import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { SidebarComponent } from '@syncfusion/ej2-react-navigations';
import { ButtonComponent } from '@syncfusion/ej2-react-buttons';
import { CalendarDays, LayoutDashboard, Menu, Moon, Network, RotateCcw, ShoppingCart, Sun, Users, X } from 'lucide-react';
import { useSalesStore } from '../../state/SalesStore';
import { useTheme } from '../theme';
import { useMediaQuery } from '../useMediaQuery';
import { useViewState } from '../viewState';
import { fullName } from '../../domain/selectors';
import { LoadingState, ErrorState } from '../components/States';
import { assetUrl } from '../../basePath';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/appointments', label: 'Appointments', icon: CalendarDays },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/organisation', label: 'Organisation', icon: Network },
];
const WIDE = '(min-width: 1024px)';

export function Shell() {
  const wide = useMediaQuery(WIDE);
  const [open, setOpen] = useState(wide);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<SidebarComponent>(null);
  const location = useLocation();
  const { load, data, retry, reset, changeCount, persistenceKind, storageWarning } = useSalesStore();
  const { theme, toggle } = useTheme();
  const { privilege, leadId, repId } = useViewState();
  const [announce, setAnnounce] = useState('');

  useEffect(() => { setOpen(wide); }, [wide]);
  // On narrow screens the drawer closes after navigating.
  useEffect(() => { if (!wide) setOpen(false); }, [location.pathname, wide]);
  useEffect(() => {
    const page = NAV.find((n) => location.pathname.startsWith(n.to))?.label ?? 'Dashboard';
    document.title = `${page} · Outdoor Excellence Sales Management`;
  }, [location.pathname]);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) menuButton.current?.focus();
  }, []);

  useEffect(() => {
    if (!open || wide) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(true); };
    document.addEventListener('keydown', onKey);
    // Opening the drawer moves focus to the current page link.
    requestAnimationFrame(() => document.querySelector<HTMLAnchorElement>('#app-sidebar a[aria-current="page"]')?.focus());
    return () => document.removeEventListener('keydown', onKey);
  }, [open, wide, close]);

  const acting = (() => {
    if (!data) return '';
    const name = (id: number) => { const e = data.employees.find((x) => x.id === id); return e ? fullName(e) : ''; };
    if (privilege === 'SM') return 'Sales Manager view';
    if (privilege === 'TL') return `Team Lead view · ${name(leadId)}`;
    return `Sales Rep view · ${name(repId)}`;
  })();
  const pageTitle = NAV.find((n) => location.pathname.startsWith(n.to))?.label ?? '';
  const notice = persistenceKind === 'browser' ? 'Changes are kept in this browser.' : 'Changes stay in this tab.';

  const onReset = () => { reset(); setAnnounce('Demo data reset to the original sample.'); };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to main content</a>
      <header className="app-topbar">
        <button ref={menuButton} type="button" className="icon-button" aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-controls="app-sidebar" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <Menu size={20} aria-hidden="true" />
        </button>
        <NavLink to="/dashboard" className="app-brand"><img src={assetUrl('images/brand/oexl.png')} alt="" /><span className="app-brand-text">Outdoor Excellence</span></NavLink>
        <span className="app-page-title" aria-hidden="true">{pageTitle}</span>
        <div className="app-topbar-spacer" />
        {acting && <span className="app-acting">{acting}</span>}
        <span className="app-notice">{notice}{changeCount > 0 ? ` ${changeCount} change${changeCount === 1 ? '' : 's'} so far.` : ''}</span>
        <ButtonComponent cssClass="e-outline app-reset" disabled={load.status !== 'ready'} onClick={onReset} title="Restore the original demo data" aria-label="Reset demo data">
          <RotateCcw size={16} aria-hidden="true" /><span className="btn-text">Reset demo data</span>
        </ButtonComponent>
        <button type="button" className="icon-button" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
          {theme === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
        </button>
      </header>
      <div className="app-body">
        <SidebarComponent key={wide ? 'wide' : 'narrow'} id="app-sidebar" ref={sidebar} width="var(--app-sidebar-width)"
          type={wide ? 'Push' : 'Over'} isOpen={open} showBackdrop={!wide} closeOnDocumentClick={!wide} enableGestures={!wide}
          close={() => setOpen(false)} open={() => setOpen(true)}>
          <nav aria-label="Main">
            {!wide && (
              <div className="app-nav-close">
                <button type="button" className="icon-button" aria-label="Close navigation" onClick={() => close(true)}><X size={20} aria-hidden="true" /></button>
              </div>
            )}
            <div className="app-nav">
              {NAV.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to}><Icon size={18} aria-hidden="true" />{label}</NavLink>
              ))}
            </div>
          </nav>
        </SidebarComponent>
        <main id="main" tabIndex={-1} className="app-main e-main-content">
          <div className="app-content">
            {storageWarning && <div className="inline-alert" role="alert">{storageWarning}</div>}
            {load.status === 'loading' && <LoadingState />}
            {load.status === 'error' && <ErrorState message={load.message} onRetry={retry} />}
            {load.status === 'ready' && <Outlet />}
          </div>
        </main>
      </div>
      <div className="sr-only" role="status" aria-live="polite">{announce}</div>
    </div>
  );
}
