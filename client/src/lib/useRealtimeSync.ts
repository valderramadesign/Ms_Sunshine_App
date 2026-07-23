import { useEffect, useRef } from "react";
import { queryClient } from "./queryClient";
import { getCachedRole, feedRoleFor } from "./auth";
import { toast } from "@/hooks/use-toast";

export function useRealtimeSync(enabled = true) {
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;

    function connect() {
      if (!mounted) return;

      const es = new EventSource("/api/events");
      esRef.current = es;

      es.addEventListener("activities", (e) => {
        try {
          const data = JSON.parse(e.data);
          const childIds: string[] = data.childIds || [];
          for (const cid of childIds) {
            queryClient.invalidateQueries({ queryKey: ["/api/activities", cid] });
          }
        } catch {}
      });

      es.addEventListener("comments", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.childId) {
            queryClient.invalidateQueries({ queryKey: ["/api/comments-bulk", data.childId] });
          }
          if (data.role && data.role !== feedRoleFor(getCachedRole()) && data.action === "created") {
            const who = data.role === "parent" ? "A parent" : "Teacher";
            const child = data.childName ? ` on ${data.childName}'s feed` : "";
            toast({
              title: `${who} left a comment${child}`,
              duration: 4000,
            });
          }
        } catch {}
      });

      es.addEventListener("likes", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.childId) {
            queryClient.invalidateQueries({ queryKey: ["/api/likes-bulk", data.childId] });
          }
          if (data.role && data.role !== feedRoleFor(getCachedRole()) && data.action === "liked") {
            const who = data.role === "parent" ? "A parent" : "Teacher";
            const child = data.childName ? ` ${data.childName}'s activity` : " an activity";
            toast({
              title: `${who} liked${child}`,
              duration: 4000,
            });
          }
        } catch {}
      });

      es.addEventListener("children", () => {
        queryClient.invalidateQueries({ queryKey: ["/api/children"] });
      });

      es.addEventListener("teachers", () => {
        queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      });

      es.onerror = () => {
        es.close();
        if (mounted) {
          reconnectTimer.current = setTimeout(connect, 3000);
        }
      };
    }

    connect();

    // Reconnect the SSE stream promptly when the connection comes back,
    // instead of waiting for the next scheduled retry.
    const handleOnline = () => {
      if (!mounted) return;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      esRef.current?.close();
      esRef.current = null;
      connect();
    };
    window.addEventListener("online", handleOnline);

    return () => {
      mounted = false;
      window.removeEventListener("online", handleOnline);
      esRef.current?.close();
      esRef.current = null;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };
  }, [enabled]);
}
