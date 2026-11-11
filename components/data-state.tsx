"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DependencyList,
  type ReactNode,
} from "react";
import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react";

import { PageLoader } from "@/components/bar-spinner";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";

// One pattern for every list/detail load on the dashboard: loading, error
// (with the server's message and a Retry), empty, or data. The point is that
// a failed request can never render as "No campaigns yet" — those two used
// to share a code path, so every network hiccup looked like data loss.

export type AsyncState<T> =
  | { status: "loading"; data: undefined; error: null }
  | { status: "error"; data: T | undefined; error: string }
  | { status: "ready"; data: T; error: null };

export type AsyncData<T> = AsyncState<T> & {
  /** Re-run the loader. Keeps the current data on screen while it runs. */
  reload: () => Promise<void>;
  /** True while a reload is in flight over existing data. */
  refreshing: boolean;
  /** Replace the data locally (optimistic updates after a mutation). */
  setData: (update: (current: T) => T) => void;
};

/**
 * Runs `loader` on mount and whenever `deps` change. A reload that fails
 * after a successful load keeps the old data and reports the error, so a
 * page never blanks out because one background refresh missed.
 */
export function useAsyncData<T>(
  loader: () => Promise<T>,
  deps: DependencyList,
): AsyncData<T> {
  const [state, setState] = useState<AsyncState<T>>({
    status: "loading",
    data: undefined,
    error: null,
  });
  const [refreshing, setRefreshing] = useState(false);
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });
  const requestRef = useRef(0);
  const hasDataRef = useRef(false);

  const run = useCallback(async () => {
    const request = ++requestRef.current;
    if (hasDataRef.current) setRefreshing(true);
    else setState({ status: "loading", data: undefined, error: null });
    try {
      const data = await loaderRef.current();
      if (request !== requestRef.current) return;
      hasDataRef.current = true;
      setState({ status: "ready", data, error: null });
    } catch (error) {
      if (request !== requestRef.current) return;
      setState((current) => ({
        status: "error",
        data: current.data,
        error: errorMessage(error),
      }));
    } finally {
      if (request === requestRef.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // A dependency change (another campaign id, another workspace) is a new
    // resource: show the loader rather than the previous one's data.
    hasDataRef.current = false;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((update: (current: T) => T) => {
    setState((current) =>
      current.status === "ready"
        ? { ...current, data: update(current.data) }
        : current,
    );
  }, []);

  return { ...state, reload: run, refreshing, setData };
}

/** The error panel: what failed, the server's reason, and a Retry. */
export function ErrorState({
  title = "Couldn't load this",
  message,
  onRetry,
  retrying,
  action,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  /** Extra action next to Retry (e.g. a back link). */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Empty className={cn("border-0 py-14", className)} role="alert">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      {(onRetry || action) && (
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onRetry && (
              <Button variant="outline" onClick={onRetry} disabled={retrying}>
                {retrying ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <RefreshCwIcon data-icon="inline-start" />
                )}
                Try again
              </Button>
            )}
            {action}
          </div>
        </EmptyContent>
      )}
    </Empty>
  );
}

/**
 * Renders exactly one of loading / error / empty / children for an
 * AsyncData. `isEmpty` decides what "no data" means for this resource.
 */
export function DataState<T>({
  state,
  loading,
  loadingLabel,
  errorTitle,
  errorAction,
  isEmpty,
  empty,
  children,
}: {
  state: AsyncData<T>;
  loading?: ReactNode;
  loadingLabel?: string;
  errorTitle?: string;
  errorAction?: ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (state.status === "loading") {
    return <>{loading ?? <PageLoader className="min-h-0 py-12" label={loadingLabel} />}</>;
  }
  // An error with no data to fall back on takes the whole slot. An error on
  // a background refresh keeps the data visible; callers surface that one
  // with a toast or banner instead.
  if (state.status === "error" && state.data === undefined) {
    return (
      <ErrorState
        title={errorTitle}
        message={state.error}
        onRetry={() => void state.reload()}
        retrying={state.refreshing}
        action={errorAction}
      />
    );
  }
  const data = state.data as T;
  if (isEmpty?.(data) && empty !== undefined) return <>{empty}</>;
  return <>{children(data)}</>;
}
