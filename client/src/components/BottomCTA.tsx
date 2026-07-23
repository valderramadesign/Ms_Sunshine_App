import { type ReactNode, useState, useEffect, useCallback } from "react";

type BottomCTAProps = {
  children: ReactNode;
  className?: string;
  height?: number;
};

export default function BottomCTA({ children, className = "", height = 134 }: BottomCTAProps) {
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const update = useCallback(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const offset = window.innerHeight - vv.height - vv.offsetTop;
    setKeyboardOffset(Math.max(0, offset));
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

  return (
    <div
      className={`relative w-full flex-shrink-0 bg-[#f5f5f5] ${className}`}
      style={{ height, transform: `translateY(-${keyboardOffset}px)` }}
      data-testid="bottom-cta"
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[12px] px-6 z-10">
        {children}
      </div>
    </div>
  );
}
