import { QueryClient, QueryFunction, MutationCache } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { drainQueue } from "@/lib/offlineQueue";

/**
 * Thrown by apiRequest when the browser reports it is offline and the
 * caller attempted a write operation (anything that is not GET/HEAD).
 */
export class OfflineError extends Error {
  constructor() {
    super("You're offline — try again when reconnected.");
    this.name = "OfflineError";
  }
}

/** Type-guard — use this in onError / catch blocks instead of inspecting .message */
export function isOfflineError(err: unknown): err is OfflineError {
  return err instanceof OfflineError;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Block write requests immediately when the browser knows it is offline.
  // Show the toast here so every caller — useMutation, try/catch, or
  // fire-and-forget .then() — gets the message without extra per-file work.
  const isWrite = method !== "GET" && method !== "HEAD";
  if (isWrite && typeof navigator !== "undefined" && !navigator.onLine) {
    toast({
      title: "You're offline",
      description: "Try again when reconnected.",
      variant: "destructive",
    });
    throw new OfflineError();
  }

  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw" | "redirect";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (res.status === 401) {
      if (unauthorizedBehavior === "returnNull") return null;
      if (unauthorizedBehavior === "redirect" || unauthorizedBehavior === "throw") {
        if (window.location.pathname !== "/") {
          window.location.href = "/";
        }
        return null;
      }
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
  // MutationCache is here for future per-mutation instrumentation.
  // The offline toast is already shown inside apiRequest so no duplicate
  // handling is needed here.
  mutationCache: new MutationCache({}),
});

// When the browser comes back online, mark all queries stale and refetch active
// ones so visible pages pick up data that changed while offline.  Also drain
// any writes that were queued while offline, and show a confirmation toast if
// any queued saves succeeded.
async function handleOnline() {
  queryClient.invalidateQueries();
  const saved = await drainQueue();
  if (saved) {
    // Re-invalidate after the queued writes land so feeds update immediately.
    queryClient.invalidateQueries();
    toast({
      title: "Your changes were saved",
      description: "Everything's up to date.",
    });
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", handleOnline);

  // If the app loads while already online and there are leftover queued writes
  // (e.g. the user closed the tab while offline), drain them now.
  if (navigator.onLine) {
    void drainQueue().then((saved) => {
      if (saved) {
        queryClient.invalidateQueries();
        toast({
          title: "Your changes were saved",
          description: "Everything's up to date.",
        });
      }
    });
  }
}
