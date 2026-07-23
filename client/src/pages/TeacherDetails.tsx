import { useState, useRef, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, isOfflineError } from "@/lib/queryClient";
import { useSchoolLogo } from "@/lib/useSchoolLogo";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile, useKeyboardToolbarPosition } from "@/hooks/use-keyboard";
import BottomCTA from "@/components/BottomCTA";
import ConfirmRemoveDialog from "@/components/ConfirmRemoveDialog";
import photoFrameImg from "@assets/PhotoFrame_1780975215901.png";
import type { Teacher } from "@shared/schema";

const FONT = "[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica]";
const NORMAL_BORDER = "border-[#e9e5dc]";
const ERROR_BORDER = "border-[#b34d3b]";

function readFileAsDataURL(file: File, cb: (url: string) => void) {
  const reader = new FileReader();
  reader.onload = () => cb(reader.result as string);
  reader.readAsDataURL(file);
}

function PolaroidUpload({
  photo, onSelect, testId, width = 104, className = "", initials = "",
}: {
  photo: string; onSelect: (file: File) => void; testId: string; width?: number; className?: string; initials?: string;
}): JSX.Element {
  const ref = useRef<HTMLInputElement>(null);
  const height = Math.round(width * (474 / 438)) - 3;
  const windowStyle = { top: "8.9%", bottom: "24.9%", left: "10.7%", right: "10.7%" } as const;
  const fontSize = Math.round(width * 0.2);
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width, height }}>
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onSelect(f); e.target.value = ""; }} />
      <button type="button" data-testid={testId}
        className="absolute inset-0 p-0 bg-transparent border-none cursor-pointer"
        onClick={() => ref.current?.click()} aria-label="Upload photo">
        <div className="absolute overflow-hidden" style={windowStyle}>
          {photo ? <img src={photo} alt="Upload preview" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: "top center" }} /> : null}
        </div>
        <img src={photoFrameImg} alt="" aria-hidden className="absolute inset-0 w-full h-full" />
        {!photo && (
          <div className="absolute flex flex-col items-center justify-center" style={windowStyle}>
            {initials ? (
              <span className={FONT} style={{ fontSize, fontWeight: 600, color: "#e0d9cc", lineHeight: 1 }}>{initials}</span>
            ) : (
              <>
                <span className={`${FONT} font-light text-[#3e983a] text-[28px] leading-none`}>+</span>
                <span className={`${FONT} font-normal text-[#3e983a] text-[14px] text-center leading-tight`}>upload<br />photo</span>
              </>
            )}
          </div>
        )}
      </button>
    </div>
  );
}

