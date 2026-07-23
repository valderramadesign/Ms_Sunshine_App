import { useEffect, useRef } from "react";
import { queryClient } from "./queryClient";

// Vercel's serverless functions can't hold long-lived SSE connections or
// in-memory client lists, so cross-device updates are driven by polling
// instead of a push stream. This trades instant updates for a small delay,
// and drops the old per-event "someone commented/liked" toast notifications
// since a poll tick carries no event metadata to build them from.
const POLL_INTERVAL_MS = 5000;

export function useRealtimeSync(enabled = true) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    function poll() {
      if (document.visibilityState === "visible") {
        queryClient.invalidateQueries();
      }
    }

    timer.current = setInterval(poll, POLL_INTERVAL_MS);

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        queryClient.invalidateQueries();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (timer.current) clearInterval(timer.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled]);
}
