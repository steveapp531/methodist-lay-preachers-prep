import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs an async loader and exposes { data, error, loading, reload }.
 *
 * Aborts the in-flight request when dependencies change or the component
 * unmounts, so a slow response can never overwrite newer data.
 */
export function useAsync(loader, deps = [], { immediate = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: immediate });
  const controllerRef = useRef(null);
  const mountedRef = useRef(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const run = useCallback(async (...args) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loaderRef.current({ signal: controller.signal }, ...args);
      if (!mountedRef.current || controller.signal.aborted) return null;
      setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      if (error?.name === 'AbortError' || !mountedRef.current) return null;
      setState({ data: null, error, loading: false });
      return null;
    }
  }, []);

  useEffect(() => {
    if (immediate) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, reload: run, setData };
}

/** For actions rather than loads: tracks pending/error around a submit. */
export function useAction(action) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const actionRef = useRef(action);
  actionRef.current = action;

  const run = useCallback(async (...args) => {
    setPending(true);
    setError(null);
    try {
      return await actionRef.current(...args);
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setPending(false);
    }
  }, []);

  return { run, pending, error, clearError: () => setError(null) };
}
