import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient, isOfflineError } from "@/lib/queryClient";
import { useSchoolLogo } from "@/lib/useSchoolLogo";
import InviteModal, { type InviteEntry } from "@/components/InviteModal";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile, useKeyboardToolbarPosition } from "@/hooks/use-keyboard";
import BottomCTA from "@/components/BottomCTA";
import photoFrameImg from "@assets/PhotoFrame_1780975215901.png";
import type { Child } from "@shared/schema";

const FONT = "[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica]";
const NORMAL_BORDER = "border-[#e9e5dc]";
const ERROR_BORDER = "border-[#b34d3b]";

function readFileAsDataURL(file: File, cb: (url: string) => void) {
  const reader = new FileReader();
  reader.onload = () => cb(reader.result as string);
  reader.readAsDataURL(file);
}

function PolaroidUpload({
  photo, onSelect, testId, width = 104, className = "",
}: {
  photo: string; onSelect: (file: File) => void; testId: string; width?: number; className?: string;
}): JSX.Element {
  const ref = useRef<HTMLInputElement>(null);
  const height = Math.round(width * (474 / 438)) - 3;
  const windowStyle = { top: "8.9%", bottom: "24.9%", left: "10.7%", right: "10.7%" } as const;
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
            <span className={`${FONT} font-light text-[#3e983a] text-[28px] leading-none`}>+</span>
            <span className={`${FONT} font-normal text-[#3e983a] text-[14px] text-center leading-tight`}>upload<br />photo</span>
          </div>
        )}
      </button>
    </div>
  );
}

type Guardian = { name?: string; relation?: string; contact?: string; email?: string; photo?: string; address?: string };

