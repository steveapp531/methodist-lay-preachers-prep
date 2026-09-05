import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);
let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (toast) => {
      const id = nextId++;
      const entry = { id, tone: 'info', duration: 5000, ...toast };
      setToasts((current) => [...current.slice(-3), entry]);
      if (entry.duration > 0) {
        timers.current.set(id, setTimeout(() => dismiss(id), entry.duration));
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const value = useMemo(
    () => ({
      toasts,
      dismiss,
      toast: push,
      success: (message, options) => push({ tone: 'success', message, ...options }),
      error: (message, options) => push({ tone: 'danger', message, duration: 8000, ...options }),
      info: (message, options) => push({ tone: 'info', message, ...options }),
      warning: (message, options) => push({ tone: 'warning', message, ...options }),
    }),
    [toasts, push, dismiss],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside a ToastProvider');
  return context;
}
