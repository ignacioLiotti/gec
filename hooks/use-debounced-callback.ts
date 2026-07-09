import * as React from "react";

import { useCallbackRef } from "@/hooks/use-callback-ref";

/**
 * Debounced, identity-stable version of `callback`: only the last call within
 * `delay` ms fires. Safe to pass to memoized children (identity changes only
 * with `delay`), and the latest `callback` is always invoked thanks to
 * `useCallbackRef`. Pending calls are dropped on unmount — don't rely on a
 * trailing invocation to persist critical work.
 */
export function useDebouncedCallback<T extends (...args: never[]) => unknown>(
  callback: T,
  delay: number,
) {
  const handleCallback = useCallbackRef(callback);
  const debounceTimerRef = React.useRef(0);
  React.useEffect(
    () => () => window.clearTimeout(debounceTimerRef.current),
    [],
  );

  const setValue = React.useCallback(
    (...args: Parameters<T>) => {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = window.setTimeout(
        () => handleCallback(...args),
        delay,
      );
    },
    [handleCallback, delay],
  );

  return setValue;
}
