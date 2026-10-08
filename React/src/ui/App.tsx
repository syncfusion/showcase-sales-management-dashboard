import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Shell } from './shell/Shell';
import { LoadingState } from './components/States';
import { HealthzPage } from './pages/HealthzPage';
// Pages load on demand so the first view does not pay for every Syncfusion control.
const DashboardPage = lazy(() => import('./pages/Dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const OrdersPage = lazy(() => import('./pages/Orders/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage').then((m) => ({ default: m.AppointmentsPage })));
const TeamPage = lazy(() => import('./pages/TeamPage').then((m) => ({ default: m.TeamPage })));
const OrganisationPage = lazy(() => import('./pages/OrganisationPage').then((m) => ({ default: m.OrganisationPage })));

const page = (el: ReactNode) => <Suspense fallback={<LoadingState label="Loading page…" />}>{el}</Suspense>;

export function App() {
  return (
     <Routes>
      <Route path="/healthz" element={<HealthzPage />} />
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={page(<DashboardPage />)} />
        <Route path="/orders" element={page(<OrdersPage />)} />
        <Route path="/appointments" element={page(<AppointmentsPage />)} />
        <Route path="/team" element={page(<TeamPage />)} />
        <Route path="/organisation" element={page(<OrganisationPage />)} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
