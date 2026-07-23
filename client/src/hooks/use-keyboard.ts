import { useState, useEffect, useCallback } from "react";

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768 && ("ontouchstart" in window || navigator.maxTouchPoints > 0));
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

export function useKeyboardToolbarPosition() {
  const [bottom, setBottom] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const update = useCallback(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const offset = window.innerHeight - vv.height - vv.offsetTop;
    setBottom(Math.max(0, offset));
    setKeyboardOpen(offset > 100);
  }, []);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [update]);
  return { bottom, keyboardOpen };
}
