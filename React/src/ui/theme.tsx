import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AppTheme } from './palette';
import type { ReactNode } from 'react';

export type Theme = AppTheme;
const KEY = 'oexl-theme';

function apply(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  // Syncfusion Tailwind 3 dark variant is driven by the e-dark-mode class; placed on <html> so the
  // app's :root[data-theme] tokens keep higher specificity than the component theme's variables.
  root.classList.toggle('e-dark-mode', theme === 'dark');
}

/** The Syncfusion theme bundle is one stylesheet linked from index.html; the shell has no layout until it has loaded. */
function themeLink(): HTMLLinkElement | null {
  return document.querySelector<HTMLLinkElement>('link[rel="stylesheet"][href*="tailwind3.css"]');
}
function useThemeReady(): boolean {
  const [ready, setReady] = useState(() => { const link = themeLink(); return !link || !!link.sheet; });
  useEffect(() => {
    if (ready) return;
    const link = themeLink();
    if (!link || link.sheet) { setReady(true); return; }
    const done = () => setReady(true);
    link.addEventListener('load', done);
    link.addEventListener('error', done);
    return () => { link.removeEventListener('load', done); link.removeEventListener('error', done); };
  }, [ready]);
  return ready;
}

const Ctx = createContext<{ theme: Theme; toggle(): void; ready: boolean }>({ theme: 'light', toggle: () => {}, ready: true });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));
  useEffect(() => { apply(theme); try { localStorage.setItem(KEY, theme); } catch { /* storage unavailable */ } }, [theme]);
  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  const ready = useThemeReady();
  return <Ctx.Provider value={{ theme, toggle, ready }}>{children}</Ctx.Provider>;
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
