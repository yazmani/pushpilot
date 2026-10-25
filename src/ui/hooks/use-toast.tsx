import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from 'react';

export interface ToastState {
  id: number;
  text: string;
  tone: 'ok' | 'error';
}

type Notify = (text: string, tone?: ToastState['tone']) => void;

const ToastContext = createContext<Notify>(() => {});

/** App-wide transient status line ("Copied", "Sent to Pixel", errors). */
export function ToastProvider({ children, render }: { children: ReactNode; render: (t: ToastState | null) => ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const notify = useCallback<Notify>((text, tone = 'ok') => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), text, tone });
    timer.current = setTimeout(() => setToast(null), tone === 'error' ? 5000 : 1800);
  }, []);
  return (
    <ToastContext.Provider value={notify}>
      {children}
      {render(toast)}
    </ToastContext.Provider>
  );
}

export function useToast(): Notify {
  return useContext(ToastContext);
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Wraps an async action so failures surface as an error toast. */
export function useRun() {
  const notify = useToast();
  return useCallback(
    async (fn: () => Promise<unknown>, done?: string) => {
      try {
        await fn();
        if (done) notify(done);
        return true;
      } catch (err) {
        notify(errorText(err), 'error');
        return false;
      }
    },
    [notify],
  );
}