export const TeacherDetails = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const params = useParams<{ teacherId: string }>();
  const logoSrc = useSchoolLogo();
  const isMobile = useIsMobile();
  const { bottom, keyboardOpen } = useKeyboardToolbarPosition();

  const { data: teacher, isLoading } = useQuery<Teacher>({ queryKey: ["/api/teachers", params.teacherId] });

  const [photo, setPhoto] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [relation, setRelation] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [showValidationError, setShowValidationError] = useState(false);
  const [toastMessage, setToastMessage] = useState("Please fill in this information.");
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (teacher && !initialized) {
      setPhoto(teacher.photo || "");
      setFirstName(teacher.firstName || "");
      setLastName(teacher.lastName || "");
      setRelation(teacher.relation || "");
      setPhone(teacher.phone || "");
      setEmail(teacher.email || "");
      setAddress(teacher.address || "");
      setInitialized(true);
    }
  }, [teacher, initialized]);

  useEffect(() => {
    if (showValidationError) { const t = setTimeout(() => setShowValidationError(false), 3000); return () => clearTimeout(t); }
  }, [showValidationError]);

  const isEmpty = (v: string) => validationAttempted && !v.trim();
  const valid = () => !!firstName.trim() && !!lastName.trim() && !!relation.trim() && !!phone.trim() && !!email.trim() && !!address.trim();

  const saveMutation = useMutation({
    mutationFn: async () =>
      apiRequest("PATCH", `/api/teachers/${params.teacherId}`, {
        firstName: firstName.trim(), lastName: lastName.trim(), photo,
        relation: relation.trim(), phone: phone.trim(), email: email.trim(), address: address.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      setLocation("/school?tab=teachers");
    },
    onError: (err) => { console.error("Failed to save teacher:", err); if (isOfflineError(err)) return; setToastMessage("Something went wrong. Please try again."); setShowValidationError(true); },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/teachers/${params.teacherId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      setLocation("/school?tab=teachers");
    },
    onError: (err) => { console.error("Failed to remove teacher:", err); setShowConfirm(false); if (isOfflineError(err)) return; setToastMessage("Something went wrong. Please try again."); setShowValidationError(true); },
  });

  function handleSave() {
    if (!valid()) { setToastMessage("Please fill in this information."); setValidationAttempted(true); setShowValidationError(true); return; }
    saveMutation.mutate();
  }

  const labelCls = `${FONT} font-normal text-[#41444b] text-[14px] leading-[18px] h-[18px]`;
  const inputCls = (err: boolean) =>
    `w-full rounded-[5px] border ${err ? ERROR_BORDER : NORMAL_BORDER} bg-white px-[16px] py-[14px] text-[16px] text-[#41444b] placeholder-[#41444b]/40 outline-none focus:border-[#41444b] ${FONT} font-normal`;

  const renderField = (label: string, value: string, onChange: (v: string) => void, placeholder: string, testId: string, type = "text") => (
    <div className="flex flex-col gap-[6px] w-full">
      <label className={labelCls}>{label}</label>
      <input data-testid={testId} type={type} placeholder={placeholder} value={value}
        onChange={(e) => onChange(e.target.value)} className={inputCls(isEmpty(value))} />
    </div>
  );

  if (isLoading) {
    return <div className="flex flex-col h-dvh items-center justify-center bg-[#fffbf2]"><p className={`${FONT} text-[#8f530f] text-[20px]`}>Loading...</p></div>;
  }
  if (!teacher) {
    return (
      <div className="flex flex-col h-dvh items-center justify-center bg-[#fffbf2]">
        <p className={`${FONT} text-[#8f530f] text-[20px]`}>Teacher not found</p>
        <button className={`mt-4 bg-transparent border-none cursor-pointer ${FONT} text-[#3e983a] text-[16px]`} onClick={() => setLocation("/school?tab=teachers")}>Back to school</button>
      </div>
    );
  }

  const ctaLabel = saveMutation.isPending ? "saving…" : "save";

  return (
    <div className="flex flex-col h-dvh items-center relative overflow-hidden bg-[#fffbf2]">
      {/* Header */}
      <div className="flex flex-col items-center w-full flex-shrink-0 pt-[32px]">
        <img src={logoSrc} alt="Ms. Sunshine" className="w-[210px] h-auto object-contain" />
        <div className="flex w-full items-center justify-between px-[24px] mt-[16px]">
          <span className={`${FONT} font-semibold text-[32px] tracking-[-0.5px] leading-[normal] text-[#8f530f] truncate`}>edit teacher</span>
          <button data-testid="btn-close-form"
            className="flex items-center justify-center w-[32px] h-[32px] rounded-full bg-white border-none cursor-pointer p-0 flex-shrink-0 shadow-[0px_0px_2px_rgba(0,0,0,0.06)]"
            onClick={() => setLocation("/school?tab=teachers")} aria-label="Close">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M10 2L2 10M2 2L10 10" stroke="#41444B" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className={`flex-1 overflow-y-auto w-full flex flex-col items-start ${isMobile ? "pb-[70px]" : "pb-[160px]"} gap-[28px] pt-[16px]`}>
        <div className="flex items-center gap-[24px] w-full px-[24px]">
          <PolaroidUpload photo={photo} onSelect={(f) => readFileAsDataURL(f, setPhoto)}
            testId="btn-upload-photo" className="ml-[-1px] mt-[18px]"
            initials={((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase()} />
          <div className="flex flex-col gap-[16px] flex-1 min-w-0">
            {renderField("first name", firstName, setFirstName, "e.g. Tim", "input-first-name")}
            {renderField("last name", lastName, setLastName, "e.g. Valderrama", "input-last-name")}
          </div>
        </div>

        <div className="flex flex-col w-full px-[24px]" style={{ display: 'flex', flexDirection: 'column', rowGap: 22 }}>
          {renderField("role", relation, setRelation, "e.g. principal, head teacher, assistant teacher.", "input-relation")}
          {renderField("phone number", phone, setPhone, "e.g. (555) 123-4567", "input-phone")}
          {renderField("email address", email, setEmail, "e.g. name@email.com", "input-email", "email")}
          {renderField("address", address, setAddress, "e.g. 123 Main St, Springfield", "input-address")}
        </div>
      </div>

      {/* Bottom CTA */}
      {isMobile ? (
        <div className="fixed left-0 right-0 z-50 flex items-center justify-between px-[16px] bg-[#f0efe9] border-t border-[#d9d3c7]"
          style={{ bottom, height: 44, transition: keyboardOpen ? "bottom 0.1s ease-out" : "none" }}>
          <button data-testid="btn-remove-form"
            className={`bg-transparent border-none cursor-pointer ${FONT} text-[#DC2626] text-[16px] font-semibold leading-[normal] py-[8px] px-[12px]`}
            onClick={() => setShowConfirm(true)}>remove</button>
          <button data-testid="btn-submit-form"
            className={`border-none cursor-pointer rounded-[100px] px-[20px] py-[8px] ${FONT} text-white text-[16px] font-semibold leading-[normal]`}
            style={{ background: "linear-gradient(135deg, #5CD1E6 0%, #42ACBF 50%, #288899 100%)" }}
            onClick={handleSave} disabled={saveMutation.isPending}>{ctaLabel}</button>
        </div>
      ) : (
        <div className="absolute bottom-0 left-0 right-0 h-[134px] z-10 pointer-events-auto">
          <BottomCTA height={134}>
            <button data-testid="btn-submit-form"
              className="w-full h-[44px] rounded-[50px] flex items-center justify-center cursor-pointer bg-white border border-[#f0f0f0] shadow-[0px_0px_4px_0px_rgba(0,0,0,0.06)]"
              onClick={handleSave} disabled={saveMutation.isPending}>
              <span className={`${FONT} text-[#3e983a] text-[24px] font-semibold leading-[normal]`}>{ctaLabel}</span>
            </button>
            <button data-testid="btn-remove-form"
              className={`bg-transparent border-none cursor-pointer ${FONT} text-[#DC2626] text-[21px] font-semibold leading-[normal]`}
              onClick={() => setShowConfirm(true)}>remove</button>
          </BottomCTA>
        </div>
      )}

      <ConfirmRemoveDialog
        open={showConfirm}
        title="remove teacher?"
        message={`This will permanently remove ${firstName || "this teacher"} from the school. This can't be undone.`}
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Validation toast */}
      <AnimatePresence>
        {showValidationError && (
          <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }} className="fixed top-[60px] left-[24px] right-[24px] z-50">
            <div data-testid="validation-notification"
              className="rounded-[16px] px-[20px] py-[14px] flex items-center gap-[10px] shadow-lg" style={{ background: "#b34d3b" }}>
              <span className={`${FONT} font-semibold text-white text-[15px] leading-[20px]`}>{toastMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
