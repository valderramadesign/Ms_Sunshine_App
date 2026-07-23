import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import BottomCTA from "@/components/BottomCTA";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest, queryClient, isOfflineError } from "@/lib/queryClient";
import docIcon from "@assets/Document_1774560438127.png";
import PolaroidUpload from "@/components/PolaroidUpload";
import { useIsMobile, useKeyboardToolbarPosition } from "@/hooks/use-keyboard";
import { useSchoolLogo } from "@/lib/useSchoolLogo";
import InviteModal, { type InviteEntry } from "@/components/InviteModal";

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
  firstName: "",
  lastName: "",
  relation: "",
  phoneNumber: "",
  email: "",
  address: "",
  photo: "",
});


export const AddChild = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const logoSrc = useSchoolLogo();
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<{ name: string; url: string }[]>([]);
  const [longPressedDoc, setLongPressedDoc] = useState<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showValidationError, setShowValidationError] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const isMobile = useIsMobile();
  const { bottom, keyboardOpen } = useKeyboardToolbarPosition();

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
  const [inviteModal, setInviteModal] = useState<InviteEntry[] | null>(null);
  const [pendingNav, setPendingNav] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSaveError, setShowSaveError] = useState(false);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    readFileAsDataURL(file, setPhotoPreview);
  }

  function handleDocSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (documents.length >= 10) {
      e.target.value = "";
      return;
    }
    const url = URL.createObjectURL(file);
    setDocuments((prev) => [...prev, { name: file.name, url }]);
    e.target.value = "";
  }

  function startLongPress(index: number) {
    longPressTimerRef.current = setTimeout(() => {
      setLongPressedDoc(index);
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function addGuardian() {
    setGuardians((prev) => [...prev, emptyGuardian()]);
  }

  function removeLastGuardian() {
    setGuardians((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }

  function updateGuardian(index: number, field: keyof Guardian, value: string) {
    setGuardians((prev) => prev.map((g, i) => (i === index ? { ...g, [field]: value } : g)));
  }

  const mandatoryFieldsValid = () => {
    if (!firstName.trim() || !lastName.trim() || !birthday || !enrollmentDate || !graduationDate) return false;
    for (const g of guardians) {
      if (!g.firstName.trim() || !g.lastName.trim() || !g.relation || !g.phoneNumber.trim() || !g.email.trim() || !g.address.trim()) return false;
    }
    return true;
  };

  const isMandatoryEmpty = (value: string) => validationAttempted && !value.trim();

  useEffect(() => {
    if (showValidationError) {
      const timer = setTimeout(() => setShowValidationError(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showValidationError]);

  useEffect(() => {
    if (longPressedDoc === null) return;
    const dismiss = () => setLongPressedDoc(null);
    document.addEventListener("click", dismiss, { once: true, capture: true });
    return () => document.removeEventListener("click", dismiss, { capture: true });
  }, [longPressedDoc]);

  async function handleSubmit() {
    if (!mandatoryFieldsValid()) {
      setValidationAttempted(true);
      setShowValidationError(true);
      return;
    }
    if (saving) return;
    setSaving(true);
    const childId = `${firstName.trim().toLowerCase()}-${Date.now()}`;
    const mappedGuardians = guardians.map((g) => ({
      name: `${g.firstName.trim()} ${g.lastName.trim()}`.trim(),
      relation: g.relation,
      contact: g.phoneNumber.trim(),
      email: g.email.trim(),
      photo: g.photo || "",
      address: g.address.trim(),
    }));
    try {
      await apiRequest("PUT", `/api/children/${childId}`, {
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
      queryClient.invalidateQueries({ queryKey: ["/api/children"] });
      const entries: InviteEntry[] = mappedGuardians
        .filter((g) => g.email)
        .map((g) => ({ name: g.name, email: g.email }));
      if (entries.length > 0) {
        setPendingNav("/school");
        setInviteModal(entries);
      } else {
        setLocation("/school");
      }
    } catch (err) {
      console.error("Failed to save child:", err);
      if (!isOfflineError(err)) {
        // apiRequest already showed the offline toast; only show inline error
        // for other failures (server errors, validation, etc.)
        setShowSaveError(true);
        setTimeout(() => setShowSaveError(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  const hasInput =
    !!photoPreview ||
    !!firstName ||
    !!lastName ||
    !!birthday ||
    !!enrollmentDate ||
    !!graduationDate ||
    guardians.some((g) => g.firstName || g.lastName || g.relation || g.phoneNumber || g.email || g.address || g.photo) ||
    !!allergies ||
    !!medications ||
    !!doctor ||
    !!doctorPhone ||
    !!note;

  const inputClass = (error: boolean) =>
    `w-full rounded-[5px] border ${error ? ERROR_BORDER : NORMAL_BORDER} bg-white px-[16px] py-[14px] text-[16px] text-[#41444b] placeholder-[#41444b]/40 outline-none focus:border-[#41444b] ${FONT} font-normal`;

  const labelClass = `${FONT} font-normal text-[#41444b] text-[14px] leading-[18px] h-[18px]`;
  const sectionTitleClass = `${FONT} font-semibold text-[#8f530f] text-[21px] tracking-[-0.5px]`;

  const renderField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    testId: string,
    required: boolean,
  ) => (
    <div className="flex flex-col gap-[6px] w-full">
      <label className={labelClass}>{label}</label>
      <input
        data-testid={testId}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass(required && isMandatoryEmpty(value))}
      />
    </div>
  );

  return (
    <>
    <div className="flex flex-col h-dvh items-center relative overflow-hidden bg-[#fffbf2]">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
      <div className="flex flex-col items-center w-full flex-shrink-0 pt-[32px]">
        <img src={logoSrc} alt="Ms. Sunshine" className="w-[210px] h-auto object-contain" />
        <div className="flex w-full items-baseline justify-between px-[24px] mt-[18px] mb-[8px]">
          <span className={`${FONT} font-semibold text-[32px] tracking-[-0.50px] leading-[normal] whitespace-nowrap text-[#8f530f]`}>
            add a child
          </span>
          <button data-testid="btn-close-add-child"
            className="flex items-center justify-center w-[32px] h-[32px] rounded-full bg-white border-none cursor-pointer p-0 flex-shrink-0 shadow-[0px_0px_2px_rgba(0,0,0,0.06)]"
            onClick={() => setLocation("/school")} aria-label="Close">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M10 2L2 10M2 2L10 10" stroke="#41444B" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto w-full flex flex-col items-start ${!hasInput ? "pb-[26px]" : isMobile ? "pb-[70px]" : "pb-[160px]"} gap-[28px] pt-[16px]`}>
        {/* Child basic info */}
        <div className="flex flex-col gap-[20px] w-full px-[24px]">
          <div className="flex items-center gap-[24px] w-full">
            <PolaroidUpload
              photo={photoPreview}
              onSelect={(file) => readFileAsDataURL(file, setPhotoPreview)}
              testId="btn-upload-photo"
              className="ml-[-1px] mt-[18px]"
              initials={((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase()}
            />
            <div className="flex flex-col gap-[16px] flex-1 min-w-0">
              {renderField("first name", firstName, setFirstName, "e.g. Tim", "input-first-name", true)}
              {renderField("last name", lastName, setLastName, "e.g. Valderrama", "input-last-name", true)}
            </div>
          </div>

          <div className="flex gap-[12px] items-end w-full">
            <div className="flex flex-col gap-[6px] flex-1">
              <label className={labelClass}>birthday</label>
              <input
                data-testid="input-birthday"
                type="text"
                placeholder="e.g. 03/15/2020"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className={inputClass(isMandatoryEmpty(birthday))}
              />
            </div>
            <div className="flex flex-col items-center gap-[6px]">
              <span className={labelClass}>age</span>
              <span
                data-testid="text-child-age"
                className={`${FONT} text-[#41444b] leading-[normal] font-normal flex items-center justify-center`}
                style={{ height: 50, fontSize: 28, minWidth: 40 }}
              >
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

          {renderField("enrollment date", enrollmentDate, setEnrollmentDate, "e.g. 09/01/2023", "input-enrollment-date", true)}
          {renderField("graduation date", graduationDate, setGraduationDate, "e.g. 06/15/2027", "input-graduation-date", true)}
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
                  {renderField("first name", guardian.firstName, (v) => updateGuardian(index, "firstName", v), "e.g. Tim", `input-guardian-first-name-${index}`, true)}
                  {renderField("last name", guardian.lastName, (v) => updateGuardian(index, "lastName", v), "e.g. Valderrama", `input-guardian-last-name-${index}`, true)}
                </div>
              </div>

              <div className="flex flex-col gap-[6px] w-full">
                <label className={labelClass}>relation</label>
                <select
                  data-testid={`select-guardian-relation-${index}`}
                  value={guardian.relation}
                  onChange={(e) => updateGuardian(index, "relation", e.target.value)}
                  className={`${inputClass(isMandatoryEmpty(guardian.relation))} appearance-none ${guardian.relation ? "text-[#41444b]" : "text-[#41444b]/40"}`}
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23c4b8a8' stroke-width='2' fill='none'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 16px center",
                  }}
                >
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

              {renderField("phone number", guardian.phoneNumber, (v) => updateGuardian(index, "phoneNumber", v), "e.g. (555) 123-4567", `input-guardian-phone-${index}`, true)}
              {renderField("email address", guardian.email, (v) => updateGuardian(index, "email", v), "e.g. parent@email.com", `input-guardian-email-${index}`, true)}
              {renderField("address", guardian.address, (v) => updateGuardian(index, "address", v), "e.g. 123 Main St, Springfield", `input-guardian-address-${index}`, true)}
            </div>
          ))}
          <div className="flex justify-between w-full">
            {guardians.length > 1 ? (
              <button
                data-testid="btn-remove-guardian"
                className={`bg-transparent border-none cursor-pointer p-0 ${FONT} font-semibold text-[16px] text-left leading-[18px] text-[#3e983a]`}
                onClick={removeLastGuardian}
              >
                - remove a guardian
              </button>
            ) : (
              <span />
            )}
            <button
              data-testid="btn-add-guardian"
              className={`bg-transparent border-none cursor-pointer p-0 ${FONT} font-semibold text-[#3e983a] text-[16px] text-right leading-[18px]`}
              onClick={addGuardian}
            >
              + add a guardian
            </button>
          </div>
        </div>

        {/* Emergency information */}
        <div className="flex flex-col gap-[20px] w-full px-[24px]">
          <p className={sectionTitleClass}>emergency information</p>
          {renderField("allergies", allergies, setAllergies, "e.g. peanuts, dairy", "input-allergies", false)}
          {renderField("medication", medications, setMedications, "e.g. inhaler, EpiPen", "input-medications", false)}
          {renderField("doctor", doctor, setDoctor, "e.g. Dr. Smith", "input-doctor", false)}
          {renderField("doctor's contact", doctorPhone, setDoctorPhone, "e.g. (555) 987-6543", "input-doctor-phone", false)}
          <div className="flex flex-col gap-[6px] w-full">
            <label className={labelClass}>note</label>
            <textarea
              data-testid="input-note"
              placeholder="e.g. immunization records, what's due?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`w-full h-[144px] rounded-[5px] border ${NORMAL_BORDER} bg-white px-[16px] py-[14px] text-[16px] text-[#41444b] placeholder-[#41444b]/40 outline-none resize-none focus:border-[#41444b] ${FONT} font-normal`}
            />
          </div>

          <div className="w-full">
            <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleDocSelect} />
            <button
              data-testid="btn-link-document"
              className="bg-transparent border-none cursor-pointer p-0 flex flex-row items-center gap-[10px]"
              onClick={() => {
                if (documents.length >= 10) return;
                docInputRef.current?.click();
              }}
              style={{ opacity: documents.length >= 10 ? 0.4 : 1 }}
            >
              <img src={docIcon} alt="Link document" className="w-[41px] h-[41px] object-contain" />
              <span className={`${FONT} font-semibold text-[#3e983a] text-[16px] leading-[18px]`}>
                {documents.length >= 10 ? "max documents linked" : "link document"}
              </span>
            </button>
            {documents.length > 0 && (
              <div className="flex flex-col gap-[16px] mt-[12px]">
                {documents.map((doc, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-[8px]"
                    onTouchStart={() => startLongPress(i)}
                    onTouchEnd={cancelLongPress}
                    onTouchCancel={cancelLongPress}
                    onMouseDown={() => startLongPress(i)}
                    onMouseUp={cancelLongPress}
                    onMouseLeave={cancelLongPress}
                  >
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`link-doc-${i}`}
                      className="[font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica] text-[#3e983a] text-[14px] leading-[20px] truncate flex-1 underline"
                    >
                      {doc.name}
                    </a>
                    {longPressedDoc === i && (
                      <button
                        data-testid={`btn-delete-doc-${i}`}
                        className={`bg-transparent border-none cursor-pointer p-0 ${FONT} font-semibold text-[#b34d3b] text-[14px] shrink-0`}
                        onClick={() => {
                          URL.revokeObjectURL(doc.url);
                          setDocuments((prev) => prev.filter((_, idx) => idx !== i));
                          setLongPressedDoc(null);
                        }}
                      >
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
        <AnimatePresence>
          {hasInput && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed left-0 right-0 z-50 flex items-center justify-between px-[16px] bg-[#f0efe9] border-t border-[#d9d3c7]"
              style={{ bottom, height: 44, transition: keyboardOpen ? "bottom 0.1s ease-out" : "none" }}
            >
              <button
                data-testid="btn-cancel-add-child"
                className={`bg-transparent border-none cursor-pointer ${FONT} text-[#3e983a] text-[16px] leading-[normal] py-[8px] px-[12px]`}
                onClick={() => setLocation("/school")}
              >
                Cancel
              </button>
              <button
                data-testid="btn-add-new-child"
                disabled={saving}
                className={`border-none cursor-pointer rounded-[100px] px-[20px] py-[8px] ${FONT} text-white text-[16px] font-semibold leading-[normal] disabled:opacity-60`}
                style={{ background: "linear-gradient(135deg, #5CD1E6 0%, #42ACBF 50%, #288899 100%)" }}
                onClick={handleSubmit}
              >
                {saving ? "Saving…" : "Add new child"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        <AnimatePresence>
          {hasInput && (
            <motion.div
              initial={{ y: 220 }}
              animate={{ y: 0 }}
              exit={{ y: 220 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute bottom-0 left-0 right-0 h-[134px] z-10 pointer-events-auto"
            >
              <BottomCTA>
                <button
                  data-testid="btn-add-new-child"
                  disabled={saving}
                  className="w-full h-[44px] rounded-[50px] flex items-center justify-center cursor-pointer bg-white border border-[#f0f0f0] shadow-[0px_0px_4px_0px_rgba(0,0,0,0.06)] disabled:opacity-60"
                  onClick={handleSubmit}
                >
                  <span className={`${FONT} text-[#3e983a] text-[24px] font-semibold leading-[normal]`}>{saving ? "saving…" : "add child"}</span>
                </button>
                <button
                  data-testid="btn-cancel-add-child"
                  className={`bg-transparent border-none cursor-pointer ${FONT} text-[#3e983a] text-[21px] font-semibold leading-[normal]`}
                  onClick={() => setLocation("/school")}
                >
                  Cancel
                </button>
              </BottomCTA>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <AnimatePresence>
        {showValidationError && (
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed top-[60px] left-[24px] right-[24px] z-50"
          >
            <div
              data-testid="validation-notification"
              className="rounded-[16px] px-[20px] py-[14px] flex items-center gap-[10px] shadow-lg"
              style={{ background: "#b34d3b" }}
            >
              <span className={`${FONT} font-semibold text-white text-[15px] leading-[20px]`}>
                Please fill in this information.
              </span>
            </div>
          </motion.div>
        )}
        {showSaveError && (
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed top-[60px] left-[24px] right-[24px] z-50"
          >
            <div
              data-testid="save-error-notification"
              className="rounded-[16px] px-[20px] py-[14px] flex items-center gap-[10px] shadow-lg"
              style={{ background: "#b34d3b" }}
            >
              <span className={`${FONT} font-semibold text-white text-[15px] leading-[20px]`}>
                Something went wrong. Please try again.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    {inviteModal && (
      <InviteModal
        entries={inviteModal}
        onDismiss={() => { setInviteModal(null); setLocation(pendingNav); }}
      />
    )}
    </>
  );
};
