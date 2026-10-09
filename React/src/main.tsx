import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { registerLicense } from '@syncfusion/ej2-base'; // transitive; never add ej2-base to package.json
import './styles/app.css';
import { resolveBasename } from './basePath';
import { browserClock } from './clock';
import { SampleInsightsProvider } from './ai/SampleInsightsProvider';
import { browserPersistence, sessionPersistence } from './state/persistence';
import { SalesStoreProvider } from './state/SalesStore';
import { ThemeProvider } from './ui/theme';
import { ViewStateProvider } from './ui/viewState';
import { InsightsContext } from './ui/insights';
import { App } from './ui/App';

const licenseKey = import.meta.env.VITE_SYNCFUSION_LICENSE_KEY;
if (licenseKey) registerLicense(licenseKey);

// Composition root: the public build keeps edits per tab; VITE_PERSISTENCE=browser keeps them in localStorage.
const persistence = import.meta.env.VITE_PERSISTENCE === 'browser' ? browserPersistence() : sessionPersistence();
const insights = new SampleInsightsProvider();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <SalesStoreProvider clock={browserClock} persistence={persistence}>
        <ViewStateProvider>
          <InsightsContext.Provider value={insights}>
            <BrowserRouter basename={resolveBasename()}>
              <App />
            </BrowserRouter>
          </InsightsContext.Provider>
        </ViewStateProvider>
      </SalesStoreProvider>
    </ThemeProvider>
  </StrictMode>,
);
