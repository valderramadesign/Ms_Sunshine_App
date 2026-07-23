import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import BottomNav from "@/components/BottomNav";
import { useActivity, formatTime } from "@/lib/activityStore";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSchoolLogo } from "@/lib/useSchoolLogo";

type ActivityItem = {
  label: string;
  description?: string;
  src?: string;
  alt?: string;
  custom?: boolean;
  iconBox?: string;
  iconImg?: string;
};

// Activity grid data.
// iconBox / iconImg replicate Figma node 2033:817 exactly: each icon sits in a
// fixed-size container (scaled from the 107px Figma card to our 98px card) with
// the artwork absolutely positioned & clipped via overflow-hidden.
const defaultActivityItems: ActivityItem[] = [
  { label: "check in", src: "/figmaAssets/home-checkin.png", alt: "Check in", iconBox: "h-[45px] w-[70px]", iconImg: "absolute max-w-none h-[146.79%] w-[142.69%] top-[-21.17%] left-[-19.23%]" },
  { label: "free play", src: "/figmaAssets/home-freeplay.png", alt: "Free play", iconBox: "h-[50px] w-[77px]", iconImg: "absolute max-w-none h-[145.27%] w-[130.36%] top-[-22.64%] left-[-15.18%]" },
  { label: "lesson", src: "/figmaAssets/home-lesson.png", alt: "Lesson", iconBox: "h-[52px] w-[60px]", iconImg: "absolute max-w-none h-[192.42%] w-[110.14%] top-[-44.94%] left-[-10.19%]" },
  { label: "meals", src: "/figmaAssets/home-meals.png", alt: "Meals", iconBox: "h-[51px] w-[66px]", iconImg: "absolute max-w-none h-[136.11%] w-[105.38%] top-[-11.11%] left-0" },
  { label: "outdoor play", src: "/figmaAssets/home-outdoor.png", alt: "Outdoor play", iconBox: "h-[50px] w-[79px]", iconImg: "absolute max-w-none h-[124.8%] w-[117%] top-[-7.2%] left-[-6%]" },
  { label: "nap time", src: "/figmaAssets/home-naptime.png", alt: "Nap time", iconBox: "h-[56px] w-[44px]", iconImg: "absolute max-w-none h-[113.21%] w-[145.16%] top-0 left-[-22.58%]" },
  { label: "sleep check", src: "/figmaAssets/home-sleepcheck.png", alt: "Sleep check", iconBox: "h-[53px] w-[59px]", iconImg: "absolute max-w-none h-[127.25%] w-[170.06%] top-[-6%] left-[-32.56%]" },
  { label: "potty", src: "/figmaAssets/home-potty.png", alt: "Potty", iconBox: "h-[54px] w-[51px]", iconImg: "absolute max-w-none h-[121.98%] w-[131.33%] top-[-4.95%] left-[-14.67%]" },
  { label: "incident", src: "/figmaAssets/home-incident.png", alt: "Incident", iconBox: "h-[52px] w-[75px]", iconImg: "absolute max-w-none h-[132.77%] w-[136.99%] top-[-13.45%] left-[-15.32%]" },
  { label: "wellness", src: "/figmaAssets/home-healthcheck.png", alt: "Wellness", iconBox: "h-[51px] w-[54px]", iconImg: "absolute max-w-none h-[122.91%] w-[116.4%] top-[-4.47%] left-[-5.29%]" },
  { label: "one on one", src: "/figmaAssets/home-oneonone.png", alt: "One on one", iconBox: "h-[48px] w-[60px]", iconImg: "absolute max-w-none h-[136.45%] w-[161.03%] top-[-14.95%] left-[-25.37%]" },
  { label: "checkout", src: "/figmaAssets/home-checkout.png", alt: "Checkout", iconBox: "h-[50px] w-[85px]", iconImg: "absolute max-w-none h-[155.88%] w-[139.12%] top-[-20.17%] left-[-19.06%]" },
];

const inputClass =
  "w-full rounded-[12px] border border-[#e0d9cc] bg-white px-[16px] py-[12px] text-[16px] text-[#41444b] placeholder-[#41444b]/40 outline-none focus:border-[#41444b] [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal";

