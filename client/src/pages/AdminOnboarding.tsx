import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import BottomCTA from "@/components/BottomCTA";
import { setOnboardingCredentials } from "@/lib/onboardingCredentials";

export const AdminOnboarding = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const { data: adminStatus } = useQuery<{ exists: boolean }>({ queryKey: ["/api/admin/status"] });

  useEffect(() => {
    if (adminStatus?.exists) {
      setLocation("/");
    }
  }, [adminStatus, setLocation]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordHint, setPasswordHint] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const errorBorder = "border-[#b34d3b]";
  const normalBorder = "border-[#e0d9cc]";

  const isFieldEmpty = (value: string) => validationAttempted && !value.trim();

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address.";
    }
    if (!password || password.length < 8) {
      newErrors.password = "Password must be at least 8 characters.";
    }
    if (confirmPassword !== password) {
      newErrors.confirmPassword = "Passwords do not match.";
    }
    if (!passwordHint.trim()) {
      newErrors.passwordHint = "Please enter a password hint phrase.";
    }
    return newErrors;
  };

  const handleContinue = () => {
    setValidationAttempted(true);
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    // In production the server requires a one-time setup token to create the
    // owner account; it is provided via the onboarding link (?setup=...).
    const setupToken = new URLSearchParams(window.location.search).get("setup") || "";
    setOnboardingCredentials({ email, password, passwordHint, setupToken });
    setLocation("/onboarding/admin-info");
  };

  const handleCancel = () => {
    setLocation("/");
  };

  const inputClass = (fieldValue: string, fieldName: string) =>
    `w-full rounded-[12px] border ${
      isFieldEmpty(fieldValue) || errors[fieldName]
        ? errorBorder
        : normalBorder
    } bg-white px-[16px] py-[12px] text-[16px] text-[#41444b] placeholder-[#41444b]/40 outline-none focus:border-[#41444b] [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal`;

  const labelClass =
    "[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#41444b] text-[14px] leading-[normal] tracking-[0.3px]";

  return (
    <div className="flex flex-col h-dvh items-center relative overflow-hidden bg-[#f5f5f5]">
      <div className="flex flex-col items-center w-full flex-shrink-0 pt-[32px]">
        <img
          src="/figmaAssets/demo-logo.png"
          alt="Ms. Sunshine"
          data-testid="img-onboarding-logo"
          className="w-[210px] h-auto object-contain"
        />
        <div className="flex w-full items-baseline justify-between px-[24px] mt-[18px] mb-[8px]">
          <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[32px] tracking-[-0.50px] leading-[normal] whitespace-nowrap text-[#7a3428]">
            admin setup
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto w-full flex flex-col items-center pb-[26px]">
        <div className="flex flex-col gap-[20px] w-full px-[24px] mt-[8px]">

          <div className="flex flex-col gap-[6px] w-full">
            <label
              htmlFor="admin-email"
              className={labelClass}
            >
              email address
            </label>
            <input
              id="admin-email"
              data-testid="input-admin-email"
              type="email"
              placeholder="e.g. admin@school.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((p) => ({ ...p, email: "" }));
              }}
              className={inputClass(email, "email")}
            />
            {errors.email && (
              <p
                data-testid="error-admin-email"
                className="text-[#b34d3b] text-[12px] [font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica]"
              >
                {errors.email}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-[6px] w-full">
            <label
              htmlFor="admin-password"
              className={labelClass}
            >
              password
            </label>
            <div className="relative">
              <input
                id="admin-password"
                data-testid="input-admin-password"
                type={showPassword ? "text" : "password"}
                placeholder="at least 8 characters"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors((p) => ({ ...p, password: "" }));
                }}
                className={`${inputClass(password, "password")} pr-[48px]`}
              />
              <button
                type="button"
                data-testid="button-toggle-password"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-[14px] top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer p-0"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#9a8e82" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.477 10.477A3 3 0 0013.5 13.5M6.228 6.228A10.45 10.45 0 003 12c1.657 4.418 6 7.5 9 7.5a9.9 9.9 0 004.772-1.228M9.88 4.88A9.9 9.9 0 0112 4.5c3 0 7.343 3.082 9 7.5a10.47 10.47 0 01-1.228 2.772" />
                  </svg>
                ) : (
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#9a8e82" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7a10.476 10.476 0 01-9.542 7C7.523 19 3.732 16.057 2.458 12z" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && (
              <p
                data-testid="error-admin-password"
                className="text-[#b34d3b] text-[12px] [font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica]"
              >
                {errors.password}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-[6px] w-full">
            <label
              htmlFor="admin-confirm-password"
              className={labelClass}
            >
              confirm password
            </label>
            <div className="relative">
              <input
                id="admin-confirm-password"
                data-testid="input-admin-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="re-enter your password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setErrors((p) => ({ ...p, confirmPassword: "" }));
                }}
                className={`${inputClass(confirmPassword, "confirmPassword")} pr-[48px]`}
              />
              <button
                type="button"
                data-testid="button-toggle-confirm-password"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-[14px] top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer p-0"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? (
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#9a8e82" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.477 10.477A3 3 0 0013.5 13.5M6.228 6.228A10.45 10.45 0 003 12c1.657 4.418 6 7.5 9 7.5a9.9 9.9 0 004.772-1.228M9.88 4.88A9.9 9.9 0 0112 4.5c3 0 7.343 3.082 9 7.5a10.47 10.47 0 01-1.228 2.772" />
                  </svg>
                ) : (
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#9a8e82" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7a10.476 10.476 0 01-9.542 7C7.523 19 3.732 16.057 2.458 12z" />
                  </svg>
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p
                data-testid="error-admin-confirm-password"
                className="text-[#b34d3b] text-[12px] [font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica]"
              >
                {errors.confirmPassword}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-[6px] w-full">
            <label
              htmlFor="admin-password-hint"
              className={labelClass}
            >
              password hint phrase
            </label>
            <input
              id="admin-password-hint"
              data-testid="input-admin-password-hint"
              type="text"
              placeholder="a phrase to help you remember"
              value={passwordHint}
              onChange={(e) => {
                setPasswordHint(e.target.value);
                setErrors((p) => ({ ...p, passwordHint: "" }));
              }}
              className={inputClass(passwordHint, "passwordHint")}
            />
            {errors.passwordHint && (
              <p
                data-testid="error-admin-password-hint"
                className="text-[#b34d3b] text-[12px] [font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica]"
              >
                {errors.passwordHint}
              </p>
            )}
          </div>

        </div>
      </div>

      <BottomCTA>
        <button
          type="button"
          data-testid="button-onboarding-continue"
          onClick={handleContinue}
          className="w-full h-[44px] rounded-[50px] flex items-center justify-center cursor-pointer bg-white border border-[#f0f0f0] shadow-[0px_0px_4px_0px_rgba(0,0,0,0.06)]"
        >
          <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#3e983a] text-[24px] font-semibold leading-[normal]">
            Continue
          </span>
        </button>
        <button
          type="button"
          data-testid="button-onboarding-cancel"
          onClick={handleCancel}
          className="bg-transparent border-none cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#3e983a] text-[21px] font-semibold leading-[normal]"
        >
          Cancel
        </button>
      </BottomCTA>
    </div>
  );
};
