import { useState, useRef } from "react";
import { useLocation } from "wouter";
import BottomCTA from "@/components/BottomCTA";
import PolaroidUpload from "@/components/PolaroidUpload";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getOnboardingCredentials, clearOnboardingCredentials } from "@/lib/onboardingCredentials";

export const AdminInfo = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [schoolNumber, setSchoolNumber] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState("");
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const errorBorder = "border-[#b34d3b]";
  const normalBorder = "border-[#e0d9cc]";

  const isFieldEmpty = (value: string) => validationAttempted && !value.trim();

  const inputClass = (value: string) =>
    `w-full rounded-[5px] border ${
      isFieldEmpty(value) ? errorBorder : normalBorder
    } bg-white px-[16px] py-[14px] text-[16px] text-[#41444b] placeholder-[#41444b]/40 outline-none focus:border-[#41444b] [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal`;

  const labelClass =
    "[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#41444b] text-[14px] leading-[normal] tracking-[0.3px]";

  function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length < 4) return digits;
    if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/png") {
      setLogoError("Please upload a PNG file.");
      e.target.value = "";
      return;
    }
    setLogoError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleSave() {
    setValidationAttempted(true);
    if (!firstName.trim() || !lastName.trim() || !role.trim() || !schoolName.trim() || !schoolNumber.trim() || !schoolAddress.trim()) {
      return;
    }
    const creds = getOnboardingCredentials();
    if (!creds) {
      setLocation("/onboarding/admin");
      return;
    }
    const { email, password, passwordHint, setupToken } = creds;
    setSaving(true);
    setSaveError("");
    try {
      await apiRequest("POST", "/api/admin/register", {
        email, password, passwordHint,
        fullName: `${firstName.trim()} ${lastName.trim()}`.trim(),
        role: role.trim(),
        schoolName: schoolName.trim(),
        schoolNumber: schoolNumber.trim(),
        schoolAddress: schoolAddress.trim(),
        logoPath: logoPreview || "",
        photo: photoPreview || "",
        setupToken: setupToken || "",
      });
      clearOnboardingCredentials();
      queryClient.setQueryData(["/api/admin/status"], { exists: true });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation("/school");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save. Please try again.";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-dvh items-center relative overflow-hidden bg-[#f5f5f5]">
      <div className="flex flex-col items-center w-full flex-shrink-0 pt-[32px]">
        <img
          src="/figmaAssets/demo-logo.png"
          alt="Ms. Sunshine"
          data-testid="img-admininfo-logo"
          className="w-[210px] h-auto object-contain"
        />
        <div className="flex w-full items-baseline justify-between px-[24px] mt-[18px] mb-[8px]">
          <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[32px] tracking-[-0.50px] leading-[normal] whitespace-nowrap text-[#7a3428]">
            admin info
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto w-full flex flex-col items-start pb-[26px]">

        {/* Photo + name row */}
        <div className="flex items-center w-full px-[24px] mt-[16px]">
          <PolaroidUpload
            photo={photoPreview}
            onSelect={(file) => {
              const reader = new FileReader();
              reader.onload = () => setPhotoPreview(reader.result as string);
              reader.readAsDataURL(file);
            }}
            testId="btn-upload-admin-photo"
            width={104}
            className="ml-[-1px] mt-[18px]"
          />

          {/* First + last name stacked beside photo */}
          <div className="flex flex-col gap-[16px] flex-1 min-w-0 pl-[21px]">
            <div className="flex flex-col gap-[6px] w-full">
              <label htmlFor="admin-firstname" className={labelClass}>first name</label>
              <input
                id="admin-firstname"
                data-testid="input-admin-firstname"
                type="text"
                placeholder="e.g. Sarah"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputClass(firstName)}
              />
            </div>
            <div className="flex flex-col gap-[6px] w-full">
              <label htmlFor="admin-lastname" className={labelClass}>last name</label>
              <input
                id="admin-lastname"
                data-testid="input-admin-lastname"
                type="text"
                placeholder="e.g. Johnson"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputClass(lastName)}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col w-full px-[24px] mt-[20px]" style={{ display: 'flex', flexDirection: 'column', rowGap: 22 }}>

          <div className="flex flex-col gap-[6px] w-full">
            <label
              htmlFor="admin-role"
              className={labelClass}
            >
              role
            </label>
            <input
              id="admin-role"
              data-testid="input-admin-role"
              type="text"
              placeholder="Principal, Head Teacher, or Administrator"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={inputClass(role)}
            />
          </div>

          <div className="flex flex-col gap-[6px] w-full">
            <label
              htmlFor="admin-school-name"
              className={labelClass}
            >
              school name
            </label>
            <input
              id="admin-school-name"
              data-testid="input-admin-school-name"
              type="text"
              placeholder="e.g. Sunshine Preschool"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className={inputClass(schoolName)}
            />
          </div>

          <div className="flex flex-col gap-[6px] w-full">
            <label
              htmlFor="admin-school-number"
              className={labelClass}
            >
              phone number
            </label>
            <input
              id="admin-school-number"
              data-testid="input-admin-school-number"
              type="tel"
              placeholder="e.g. (555) 123-4567"
              value={schoolNumber}
              onChange={(e) => setSchoolNumber(formatPhone(e.target.value))}
              className={inputClass(schoolNumber)}
            />
          </div>

          <div className="flex flex-col gap-[6px] w-full">
            <label
              htmlFor="admin-school-address"
              className={labelClass}
            >
              school address
            </label>
            <input
              id="admin-school-address"
              data-testid="input-admin-school-address"
              type="text"
              placeholder="e.g. 123 Maple Ave, Springfield"
              value={schoolAddress}
              onChange={(e) => setSchoolAddress(e.target.value)}
              className={inputClass(schoolAddress)}
            />
          </div>

          <div className="flex flex-col gap-[6px] w-full">
            <div className="flex items-baseline justify-between">
              <label
                className={labelClass}
              >
                school logo
              </label>
              <span className="[font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica] text-[#41444b]/40 text-[12px]">
                optional · PNG · 420×106px
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".png,image/png"
              className="hidden"
              onChange={handleLogoSelect}
            />

            <button
              type="button"
              data-testid="btn-upload-school-logo"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-[12px] border border-[#e0d9cc] bg-white flex items-center justify-center cursor-pointer overflow-hidden"
              style={{ height: logoPreview ? "auto" : 56 }}
            >
              {logoPreview ? (
                <div className="relative w-full flex items-center justify-center py-[14px] px-[16px]">
                  <img
                    src={logoPreview}
                    alt="School logo preview"
                    data-testid="img-school-logo-preview"
                    className="max-w-[210px] max-h-[53px] object-contain"
                  />
                  <button
                    type="button"
                    data-testid="btn-remove-school-logo"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLogoPreview(null);
                    }}
                    className="absolute right-[12px] top-1/2 -translate-y-1/2 flex items-center justify-center w-[28px] h-[28px] rounded-full bg-[#f0ede8] border-none cursor-pointer p-0"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path d="M12 4L4 12M4 4L12 12" stroke="#7a3428" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-[8px]">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#3e983a" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 8l-4-4-4 4M12 4v12" />
                  </svg>
                  <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[#3e983a] text-[16px]">
                    upload logo
                  </span>
                </div>
              )}
            </button>
            {logoError && (
              <p
                data-testid="error-school-logo"
                className="text-[#b34d3b] text-[12px] [font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica]"
              >
                {logoError}
              </p>
            )}
          </div>

        </div>
      </div>

      <BottomCTA>
        {saveError && (
          <p className="text-[#b34d3b] text-[13px] text-center [font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica] px-[4px]">
            {saveError}
          </p>
        )}
        <button
          type="button"
          data-testid="button-admininfo-save"
          onClick={handleSave}
          disabled={saving}
          className="w-full h-[44px] rounded-[50px] flex items-center justify-center cursor-pointer bg-white border border-[#f0f0f0] shadow-[0px_0px_4px_0px_rgba(0,0,0,0.06)] disabled:opacity-60"
        >
          <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#3e983a] text-[24px] font-semibold leading-[normal]">
            {saving ? "Saving…" : "Save"}
          </span>
        </button>
        <button
          type="button"
          data-testid="button-admininfo-cancel"
          onClick={() => setLocation("/onboarding/admin")}
          disabled={saving}
          className="bg-transparent border-none cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#3e983a] text-[21px] font-semibold leading-[normal] disabled:opacity-60"
        >
          Cancel
        </button>
      </BottomCTA>
    </div>
  );
};
