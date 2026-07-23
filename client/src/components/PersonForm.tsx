import { useState, useEffect } from "react";
import BottomCTA from "@/components/BottomCTA";
import PolaroidUpload from "@/components/PolaroidUpload";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile, useKeyboardToolbarPosition } from "@/hooks/use-keyboard";
import { useSchoolLogo } from "@/lib/useSchoolLogo";
import { CloseButton } from "@/components/CloseButton";

export type PersonFormData = {
  photo: string;
  firstName: string;
  lastName: string;
  relation: string;
  phone: string;
  email: string;
  address: string;
};

type ChildSelector = {
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
};

type Props = {
  title: string;
  ctaLabel: string;
  onCancel: () => void;
  onSubmit: (data: PersonFormData) => Promise<void>;
  childSelector?: ChildSelector;
};

const labelCls =
  "[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#41444b] text-[14px] leading-[normal] tracking-[0.3px]";
const inputBase =
  "w-full rounded-[5px] border bg-white px-[16px] py-[14px] text-[16px] text-[#41444b] placeholder-[#41444b]/40 outline-none focus:border-[#41444b] [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal";

export default function PersonForm({ title, ctaLabel, onCancel, onSubmit, childSelector }: Props): JSX.Element {
  const logoSrc = useSchoolLogo();
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [showValidationError, setShowValidationError] = useState(false);
  const isMobile = useIsMobile();
  const { bottom, keyboardOpen } = useKeyboardToolbarPosition();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [relation, setRelation] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  const errorBorder = "border-[#b34d3b]";
  const normalBorder = "border-[#e0d9cc]";
  const isEmpty = (v: string) => validationAttempted && !v.trim();

  useEffect(() => {
    if (showValidationError) {
      const timer = setTimeout(() => setShowValidationError(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showValidationError]);

  const valid = () => {
    if (childSelector && !childSelector.value) return false;
    return !!(firstName.trim() && lastName.trim() && relation.trim() && phone.trim() && email.trim() && address.trim());
  };

  async function handleSubmit() {
    if (!valid()) {
      setValidationAttempted(true);
      setShowValidationError(true);
      return;
    }
    await onSubmit({
      photo: photoPreview || "",
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      relation: relation.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
    });
  }

  const anyFilled =
    !!photoPreview || !!firstName || !!lastName || !!relation || !!phone || !!email || !!address ||
    !!(childSelector && childSelector.value);

  return (
    <div className="flex flex-col h-dvh items-center relative overflow-hidden bg-[#f5f5f5]">

      <div className="flex flex-col items-center w-full flex-shrink-0 pt-[32px]">
        <img src={logoSrc} alt="Ms. Sunshine" className="w-[210px] h-auto object-contain" />
        <div className="flex w-full items-baseline justify-between px-[24px] mt-[18px] mb-[8px]">
          <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[32px] tracking-[-0.50px] leading-[normal] whitespace-nowrap text-[#8f530f]">
            {title}
          </span>
          <CloseButton testId="btn-close-form" onClick={onCancel} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto w-full flex flex-col items-start pb-[220px]">

        {/* Photo + name row */}
        <div className="flex items-end w-full px-[24px] mt-[16px]">
          <PolaroidUpload
            photo={photoPreview}
            onSelect={(file) => {
              const reader = new FileReader();
              reader.onload = () => setPhotoPreview(reader.result as string);
              reader.readAsDataURL(file);
            }}
            testId="btn-upload-photo"
            width={104}
            className="ml-[-1px] mt-[18px]"
          />

          <div className="flex flex-col gap-[16px] flex-1 min-w-0 pl-[21px]">
            <div className="flex flex-col gap-[6px] w-full">
              <label className={labelCls}>first name</label>
              <input
                data-testid="input-first-name"
                type="text"
                placeholder="e.g. Emma"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={`${inputBase} ${isEmpty(firstName) ? errorBorder : normalBorder}`}
              />
            </div>
            <div className="flex flex-col gap-[6px] w-full">
              <label className={labelCls}>last name</label>
              <input
                data-testid="input-last-name"
                type="text"
                placeholder="e.g. Parker"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={`${inputBase} ${isEmpty(lastName) ? errorBorder : normalBorder}`}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start w-full px-[24px] mt-[20px]" style={{ display: 'flex', flexDirection: 'column', rowGap: 22 }}>
          {childSelector && (
            <div className="flex flex-col gap-[6px] w-full">
              <label className={labelCls}>child</label>
              <select
                data-testid="select-child"
                value={childSelector.value}
                onChange={(e) => childSelector.onChange(e.target.value)}
                className={`${inputBase} appearance-none ${childSelector.value ? "text-[#41444b]" : "text-[#c4b8a8]"} ${
                  validationAttempted && !childSelector.value ? errorBorder : normalBorder
                }`}
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23c4b8a8' stroke-width='2' fill='none'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 16px center",
                }}
              >
                <option value="" disabled>select a child</option>
                {childSelector.options.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-[6px] w-full">
            <label className={labelCls}>relation</label>
            <input
              data-testid="input-relation"
              type="text"
              placeholder="e.g. Mother / Lead Teacher"
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              className={`${inputBase} ${isEmpty(relation) ? errorBorder : normalBorder}`}
            />
          </div>
          <div className="flex flex-col gap-[6px] w-full">
            <label className={labelCls}>phone number</label>
            <input
              data-testid="input-phone"
              type="text"
              placeholder="e.g. (555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`${inputBase} ${isEmpty(phone) ? errorBorder : normalBorder}`}
            />
          </div>
          <div className="flex flex-col gap-[6px] w-full">
            <label className={labelCls}>email address</label>
            <input
              data-testid="input-email"
              type="email"
              placeholder="e.g. name@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputBase} ${isEmpty(email) ? errorBorder : normalBorder}`}
            />
          </div>
          <div className="flex flex-col gap-[6px] w-full">
            <label className={labelCls}>address</label>
            <input
              data-testid="input-address"
              type="text"
              placeholder="e.g. 123 Main St, Springfield"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={`${inputBase} ${isEmpty(address) ? errorBorder : normalBorder}`}
            />
          </div>
        </div>
      </div>

      {isMobile ? (
        <AnimatePresence>
          {anyFilled && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed left-0 right-0 z-50 flex items-center justify-between px-[16px] bg-[#f0efe9] border-t border-[#d9d3c7]"
              style={{ bottom, height: 44, transition: keyboardOpen ? "bottom 0.1s ease-out" : "none" }}
            >
              <button
                data-testid="btn-cancel-form"
                className="bg-transparent border-none cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#3e983a] text-[16px] leading-[normal] py-[8px] px-[12px]"
                onClick={onCancel}
              >
                Cancel
              </button>
              <button
                data-testid="btn-submit-form"
                className="border-none cursor-pointer rounded-[100px] px-[20px] py-[8px] [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-white text-[16px] font-semibold leading-[normal]"
                style={{ background: "linear-gradient(135deg, #5CD1E6 0%, #42ACBF 50%, #288899 100%)" }}
                onClick={handleSubmit}
              >
                {ctaLabel}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        <AnimatePresence>
          {anyFilled && (
            <motion.div
              initial={{ y: 220 }}
              animate={{ y: 0 }}
              exit={{ y: 220 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute bottom-0 left-0 right-0 h-[159px] z-10 pointer-events-auto"
            >
              <BottomCTA>
                <button
                  data-testid="btn-submit-form"
                  className="w-full h-[44px] rounded-[50px] flex items-center justify-center cursor-pointer bg-white border border-[#f0f0f0] shadow-[0px_0px_4px_0px_rgba(0,0,0,0.06)]"
                  onClick={handleSubmit}
                >
                  <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#3e983a] text-[24px] font-semibold leading-[normal]">
                    {ctaLabel}
                  </span>
                </button>
                <button
                  data-testid="btn-cancel-form"
                  className="bg-transparent border-none cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#3e983a] text-[21px] font-semibold leading-[normal]"
                  onClick={onCancel}
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
              <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-white text-[15px] leading-[20px]">
                Please fill in this information.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
