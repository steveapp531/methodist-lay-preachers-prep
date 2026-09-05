import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export { useAsync, useAction } from './useAsync';
export { useSpeechRecognition, speechRecognitionSupported } from './useSpeechRecognition';

/**
 * A countdown driven by an absolute deadline rather than by accumulating
 * ticks, so a backgrounded tab, a sleeping laptop or a slow frame cannot buy
 * the candidate extra time.
 */
export function useCountdown(expiresAt, { onExpire } = {}) {
  const deadline = useMemo(() => (expiresAt ? new Date(expiresAt).getTime() : null), [expiresAt]);
  const [remaining, setRemaining] = useState(() => (deadline ? Math.max(0, Math.round((deadline - Date.now()) / 1000)) : 0));
  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!deadline) return undefined;
    firedRef.current = false;

    const tick = () => {
      const seconds = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0 && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current?.();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    // Re-sync the moment the tab becomes visible again.
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [deadline]);

  return {
    remaining,
    formatted: formatDuration(remaining),
    isCritical: remaining > 0 && remaining <= 300,
    isFinal: remaining > 0 && remaining <= 60,
    expired: deadline != null && remaining === 0,
  };
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Measures how long a screen has been open, for banking study time. */
export function useElapsedSeconds(active = true) {
  const startRef = useRef(Date.now());
  const accumulatedRef = useRef(0);

  useEffect(() => {
    if (active) {
      startRef.current = Date.now();
      return () => {
        accumulatedRef.current += Math.round((Date.now() - startRef.current) / 1000);
      };
    }
    return undefined;
  }, [active]);

  // Time spent with the tab hidden is not study time.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        accumulatedRef.current += Math.round((Date.now() - startRef.current) / 1000);
      } else {
        startRef.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return useCallback(() => accumulatedRef.current + Math.round((Date.now() - startRef.current) / 1000), []);
}

export function useLocalStorage(key, initialValue) {
  const [stored, setStored] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const set = useCallback(
    (value) => {
      setStored((current) => {
        const next = typeof value === 'function' ? value(current) : value;
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* Private browsing, or storage disabled. The value still works in memory. */
        }
        return next;
      });
    },
    [key],
  );

  return [stored, set];
}

/** Warns before leaving a page with work in progress. */
export function useUnsavedChangesWarning(active) {
  useEffect(() => {
    if (!active) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active]);
}

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const list = window.matchMedia(query);
    const handler = (event) => setMatches(event.matches);
    list.addEventListener('change', handler);
    setMatches(list.matches);
    return () => list.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

/** Sets the document title, restoring the previous one on unmount. */
export function useDocumentTitle(title) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · Lay Preachers' Prep` : "Lay Preachers' Examination Preparation";
    return () => {
      document.title = previous;
    };
  }, [title]);
}
