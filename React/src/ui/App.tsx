import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { Shell } from './shell/Shell';
import { AppLoading } from './components/AppLoading';
import { useTheme } from './theme';
import { HealthzPage } from './pages/HealthzPage';
// Pages load on demand so the first view does not pay for every Syncfusion control.
const DashboardPage = lazy(() => import('./pages/Dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const OrdersPage = lazy(() => import('./pages/Orders/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage').then((m) => ({ default: m.AppointmentsPage })));
const TeamPage = lazy(() => import('./pages/TeamPage').then((m) => ({ default: m.TeamPage })));
const OrganisationPage = lazy(() => import('./pages/OrganisationPage').then((m) => ({ default: m.OrganisationPage })));

const page = (name: string, el: ReactNode) => <Suspense fallback={<AppLoading label={`Loading ${name}…`} />}>{el}</Suspense>;

export function App() {
  const { ready } = useTheme();
  const { pathname } = useLocation();
  return (
    <>
    {/* Startup screen until the Syncfusion theme has loaded; the shell mounts underneath so page code downloads meanwhile. */}
    {!ready && pathname !== '/healthz' && <AppLoading variant="screen" label="Loading Outdoor Excellence Sales Management…" />}
     <Routes>
      <Route path="/healthz" element={<HealthzPage />} />
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={page('Dashboard', <DashboardPage />)} />
        <Route path="/orders" element={page('Orders', <OrdersPage />)} />
        <Route path="/appointments" element={page('Appointments', <AppointmentsPage />)} />
        <Route path="/team" element={page('Team', <TeamPage />)} />
        <Route path="/organisation" element={page('Organisation', <OrganisationPage />)} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
    </>
  );
}
