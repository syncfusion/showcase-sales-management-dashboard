import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/**
 * Dashboard Layout sizes a cell as width / cellAspectRatio. Measure the container and derive the ratio so
 * panels keep `panelHeight` instead of growing with the screen (factory component-patterns standard).
 */
export function useCellRatio(ref: RefObject<HTMLElement | null>, panelHeight: number, spacing: number, onResize?: () => void): { ratio: number; columns: number } {
  const resized = useRef(onResize);
  resized.current = onResize;
  const [state, setState] = useState({ ratio: 1.6, columns: 2 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = el.clientWidth;
        if (!width) return;
        const columns = window.matchMedia('(max-width: 600px)').matches ? 1 : 2;
        const cell = (width - spacing * (columns - 1)) / columns;
        const ratio = Math.round((cell / panelHeight) * 1000) / 1000;
        setState((s) => (s.ratio === ratio && s.columns === columns ? s : { ratio, columns }));
        resized.current?.();
      });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => { ro.disconnect(); cancelAnimationFrame(frame); };
  }, [ref, panelHeight, spacing]);
  return state;
}
