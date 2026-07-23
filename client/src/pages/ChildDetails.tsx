import { useState, useRef, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import BottomCTA from "@/components/BottomCTA";
import ConfirmRemoveDialog from "@/components/ConfirmRemoveDialog";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, isOfflineError } from "@/lib/queryClient";
import docIcon from "@assets/Document_1774560438127.png";
import photoFrameImg from "@assets/PhotoFrame_1780975215901.png";
import { useIsMobile, useKeyboardToolbarPosition } from "@/hooks/use-keyboard";
import { useSchoolLogo } from "@/lib/useSchoolLogo";

const FONT = "[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica]";
const ERROR_BORDER = "border-[#b34d3b]";
const NORMAL_BORDER = "border-[#e9e5dc]";

function readFileAsDataURL(file: File, cb: (url: string) => void) {
  const reader = new FileReader();
  reader.onload = () => cb(reader.result as string);
  reader.readAsDataURL(file);
}

type Guardian = {
  firstName: string;
  lastName: string;
  relation: string;
  phoneNumber: string;
  email: string;
  address: string;
  photo: string;
};

const emptyGuardian = (): Guardian => ({
  firstName: "", lastName: "", relation: "", phoneNumber: "", email: "", address: "", photo: "",
});

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
          {photo ? <img src={photo} alt="preview" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: "top center" }} /> : null}
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

