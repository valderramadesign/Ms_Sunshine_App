import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import BottomCTA from "@/components/BottomCTA";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import { useActivity, formatTime } from "@/lib/activityStore";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSchoolLogo } from "@/lib/useSchoolLogo";
import type { Child as DbChild } from "@shared/schema";

type Child = {
  id: string;
  name: string;
  photo: string;
  tilt: number;
};

// Alternating polaroid tilts applied to the fetched list.
const TILTS = [-3, 2, -1.5, 3, -2.5, 1.5, -2];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return "";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

function GrabbersIcon() {
  return (
    <svg width="20" height="36" viewBox="0 0 20 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="7" cy="12" r="2" fill="#e0d9cc" />
      <circle cx="13" cy="12" r="2" fill="#e0d9cc" />
      <circle cx="7" cy="18" r="2" fill="#e0d9cc" />
      <circle cx="13" cy="18" r="2" fill="#e0d9cc" />
      <circle cx="7" cy="24" r="2" fill="#e0d9cc" />
      <circle cx="13" cy="24" r="2" fill="#e0d9cc" />
    </svg>
  );
}

type DraggableChildButtonProps = {
  child: Child;
  selected: boolean;
  onToggle: () => void;
};

function DraggableChildButton({ child, selected, onToggle }: DraggableChildButtonProps) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={child}
      dragListener={false}
      dragControls={controls}
      className="h-[83px] relative w-full flex-shrink-0 list-none"
      style={{ listStyle: "none" }}
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
    >
      {/* Tappable area for selection — excludes the grab handle */}
      <div
        className="absolute inset-0 cursor-pointer"
        onClick={onToggle}
      />

      {/* Button panel */}
      <div
        className={`absolute left-0 right-0 bottom-0 rounded-[15px] flex items-center pointer-events-none ${
          selected
            ? "bg-white border border-[#41444b] border-solid shadow-[0px_0px_4px_0px_rgba(0,0,0,0.06)]"
            : "bg-white border border-[#f0f0f0] border-solid shadow-[0px_0px_4px_0px_rgba(0,0,0,0.06)]"
        }`}
        style={{ top: "18.07%" }}
      >
        {/* Contents row */}
        <div className="flex items-center justify-between w-full pl-[97px] pr-[16px]">
          <p className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold h-[19px] leading-[normal] not-italic shrink-0 text-[16px] text-[#41444b] -translate-y-[3px]">
            {child.name}
          </p>

          {/* Grab handle — pointer-events re-enabled, triggers drag */}
          <div
            className="h-[36px] w-[20px] relative shrink-0 cursor-grab active:cursor-grabbing pointer-events-auto touch-none"
            onPointerDown={(e) => {
              e.stopPropagation();
              controls.start(e);
            }}
          >
            <div className="absolute inset-[0_-10%_-5.56%_0]">
              <GrabbersIcon />
            </div>
          </div>
        </div>
      </div>

      {/* Polaroid photo frame */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "3.61%",
          right: "75.99%",
          bottom: "7.23%",
          left: "3.95%",
          overflow: "visible",
        }}
      >
        <div
          className="absolute flex flex-col"
          style={{
            top: "2px",
            right: "2px",
            bottom: "2px",
            left: "2px",
            transform: `rotate(${child.tilt}deg)`,
            transformOrigin: "center center",
            background: "#fffef9",
            padding: "4px 4px 14px 4px",
            boxShadow: "0 3px 8px rgba(0,0,0,0.28), 0 1px 3px rgba(0,0,0,0.16)",
            borderRadius: "1px",
          }}
        >
          <div className="relative flex-1 overflow-hidden bg-[#d9d9d9]">
            {child.photo ? (
              <img
                src={child.photo}
                alt={child.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  style={{
                    fontFamily: "'SF Pro Rounded', 'M PLUS Rounded 1c', Helvetica",
                    fontWeight: 600,
                    fontSize: 14,
                    color: "#ffffff",
                    lineHeight: 1,
                    userSelect: "none",
                  }}
                >
                  {getInitials(child.name)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Reorder.Item>
  );
}

export const SelectChildren = (): JSX.Element => {
  const [childList, setChildList] = useState<Child[]>([]);
  const { data: childrenData } = useQuery<DbChild[]>({ queryKey: ["/api/children"] });

  useEffect(() => {
    setChildList((prev) => {
      const rows = (childrenData ?? []).map((c, i) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`.trim(),
        photo: c.photo,
        tilt: TILTS[i % TILTS.length],
      }));
      if (prev.length) {
        // Preserve the user's drag order for ids that still exist.
        const order = new Map(prev.map((c, idx) => [c.id, idx]));
        rows.sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER));
      }
      return rows;
    });
  }, [childrenData]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [, setLocation] = useLocation();
  const logoSrc = useSchoolLogo();
  const { activityType, setSelectedChildren, setSelectedChildIds, setActivityTime, setCreatedActivityIds } = useActivity();

  const toggleChild = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === childList.length) setSelected(new Set());
    else setSelected(new Set(childList.map((c) => c.id)));
  };

  const hasSelection = selected.size > 0;

  return (
    <div className="flex flex-col h-dvh items-center relative overflow-hidden bg-[#f5f5f5]">

      {/* Header — Ms.Sunshine logo + title row (matches Home page style) */}
      <div className="flex flex-col items-center w-full flex-shrink-0 pt-[32px]">
        <img
          src={logoSrc}
          alt="Ms. Sunshine"
          data-testid="img-select-children-logo"
          className="w-[210px] h-auto object-contain"
        />
        <div className="flex w-full items-baseline justify-between px-[24px] mt-[18px] mb-[8px]">
          <div className="flex items-baseline gap-[12px]">
            <button
              data-testid="button-back"
              onClick={() => setLocation("/home")}
              className="flex items-center justify-center w-[40px] h-[40px] rounded-full bg-white border-none cursor-pointer p-0 flex-shrink-0 shadow-[0px_1px_3px_rgba(0,0,0,0.08)] self-center"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M9 15L4 10L9 5" stroke="#41444B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="4" y1="10" x2="16" y2="10" stroke="#41444B" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
            <span
              data-testid="text-page-title"
              className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[32px] tracking-[-0.50px] leading-[normal] whitespace-nowrap text-[#7a3428]"
            >
              school
            </span>
          </div>

          {childList.length > 0 && (
            <button
              data-testid="button-select-all"
              onClick={selectAll}
              className="bg-transparent border-none cursor-pointer p-0"
            >
              <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[#3e983a] text-[16px] leading-[18px] whitespace-nowrap">
                {selected.size === childList.length ? "deselect all" : "select all"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Empty state — no children enrolled yet */}
      {childList.length === 0 && (
        <div className="flex flex-col items-center gap-[6px] w-full px-[24px] mt-[48px]">
          <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[18px] text-[#41444b]">
            no children yet
          </span>
          <span className="[font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica] text-[14px] text-[#9b9ea6] text-center">
            add children from the school page to start posting activities
          </span>
        </div>
      )}

      {/* Draggable child list */}
      <Reorder.Group
        axis="y"
        values={childList}
        onReorder={setChildList}
        className="flex flex-col gap-[8px] w-full flex-1 overflow-y-auto"
        style={{ listStyle: "none", paddingLeft: 24, paddingRight: 24, paddingTop: 0, paddingBottom: hasSelection ? 160 : 26, margin: 0 }}
      >
        {childList.map((child) => (
          <DraggableChildButton
            key={child.id}
            child={child}
            selected={selected.has(child.id)}
            onToggle={() => toggleChild(child.id)}
          />
        ))}
      </Reorder.Group>

      {/* Bottom CTA */}
      <AnimatePresence>
        {hasSelection && (
          <motion.div
            initial={{ y: 220 }}
            animate={{ y: 0 }}
            exit={{ y: 220 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute bottom-0 left-0 right-0 h-[134px] z-10 pointer-events-auto"
          >
            <BottomCTA>
              <button
                data-testid="button-add-children"
                className="w-full h-[44px] rounded-[50px] flex items-center justify-center cursor-pointer bg-white border border-[#f0f0f0] shadow-[0px_0px_4px_0px_rgba(0,0,0,0.06)]"
                onClick={async () => {
                  const selectedKids = childList.filter((c) => selected.has(c.id));
                  setSelectedChildren(selectedKids.map((c) => c.name));
                  setSelectedChildIds(selectedKids.map((c) => c.id));
                  if (activityType !== "meals" && activityType !== "check in" && activityType !== "checkout") {
                    const timeStr = formatTime(new Date());
                    setActivityTime(timeStr);
                    const labelMap: Record<string, string> = {
                      "free play": "had free play",
                      "lesson": "had a lesson",
                      "outdoor play": "had outdoor play",
                      "nap time": "had nap time",
                      "sleep check": "had a sleep check",
                      "potty": "had a potty break",
                      "incident": "had an incident",
                      "wellness": "had a wellness check",
                      "one on one": "had one on one time",
                    };
                    const verb = labelMap[activityType] || `did ${activityType}`;
                    const texts: Record<string, string> = {};
                    for (const kid of selectedKids) {
                      texts[kid.id] = `${kid.name.split(" ")[0]} ${verb}.`;
                    }
                    try {
                      const res = await apiRequest("POST", "/api/activities", {
                        childIds: selectedKids.map((c) => c.id),
                        texts,
                        time: timeStr,
                      });
                      const created = await res.json();
                      setCreatedActivityIds(created.map((a: { id: string }) => a.id));
                      for (const kid of selectedKids) {
                        queryClient.invalidateQueries({ queryKey: ["/api/activities", kid.id] });
                      }
                    } catch (err) {
                      console.error("Failed to save activity:", err);
                    }
                    setLocation("/add-note");
                  } else if (activityType === "check in" || activityType === "checkout") {
                    const timeStr = formatTime(new Date());
                    setActivityTime(timeStr);
                    const texts: Record<string, string> = {};
                    for (const kid of selectedKids) {
                      const firstName = kid.name.split(" ")[0];
                      texts[kid.id] = activityType === "check in"
                        ? `${firstName} checked in.`
                        : `${firstName} checked out.`;
                    }
                    try {
                      const res = await apiRequest("POST", "/api/activities", {
                        childIds: selectedKids.map((c) => c.id),
                        texts,
                        time: timeStr,
                      });
                      const created = await res.json();
                      setCreatedActivityIds(created.map((a: { id: string }) => a.id));
                      for (const kid of selectedKids) {
                        queryClient.invalidateQueries({ queryKey: ["/api/activities", kid.id] });
                      }
                    } catch (err) {
                      console.error("Failed to save activity:", err);
                    }
                    setLocation("/success");
                  } else {
                    setLocation("/select-items");
                  }
                }}
              >
                <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#3e983a] text-[24px] font-semibold leading-[normal]">
                  Continue
                </span>
              </button>
              <button
                data-testid="button-cancel"
                className="bg-transparent border-none cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#3e983a] text-[21px] font-semibold leading-[normal]"
                onClick={() => setLocation("/home")}
              >
                Cancel
              </button>
            </BottomCTA>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
