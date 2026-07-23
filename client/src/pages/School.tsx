import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import BottomNav from "@/components/BottomNav";
import { useSchoolLogo } from "@/lib/useSchoolLogo";
import type { Child, Teacher } from "@shared/schema";
import photoFrameImg from "@assets/PhotoFrame_1780975215901.png";

type TabKey = "kids" | "parents" | "teachers";

type Guardian = { name?: string; relation?: string; contact?: string; email?: string; photo?: string };

function GrabbersIcon() {
  return (
    <svg width="20" height="36" viewBox="0 0 20 36" fill="none">
      <circle cx="7" cy="12" r="2" fill="#e0d9cc" />
      <circle cx="13" cy="12" r="2" fill="#e0d9cc" />
      <circle cx="7" cy="18" r="2" fill="#e0d9cc" />
      <circle cx="13" cy="18" r="2" fill="#e0d9cc" />
      <circle cx="7" cy="24" r="2" fill="#e0d9cc" />
      <circle cx="13" cy="24" r="2" fill="#e0d9cc" />
    </svg>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return "";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

function PersonRow({
  name,
  photo,
  testId,
  onClick,
}: {
  name: string;
  photo: string;
  testId: string;
  onClick?: () => void;
}) {
  const initials = getInitials(name);
  return (
    <div
      className={`h-[83px] relative w-full flex-shrink-0 ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
      data-testid={testId}
    >
      {/* Card panel */}
      <div
        className="absolute left-0 right-0 bottom-0 rounded-[15px] flex items-center bg-white border border-[#f0f0f0] border-solid shadow-[0px_0px_4px_0px_rgba(0,0,0,0.06)]"
        style={{ top: "18.07%" }}
      >
        <div className="flex items-center justify-between w-full pl-[97px] pr-[16px]">
          <p className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold leading-[normal] shrink-0 text-[#41444b] text-[16px] truncate flex-1 min-w-0 -translate-y-[3px]">
            {name}
          </p>
          <div className="h-[36px] w-[20px] relative shrink-0">
            <div className="absolute inset-[0_-10%_-5.56%_0]">
              <GrabbersIcon />
            </div>
          </div>
        </div>
      </div>

      {/* PhotoFrame — Figma PNG overlay with photo behind, fixed size */}
      <div
        className="absolute pointer-events-none"
        style={{ top: 0, bottom: 0, left: "13px", width: "62px", overflow: "visible", display: "flex", alignItems: "center" }}
      >
        <div style={{ position: "relative", width: "62px", height: "67px", flexShrink: 0 }}>
          {/* Photo or initials sits behind the frame */}
          <div
            style={{
              position: "absolute",
              top: "8.9%", bottom: "24.9%", left: "10.7%", right: "10.7%",
              overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {photo ? (
              <img
                src={photo}
                alt={name}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
              />
            ) : (
              <span
                style={{
                  fontFamily: "'SF Pro Rounded', 'M PLUS Rounded 1c', Helvetica",
                  fontWeight: 600,
                  fontSize: 16,
                  color: "#e0d9cc",
                  lineHeight: 1,
                  userSelect: "none",
                }}
              >
                {initials}
              </span>
            )}
          </div>
          {/* Frame PNG overlaid on top — transparent center reveals the photo */}
          <img
            src={photoFrameImg}
            alt=""
            aria-hidden
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          />
        </div>
      </div>
    </div>
  );
}

export const School = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const logoSrc = useSchoolLogo();

  const getInitialTab = (): TabKey => {
    const t = new URLSearchParams(window.location.search).get("tab");
    return t === "parents" || t === "teachers" ? t : "kids";
  };
  const [tab, setTab] = useState<TabKey>(getInitialTab);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { data: childrenData } = useQuery<Child[]>({ queryKey: ["/api/children"] });
  const { data: teachersData } = useQuery<Teacher[]>({ queryKey: ["/api/teachers"] });

  const parents = useMemo(() => {
    const list: { id: string; name: string; photo: string }[] = [];
    const seen = new Set<string>();
    for (const c of childrenData ?? []) {
      let gs: Guardian[] = [];
      try {
        gs = JSON.parse(c.guardians || "[]");
      } catch {
        gs = [];
      }
      for (const g of gs) {
        const name = (g.name || "").trim();
        if (!name) continue;
        const key = `${name.toLowerCase()}|${(g.email || "").trim().toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        list.push({ id: key, name, photo: g.photo || "" });
      }
    }
    return list;
  }, [childrenData]);

  const teacherList = useMemo(
    () =>
      (teachersData ?? []).map((t) => ({
        id: t.id,
        name: `${t.firstName} ${t.lastName}`.trim(),
        photo: t.photo || "",
      })),
    [teachersData],
  );

  function selectTab(t: TabKey) {
    setTab(t);
    setSearchOpen(false);
    setQuery("");
    window.history.replaceState(null, "", t === "kids" ? "/school" : `/school?tab=${t}`);
  }

  const action =
    tab === "kids"
      ? { label: "+ add a child", testId: "button-add-child", go: () => setLocation("/school/add") }
      : tab === "parents"
        ? { label: "+ add a guardian", testId: "button-add-guardian", go: () => setLocation("/school/add-guardian") }
        : { label: "+ add a teacher", testId: "button-add-teacher", go: () => setLocation("/school/add-teacher") };

  const q = query.trim().toLowerCase();
  const matches = (name: string) => !q || name.toLowerCase().includes(q);

  return (
    <div className="flex flex-col h-dvh items-center relative overflow-hidden bg-[#f5f5f5]">

      {/* Header — Ms.Sunshine logo + title row */}
      <div className="flex flex-col items-center w-full flex-shrink-0 pt-[32px]">
        <img
          src={logoSrc}
          alt="Ms. Sunshine"
          data-testid="img-school-logo"
          className="w-[210px] h-auto object-contain"
        />
        <div className="flex w-full items-baseline justify-between px-[24px] mt-[18px] mb-[8px]">
          <span
            data-testid="text-page-title"
            className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[32px] tracking-[-0.50px] leading-[normal] whitespace-nowrap text-[#8f530f]"
          >
            school
          </span>
          <button
            data-testid={action.testId}
            onClick={action.go}
            className="bg-transparent border-none cursor-pointer p-0"
          >
            <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[#3e983a] text-[16px] leading-[18px] whitespace-nowrap">
              {action.label}
            </span>
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-[8px] w-full px-[24px] mt-[6px]">
          <div className="flex items-center flex-1 bg-[#eeeeec] rounded-[14px] p-[4px]">
            {(["kids", "parents", "teachers"] as TabKey[]).map((t) => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  data-testid={`tab-${t}`}
                  onClick={() => selectTab(t)}
                  className={`flex-1 rounded-[10px] py-[8px] [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[16px] leading-[normal] transition-colors ${
                    active
                      ? "bg-white text-[#41444b] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.12)]"
                      : "bg-transparent text-[#3e983a]"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
          <button
            data-testid="button-search"
            onClick={() => {
              setSearchOpen((v) => !v);
              setQuery("");
            }}
            className={`w-[48px] h-[48px] rounded-[14px] flex items-center justify-center flex-shrink-0 border-none cursor-pointer ${
              searchOpen ? "bg-white shadow-[0px_1px_3px_0px_rgba(0,0,0,0.12)]" : "bg-[#eeeeec]"
            }`}
            aria-label="Search"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="6.5" stroke="#3e983a" strokeWidth="2" />
              <path d="M14 14L18 18" stroke="#3e983a" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {searchOpen && (
          <div className="w-full px-[24px] mt-[10px]">
            <input
              data-testid="input-search"
              autoFocus
              type="text"
              placeholder={`Search ${tab}...`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-[12px] border border-[#e0d9cc] bg-white px-[16px] py-[10px] text-[16px] text-[#41444b] placeholder-[#41444b]/40 outline-none focus:border-[#41444b] [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal"
            />
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex flex-col gap-[8px] items-center w-full px-[24px] mt-[12px] flex-1 overflow-y-auto pb-[139px]">
        {tab === "kids" &&
          (childrenData ?? [])
            .map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`.trim(), photo: c.photo }))
            .filter((c) => matches(c.name))
            .map((child) => (
              <PersonRow
                key={child.id}
                name={child.name}
                photo={child.photo}
                testId={`card-kid-${child.id}`}
                onClick={() => setLocation(`/school/${child.id}`)}
              />
            ))}

        {tab === "parents" &&
          parents
            .filter((p) => matches(p.name))
            .map((parent) => (
              <PersonRow key={parent.id} name={parent.name} photo={parent.photo} testId={`card-parent-${parent.id}`}
                onClick={() => setLocation(`/school/guardian/${encodeURIComponent(parent.id)}`)} />
            ))}

        {tab === "teachers" &&
          teacherList
            .filter((t) => matches(t.name))
            .map((teacher) => (
              <PersonRow key={teacher.id} name={teacher.name} photo={teacher.photo} testId={`card-teacher-${teacher.id}`}
                onClick={() => setLocation(`/school/teacher/${teacher.id}`)} />
            ))}
      </div>

      <BottomNav active="school" />
    </div>
  );
};
