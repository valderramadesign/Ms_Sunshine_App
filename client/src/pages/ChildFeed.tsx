import { useState, useRef, useEffect, Fragment } from "react";
import { createPortal } from "react-dom";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useActivity } from "@/lib/activityStore";
import { useSchoolLogo } from "@/lib/useSchoolLogo";
import { useAuth } from "@/lib/auth";


import editIcon from "@assets/edit-icon-new.png";
import commentIcon from "@assets/comment-icon-new.png";
import likeIcon from "@assets/heart-icon-new.png";
import likeIconEmpty from "@assets/heart-nocolor-icon-new.png";


type Comment = {
  id: string;
  text: string;
  time: string;
};

type FeedEntry = {
  id: string;
  type: "text" | "photo";
  text: string;
  time: string;
  date?: string;
  photo?: string;
  photos?: string[];
  note?: string;
  comments: Comment[];
  liked: boolean;
};

function getDateStr(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const glassCard = "bg-[#ffffff1a] border border-solid border-white shadow-[0px_0px_4px_#0000000f,inset_0_1px_0_rgba(255,255,255,0.40),inset_1px_0_0_rgba(255,255,255,0.32),inset_0_-1px_1px_rgba(0,0,0,0.13),inset_-1px_0_1px_rgba(0,0,0,0.11)] backdrop-blur-[2.0px] backdrop-brightness-[110%] [-webkit-backdrop-filter:blur(2.0px)_brightness(110%)]";


function EditIcon() {
  return (
    <div className="relative size-[28px]">
      <img alt="Edit" className="block w-full h-full object-contain" src={editIcon} />
    </div>
  );
}

function CommentIcon() {
  return (
    <div className="relative size-[28px]">
      <img alt="Comment" className="block w-full h-full object-contain" src={commentIcon} />
    </div>
  );
}

function LikeIcon({ liked }: { liked: boolean }) {
  return (
    <div className="relative size-[26px]">
      <img
        alt="Like"
        className="block w-full h-full object-contain transition-all duration-200"
        src={liked ? likeIcon : likeIconEmpty}
        style={undefined}
      />
    </div>
  );
}

function EditMenu({
  entry,
  onClose,
  onEditText,
  onEditTime,
  onAddImage,
  onDeleteImage,
  anchorRef,
}: {
  entry: FeedEntry;
  onClose: () => void;
  onEditText: () => void;
  onEditTime: () => void;
  onAddImage: () => void;
  onDeleteImage: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.top - 8, left: rect.right - 180 });
    }
  }, [anchorRef]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleScroll() {
      onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("scroll", handleScroll, true);
    document.addEventListener("touchmove", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("scroll", handleScroll, true);
      document.removeEventListener("touchmove", handleScroll, true);
    };
  }, [onClose]);

  if (!pos) return null;

  return createPortal(
    <div
      ref={menuRef}
      className={`fixed rounded-[12px] ${glassCard}`}
      style={{ padding: "6px 0", minWidth: 180, background: "rgba(255,252,242,0.95)", top: pos.top, left: pos.left, transform: "translateY(-100%)", zIndex: 99999 }}
    >
      <button
        data-testid="btn-edit-text"
        className="w-full text-left px-[16px] py-[10px] bg-transparent border-none cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#41444b] text-[15px] hover:bg-[#00000008]"
        onClick={() => { onEditText(); onClose(); }}
      >
        Edit text
      </button>
      <button
        data-testid="btn-edit-time"
        className="w-full text-left px-[16px] py-[10px] bg-transparent border-none cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#41444b] text-[15px] hover:bg-[#00000008]"
        onClick={() => { onEditTime(); onClose(); }}
      >
        Edit time
      </button>
      <button
        data-testid="btn-add-image"
        className="w-full text-left px-[16px] py-[10px] bg-transparent border-none cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#41444b] text-[15px] hover:bg-[#00000008]"
        onClick={() => { onAddImage(); onClose(); }}
      >
        Add image
      </button>
      {entry.type === "photo" && (
        <button
          data-testid="btn-delete-image"
          className="w-full text-left px-[16px] py-[10px] bg-transparent border-none cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#c0392b] text-[15px] hover:bg-[#00000008]"
          onClick={() => { onDeleteImage(); onClose(); }}
        >
          Delete image
        </button>
      )}
    </div>,
    document.body
  );
}

