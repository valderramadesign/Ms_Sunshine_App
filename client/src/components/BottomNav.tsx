import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

type BottomNavProps = {
  active: "activities" | "school";
};

export default function BottomNav({ active }: BottomNavProps) {
  const [, setLocation] = useLocation();
  const { role } = useAuth();
  const showSchoolTab = role !== "teacher";

  return (
    <div
      className="absolute bottom-0 left-0 w-full z-20 pointer-events-none"
      style={{ height: 113 }}
      data-testid="bottom-nav"
    >
      {/* Opaque white background with upward shadow; area above it stays transparent */}
      <div className="absolute bottom-0 left-0 w-full h-[80px] bg-white shadow-[0px_-4px_6px_0px_rgba(0,0,0,0.05)]" />

      {/* Icon row — icons sit at bottom, peeking above the white bar */}
      <div className="absolute bottom-0 left-0 w-full flex justify-center items-end gap-[65px] pb-[33px] z-10 pointer-events-auto">

        {/* Activities tab */}
        <button
          data-testid="nav-activities"
          className="flex flex-col items-center gap-[6px] bg-transparent border-none cursor-pointer p-0 shrink-0"
          onClick={() => setLocation("/home")}
        >
          <div className="relative shrink-0">
            <div className="h-[49px] w-[52px] relative overflow-hidden translate-y-[2px]">
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <img
                  alt="Activities"
                  className="absolute max-w-none h-[141.05%] w-[124.88%] top-[-14.19%] left-[-11.22%]"
                  src="/figmaAssets/home-sun.png"
                />
              </div>
            </div>
            {active === "activities" && (
              <img
                src="/figmaAssets/home-checkmark.png"
                alt=""
                className="absolute w-[26px] h-[26px] object-contain pointer-events-none"
                style={{ top: -6, left: -15 }}
              />
            )}
          </div>
          <p className={`[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[14px] text-center leading-[normal] tracking-[0] shrink-0 m-0 ${active === "activities" ? "text-[#41444b]" : "text-[#3e983a]"}`}>
            activities
          </p>
        </button>

        {/* School tab — hidden for teachers who have no school management view */}
        {showSchoolTab && <button
          data-testid="nav-school"
          className="flex flex-col items-center gap-[6px] bg-transparent border-none cursor-pointer p-0 shrink-0"
          onClick={() => setLocation("/school")}
        >
          <div className="relative shrink-0">
            <div className="h-[60px] w-[83px] relative overflow-hidden">
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <img
                  alt="School"
                  className="absolute max-w-none h-[128.61%] w-[140.02%] top-[-9.17%] left-[-19.2%]"
                  src="/figmaAssets/home-school.png"
                />
              </div>
            </div>
            {active === "school" && (
              <img
                src="/figmaAssets/home-checkmark.png"
                alt=""
                className="absolute w-[26px] h-[26px] object-contain pointer-events-none"
                style={{ top: -6, right: -6 }}
              />
            )}
          </div>
          <p className={`[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[14px] text-center leading-[normal] tracking-[0] shrink-0 m-0 ${active === "school" ? "text-[#41444b]" : "text-[#3e983a]"}`}>
            school
          </p>
        </button>}

      </div>
    </div>
  );
}