export const ChildDetails = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const params = useParams<{ childId: string }>();
  const logoSrc = useSchoolLogo();
  const isMobile = useIsMobile();
  const { bottom, keyboardOpen } = useKeyboardToolbarPosition();
  const docInputRef = useRef<HTMLInputElement>(null);

  const { data: childData, isLoading } = useQuery<{
    id: string; firstName: string; lastName: string; photo: string; birthday: string;
    guardians: string; enrollmentDate: string; graduationDate: string; address: string;
    allergies: string; medications: string; doctor: string; doctorPhone: string; note: string;
  }>({ queryKey: ["/api/children", params.childId] });

  const [photoPreview, setPhotoPreview] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [guardians, setGuardians] = useState<Guardian[]>([emptyGuardian()]);
  const [enrollmentDate, setEnrollmentDate] = useState("");
  const [graduationDate, setGraduationDate] = useState("");
  const [allergies, setAllergies] = useState("");
  const [medications, setMedications] = useState("");
  const [doctor, setDoctor] = useState("");
  const [doctorPhone, setDoctorPhone] = useState("");
  const [note, setNote] = useState("");
  const [documents, setDocuments] = useState<{ name: string; url: string }[]>([]);
  const [longPressedDoc, setLongPressedDoc] = useState<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showValidationError, setShowValidationError] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState("Please fill in this information.");

  useEffect(() => {
    if (childData && !dirty) {
      setFirstName(childData.firstName || "");
      setLastName(childData.lastName || "");
      setPhotoPreview(childData.photo || "");
      setBirthday(childData.birthday || "");
      setEnrollmentDate(childData.enrollmentDate || "");
      setGraduationDate(childData.graduationDate || "");
      setAllergies(childData.allergies || "");
      setMedications(childData.medications || "");
      setDoctor(childData.doctor || "");
      setDoctorPhone(childData.doctorPhone || "");
      setNote(childData.note || "");
      try {
        const parsed = JSON.parse(childData.guardians || "[]");
        if (parsed.length > 0) {
          setGuardians(parsed.map((g: any, i: number) => {
            const nameParts = (g.name || "").trim().split(" ");
            const fn = nameParts[0] || "";
            const ln = nameParts.slice(1).join(" ") || "";
            return {
              firstName: fn,
              lastName: ln,
              relation: g.relation || "",
              phoneNumber: g.contact || "",
              email: g.email || "",
              address: g.address || (i === 0 ? childData.address || "" : ""),
              photo: g.photo || "",
            };
          }));
        } else {
          setGuardians([{ ...emptyGuardian(), address: childData.address || "" }]);
        }
      } catch {
        setGuardians([{ ...emptyGuardian(), address: childData.address || "" }]);
      }
    }
  }, [childData, dirty]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const mappedGuardians = guardians.map((g) => ({
        name: `${g.firstName.trim()} ${g.lastName.trim()}`.trim(),
        relation: g.relation,
        contact: g.phoneNumber.trim(),
        email: g.email.trim(),
        photo: g.photo || "",
        address: g.address.trim(),
      }));
      await apiRequest("PUT", `/api/children/${params.childId}`, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        photo: photoPreview || "",
        birthday,
        guardians: mappedGuardians,
        enrollmentDate,
        graduationDate,
        address: guardians[0]?.address.trim() || "",
        allergies,
        medications,
        doctor,
        doctorPhone,
        note,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/children"] });
      setLocation(`/school/${params.childId}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/children/${params.childId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/children"] });
      setLocation("/school");
    },
    onError: (err) => { console.error("Failed to graduate child:", err); setShowConfirm(false); if (isOfflineError(err)) return; setToastMessage("Something went wrong. Please try again."); setShowValidationError(true); },
  });

  function handleDocSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (documents.length >= 10) { e.target.value = ""; return; }
    const url = URL.createObjectURL(file);
    setDocuments((prev) => [...prev, { name: file.name, url }]);
    e.target.value = "";
    setDirty(true);
  }

  function startLongPress(i: number) {
    longPressTimerRef.current = setTimeout(() => setLongPressedDoc(i), 500);
  }
  function cancelLongPress() {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  }

  function addGuardian() { setGuardians((prev) => [...prev, emptyGuardian()]); setDirty(true); }
  function removeLastGuardian() { setGuardians((prev) => prev.length > 1 ? prev.slice(0, -1) : prev); setDirty(true); }
  function updateGuardian(index: number, field: keyof Guardian, value: string) {
    setGuardians((prev) => prev.map((g, i) => i === index ? { ...g, [field]: value } : g));
    setDirty(true);
  }

  const isMandatoryEmpty = (v: string) => validationAttempted && !v.trim();

  const mandatoryFieldsValid = () => {
    if (!firstName.trim() || !lastName.trim() || !birthday || !enrollmentDate || !graduationDate) return false;
    for (const g of guardians) {
      if (!g.firstName.trim() || !g.lastName.trim() || !g.relation || !g.phoneNumber.trim() || !g.email.trim()) return false;
    }
    return true;
  };

  useEffect(() => {
    if (showValidationError) { const t = setTimeout(() => setShowValidationError(false), 3000); return () => clearTimeout(t); }
  }, [showValidationError]);

  useEffect(() => {
    if (longPressedDoc === null) return;
    const dismiss = () => setLongPressedDoc(null);
    document.addEventListener("click", dismiss, { once: true, capture: true });
    return () => document.removeEventListener("click", dismiss, { capture: true });
  }, [longPressedDoc]);

  function handleSubmit() {
    if (!mandatoryFieldsValid()) { setToastMessage("Please fill in this information."); setValidationAttempted(true); setShowValidationError(true); return; }
    saveMutation.mutate();
  }

  const inputClass = (error: boolean) =>
    `w-full rounded-[5px] border ${error ? ERROR_BORDER : NORMAL_BORDER} bg-white px-[16px] py-[14px] text-[16px] text-[#41444b] placeholder-[#41444b]/40 outline-none focus:border-[#41444b] ${FONT} font-normal`;
  const labelClass = `${FONT} font-normal text-[#41444b] text-[14px] leading-[18px] h-[18px]`;
  const sectionTitleClass = `${FONT} font-semibold text-[#8f530f] text-[21px] tracking-[-0.5px]`;

  const renderField = (
    label: string, value: string, onChange: (v: string) => void,
    placeholder: string, testId: string, required = false, type = "text"
  ) => (
    <div className="flex flex-col gap-[6px] w-full">
      <label className={labelClass}>{label}</label>
      <input data-testid={testId} type={type} placeholder={placeholder} value={value}
        onChange={(e) => { onChange(e.target.value); setDirty(true); }}
        className={inputClass(required && isMandatoryEmpty(value))} />
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col h-dvh items-center justify-center bg-[#fffbf2]">
        <p className={`${FONT} text-[#8f530f] text-[20px]`}>Loading...</p>
      </div>
    );
  }

  if (!childData) {
    return (
      <div className="flex flex-col h-dvh items-center justify-center bg-[#fffbf2]">
        <p className={`${FONT} text-[#8f530f] text-[20px]`}>Child not found</p>
        <button className={`mt-4 bg-transparent border-none cursor-pointer ${FONT} text-[#3e983a] text-[16px]`} onClick={() => setLocation("/school")}>Back to school</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh items-center relative overflow-hidden bg-[#fffbf2]">
      <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleDocSelect} />

      {/* Header */}
      <div className="flex flex-col items-center w-full flex-shrink-0 pt-[32px]">
        <img src={logoSrc} alt="Ms. Sunshine" className="w-[210px] h-auto object-contain" />
        <div className="flex w-full items-baseline justify-between px-[24px] mt-[18px] mb-[8px]">
          <span className={`${FONT} font-semibold text-[32px] tracking-[-0.50px] leading-[normal] whitespace-nowrap text-[#8f530f]`}>
            {childData.firstName}
          </span>
          <button
            data-testid="btn-close-details"
            className="flex items-center justify-center w-[40px] h-[40px] rounded-full bg-white border-none cursor-pointer p-0 flex-shrink-0 shadow-[0px_1px_3px_rgba(0,0,0,0.08)] self-center"
            onClick={() => setLocation(`/school/${params.childId}`)}
            aria-label="Close"
          >
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4L12 12" stroke="#41444B" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className={`flex-1 overflow-y-auto w-full flex flex-col items-start ${isMobile ? "pb-[70px]" : "pb-[160px]"} gap-[28px] pt-[16px]`}>

        {/* Child basic info */}
        <div className="flex flex-col gap-[20px] w-full px-[24px]">
          <div className="flex items-center gap-[24px] w-full">
            <PolaroidUpload
              photo={photoPreview}
              onSelect={(file) => { readFileAsDataURL(file, setPhotoPreview); setDirty(true); }}
              testId="btn-upload-photo"
              className="ml-[-1px] mt-[18px]"
              initials={((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase()}
            />
            <div className="flex flex-col gap-[16px] flex-1 min-w-0">
              {renderField("first name", firstName, setFirstName, "e.g. Tim", "input-first-name", true)}
              {renderField("last name", lastName, setLastName, "e.g. Valderrama", "input-last-name", true)}
            </div>
          </div>

          {/* Birthday + age */}
          <div className="flex gap-[12px] items-end w-full">
            <div className="flex flex-col gap-[6px] flex-1">
              <label className={labelClass}>birthday</label>
              <input data-testid="input-birthday" type="text" placeholder="e.g. 06/01/2020"
                value={birthday} onChange={(e) => { setBirthday(e.target.value); setDirty(true); }}
                className={inputClass(isMandatoryEmpty(birthday))} />
            </div>
            <div className="flex flex-col items-center gap-[6px]">
              <span className={labelClass}>age</span>
              <span data-testid="text-child-age"
                className={`${FONT} text-[#41444b] leading-[normal] font-normal flex items-center justify-center`}
                style={{ height: 50, fontSize: 28, minWidth: 40 }}>
                {(() => {
                  if (!birthday) return "0";
                  const parts = birthday.match(/^(\d{1,2})\/?(\d{1,2})\/?(\d{4})$/);
                  if (!parts) return "0";
                  const bDate = new Date(+parts[3], +parts[1] - 1, +parts[2]);
                  if (isNaN(bDate.getTime())) return "0";
                  const now = new Date();
                  let age = now.getFullYear() - bDate.getFullYear();
                  if (now.getMonth() < bDate.getMonth() || (now.getMonth() === bDate.getMonth() && now.getDate() < bDate.getDate())) age--;
                  return age < 0 ? "0" : String(age);
                })()}
              </span>
            </div>
          </div>

          {renderField("enrollment date", enrollmentDate, setEnrollmentDate, "e.g. 06/01/2023", "input-enrollment-date", true)}
          {renderField("graduation date", graduationDate, setGraduationDate, "e.g. 06/01/2025", "input-graduation-date", true)}
        </div>

        {/* Guardian information */}
        <div className="flex flex-col gap-[12px] w-full px-[24px]">
          <p className={sectionTitleClass}>guardian information</p>
          {guardians.map((guardian, index) => (
            <div key={index} className={`flex flex-col gap-[20px] w-full ${index > 0 ? "mt-[12px] pt-[12px]" : ""}`}>
              <div className="flex items-center gap-[24px] w-full">
                <PolaroidUpload
                  photo={guardian.photo}
                  onSelect={(file) => readFileAsDataURL(file, (url) => updateGuardian(index, "photo", url))}
                  testId={`btn-upload-guardian-photo-${index}`}
                  className="ml-[-1px] mt-[18px]"
                  initials={((guardian.firstName[0] ?? "") + (guardian.lastName[0] ?? "")).toUpperCase()}
                />
                <div className="flex flex-col gap-[16px] flex-1 min-w-0">
                  <div className="flex flex-col gap-[6px] w-full">
                    <label className={labelClass}>first name</label>
                    <input data-testid={`input-guardian-first-name-${index}`} type="text" placeholder="e.g. Tim"
                      value={guardian.firstName} onChange={(e) => updateGuardian(index, "firstName", e.target.value)}
                      className={inputClass(isMandatoryEmpty(guardian.firstName))} />
                  </div>
                  <div className="flex flex-col gap-[6px] w-full">
                    <label className={labelClass}>last name</label>
                    <input data-testid={`input-guardian-last-name-${index}`} type="text" placeholder="e.g. Valderrama"
                      value={guardian.lastName} onChange={(e) => updateGuardian(index, "lastName", e.target.value)}
                      className={inputClass(isMandatoryEmpty(guardian.lastName))} />
                  </div>
                </div>
              </div>

              {/* Relation dropdown */}
              <div className="flex flex-col gap-[6px] w-full">
                <label className={labelClass}>relation</label>
                <select data-testid={`select-guardian-relation-${index}`}
                  value={guardian.relation} onChange={(e) => updateGuardian(index, "relation", e.target.value)}
                  className={`${inputClass(isMandatoryEmpty(guardian.relation))} appearance-none ${guardian.relation ? "text-[#41444b]" : "text-[#41444b]/40"}`}
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23c4b8a8' stroke-width='2' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 16px center" }}>
                  <option value="" disabled>e.g. mother</option>
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                  <option value="grandfather">Grandfather</option>
                  <option value="grandmother">Grandmother</option>
                  <option value="uncle">Uncle</option>
                  <option value="aunt">Aunt</option>
                  <option value="friend">Friend</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="flex flex-col gap-[6px] w-full">
                <label className={labelClass}>phone number</label>
                <input data-testid={`input-guardian-phone-${index}`} type="text" placeholder="e.g. (555) 123-4567"
                  value={guardian.phoneNumber} onChange={(e) => updateGuardian(index, "phoneNumber", e.target.value)}
                  className={inputClass(isMandatoryEmpty(guardian.phoneNumber))} />
              </div>
              <div className="flex flex-col gap-[6px] w-full">
                <label className={labelClass}>email address</label>
                <input data-testid={`input-guardian-email-${index}`} type="email" placeholder="e.g. parent@email.com"
                  value={guardian.email} onChange={(e) => updateGuardian(index, "email", e.target.value)}
                  className={inputClass(isMandatoryEmpty(guardian.email))} />
              </div>
              <div className="flex flex-col gap-[6px] w-full">
                <label className={labelClass}>address</label>
                <input data-testid={`input-guardian-address-${index}`} type="text" placeholder="e.g. 123 Main St, Springfield"
                  value={guardian.address} onChange={(e) => updateGuardian(index, "address", e.target.value)}
                  className={inputClass(false)} />
              </div>
            </div>
          ))}

          <div className="flex justify-between w-full">
            {guardians.length > 1 ? (
              <button data-testid="btn-remove-guardian"
                className={`bg-transparent border-none cursor-pointer p-0 ${FONT} font-semibold text-[16px] text-left leading-[18px] text-[#3e983a]`}
                onClick={removeLastGuardian}>- remove a guardian</button>
            ) : <span />}
            <button data-testid="btn-add-guardian"
              className={`bg-transparent border-none cursor-pointer p-0 ${FONT} font-semibold text-[#3e983a] text-[16px] text-right leading-[18px]`}
              onClick={addGuardian}>+ add a guardian</button>
          </div>
        </div>

        {/* Emergency information */}
        <div className="flex flex-col gap-[20px] w-full px-[24px]">
          <p className={sectionTitleClass}>emergency information</p>
          {renderField("allergies", allergies, setAllergies, "e.g. peanuts, dairy", "input-allergies")}
          {renderField("medication", medications, setMedications, "e.g. inhaler, EpiPen", "input-medications")}
          {renderField("doctor", doctor, setDoctor, "e.g. Dr. Smith", "input-doctor")}
          {renderField("doctor's contact", doctorPhone, setDoctorPhone, "e.g. (555) 987-6543", "input-doctor-phone")}
          <div className="flex flex-col gap-[6px] w-full">
            <label className={labelClass}>note</label>
            <textarea data-testid="input-note" placeholder="e.g. immunization records, what's due?"
              value={note} onChange={(e) => { setNote(e.target.value); setDirty(true); }}
              className={`w-full h-[144px] rounded-[5px] border ${NORMAL_BORDER} bg-white px-[16px] py-[14px] text-[16px] text-[#41444b] placeholder-[#41444b]/40 outline-none resize-none focus:border-[#41444b] ${FONT} font-normal`} />
          </div>

          <div className="w-full">
            <button data-testid="btn-link-document"
              className="bg-transparent border-none cursor-pointer p-0 flex flex-row items-center gap-[10px]"
              onClick={() => { if (documents.length < 10) docInputRef.current?.click(); }}
              style={{ opacity: documents.length >= 10 ? 0.4 : 1 }}>
              <img src={docIcon} alt="Link document" className="w-[41px] h-[41px] object-contain" />
              <span className={`${FONT} font-semibold text-[#3e983a] text-[16px] leading-[18px]`}>
                {documents.length >= 10 ? "max documents linked" : "link document"}
              </span>
            </button>
            {documents.length > 0 && (
              <div className="flex flex-col gap-[16px] mt-[12px]">
                {documents.map((doc, i) => (
                  <div key={i} className="flex items-center gap-[8px]"
                    onTouchStart={() => startLongPress(i)} onTouchEnd={cancelLongPress} onTouchCancel={cancelLongPress}
                    onMouseDown={() => startLongPress(i)} onMouseUp={cancelLongPress} onMouseLeave={cancelLongPress}>
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" data-testid={`link-doc-${i}`}
                      className="[font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica] text-[#3e983a] text-[14px] leading-[20px] truncate flex-1 underline">
                      {doc.name}
                    </a>
                    {longPressedDoc === i && (
                      <button data-testid={`btn-delete-doc-${i}`}
                        className={`bg-transparent border-none cursor-pointer p-0 ${FONT} font-semibold text-[#b34d3b] text-[14px] shrink-0`}
                        onClick={() => { URL.revokeObjectURL(doc.url); setDocuments((prev) => prev.filter((_, idx) => idx !== i)); setLongPressedDoc(null); }}>
                        delete
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isMobile ? (
        <div className="fixed left-0 right-0 z-50 flex items-center justify-between px-[16px] bg-[#f0efe9] border-t border-[#d9d3c7]"
          style={{ bottom, height: 44, transition: keyboardOpen ? "bottom 0.1s ease-out" : "none" }}>
          <button data-testid="btn-graduate-details"
            className={`bg-transparent border-none cursor-pointer ${FONT} text-[#DC2626] text-[16px] font-semibold leading-[normal] py-[8px] px-[12px]`}
            onClick={() => setShowConfirm(true)}>graduate</button>
          <button data-testid="btn-save-details"
            className={`border-none cursor-pointer rounded-[100px] px-[20px] py-[8px] ${FONT} text-white text-[16px] font-semibold leading-[normal]`}
            style={{ background: "linear-gradient(135deg, #5CD1E6 0%, #42ACBF 50%, #288899 100%)" }}
            onClick={handleSubmit}>Save changes</button>
        </div>
      ) : (
        <div className="absolute bottom-0 left-0 right-0 h-[134px] z-10 pointer-events-auto">
          <BottomCTA>
            <button data-testid="btn-save-details"
              className="w-full h-[44px] rounded-[50px] flex items-center justify-center cursor-pointer bg-white border border-[#f0f0f0] shadow-[0px_0px_4px_0px_rgba(0,0,0,0.06)]"
              onClick={handleSubmit}>
              <span className={`${FONT} text-[#3e983a] text-[24px] font-semibold leading-[normal]`}>
                {saveMutation.isPending ? "saving…" : "save changes"}
              </span>
            </button>
            <button data-testid="btn-graduate-details"
              className={`bg-transparent border-none cursor-pointer ${FONT} text-[#DC2626] text-[21px] font-semibold leading-[normal]`}
              onClick={() => setShowConfirm(true)}>graduate</button>
          </BottomCTA>
        </div>
      )}

      <ConfirmRemoveDialog
        open={showConfirm}
        title="graduate child?"
        confirmLabel="graduate"
        pendingLabel="graduating…"
        message={`This will graduate ${childData.firstName || "this child"} and remove their profile, guardians and news feed. This can't be undone.`}
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
