"use client";

import { useEffect, useState } from "react";
import { ApiClientError } from "./api/client";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  code: string | null;
}

/**
 * Tiny async data hook over the mock API client. Re-runs when `deps` change
 * or when `reload()` is called. Swapping the mock client for a real backend
 * does not change a single call site — the contract shapes are identical.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
    code: null,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    fn()
      .then((d) => alive && setState({ data: d, loading: false, error: null, code: null }))
      .catch((e) => {
        if (!alive) return;
        const code = e instanceof ApiClientError ? e.code : null;
        setState({ data: null, loading: false, error: (e as Error).message ?? String(e), code });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { ...state, reload: () => setTick((t) => t + 1) };
}
