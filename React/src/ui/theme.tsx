import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'oexl-theme';

function apply(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  // Syncfusion Tailwind 3 dark variant is driven by the e-dark-mode class; placed on <html> so the
  // app's :root[data-theme] tokens keep higher specificity than the component theme's variables.
  root.classList.toggle('e-dark-mode', theme === 'dark');
}

const Ctx = createContext<{ theme: Theme; toggle(): void }>({ theme: 'light', toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));
  useEffect(() => { apply(theme); try { localStorage.setItem(KEY, theme); } catch { /* storage unavailable */ } }, [theme]);
  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}
export const useTheme = () => useContext(Ctx);

/** Reads resolved token colors so charts follow the active theme. */
export function readTokens(names: string[]): string[] {
  const cs = getComputedStyle(document.documentElement);
  return names.map((n) => cs.getPropertyValue(n).trim());
}
export function useTokenColors(names: string[]): string[] {
  const { theme } = useTheme();
  const [colors, setColors] = useState<string[]>(() => readTokens(names));
  const key = names.join('|');
  useEffect(() => { setColors(readTokens(key.split('|'))); }, [theme, key]);
  return colors;
}
