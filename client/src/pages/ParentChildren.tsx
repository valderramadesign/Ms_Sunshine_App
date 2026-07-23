import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Child } from "@shared/schema";
import { useSchoolLogo } from "@/lib/useSchoolLogo";
import photoFrameImg from "@assets/PhotoFrame_1780975215901.png";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return "";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

function ChildRow({
  name,
  photo,
  testId,
  onClick,
}: {
  name: string;
  photo: string;
  testId: string;
  onClick: () => void;
}) {
  const initials = getInitials(name);
  return (
    <div
      className="h-[83px] relative w-full flex-shrink-0 cursor-pointer"
      onClick={onClick}
      data-testid={testId}
    >
      <div
        className="absolute left-0 right-0 bottom-0 rounded-[15px] flex items-center bg-white border border-[#f0f0f0] border-solid shadow-[0px_0px_4px_0px_rgba(0,0,0,0.06)]"
        style={{ top: "18.07%" }}
      >
        <div className="flex items-center justify-between w-full pl-[97px] pr-[16px]">
          <p className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold leading-[normal] shrink-0 text-[#41444b] text-[16px] truncate flex-1 min-w-0 -translate-y-[3px]">
            {name}
          </p>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
            <path d="M7 5l5 5-5 5" stroke="#c8c2b6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <div
        className="absolute pointer-events-none"
        style={{ top: 0, bottom: 0, left: "13px", width: "62px", overflow: "visible", display: "flex", alignItems: "center" }}
      >
        <div style={{ position: "relative", width: "62px", height: "67px", flexShrink: 0 }}>
          <div style={{ position: "absolute", top: "8.9%", bottom: "24.9%", left: "10.7%", right: "10.7%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {photo ? (
              <img
                src={photo}
                alt={name}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
              />
            ) : (
              <span style={{ fontFamily: "'SF Pro Rounded', 'M PLUS Rounded 1c', Helvetica", fontWeight: 600, fontSize: 16, color: "#e0d9cc", lineHeight: 1, userSelect: "none" }}>
                {initials}
              </span>
            )}
          </div>
          <img src={photoFrameImg} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
        </div>
      </div>
    </div>
  );
}

export const ParentChildren = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const logoSrc = useSchoolLogo();
  const { data: childrenData, isLoading } = useQuery<Child[]>({ queryKey: ["/api/children"] });

  const list = (childrenData ?? []).map((c) => ({
    id: c.id,
    name: `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "Child",
    photo: c.photo || "",
  }));

  return (
    <div className="flex flex-col h-dvh items-center relative overflow-hidden bg-[#f5f5f5]">
      <div className="flex flex-col items-center w-full flex-shrink-0 pt-[32px]">
        <img src={logoSrc} alt="Ms. Sunshine" data-testid="img-children-logo" className="h-[44px] object-contain" />
        <div className="w-full px-[24px] mt-[24px]">
          <p
            data-testid="text-children-title"
            className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[32px] text-[#7a3428] tracking-[-0.5px] leading-[normal]"
          >
            my children
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-[12px] w-full px-[24px] mt-[16px] overflow-y-auto pb-[40px]">
        {isLoading ? (
          <p className="text-[#7a3428] text-[14px] mt-[24px]" data-testid="text-children-loading">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-[#7a3428] text-[14px] mt-[24px]" data-testid="text-children-empty">No children linked to your account yet.</p>
        ) : (
          list.map((c) => (
            <ChildRow
              key={c.id}
              name={c.name}
              photo={c.photo}
              testId={`row-child-${c.id}`}
              onClick={() => setLocation(`/school/${c.id}`)}
            />
          ))
        )}
      </div>
    </div>
  );
};
