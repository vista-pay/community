'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';

export interface QueryState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  /** True while refetching with data already on screen. */
  refreshing: boolean;
  refresh: () => Promise<void>;
  setData: (updater: T | ((previous: T | undefined) => T)) => void;
}

/**
 * Minimal data hook: fetch on mount, refetch on demand, and never let a
 * slow earlier request overwrite a newer result.
 *
 * `initial` lets a server component hand down what it already fetched, so the
 * first paint has real data instead of a skeleton.
 *
 * The effect never calls setState synchronously — it starts the request and
 * only touches state once the promise settles. Setting state inside an effect
 * body costs a second render pass before the browser has painted the first.
 */
export function useQuery<T>(
  loader: () => Promise<T>,
  deps: ReadonlyArray<unknown> = [],
  options: { initial?: T; enabled?: boolean } = {},
): QueryState<T> {
  const { initial, enabled = true } = options;

  const [data, setDataState] = useState<T | undefined>(initial);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState(initial !== undefined);
  const [refreshing, setRefreshing] = useState(false);

  // The loader closes over props that change every render; holding it in a
  // ref keeps the effect keyed on `deps` alone rather than re-running on
  // every parent render.
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  const requestId = useRef(0);

  const start = useCallback(() => {
    const id = ++requestId.current;
    return loaderRef.current().then(
      (result) => {
        if (id !== requestId.current) return;
        setDataState(result);
        setError(null);
        setSettled(true);
        setRefreshing(false);
      },
      (err: unknown) => {
        if (id !== requestId.current) return;
        setError(
          err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong',
        );
        setSettled(true);
        setRefreshing(false);
      },
    );
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void start();
    // The caller decides what identity means here; `start` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, start]);

  const refresh = useCallback(async () => {
    // Called from event handlers, where setting state up front is correct:
    // the officer pressed refresh and should see that something is happening.
    setRefreshing(true);
    await start();
  }, [start]);

  const setData = useCallback((updater: T | ((previous: T | undefined) => T)) => {
    setDataState((previous) =>
      typeof updater === 'function' ? (updater as (p: T | undefined) => T)(previous) : previous,
    );
  }, []);

  return {
    data,
    error,
    // Derived rather than stored: the first load is simply "enabled, nothing
    // back yet". One less piece of state to get out of step.
    loading: enabled && !settled,
    refreshing,
    refresh,
    setData,
  };
}

export interface MutationState<TArgs extends unknown[], TResult> {
  run: (...args: TArgs) => Promise<TResult | null>;
  pending: boolean;
  error: string | null;
  reset: () => void;
}

/**
 * Wraps a write so every caller gets the same pending/error handling and a
 * null return on failure, rather than each form inventing its own try/catch.
 */
export function useMutation<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options: { onSuccess?: (result: TResult) => void; onError?: (message: string) => void } = {},
): MutationState<TArgs, TResult> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actionRef = useRef(action);
  const optionsRef = useRef(options);
  useEffect(() => {
    actionRef.current = action;
    optionsRef.current = options;
  });

  const run = useCallback(async (...args: TArgs) => {
    setPending(true);
    setError(null);
    try {
      const result = await actionRef.current(...args);
      optionsRef.current.onSuccess?.(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      optionsRef.current.onError?.(message);
      return null;
    } finally {
      setPending(false);
    }
  }, []);

  return { run, pending, error, reset: useCallback(() => setError(null), []) };
}
