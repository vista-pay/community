'use client';

import { useEffect, useState } from 'react';

/** Holds a value still for `delay` ms — used to keep search off every keystroke. */
export function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
