import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import BottomCTA from "@/components/BottomCTA";
import { useActivity } from "@/lib/activityStore";
import { apiRequest, queryClient, isOfflineError } from "@/lib/queryClient";
import { enqueueBatch, type QueuedRequest } from "@/lib/offlineQueue";
import { toast } from "@/hooks/use-toast";
import { useIsMobile, useKeyboardToolbarPosition } from "@/hooks/use-keyboard";
import { useSchoolLogo } from "@/lib/useSchoolLogo";

function getCurrentTime24() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function formatTo12Hour(time24: string) {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export const AddNoteAndPhotos = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const logoSrc = useSchoolLogo();
  const { selectedChildIds, createdActivityIds, setActivityTime } = useActivity();
  const [noteText, setNoteText] = useState("");
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null]);
  const [time, setTime] = useState(getCurrentTime24);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const fileInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const isMobile = useIsMobile();
  const { bottom, keyboardOpen } = useKeyboardToolbarPosition();

  useEffect(() => {
    setActivityTime(formatTo12Hour(time));
  }, []);

  function handleFileSelect(index: number, file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPhotos((prev) => {
        const next = [...prev];
        next[index] = result;
        return next;
      });
    };
    reader.readAsDataURL(file);
  }

  async function handleAddNote() {
    if (createdActivityIds.length > 0) {
      const uploadedPhotos = photos.filter((p): p is string => p !== null);
      const formattedTime = formatTo12Hour(time);

      // Build the full request list upfront so we can queue the entire batch
      // atomically if the device is offline.
      const requests = createdActivityIds.flatMap((actId) => {
        const reqs: QueuedRequest[] = [
          { method: "PATCH", url: `/api/activities/${actId}/time`, body: { time: formattedTime } },
        ];
        if (noteText.trim()) {
          reqs.push({ method: "PATCH", url: `/api/activities/${actId}/note`, body: { note: noteText.trim() } });
        }
        if (uploadedPhotos.length > 0) {
          reqs.push({ method: "PATCH", url: `/api/activities/${actId}/photo`, body: { photo: JSON.stringify(uploadedPhotos) } });
        }
        return reqs;
      });

      try {
        for (const req of requests) {
          await apiRequest(req.method, req.url, req.body);
        }
        for (const cid of selectedChildIds) {
          queryClient.invalidateQueries({ queryKey: ["/api/activities", cid] });
        }
      } catch (err) {
        console.error("Failed to save note/photo:", err);
        if (isOfflineError(err)) {
          // Queue the full batch for automatic replay when connectivity returns.
          // The toast from apiRequest ("You're offline") is already visible; add
          // a secondary line so the user knows their work is safe.
          enqueueBatch({
            batchId: crypto.randomUUID(),
            requests,
            childIds: selectedChildIds,
          });
          toast({
            title: "Note queued",
            description: "We'll save it automatically when you're back online.",
          });
          setLocation("/success");
          return;
        }
        // Non-offline error (server 5xx, timeout, etc.) — keep the user on
        // this page so they can retry.  Don't navigate to /success since
        // nothing was saved.
        toast({
          title: "Couldn't save",
          description: "Something went wrong. Please try again.",
          variant: "destructive",
        });
        return;
      }
    }
    setLocation("/success");
  }

  return (
    <div className="flex flex-col h-dvh items-center relative overflow-hidden bg-[#f5f5f5]">

      {/* Header — Ms.Sunshine logo + title row */}
      <div className="flex flex-col items-center w-full flex-shrink-0 pt-[32px]">
        <img
          src={logoSrc}
          alt="Ms. Sunshine"
          data-testid="img-add-note-logo"
          className="w-[210px] h-auto object-contain"
        />
        <div className="flex w-full items-baseline justify-between px-[24px] mt-[18px] mb-[8px]">
          <div className="flex items-baseline gap-[12px]">
            <button
              data-testid="button-back"
              onClick={() => setLocation("/select-items")}
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
              note
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 w-full px-[24px] mt-[8px] overflow-y-auto ${isMobile && keyboardOpen ? "pb-[70px]" : "pb-[26px]"}`}>
        {/* Time picker */}
        <div className="relative mb-[16px]">
          <input
            ref={timeInputRef}
            type="time"
            value={time}
            onChange={(e) => {
              setTime(e.target.value);
              setActivityTime(formatTo12Hour(e.target.value));
            }}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            data-testid="input-activity-time"
          />
          <button
            type="button"
            onClick={() => timeInputRef.current?.showPicker?.() || timeInputRef.current?.click()}
            className="w-full rounded-[12px] border border-[#e0d9cc] bg-white px-[16px] py-[12px] text-left cursor-pointer flex items-center gap-[8px]"
            data-testid="button-edit-time"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="7.5" stroke="#288899" strokeWidth="1.5"/>
              <path d="M9 5V9L12 11" stroke="#288899" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#41444b] text-[16px] leading-[normal]">
              {formatTo12Hour(time)}
            </span>
          </button>
        </div>

        {/* Note + photos row */}
        <div className="flex gap-[12px]" style={{ height: "calc(100% - 60px)" }}>
          <textarea
            data-testid="input-activity-note"
            placeholder="Write a note about this activity..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            autoFocus
            className="flex-[2] rounded-[12px] border border-[#e0d9cc] bg-white px-[16px] py-[12px] text-[16px] text-[#41444b] placeholder-[#41444b]/40 outline-none focus:border-[#41444b] [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal resize-none"
          />
          <div className="flex-1 flex flex-col gap-[12px]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex-1 relative">
                <input
                  ref={fileInputRefs[i]}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  data-testid={`input-file-photo-${i}`}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(i, file);
                  }}
                />
                {photos[i] ? (
                  <div className="w-full h-full relative rounded-[12px] overflow-hidden">
                    <img
                      src={photos[i]!}
                      alt={`Uploaded photo ${i + 1}`}
                      data-testid={`img-uploaded-photo-${i}`}
                      className="w-full h-full object-cover rounded-[12px]"
                    />
                    <button
                      data-testid={`btn-remove-photo-${i}`}
                      className="absolute top-[4px] right-[4px] w-[22px] h-[22px] rounded-full bg-[#117182] border-none cursor-pointer flex items-center justify-center p-0"
                      onClick={() => {
                        setPhotos((prev) => {
                          const next = [...prev];
                          next[i] = null;
                          return next;
                        });
                        if (fileInputRefs[i].current) fileInputRefs[i].current!.value = "";
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M8 2L2 8M2 2L8 8" stroke="white" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    data-testid={`btn-upload-photo-${i}`}
                    className="w-full h-full rounded-[12px] border border-[#e0d9cc] bg-white flex flex-col items-center justify-center gap-[4px] cursor-pointer p-0"
                    onClick={() => fileInputRefs[i].current?.click()}
                  >
                    <span className="text-[#3e983a] text-[24px] font-light leading-none">+</span>
                    <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#3e983a] text-[13px] leading-[16px] text-center">
                      upload<br />photo
                    </span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile keyboard toolbar — shown above keyboard when keyboard is open */}
      {isMobile && keyboardOpen && (
        <div
          className="fixed left-0 right-0 z-50 flex items-center justify-between px-[16px] bg-[#f0efe9] border-t border-[#d9d3c7]"
          style={{ bottom, height: 44, transition: "bottom 0.1s ease-out" }}
        >
          <button
            data-testid="btn-skip-note"
            className="bg-transparent border-none cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#3e983a] text-[16px] leading-[normal] py-[8px] px-[12px]"
            onClick={() => setLocation("/success")}
          >
            Skip
          </button>
          <button
            data-testid="btn-add-note-submit"
            className="border-none cursor-pointer rounded-[100px] px-[20px] py-[8px] [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-white text-[16px] font-semibold leading-[normal]"
            style={{ background: "linear-gradient(135deg, #5CD1E6 0%, #42ACBF 50%, #288899 100%)" }}
            onClick={handleAddNote}
          >
            Add note
          </button>
        </div>
      )}

      {/* Bottom CTA — shown when keyboard is closed */}
      {(!isMobile || !keyboardOpen) && (
        <BottomCTA>
          <button
            data-testid="btn-add-note-submit"
            className="w-full h-[44px] rounded-[50px] flex items-center justify-center cursor-pointer bg-white border border-[#f0f0f0] shadow-[0px_0px_4px_0px_rgba(0,0,0,0.06)]"
            onClick={handleAddNote}
          >
            <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#3e983a] text-[24px] font-semibold leading-[normal]">
              Add Note
            </span>
          </button>
          <button
            data-testid="btn-skip-note"
            className="bg-transparent border-none cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#3e983a] text-[21px] font-semibold leading-[normal]"
            onClick={() => setLocation("/success")}
          >
            Skip
          </button>
        </BottomCTA>
      )}
    </div>
  );
};
