import { useCallback, useRef, useState } from 'react';
import { ToastComponent } from '@syncfusion/ej2-react-notifications';
import { useReducedMotion } from '../useMediaQuery';

export type Notify = (title: string, content: string, kind: 'success' | 'danger' | 'info') => void;

/** One toast host per page; every message is mirrored to a polite live region for screen readers. */
export function useNotifier() {
  const toast = useRef<ToastComponent>(null);
  const [live, setLive] = useState('');
  const reduced = useReducedMotion();
  const notify = useCallback<Notify>((title, content, kind) => {
    toast.current?.show({ title, content, cssClass: `e-toast-${kind}`, timeOut: kind === 'danger' ? 6000 : 4000 });
    setLive(`${title}. ${content}`);
  }, []);
  // The Toast relocates its own element, so it sits in a wrapper React owns; otherwise leaving the page
  // fails with "removeChild: the node to be removed is not a child of this node" and blanks the app.
  const host = (
    <>
      <div className="toast-host">
        <ToastComponent ref={toast} position={{ X: 'Right', Y: 'Top' }} showCloseButton newestOnTop
          animation={reduced ? { show: { effect: 'FadeIn', duration: 0 }, hide: { effect: 'FadeOut', duration: 0 } } : undefined} />
      </div>
      <div className="sr-only" role="status" aria-live="polite">{live}</div>
    </>
  );
  return { notify, host };
}
