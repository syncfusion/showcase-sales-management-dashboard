import { createContext, useContext } from 'react';
import type { InsightsProvider } from '../ai/InsightsProvider';
import { SampleInsightsProvider } from '../ai/SampleInsightsProvider';

export const InsightsContext = createContext<InsightsProvider>(new SampleInsightsProvider());
export const useInsights = () => useContext(InsightsContext);