export const Home = (): JSX.Element => {
  const { setActivityType, preSelectedChildId, preSelectedChildName, setPreSelectedChild, setSelectedChildren, setSelectedChildIds, setActivityTime, setCreatedActivityIds } = useActivity();
  const [activityItems, setActivityItems] = useState<ActivityItem[]>(defaultActivityItems);
  const [showDialog, setShowDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [nameError, setNameError] = useState(false);
  const [descError, setDescError] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, setLocation] = useLocation();
  const logoSrc = useSchoolLogo();

  useEffect(() => {
    return () => {
      setPreSelectedChild(null, null);
    };
  }, []);

  const startLongPress = useCallback((label: string) => {
    longPressTimer.current = setTimeout(() => {
      setEditingLabel(label);
    }, 500);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    setActivityItems((prev) => prev.filter((i) => i.label !== deleteTarget));
    setDeleteTarget(null);
    setEditingLabel(null);
  };

  const closeNewActivityDialog = () => {
    setShowDialog(false);
    setNewName("");
    setNewDescription("");
    setNameError(false);
    setDescError(false);
  };

  const handleAddActivity = async () => {
    const nameOk = !!newName.trim();
    const descOk = !!newDescription.trim();
    setNameError(!nameOk);
    setDescError(!descOk);
    if (!nameOk || !descOk) return;
    setIsGenerating(true);

    let imageSrc: string | undefined;
    const subject = newDescription.trim() || newName.trim();

    try {
      const res = await fetch("/api/generate-activity-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject }),
      });
      if (res.ok) {
        const data = await res.json();
        imageSrc = data.image;
      }
    } catch (e) {
      console.error("Image generation failed:", e);
    }

    const custom: ActivityItem = {
      label: newName.trim(),
      description: newDescription.trim(),
      src: imageSrc,
      alt: newName.trim(),
      custom: true,
    };
    setActivityItems((prev) => [...prev, custom]);
    setNewName("");
    setNewDescription("");
    setIsGenerating(false);
    setShowDialog(false);
  };

  return (
    <div className="flex flex-col h-dvh items-center relative bg-[#f5f5f5]">
      {/* Dialog overlay */}
      {showDialog && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.35)" }}
          onClick={closeNewActivityDialog}
        >
          <div
            className="relative flex flex-col gap-[20px] rounded-[20px] bg-white mx-[24px] w-full max-w-[354px] p-[28px] font-semibold"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dialog heading row */}
            <div className="flex items-center justify-between">
              <p className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[#7a3428] text-[22px] leading-[normal] tracking-[-0.5px] m-0">new activity</p>
              <button
                className="flex items-center justify-center w-[40px] h-[40px] rounded-full bg-white border-none cursor-pointer p-0 flex-shrink-0 shadow-[0px_1px_3px_rgba(0,0,0,0.08)]"
                onClick={closeNewActivityDialog}
                aria-label="Close"
              >
                <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4L12 12" stroke="#288899" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Name field */}
            <div className="flex flex-col gap-[6px]">
              <label className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#41444b] text-[14px] leading-[normal] tracking-[0.3px]">activity title</label>
              <input
                className={inputClass}
                style={{ borderColor: nameError ? "#e53e3e" : undefined }}
                placeholder="e.g. story time"
                value={newName}
                onChange={(e) => { setNewName(e.target.value); if (nameError) setNameError(false); }}
                maxLength={30}
                data-testid="input-activity-title"
              />
              {nameError && (
                <p className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#e53e3e] text-[13px] font-normal m-0 mt-[-2px]">Enter a activity title</p>
              )}
            </div>

            {/* Description field */}
            <div className="flex flex-col gap-[6px]">
              <label className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#41444b] text-[14px] leading-[normal] tracking-[0.3px]">icon discription</label>
              <input
                className={inputClass}
                style={{ borderColor: descError ? "#e53e3e" : undefined }}
                placeholder="e.g. reading books together"
                value={newDescription}
                onChange={(e) => { setNewDescription(e.target.value); if (descError) setDescError(false); }}
                maxLength={60}
                data-testid="input-activity-description"
              />
              {descError && (
                <p className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#e53e3e] text-[13px] font-normal m-0 mt-[-2px]">Enter a icon discription</p>
              )}
            </div>

            {/* CTA */}
            <button
              className="w-full h-[44px] rounded-[50px] flex items-center justify-center cursor-pointer mt-[4px] bg-white border border-[#f0f0f0] shadow-[0px_0px_4px_0px_rgba(0,0,0,0.06)] disabled:opacity-70"
              onClick={handleAddActivity}
              disabled={isGenerating}
              data-testid="button-create-activity"
            >
              {isGenerating ? (
                <span className="flex items-center gap-[8px]">
                  <svg className="animate-spin" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="10" cy="10" r="8" stroke="rgba(62,152,58,0.3)" strokeWidth="2.5"/>
                    <path d="M10 2a8 8 0 0 1 8 8" stroke="#3e983a" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                  <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#3e983a] text-[18px] font-semibold leading-[normal]">Creating…</span>
                </span>
              ) : (
                <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#3e983a] text-[24px] font-semibold leading-[normal]">
                  Add Activity
                </span>
              )}
            </button>
          </div>
        </div>
      )}
      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.25)" }}
          onClick={() => { setDeleteTarget(null); setEditingLabel(null); }}
        >
          <div
            className="relative flex flex-col gap-[20px] rounded-[20px] bg-white mx-[24px] w-full max-w-[310px] p-[28px]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Heading */}
            <div className="flex items-center justify-between">
              <span
                className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[#1B5C68] text-[20px] leading-[normal]"
              >
                delete activity
              </span>
              <button
                className="bg-transparent border-none cursor-pointer p-0 flex items-center justify-center opacity-60 hover:opacity-100"
                style={{ width: 20, height: 20 }}
                onClick={() => { setDeleteTarget(null); setEditingLabel(null); }}
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 5L5 15M5 5L15 15" stroke="#117182" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Message */}
            <p
              className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#7a3428] text-[15px] leading-[1.4] m-0"
            >
              Are you sure you want to delete{" "}
              <span className="font-semibold">"{deleteTarget}"</span>? This
              cannot be undone.
            </p>

            {/* Actions */}
            <div className="flex gap-[10px]">
              <button
                className="flex-1 h-[44px] rounded-[100px] flex items-center justify-center border border-[#e0d9cc] bg-transparent cursor-pointer"
                onClick={() => { setDeleteTarget(null); setEditingLabel(null); }}
              >
                <span
                  className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[#1B5C68] text-[16px]"
                >
                  cancel
                </span>
              </button>
              <button
                className="flex-1 h-[44px] rounded-[100px] flex items-center justify-center border-none cursor-pointer"
                style={{ background: "linear-gradient(135deg, #5CD1E6 0%, #42ACBF 50%, #288899 100%)" }}
                onClick={handleDeleteConfirm}
                data-testid="button-confirm-delete"
              >
                <span
                  className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-white text-[16px]"
                >
                  delete
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col items-center w-full flex-shrink-0 pt-[32px]">
        <img
          src={logoSrc}
          alt="Ms. Sunshine"
          data-testid="img-home-logo"
          className="w-[210px] h-auto object-contain"
        />
        <div className="flex w-full items-baseline justify-between px-[24px] mt-[18px]">
          <div className="flex items-baseline gap-[12px]">
            {preSelectedChildId && (
              <button
                data-testid="button-back"
                onClick={() => {
                  setPreSelectedChild(null, null);
                  setLocation(`/school/${preSelectedChildId}`);
                }}
                className="flex items-center justify-center w-[40px] h-[40px] rounded-full bg-white border-none cursor-pointer p-0 flex-shrink-0 shadow-[0px_1px_3px_rgba(0,0,0,0.08)] self-center"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M9 15L4 10L9 5" stroke="#41444B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="4" y1="10" x2="16" y2="10" stroke="#41444B" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            )}
            <div className="flex items-baseline gap-[8px]">
              <span
                data-testid="text-page-title"
                className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[32px] tracking-[-0.50px] leading-[normal] whitespace-nowrap text-[#7a3428]"
              >
                activities
              </span>
              {preSelectedChildId && preSelectedChildName && (
                <span
                  data-testid="text-page-subtitle"
                  className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#1B5C68] text-[16px] leading-[normal] whitespace-nowrap"
                >
                  for {preSelectedChildName.split(" ")[0]}
                </span>
              )}
            </div>
          </div>

          <button
            data-testid="button-page-action"
            onClick={() => setShowDialog(true)}
            className="bg-transparent border-none cursor-pointer p-0"
          >
            <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[#3e983a] text-[16px] leading-[18px] whitespace-nowrap">
              + add an activity
            </span>
          </button>
        </div>
      </div>

      {/* Activity grid */}
      <div
        className="grid grid-cols-3 justify-items-center w-full px-[24px] flex-1 gap-[16px] content-start overflow-y-auto mt-[18px] pb-[139px]"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-delete-btn]")) return;
          setEditingLabel(null);
        }}
      >
        {activityItems.map((item) => {
          const isEditing = editingLabel === item.label;
          return (
            <button
              key={item.label}
              data-testid={`button-activity-${item.label.replace(/\s+/g, "-")}`}
              className="relative w-full aspect-square bg-white rounded-[16px] drop-shadow-[0px_0px_2px_rgba(0,0,0,0.06)] flex flex-col items-center justify-end gap-[4px] pb-[14px] cursor-pointer select-none border-none p-0"
              onMouseDown={() => startLongPress(item.label)}
              onMouseUp={cancelLongPress}
              onMouseLeave={cancelLongPress}
              onTouchStart={() => startLongPress(item.label)}
              onTouchEnd={cancelLongPress}
              onTouchMove={cancelLongPress}
              onClick={async (e) => {
                e.stopPropagation();
                if (isEditing) return;
                setActivityType(item.label);

                if (preSelectedChildId && preSelectedChildName) {
                  const childId = preSelectedChildId;
                  const childName = preSelectedChildName;
                  const firstName = childName.split(" ")[0];
                  setSelectedChildren([childName]);
                  setSelectedChildIds([childId]);
                  setPreSelectedChild(null, null);

                  const timeStr = formatTime(new Date());
                  setActivityTime(timeStr);

                  if (item.label === "check in" || item.label === "checkout") {
                    const summaryText = item.label === "check in"
                      ? `${firstName} checked in.`
                      : `${firstName} checked out.`;
                    try {
                      const res = await apiRequest("POST", "/api/activities", {
                        childIds: [childId],
                        text: summaryText,
                        time: timeStr,
                      });
                      const created = await res.json();
                      setCreatedActivityIds(created.map((a: { id: string }) => a.id));
                      queryClient.invalidateQueries({ queryKey: ["/api/activities", childId] });
                    } catch (err) {
                      console.error("Failed to save activity:", err);
                    }
                    setLocation("/success");
                  } else if (item.label === "meals") {
                    setLocation("/select-items");
                  } else {
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
                    const verb = labelMap[item.label] || `did ${item.label}`;
                    const summaryText = `${firstName} ${verb}.`;
                    try {
                      const res = await apiRequest("POST", "/api/activities", {
                        childIds: [childId],
                        text: summaryText,
                        time: timeStr,
                      });
                      const created = await res.json();
                      setCreatedActivityIds(created.map((a: { id: string }) => a.id));
                      queryClient.invalidateQueries({ queryKey: ["/api/activities", childId] });
                    } catch (err) {
                      console.error("Failed to save activity:", err);
                    }
                    setLocation("/add-note");
                  }
                } else {
                  setLocation("/select-children");
                }
              }}
            >
              {/* Icon */}
              {item.iconBox && item.iconImg ? (
                <div className={`${item.iconBox} relative shrink-0 max-w-full`}>
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <img alt={item.alt} className={item.iconImg} src={item.src} />
                  </div>
                </div>
              ) : (
                <div className="h-[52px] w-[84px] max-w-full flex items-center justify-center flex-shrink-0 px-[4px]">
                  {item.src ? (
                    <img
                      className="max-h-full max-w-full object-contain"
                      alt={item.alt}
                      src={item.src}
                    />
                  ) : (
                    <span className="text-[36px]">✦</span>
                  )}
                </div>
              )}
              {/* Label */}
              <p className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[#41444b] text-[14px] text-center leading-tight m-0 px-[4px] max-w-full">
                {item.label}
              </p>
              {/* Delete badge — shown on long press */}
              {isEditing && (
                <span
                  data-delete-btn="true"
                  role="button"
                  tabIndex={0}
                  className="absolute bottom-[8px] right-[8px] w-[22px] h-[22px] rounded-full flex items-center justify-center cursor-pointer z-20 shadow-[0px_1px_4px_rgba(0,0,0,0.25)] bg-[#117182]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(item.label);
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1 1L9 9M9 1L1 9" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <BottomNav active="activities" />
    </div>
  );
};
