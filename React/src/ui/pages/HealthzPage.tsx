import { useSalesStore } from '../../state/SalesStore';
import { resolveBasename } from '../../basePath';

const PAGE_LOADED = new Date(performance.timeOrigin).toISOString();

/** Page-level health view (factory/standards/health-check.md). The host serves its own JSON /healthz. */
export function HealthzPage() {
  const { load, data, persistenceKind } = useSalesStore();
  const status = load.status === 'ready' ? 'ok' : load.status === 'error' ? 'degraded' : 'starting';
  return (
    <main className="healthz surface" aria-labelledby="healthz-title">
      <h1 id="healthz-title">Health</h1>
      <dl>
        <dt>Status</dt><dd data-testid="health-status">{status}</dd>
        <dt>App</dt><dd>{__APP_NAME__}</dd>
        <dt>Version</dt><dd>{__APP_VERSION__}</dd>
        <dt>Built</dt><dd>{__BUILD_TIME__}</dd>
        <dt>Page loaded</dt><dd>{PAGE_LOADED}</dd>
        <dt>Base path</dt><dd>{resolveBasename()}</dd>
        <dt>Data source</dt><dd>json</dd>
        <dt>Fixture version</dt><dd>{data?.manifest.fixtureVersion ?? '—'}</dd>
        <dt>Persistence</dt><dd>{persistenceKind}</dd>
        {load.status === 'error' && (<><dt>Error</dt><dd>{load.message}</dd></>)}
      </dl>
    </main>
  );
}
