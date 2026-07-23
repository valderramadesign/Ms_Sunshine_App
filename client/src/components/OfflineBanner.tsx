import { useEffect, useRef, useState } from "react";
import { WifiOff, Wifi, X } from "lucide-react";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [dismissed, setDismissed] = useState(false);
  const [showBackOnline, setShowBackOnline] = useState(false);
  const wasOfflineRef = useRef(false);
  const backOnlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleOffline = () => {
      wasOfflineRef.current = true;
      setIsOffline(true);
      setDismissed(false);
      setShowBackOnline(false);
      if (backOnlineTimerRef.current) {
        clearTimeout(backOnlineTimerRef.current);
        backOnlineTimerRef.current = null;
      }
    };
    const handleOnline = () => {
      setIsOffline(false);
      setDismissed(false);
      if (wasOfflineRef.current) {
        setShowBackOnline(true);
        backOnlineTimerRef.current = setTimeout(() => {
          setShowBackOnline(false);
          backOnlineTimerRef.current = null;
        }, 3000);
      }
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (backOnlineTimerRef.current) clearTimeout(backOnlineTimerRef.current);
    };
  }, []);

  if (showBackOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed left-1/2 top-3 z-[100] w-[calc(100%-24px)] max-w-sm -translate-x-1/2"
        data-testid="banner-back-online"
      >
        <div className="flex items-center gap-3 rounded-2xl bg-[#e6f9ef] px-4 py-3 shadow-lg ring-1 ring-[#6fcf97]">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6fcf97]">
            <Wifi className="h-4 w-4 text-[#1a4731]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#1a4731]">Back online</p>
            <p className="text-xs text-[#2d7a51]">Everything's up to date.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isOffline || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-3 z-[100] w-[calc(100%-24px)] max-w-sm -translate-x-1/2"
      data-testid="banner-offline"
    >
      <div className="flex items-center gap-3 rounded-2xl bg-[#fff6df] px-4 py-3 shadow-lg ring-1 ring-[#ffd97a]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ffd97a]">
          <WifiOff className="h-4 w-4 text-[#4a3b28]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#4a3b28]">You're offline</p>
          <p className="text-xs text-[#7a6a4f]">Changes may not save until you're back online.</p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1 text-[#7a6a4f] active:opacity-70"
          data-testid="button-dismiss-offline"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