export const AddGuardian = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const logoSrc = useSchoolLogo();
  const isMobile = useIsMobile();
  const { bottom, keyboardOpen } = useKeyboardToolbarPosition();
  const { data: childrenData } = useQuery<Child[]>({ queryKey: ["/api/children"] });

  const [childId, setChildId] = useState("");
  const [photo, setPhoto] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [relation, setRelation] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [showValidationError, setShowValidationError] = useState(false);
  const [inviteModal, setInviteModal] = useState<InviteEntry[] | null>(null);

  const options = (childrenData ?? []).map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName}`.trim() }));

  useEffect(() => {
    if (showValidationError) { const t = setTimeout(() => setShowValidationError(false), 3000); return () => clearTimeout(t); }
  }, [showValidationError]);

  const isEmpty = (v: string) => validationAttempted && !v.trim();
  const anyFilled = !!photo || !!childId || !!firstName || !!lastName || !!relation || !!phone || !!email || !!address;
  const valid = () => !!childId && !!firstName.trim() && !!lastName.trim() && !!relation.trim() && !!phone.trim() && !!email.trim() && !!address.trim();

  async function handleSubmit() {
    if (!valid()) { setValidationAttempted(true); setShowValidationError(true); return; }
    const child = (childrenData ?? []).find((c) => c.id === childId);
    if (!child) return;
    let guardians: Guardian[] = [];
    try { guardians = JSON.parse(child.guardians || "[]"); } catch { guardians = []; }
    const newName = `${firstName} ${lastName}`.trim();
    const newKey = `${newName.toLowerCase()}|${email.trim().toLowerCase()}`;
    if (guardians.some((g) => `${(g.name || "").trim().toLowerCase()}|${(g.email || "").trim().toLowerCase()}` === newKey)) {
      setLocation("/school?tab=parents"); return;
    }
    guardians.push({ name: newName, relation, contact: phone, email, photo, address });
    try {
      await apiRequest("PUT", `/api/children/${child.id}`, {
        firstName: child.firstName, lastName: child.lastName, photo: child.photo,
        birthday: child.birthday, guardians, enrollmentDate: child.enrollmentDate,
        graduationDate: child.graduationDate, address: child.address,
        allergies: child.allergies, medications: child.medications,
        doctor: child.doctor, doctorPhone: child.doctorPhone, note: child.note,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/children"] });
      if (email.trim()) {
        setInviteModal([{ name: `${firstName.trim()} ${lastName.trim()}`.trim(), email: email.trim() }]);
      } else {
        setLocation("/school?tab=parents");
      }
    } catch (err) {
      console.error("Failed to save guardian:", err);
      // Offline: toast already shown by apiRequest; nothing more to do.
    }
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

  return (
    <>
    <div className="flex flex-col h-dvh items-center relative overflow-hidden bg-[#fffbf2]">
      {/* Header */}
      <div className="flex flex-col items-center w-full flex-shrink-0 pt-[32px]">
        <img src={logoSrc} alt="Ms. Sunshine" className="w-[210px] h-auto object-contain" />
        <div className="flex w-full items-center justify-between px-[24px] mt-[16px]">
          <span className={`${FONT} font-semibold text-[32px] tracking-[-0.5px] leading-[normal] text-[#8f530f]`}>add a guardian</span>
          <button data-testid="btn-close-form"
            className="flex items-center justify-center w-[32px] h-[32px] rounded-full bg-white border-none cursor-pointer p-0 flex-shrink-0 shadow-[0px_0px_2px_rgba(0,0,0,0.06)]"
            onClick={() => setLocation("/school?tab=parents")} aria-label="Close">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M10 2L2 10M2 2L10 10" stroke="#41444B" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className={`flex-1 overflow-y-auto w-full flex flex-col items-start ${!anyFilled ? "pb-[26px]" : isMobile ? "pb-[70px]" : "pb-[160px]"} gap-[16px] pt-[16px]`}>
        {/* Photo + name row — matches AddChild spacing exactly */}
        <div className="flex items-center gap-[24px] w-full px-[24px]">
          <PolaroidUpload photo={photo} onSelect={(f) => readFileAsDataURL(f, setPhoto)}
            testId="btn-upload-photo" className="ml-[-1px] mt-[18px]" />
          <div className="flex flex-col gap-[16px] flex-1 min-w-0">
            {renderField("first name", firstName, setFirstName, "e.g. Tim", "input-first-name")}
            {renderField("last name", lastName, setLastName, "e.g. Valderrama", "input-last-name")}
          </div>
        </div>

        {/* Fields below */}
        <div className="flex flex-col w-full px-[24px]" style={{ display: 'flex', flexDirection: 'column', rowGap: 22 }}>
          {/* Child selector */}
          <div className="flex flex-col gap-[6px] w-full">
            <label className={labelCls}>child</label>
            <select data-testid="select-child" value={childId} onChange={(e) => setChildId(e.target.value)}
              className={`${inputCls(validationAttempted && !childId)} appearance-none ${childId ? "text-[#41444b]" : "text-[#41444b]/40"}`}
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23c4b8a8' stroke-width='2' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 16px center" }}>
              <option value="" disabled>select a child</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          {renderField("relation", relation, setRelation, "e.g. mother", "input-relation")}
          {renderField("phone number", phone, setPhone, "e.g. (555) 123-4567", "input-phone")}
          {renderField("email address", email, setEmail, "e.g. name@email.com", "input-email", "email")}
          {renderField("address", address, setAddress, "e.g. 123 Main St, Springfield", "input-address")}
        </div>
      </div>

      {/* Bottom CTA */}
      {isMobile ? (
        <AnimatePresence>
          {anyFilled && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              className="fixed left-0 right-0 z-50 flex items-center justify-between px-[16px] bg-[#f0efe9] border-t border-[#d9d3c7]"
              style={{ bottom, height: 44, transition: keyboardOpen ? "bottom 0.1s ease-out" : "none" }}>
              <button data-testid="btn-cancel-form"
                className={`bg-transparent border-none cursor-pointer ${FONT} text-[#3e983a] text-[16px] leading-[normal] py-[8px] px-[12px]`}
                onClick={() => setLocation("/school?tab=parents")}>Cancel</button>
              <button data-testid="btn-submit-form"
                className={`border-none cursor-pointer rounded-[100px] px-[20px] py-[8px] ${FONT} text-white text-[16px] font-semibold leading-[normal]`}
                style={{ background: "linear-gradient(135deg, #5CD1E6 0%, #42ACBF 50%, #288899 100%)" }}
                onClick={handleSubmit}>add guardian</button>
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        <AnimatePresence>
          {anyFilled && (
            <motion.div initial={{ y: 220 }} animate={{ y: 0 }} exit={{ y: 220 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute bottom-0 left-0 right-0 h-[134px] z-10 pointer-events-auto">
              <BottomCTA>
                <button data-testid="btn-submit-form"
                  className="w-full h-[44px] rounded-[50px] flex items-center justify-center cursor-pointer bg-white border border-[#f0f0f0] shadow-[0px_0px_4px_0px_rgba(0,0,0,0.06)]"
                  onClick={handleSubmit}>
                  <span className={`${FONT} text-[#3e983a] text-[24px] font-semibold leading-[normal]`}>add guardian</span>
                </button>
                <button data-testid="btn-cancel-form"
                  className={`bg-transparent border-none cursor-pointer ${FONT} text-[#3e983a] text-[21px] font-semibold leading-[normal]`}
                  onClick={() => setLocation("/school?tab=parents")}>Cancel</button>
              </BottomCTA>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Validation toast */}
      <AnimatePresence>
        {showValidationError && (
          <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }} className="fixed top-[60px] left-[24px] right-[24px] z-50">
            <div data-testid="validation-notification"
              className="rounded-[16px] px-[20px] py-[14px] flex items-center gap-[10px] shadow-lg" style={{ background: "#b34d3b" }}>
              <span className={`${FONT} font-semibold text-white text-[15px] leading-[20px]`}>Please fill in this information.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    {inviteModal && (
      <InviteModal
        entries={inviteModal}
        onDismiss={() => { setInviteModal(null); setLocation("/school?tab=parents"); }}
      />
    )}
    </>
  );
};