function EditTextOverlay({
  text,
  onSave,
  onCancel,
}: {
  text: string;
  onSave: (newText: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(text);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className={`w-full max-w-[340px] mx-[24px] rounded-[16px] p-[20px] flex flex-col gap-[16px] ${glassCard}`} style={{ background: "#f5f5f5" }}>
        <p className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[#7a3428] text-[20px] m-0">Edit text</p>
        <textarea
          data-testid="input-edit-text"
          className="w-full rounded-[10px] border border-solid border-[#d9d9d9] p-[12px] [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#41444b] text-[16px] resize-none outline-none focus:border-[#288899]"
          rows={4}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="flex gap-[12px] justify-end">
          <button
            data-testid="btn-cancel-edit"
            className="px-[20px] py-[10px] rounded-[10px] border border-solid border-[#d9d9d9] bg-white cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#41444b] text-[15px]"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            data-testid="btn-save-edit"
            className="px-[20px] py-[10px] rounded-[10px] border-none cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-white text-[15px]"
            style={{ background: "linear-gradient(135deg, #5CD1E6 0%, #42ACBF 50%, #288899 100%)" }}
            onClick={() => onSave(value)}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function EditTimeOverlay({
  time,
  onSave,
  onCancel,
}: {
  time: string;
  onSave: (newTime: string) => void;
  onCancel: () => void;
}) {
  const parseToInput = (t: string) => {
    const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return "12:00";
    let h = parseInt(m[1]);
    const min = m[2];
    const ampm = m[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${h.toString().padStart(2, "0")}:${min}`;
  };

  const formatToDisplay = (val: string) => {
    const [hStr, mStr] = val.split(":");
    let h = parseInt(hStr);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${mStr} ${ampm}`;
  };

  const [value, setValue] = useState(parseToInput(time));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className={`w-full max-w-[340px] mx-[24px] rounded-[16px] p-[20px] flex flex-col gap-[16px] ${glassCard}`} style={{ background: "#f5f5f5" }}>
        <p className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[#7a3428] text-[20px] m-0">Edit time</p>
        <input
          data-testid="input-edit-time"
          type="time"
          className="w-full rounded-[10px] border border-solid border-[#d9d9d9] p-[12px] [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#41444b] text-[16px] outline-none focus:border-[#288899]"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="flex gap-[12px] justify-end">
          <button
            data-testid="btn-cancel-edit-time"
            className="px-[20px] py-[10px] rounded-[10px] border border-solid border-[#d9d9d9] bg-white cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#41444b] text-[15px]"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            data-testid="btn-save-edit-time"
            className="px-[20px] py-[10px] rounded-[10px] border-none cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-white text-[15px]"
            style={{ background: "linear-gradient(135deg, #5CD1E6 0%, #42ACBF 50%, #288899 100%)" }}
            onClick={() => onSave(formatToDisplay(value))}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryDialog({
  dateLabel,
  isParent,
  summaryLoading,
  summaryText,
  setSummaryText,
  onClose,
  onSave,
  glassCard,
}: {
  dateLabel: string;
  isParent: boolean;
  summaryLoading: boolean;
  summaryText: string;
  setSummaryText: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
  glassCard: string;
}) {
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [viewportOffsetTop, setViewportOffsetTop] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      setViewportHeight(vv.height);
      setViewportOffsetTop(vv.offsetTop);
    };
    onResize();
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, []);

  const keyboardOpen = viewportHeight < window.innerHeight * 0.75;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: "rgba(0,0,0,0.4)",
        ...(keyboardOpen ? { alignItems: "flex-end" } : {}),
      }}
    >
      <div
        className={`w-full max-w-[370px] mx-[24px] rounded-[16px] p-[24px] flex flex-col gap-[16px] ${glassCard}`}
        style={{
          background: "#f5f5f5",
          maxHeight: keyboardOpen ? `${viewportHeight - 16}px` : "calc(100dvh - 48px)",
          ...(keyboardOpen ? { marginBottom: `${window.innerHeight - viewportHeight - viewportOffsetTop}px` } : {}),
          transition: "max-height 0.15s ease, margin-bottom 0.15s ease",
        }}
      >
        <p className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[18px] m-0 text-[#7A3428] flex-shrink-0">
          end of day summary {dateLabel}
        </p>
        {summaryLoading ? (
          <div className="flex items-center justify-center py-[36px]">
            <div className="w-[24px] h-[24px] border-[3px] border-[#e0d9cc] border-t-[#1b5c68] rounded-full animate-spin" />
          </div>
        ) : isParent ? (
          <div
            className="w-full rounded-[10px] border border-solid border-[#d9d9d9] p-[12px] [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#41444b] text-[15px] leading-[21px] whitespace-pre-wrap overflow-y-auto flex-1 min-h-0"
            style={{ minHeight: 120 }}
          >
            {summaryText}
          </div>
        ) : (
          <textarea
            data-testid="input-summary-text"
            className="w-full rounded-[10px] border border-solid border-[#d9d9d9] p-[12px] [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#41444b] text-[15px] leading-[21px] resize-none outline-none focus:border-[#288899] flex-1 min-h-0"
            style={{ minHeight: keyboardOpen ? 120 : 360 }}
            value={summaryText}
            onChange={(e) => setSummaryText(e.target.value)}
          />
        )}
        <div className="flex gap-[12px] justify-end flex-shrink-0">
          {isParent ? (
            <button
              data-testid="btn-close-summary"
              className="px-[20px] py-[10px] rounded-[10px] border-none cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-white text-[15px]"
              style={{ background: "linear-gradient(135deg, #5CD1E6 0%, #42ACBF 50%, #288899 100%)" }}
              onClick={onClose}
            >
              Close
            </button>
          ) : (
            <>
              <button
                data-testid="btn-cancel-summary"
                className="px-[20px] py-[10px] rounded-[10px] border border-solid border-[#d9d9d9] bg-white cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#41444b] text-[15px]"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                data-testid="btn-save-summary"
                className="px-[20px] py-[10px] rounded-[10px] border-none cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-white text-[15px]"
                style={{ background: "linear-gradient(135deg, #5CD1E6 0%, #42ACBF 50%, #288899 100%)" }}
                onClick={onSave}
                disabled={summaryLoading}
              >
                Save
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Controls({
  entry,
  onEditText,
  onEditTime,
  onAddImage,
  onDeleteImage,
  onToggleComment,
  onToggleLike,
  hideEdit,
}: {
  entry: FeedEntry;
  onEditText: () => void;
  onEditTime: () => void;
  onAddImage: () => void;
  onDeleteImage: () => void;
  onToggleComment: () => void;
  onToggleLike: () => void;
  hideEdit?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const editBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex gap-[13px] items-center relative">
      {!hideEdit && (
        <button
          ref={editBtnRef}
          data-testid={`btn-edit-${entry.id}`}
          className="bg-transparent border-none cursor-pointer p-0"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <EditIcon />
        </button>
      )}
      <button
        data-testid={`btn-comment-${entry.id}`}
        className="bg-transparent border-none cursor-pointer p-0"
        onClick={onToggleComment}
      >
        <CommentIcon />
      </button>
      <button
        data-testid={`btn-like-${entry.id}`}
        className="bg-transparent border-none cursor-pointer p-0"
        onClick={onToggleLike}
      >
        <LikeIcon liked={entry.liked} />
      </button>

      {!hideEdit && menuOpen && (
        <EditMenu
          entry={entry}
          onClose={() => setMenuOpen(false)}
          onEditText={onEditText}
          onEditTime={onEditTime}
          onAddImage={onAddImage}
          onDeleteImage={onDeleteImage}
          anchorRef={editBtnRef}
        />
      )}
    </div>
  );
}

export const ChildFeed = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const logoSrc = useSchoolLogo();
  const params = useParams<{ childId: string }>();
  const { role } = useAuth();

  const { data: childData } = useQuery<{ firstName: string; lastName: string; photo: string } | null>({
    queryKey: ["/api/children", params.childId],
    staleTime: 60_000,
  });
  const child = childData
    ? { firstName: childData.firstName, photo: childData.photo || "" }
    : { firstName: "", photo: "" };
  const isParent = role === "parent";
  const { setPreSelectedChild } = useActivity();

  const { data: dbActivities } = useQuery<{ id: string; text: string; time: string; note: string; photo: string; createdAt: string }[]>({
    queryKey: ["/api/activities", params.childId],
    staleTime: 0,
  });

  const activityIds = (dbActivities || []).map((a) => a.id);

  const { data: dbCommentsRaw } = useQuery<Record<string, { id: string; text: string; time: string; role: string }[]>>({
    queryKey: ["/api/comments-bulk", params.childId],
    queryFn: async () => {
      if (activityIds.length === 0) return {};
      const results: Record<string, { id: string; text: string; time: string; role: string }[]> = {};
      await Promise.all(activityIds.map(async (aid) => {
        const res = await fetch(`/api/comments/${aid}`);
        if (res.ok) results[aid] = await res.json();
      }));
      return results;
    },
    enabled: activityIds.length > 0,
    staleTime: 0,
  });

  const currentRole = isParent ? "parent" : "teacher";
  const { data: dbLikesRaw } = useQuery<Record<string, boolean>>({
    queryKey: ["/api/likes-bulk", params.childId],
    queryFn: async () => {
      if (activityIds.length === 0) return {};
      const results: Record<string, boolean> = {};
      await Promise.all(activityIds.map(async (aid) => {
        const res = await fetch(`/api/likes/${aid}`);
        if (res.ok) {
          const likes: { mine: boolean }[] = await res.json();
          results[aid] = likes.some((l) => l.mine);
        }
      }));
      return results;
    },
    enabled: activityIds.length > 0,
    staleTime: 0,
  });

  const dbEntries: FeedEntry[] = (dbActivities || []).map((a) => {
    let photosList: string[] = [];
    if (a.photo) {
      try {
        const parsed = JSON.parse(a.photo);
        if (Array.isArray(parsed)) photosList = parsed;
        else photosList = [a.photo];
      } catch {
        photosList = [a.photo];
      }
    }
    const dbComments = (dbCommentsRaw?.[a.id] || []).map((c) => ({ id: c.id, text: c.text, time: c.time }));
    return {
      id: `db-${a.id}`,
      type: photosList.length > 0 ? "photo" as const : "text" as const,
      photo: photosList[0] || undefined,
      photos: photosList.length > 0 ? photosList : undefined,
      text: a.text,
      time: a.time,
      date: a.createdAt ? a.createdAt.slice(0, 10) : getDateStr(0),
      note: a.note || "",
      comments: dbComments,
      liked: dbLikesRaw?.[a.id] ?? false,
    };
  });

  const [localFeed, setLocalFeed] = useState<FeedEntry[]>([]);
  const [overlayComments, setOverlayComments] = useState<Record<string, Comment[]>>({});
  const [overlayLikes, setOverlayLikes] = useState<Record<string, boolean>>({});
  const rawFeed = [...dbEntries, ...localFeed];
  const feed = rawFeed.map((e) => ({
    ...e,
    comments: overlayComments[e.id] ?? e.comments,
    liked: overlayLikes[e.id] ?? e.liked,
  }));
  const setFeed = setLocalFeed;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [addImageTargetId, setAddImageTargetId] = useState<string | null>(null);
  const [summaryDialog, setSummaryDialog] = useState<{ date: string; dateLabel: string } | null>(null);
  const [summaryText, setSummaryText] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [savedSummaries, setSavedSummaries] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null);

  async function openSummary(date: string, dateLabel: string) {
    if (savedSummaries[date]) {
      setSummaryText(savedSummaries[date]);
      setSummaryDialog({ date, dateLabel });
      return;
    }
    setSummaryDialog({ date, dateLabel });
    setSummaryLoading(true);
    setSummaryText("");
    const dayEntries = feed.filter((e) => e.date === date);
    try {
      const res = await fetch("/api/summarize-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childName: child.firstName,
          activities: dayEntries.map((e) => ({ text: e.text, note: e.note })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSummaryText(data.summary);
      } else {
        setSummaryText("Could not generate summary. Please try again.");
      }
    } catch {
      setSummaryText("Could not generate summary. Please try again.");
    }
    setSummaryLoading(false);
  }

  function saveSummary() {
    if (summaryDialog) {
      setSavedSummaries((prev) => ({ ...prev, [summaryDialog.date]: summaryText }));
    }
    setSummaryDialog(null);
  }
  const [commentingId, setCommentingId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [tappedComment, setTappedComment] = useState<{ entryId: string; commentId: string } | null>(null);
  const [editingComment, setEditingComment] = useState<{ entryId: string; commentId: string; text: string } | null>(null);
  const [longPressedId, setLongPressedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editingEntry = editingId ? feed.find((e) => e.id === editingId) : null;
  const editingTimeEntry = editingTimeId ? feed.find((e) => e.id === editingTimeId) : null;

  function handleSaveText(id: string, newText: string) {
    if (id.startsWith("db-")) {
      const dbId = id.replace("db-", "");
      apiRequest("PATCH", `/api/activities/${dbId}/text`, { text: newText })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/activities", params.childId] });
        })
        .catch((err) => {
          // Offline: toast already shown by apiRequest. Other errors: log only.
          console.error("Failed to update text:", err);
        });
    }
    setFeed((prev) => prev.map((e) => (e.id === id ? { ...e, text: newText } : e)));
    setEditingId(null);
  }

  async function handleSaveTime(id: string, newTime: string) {
    if (id.startsWith("db-")) {
      const dbId = id.replace("db-", "");
      try {
        await apiRequest("PATCH", `/api/activities/${dbId}/time`, { time: newTime });
        queryClient.invalidateQueries({ queryKey: ["/api/activities", params.childId] });
      } catch (err) {
        console.error("Failed to update time:", err);
      }
    }
    setFeed((prev) => prev.map((e) => (e.id === id ? { ...e, time: newTime } : e)));
    setEditingTimeId(null);
  }

  function handleAddImage(id: string) {
    setAddImageTargetId(id);
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !addImageTargetId) return;

    if (addImageTargetId.startsWith("db-")) {
      const dbId = addImageTargetId.replace("db-", "");
      try {
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result as string;
          await apiRequest("PATCH", `/api/activities/${dbId}/photo`, { photo: dataUrl });
          queryClient.invalidateQueries({ queryKey: ["/api/activities", params.childId] });
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error("Failed to upload image:", err);
      }
    } else {
      const url = URL.createObjectURL(file);
      setFeed((prev) =>
        prev.map((entry) =>
          entry.id === addImageTargetId ? { ...entry, type: "photo" as const, photo: url } : entry
        )
      );
    }
    setAddImageTargetId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDeleteImage(id: string) {
    if (id.startsWith("db-")) {
      const dbId = id.replace("db-", "");
      try {
        await apiRequest("PATCH", `/api/activities/${dbId}/photo`, { photo: "" });
        queryClient.invalidateQueries({ queryKey: ["/api/activities", params.childId] });
      } catch (err) {
        console.error("Failed to delete image:", err);
      }
    } else {
      setFeed((prev) =>
        prev.map((entry) =>
          entry.id === id ? { ...entry, type: "text" as const, photo: undefined } : entry
        )
      );
    }
  }

  async function handleSubmitComment(id: string) {
    if (!commentText.trim()) return;
    const now = new Date();
    const hours = now.getHours();
    const mins = now.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const timeStr = `${hours % 12 || 12}:${mins} ${ampm}`;
    const role = isParent ? "parent" : "teacher";

    if (id.startsWith("db-")) {
      const dbId = id.replace("db-", "");
      try {
        await apiRequest("POST", "/api/comments", { activityId: dbId, text: commentText.trim(), time: timeStr, role });
        queryClient.invalidateQueries({ queryKey: ["/api/comments-bulk", params.childId] });
      } catch (err) {
        console.error("Failed to save comment:", err);
      }
    } else {
      const newComment: Comment = { id: `c-${Date.now()}`, text: commentText.trim(), time: timeStr };
      const existing = overlayComments[id] ?? feed.find((e) => e.id === id)?.comments ?? [];
      setOverlayComments((prev) => ({ ...prev, [id]: [...existing, newComment] }));
    }
    setCommentText("");
    setCommentingId(null);
  }

  function startLongPress(entryId: string) {
    longPressTimer.current = setTimeout(() => {
      setLongPressedId(entryId);
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  async function handleDeleteEntry(id: string) {
    if (id.startsWith("db-")) {
      const dbId = id.replace("db-", "");
      try {
        await apiRequest("DELETE", `/api/activities/${dbId}`);
        queryClient.invalidateQueries({ queryKey: ["/api/activities", params.childId] });
      } catch (err) {
        console.error("Failed to delete activity:", err);
      }
    } else {
      setFeed((prev) => prev.filter((e) => e.id !== id));
    }
    setDeleteConfirmId(null);
    setLongPressedId(null);
  }

  async function handleDeleteComment(entryId: string, commentId: string) {
    if (entryId.startsWith("db-")) {
      try {
        await apiRequest("DELETE", `/api/comments/${commentId}`);
        queryClient.invalidateQueries({ queryKey: ["/api/comments-bulk", params.childId] });
      } catch (err) {
        console.error("Failed to delete comment:", err);
      }
    } else {
      const current = overlayComments[entryId] ?? feed.find((e) => e.id === entryId)?.comments ?? [];
      setOverlayComments((prev) => ({ ...prev, [entryId]: current.filter((c) => c.id !== commentId) }));
    }
    setTappedComment(null);
  }

  async function handleSaveComment(entryId: string, commentId: string, newText: string) {
    if (!newText.trim()) return;
    if (entryId.startsWith("db-")) {
      try {
        await apiRequest("PATCH", `/api/comments/${commentId}`, { text: newText.trim() });
        queryClient.invalidateQueries({ queryKey: ["/api/comments-bulk", params.childId] });
      } catch (err) {
        console.error("Failed to update comment:", err);
      }
    } else {
      const current = overlayComments[entryId] ?? feed.find((e) => e.id === entryId)?.comments ?? [];
      setOverlayComments((prev) => ({ ...prev, [entryId]: current.map((c) => c.id === commentId ? { ...c, text: newText.trim() } : c) }));
    }
    setEditingComment(null);
  }

  return (
    <div className="flex flex-col h-dvh items-center relative overflow-hidden bg-[#f5f5f5]">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className={`w-full max-w-[320px] mx-[24px] rounded-[16px] p-[20px] flex flex-col gap-[16px] items-center ${glassCard}`} style={{ background: "#f5f5f5" }}>
            <p className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[#7a3428] text-[18px] m-0 text-center">
              Are you sure you want to delete this activity?
            </p>
            <p className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#41444b] text-[14px] m-0 text-center opacity-60">
              This action cannot be undone.
            </p>
            <div className="flex gap-[12px] w-full">
              <button
                data-testid="btn-cancel-delete-entry"
                className="flex-1 px-[16px] py-[10px] rounded-[10px] border border-solid border-[#d9d9d9] bg-white cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#41444b] text-[15px]"
                onClick={() => { setDeleteConfirmId(null); setLongPressedId(null); }}
              >
                Cancel
              </button>
              <button
                data-testid="btn-confirm-delete-entry"
                className="flex-1 px-[16px] py-[10px] rounded-[10px] border-none cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-white text-[15px]"
                style={{ background: "linear-gradient(135deg, #5CD1E6 0%, #42ACBF 50%, #288899 100%)" }}
                onClick={() => handleDeleteEntry(deleteConfirmId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {editingEntry && (
        <EditTextOverlay
          text={editingEntry.text}
          onSave={(newText) => handleSaveText(editingEntry.id, newText)}
          onCancel={() => setEditingId(null)}
        />
      )}
      {editingTimeEntry && (
        <EditTimeOverlay
          time={editingTimeEntry.time}
          onSave={(newTime) => handleSaveTime(editingTimeEntry.id, newTime)}
          onCancel={() => setEditingTimeId(null)}
        />
      )}
      {summaryDialog && (
        <SummaryDialog
          dateLabel={summaryDialog.dateLabel}
          isParent={isParent}
          summaryLoading={summaryLoading}
          summaryText={summaryText}
          setSummaryText={setSummaryText}
          onClose={() => setSummaryDialog(null)}
          onSave={saveSummary}
          glassCard={glassCard}
        />
      )}
      {lightbox && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setLightbox(null)}
        >
          <button
            data-testid="btn-close-lightbox"
            className="absolute top-[48px] right-[16px] w-[40px] h-[40px] rounded-full bg-white border-none cursor-pointer flex items-center justify-center z-10 shadow-[0px_1px_3px_rgba(0,0,0,0.08)]"
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
          >
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4L12 12" stroke="#288899" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          {lightbox.photos.length > 1 && (
            <>
              <button
                data-testid="btn-lightbox-prev"
                className="absolute left-[8px] top-1/2 -translate-y-1/2 w-[40px] h-[40px] rounded-full bg-white/20 border-none cursor-pointer flex items-center justify-center z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox((prev) => prev ? { ...prev, index: (prev.index - 1 + prev.photos.length) % prev.photos.length } : null);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 3L5 8L10 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                data-testid="btn-lightbox-next"
                className="absolute right-[8px] top-1/2 -translate-y-1/2 w-[40px] h-[40px] rounded-full bg-white/20 border-none cursor-pointer flex items-center justify-center z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox((prev) => prev ? { ...prev, index: (prev.index + 1) % prev.photos.length } : null);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 3L11 8L6 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          )}
          <img
            src={lightbox.photos[lightbox.index]}
            alt={`Photo ${lightbox.index + 1}`}
            className="max-w-[90%] max-h-[80vh] object-contain rounded-[12px]"
            onClick={(e) => e.stopPropagation()}
          />
          {lightbox.photos.length > 1 && (
            <div className="absolute bottom-[40px] left-1/2 -translate-x-1/2 flex gap-[8px]">
              {lightbox.photos.map((_, i) => (
                <div
                  key={i}
                  className={`w-[8px] h-[8px] rounded-full ${i === lightbox.index ? "bg-white" : "bg-white/40"}`}
                  onClick={(e) => { e.stopPropagation(); setLightbox((prev) => prev ? { ...prev, index: i } : null); }}
                />
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col items-center w-full flex-shrink-0 pt-[32px]">
        <img
          src={logoSrc}
          alt="Ms. Sunshine"
          className="w-[210px] h-auto object-contain"
        />
        <div className="flex w-full items-baseline justify-between px-[24px] mt-[18px] mb-[8px]">
          <div className="flex items-baseline gap-[12px]">
            {!isParent && (
              <button
                data-testid="button-back"
                onClick={() => setLocation("/school")}
                className="flex items-center justify-center w-[40px] h-[40px] rounded-full bg-white border-none cursor-pointer p-0 flex-shrink-0 shadow-[0px_1px_3px_rgba(0,0,0,0.08)] self-center"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M9 15L4 10L9 5" stroke="#41444B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="4" y1="10" x2="16" y2="10" stroke="#41444B" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            )}
            <span
              data-testid="text-page-title"
              className={`[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[32px] tracking-[-0.50px] leading-[normal] whitespace-nowrap text-[#7a3428]${!isParent ? " cursor-pointer" : ""}`}
              onClick={!isParent ? () => setLocation(`/school/${params.childId}/details`) : undefined}
            >
              {child.firstName}
            </span>
          </div>
          {!isParent && (
            <button
              data-testid="button-add-to-feed"
              onClick={() => {
                setPreSelectedChild(params.childId, child.firstName || "Child");
                setLocation("/home");
              }}
              className="bg-transparent border-none cursor-pointer p-0"
            >
              <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[#3e983a] text-[16px] leading-[18px] whitespace-nowrap">
                + add to feed
              </span>
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-[19px] items-start w-full px-[24px] mt-[36px] flex-1 overflow-y-auto pb-[26px]">
        {feed.map((entry, idx) => {
          const isCheckout = /check(ed)?\s*out/i.test(entry.text);
          const showDayDivider = isCheckout;
          return (<Fragment key={entry.id}>
          {showDayDivider && (
            <div className="w-full flex items-center gap-[10px] py-[4px]">
              <div className="flex-1 h-[2px]" style={{ backgroundImage: "repeating-linear-gradient(to right, #ADA89E 0px, #ADA89E 4px, transparent 4px, transparent 6px)", backgroundSize: "6px 2px" }} />
              <button
                data-testid={`btn-summary-${entry.date}`}
                className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[13px] text-[#3e983a] whitespace-nowrap tracking-[-0.2px] bg-transparent border-none cursor-pointer p-0"
                onClick={() => openSummary(entry.date!, new Date(entry.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" }).toLowerCase())}
              >
                end of day summary {new Date(entry.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" }).toLowerCase()}
              </button>
              <div className="flex-1 h-[2px]" style={{ backgroundImage: "repeating-linear-gradient(to right, #ADA89E 0px, #ADA89E 4px, transparent 4px, transparent 6px)", backgroundSize: "6px 2px" }} />
            </div>
          )}
          <div
            className={`w-full rounded-[16px] flex flex-col items-start ${glassCard} relative`}
            style={{
              padding: entry.type === "text" ? "8px 16px" : "16px",
            }}
            onMouseDown={isParent ? undefined : () => startLongPress(entry.id)}
            onMouseUp={isParent ? undefined : cancelLongPress}
            onMouseLeave={isParent ? undefined : cancelLongPress}
            onTouchStart={isParent ? undefined : () => startLongPress(entry.id)}
            onTouchEnd={isParent ? undefined : cancelLongPress}
            onTouchCancel={isParent ? undefined : cancelLongPress}
          >
            {!isParent && longPressedId === entry.id && (
              <button
                data-testid={`btn-delete-card-${entry.id}`}
                className="absolute top-[8px] right-[8px] z-10 flex items-center justify-center cursor-pointer bg-[#117182] rounded-full border-none"
                style={{ width: 20, height: 20 }}
                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(entry.id); }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M8 2L2 8M2 2L8 8" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
            {entry.type === "photo" && (entry.photos || entry.photo) && (() => {
              const pics = entry.photos || (entry.photo ? [entry.photo] : []);
              const openLb = (i: number) => setLightbox({ photos: pics, index: i });
              if (pics.length === 1) {
                return (
                  <div className="w-full mb-[16px] rounded-[8px] overflow-hidden bg-[#d9d9d9] cursor-pointer" style={{ height: 322 }} onClick={() => openLb(0)}>
                    <img src={pics[0]} alt="Activity" className="w-full h-full object-cover" />
                  </div>
                );
              }
              if (pics.length === 2) {
                return (
                  <div className="w-full mb-[16px] rounded-[8px] overflow-hidden bg-[#d9d9d9] flex gap-[3px]" style={{ height: 322 }}>
                    <img src={pics[0]} alt="Activity 1" className="w-1/2 h-full object-cover rounded-l-[8px] cursor-pointer" onClick={() => openLb(0)} />
                    <img src={pics[1]} alt="Activity 2" className="w-1/2 h-full object-cover rounded-r-[8px] cursor-pointer" onClick={() => openLb(1)} />
                  </div>
                );
              }
              return (
                <div className="w-full mb-[16px] rounded-[8px] overflow-hidden bg-[#d9d9d9] flex gap-[3px]" style={{ height: 322 }}>
                  <img src={pics[0]} alt="Activity 1" className="w-1/2 h-full object-cover rounded-l-[8px] cursor-pointer" onClick={() => openLb(0)} />
                  <div className="w-1/2 flex flex-col gap-[3px]">
                    <img src={pics[1]} alt="Activity 2" className="w-full h-1/2 object-cover rounded-tr-[8px] cursor-pointer" onClick={() => openLb(1)} />
                    <img src={pics[2]} alt="Activity 3" className="w-full h-1/2 object-cover rounded-br-[8px] cursor-pointer" onClick={() => openLb(2)} />
                  </div>
                </div>
              );
            })()}

            <p
              className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#41444b] tracking-[-0.5px] w-full m-0 font-normal text-[21px] leading-[25px] mt-[8px] mb-[16px]"
              style={{ marginBottom: entry.note ? 8 : 16 }}
            >
              {entry.text}
            </p>

            {entry.note && (
              <p
                className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#41444b] tracking-[-0.3px] w-full m-0 font-normal text-[15px] leading-[20px] italic"
                style={{ marginBottom: 16, opacity: 0.75 }}
              >
                Note: {entry.note}
              </p>
            )}

            <div className="flex items-center justify-between w-full mb-[8px]">
              <p className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#41444b] text-[16px] tracking-[-0.5px] leading-[normal] m-0">
                {entry.time}
              </p>
              <Controls
                entry={entry}
                hideEdit={isParent}
                onEditText={() => setEditingId(entry.id)}
                onEditTime={() => setEditingTimeId(entry.id)}
                onAddImage={() => handleAddImage(entry.id)}
                onDeleteImage={() => handleDeleteImage(entry.id)}
                onToggleComment={() => {
                  setCommentingId(commentingId === entry.id ? null : entry.id);
                  setCommentText("");
                }}
                onToggleLike={async () => {
                  if (entry.id.startsWith("db-")) {
                    const dbId = entry.id.replace("db-", "");
                    try {
                      await apiRequest("POST", "/api/likes/toggle", { activityId: dbId });
                      queryClient.invalidateQueries({ queryKey: ["/api/likes-bulk", params.childId] });
                    } catch (err) {
                      console.error("Failed to toggle like:", err);
                    }
                  } else {
                    setOverlayLikes((prev) => ({ ...prev, [entry.id]: !(prev[entry.id] ?? entry.liked) }));
                  }
                }}
              />
            </div>

            {entry.comments.length > 0 && (
              <div className="w-full flex flex-col gap-[8px] mt-[4px] mb-[4px]">
                {entry.comments.map((c) => {
                  const isTapped = tappedComment?.entryId === entry.id && tappedComment?.commentId === c.id;
                  const isEditing = editingComment?.entryId === entry.id && editingComment?.commentId === c.id;

                  if (isEditing) {
                    return (
                      <div key={c.id} className="flex items-start gap-[8px] pl-[4px]">
                        <div className="w-[3px] rounded-full bg-[#288899] self-stretch flex-shrink-0" />
                        <div className="flex flex-col gap-[6px] flex-1">
                          <input
                            data-testid={`input-edit-comment-${c.id}`}
                            type="text"
                            value={editingComment.text}
                            onChange={(e) => setEditingComment({ ...editingComment, text: e.target.value })}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSaveComment(entry.id, c.id, editingComment.text); if (e.key === "Escape") setEditingComment(null); }}
                            autoFocus
                            className="w-full rounded-[12px] border border-[#e0d9cc] bg-white px-[16px] py-[12px] text-[16px] text-[#41444b] placeholder-[#41444b]/40 outline-none focus:border-[#41444b] [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal"
                          />
                          <div className="flex gap-[8px]">
                            <button
                              data-testid={`btn-save-comment-${c.id}`}
                              className="px-[12px] py-[5px] rounded-[8px] border-none cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-white text-[12px]"
                              style={{ background: "linear-gradient(135deg, #5CD1E6 0%, #42ACBF 50%, #288899 100%)" }}
                              onClick={() => handleSaveComment(entry.id, c.id, editingComment.text)}
                            >
                              Save
                            </button>
                            <button
                              className="px-[12px] py-[5px] rounded-[8px] border border-solid border-[#d9d9d9] bg-white cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#41444b] text-[12px]"
                              onClick={() => setEditingComment(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={c.id} className="flex items-start gap-[8px] pl-[4px] relative">
                      <div className="w-[3px] rounded-full bg-[#288899] self-stretch flex-shrink-0" />
                      <div
                        className="flex flex-col gap-[2px] flex-1 cursor-pointer rounded-[6px] px-[4px] py-[2px] hover:bg-[#00000005]"
                        onClick={() => setTappedComment(isTapped ? null : { entryId: entry.id, commentId: c.id })}
                      >
                        <p className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[15px] leading-[19px] tracking-[-0.3px] m-0 text-[#1B5C68]">
                          {c.text}
                        </p>
                        <p className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#41444b] text-[12px] leading-[16px] tracking-[-0.2px] m-0 opacity-50">
                          {c.time}
                        </p>
                      </div>
                      {isTapped && !isParent && (
                        <div className="flex gap-[6px] items-center flex-shrink-0 self-center">
                          <button
                            data-testid={`btn-edit-comment-${c.id}`}
                            className="px-[10px] py-[4px] rounded-[8px] border border-solid border-[#288899] bg-transparent cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#1B5C68] text-[12px]"
                            onClick={(e) => { e.stopPropagation(); setEditingComment({ entryId: entry.id, commentId: c.id, text: c.text }); setTappedComment(null); }}
                          >
                            Edit
                          </button>
                          <button
                            data-testid={`btn-delete-comment-${c.id}`}
                            className="px-[10px] py-[4px] rounded-[8px] border border-solid border-[#c0392b] bg-transparent cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#c0392b] text-[12px]"
                            onClick={(e) => { e.stopPropagation(); handleDeleteComment(entry.id, c.id); }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {commentingId === entry.id && (
              <div className="w-full flex gap-[8px] items-stretch mt-[8px]">
                <div className="flex-1 relative">
                  <input
                    data-testid={`input-comment-${entry.id}`}
                    type="text"
                    placeholder="Add a comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSubmitComment(entry.id); }}
                    autoFocus
                    className="w-full h-full rounded-[12px] border border-[#e0d9cc] bg-white pl-[16px] pr-[36px] py-[12px] text-[16px] text-[#41444b] placeholder-[#41444b]/40 outline-none focus:border-[#41444b] [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal"
                  />
                  <button
                    data-testid={`btn-cancel-comment-${entry.id}`}
                    className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer bg-[#3e983a] rounded-full border-none"
                    style={{ width: 20, height: 20, right: 8 }}
                    onClick={() => { setCommentingId(null); setCommentText(""); }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M8 2L2 8M2 2L8 8" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <button
                  data-testid={`btn-submit-comment-${entry.id}`}
                  className="px-[16px] rounded-[12px] border border-[#e0d9cc] bg-white cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[#3e983a] text-[15px] flex-shrink-0 flex items-center justify-center"
                  onClick={() => handleSubmitComment(entry.id)}
                >
                  Post
                </button>
              </div>
            )}
          </div>
          </Fragment>);
        })}
      </div>
    </div>
  );
};
