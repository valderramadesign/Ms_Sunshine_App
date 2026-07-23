import { useState } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { roleHome, type Role } from "@/lib/auth";

export const AdminLogin = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const errorBorder = "border-[#b34d3b]";
  const normalBorder = "border-[#e9e5dc]";

  const isInvalid = (field: string) => validationAttempted && !!errors[field];

  const handleLogin = async () => {
    setValidationAttempted(true);
    const newErrors: Record<string, string> = {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address.";
    }
    if (!password) {
      newErrors.password = "Please enter your password.";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/login", { email, password });
      const body = (await res.json()) as { role: Role; childIds?: string[] };
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation(roleHome(body.role, body.childIds ?? []));
    } catch {
      setErrors({ general: "Incorrect email or password." });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async () => {
    if (!forgotEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail)) {
      setForgotError("Please enter a valid email address.");
      return;
    }
    setForgotError("");
    setForgotLoading(true);
    try {
      await apiRequest("POST", "/api/auth/forgot-password", { email: forgotEmail });
      setForgotSent(true);
    } catch {
      setForgotError("Something went wrong. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgot = () => {
    setShowForgot(false);
    setForgotEmail("");
    setForgotError("");
    setForgotSent(false);
    setForgotLoading(false);
  };

  const inputClass = (fieldName: string) =>
    `bg-white border ${isInvalid(fieldName) ? errorBorder : normalBorder} border-solid content-stretch flex items-center p-[16px] relative rounded-[5px] w-full outline-none text-[14px] text-[#41444b] [font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica] placeholder-[#41444b]/50`;

  const forgotInputClass = forgotError
    ? `bg-white border ${errorBorder} border-solid flex items-center p-[16px] rounded-[5px] w-full outline-none text-[14px] text-[#41444b] [font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica] placeholder-[#41444b]/50`
    : `bg-white border ${normalBorder} border-solid flex items-center p-[16px] rounded-[5px] w-full outline-none text-[14px] text-[#41444b] [font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica] placeholder-[#41444b]/50`;

  return (
    <>
      <div className="fixed inset-0 flex flex-col items-center bg-[#f5f5f5] px-[24px] overflow-y-auto pt-[10dvh] pb-[13dvh]">
        <div className="flex flex-col gap-[36px] items-center w-full max-w-[402px] my-auto">

          <div className="flex flex-col gap-[22px] items-center w-full">
            <div className="h-[81px] relative shrink-0 w-[296px]">
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <img
                  src="/figmaAssets/login-logo2.png"
                  alt="Ms. Sunshine"
                  data-testid="img-login-logo"
                  className="absolute max-w-none"
                  style={{
                    width: "137.63%",
                    height: "335.74%",
                    left: "-19%",
                    top: "-95.74%",
                  }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-[8px] items-center">
              <p
                data-testid="text-login-welcome"
                className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[32px] text-[#8f530f] tracking-[-0.5px] leading-[normal] text-center"
              >
                Welcome!
              </p>
              <p
                data-testid="text-login-subtitle"
                className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[20px] text-[#41444b] text-center leading-[normal]"
              >
                Please enter your email and password.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-[32px] items-start w-full">
            <div className="flex flex-col gap-[20px] items-center w-full">

              <div className="flex flex-col gap-[4px] items-start w-full">
                <label
                  htmlFor="login-email"
                  className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[14px] text-[#41444b] leading-[normal]"
                >
                  email address
                </label>
                <input
                  id="login-email"
                  data-testid="input-login-email"
                  type="email"
                  placeholder="e.g. admin@school.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrors((p) => ({ ...p, email: "", general: "" }));
                  }}
                  className={inputClass("email")}
                />
                {errors.email && (
                  <p
                    data-testid="error-login-email"
                    className="text-[#b34d3b] text-[12px] [font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica]"
                  >
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-[4px] items-start w-full">
                <label
                  htmlFor="login-password"
                  className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[14px] text-[#41444b] leading-[normal]"
                >
                  password
                </label>
                <div className="relative w-full">
                  <input
                    id="login-password"
                    data-testid="input-login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrors((p) => ({ ...p, password: "", general: "" }));
                    }}
                    className={`${inputClass("password")} pr-[44px]`}
                  />
                  <button
                    type="button"
                    data-testid="button-toggle-login-password"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-[14px] top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer p-0"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <img
                      src="/figmaAssets/icon-eye.png"
                      alt="toggle password"
                      className="w-[18px] h-[13px] object-contain"
                      style={{ opacity: showPassword ? 1 : 0.5 }}
                    />
                  </button>
                </div>
                {errors.password && (
                  <p
                    data-testid="error-login-password"
                    className="text-[#b34d3b] text-[12px] [font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica]"
                  >
                    {errors.password}
                  </p>
                )}
                {errors.general && (
                  <p
                    data-testid="error-login-general"
                    className="text-[#b34d3b] text-[12px] [font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica]"
                  >
                    {errors.general}
                  </p>
                )}
                <button
                  type="button"
                  data-testid="button-forgot-password"
                  onClick={() => setShowForgot(true)}
                  className="bg-transparent border-none cursor-pointer p-0 mt-[2px]"
                >
                  <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[14px] text-[#3e983a] leading-[18px]">
                    forgot your password?
                  </span>
                </button>
              </div>
            </div>

            <button
              type="button"
              data-testid="button-login-submit"
              onClick={handleLogin}
              disabled={loading}
              className="bg-white drop-shadow-[0px_0px_2px_rgba(0,0,0,0.06)] flex items-center justify-center px-[16px] py-[8px] relative rounded-[50px] w-full border border-[#f0f0f0] cursor-pointer disabled:opacity-60"
            >
              <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold leading-[normal] text-[24px] text-[#3e983a] text-center whitespace-nowrap">
                {loading ? "Logging in…" : "Login"}
              </span>
            </button>
          </div>

        </div>
      </div>

      {showForgot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-[24px]"
          data-testid="overlay-forgot-password"
          onClick={(e) => { if (e.target === e.currentTarget) closeForgot(); }}
        >
          <div className="bg-white rounded-[20px] w-full max-w-[380px] p-[28px] flex flex-col gap-[20px] shadow-lg">
            {forgotSent ? (
              <>
                <p
                  data-testid="text-forgot-sent-title"
                  className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[22px] text-[#8f530f] text-center"
                >
                  Check your email
                </p>
                <p
                  data-testid="text-forgot-sent-body"
                  className="[font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica] text-[15px] text-[#41444b] text-center leading-[1.5]"
                >
                  If an account exists for{" "}
                  <span className="font-semibold">{forgotEmail}</span>, you'll
                  receive a password reset link shortly.
                </p>
                <button
                  type="button"
                  data-testid="button-forgot-done"
                  onClick={closeForgot}
                  className="bg-white drop-shadow-[0px_0px_2px_rgba(0,0,0,0.06)] flex items-center justify-center px-[16px] py-[10px] rounded-[50px] w-full border border-[#f0f0f0] cursor-pointer"
                >
                  <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[18px] text-[#3e983a]">
                    Done
                  </span>
                </button>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-[4px]">
                  <p
                    data-testid="text-forgot-title"
                    className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[22px] text-[#8f530f]"
                  >
                    Forgot password?
                  </p>
                  <p className="[font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica] text-[14px] text-[#41444b]/70 leading-[1.4]">
                    Enter your email and we'll send you a reset link.
                  </p>
                </div>
                <div className="flex flex-col gap-[4px]">
                  <label className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[14px] text-[#41444b]">
                    email address
                  </label>
                  <input
                    data-testid="input-forgot-email"
                    type="email"
                    placeholder="e.g. you@school.com"
                    value={forgotEmail}
                    onChange={(e) => {
                      setForgotEmail(e.target.value);
                      setForgotError("");
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleForgotSubmit(); }}
                    className={forgotInputClass}
                    autoFocus
                  />
                  {forgotError && (
                    <p
                      data-testid="error-forgot-email"
                      className="text-[#b34d3b] text-[12px] [font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica]"
                    >
                      {forgotError}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-[10px]">
                  <button
                    type="button"
                    data-testid="button-forgot-submit"
                    onClick={handleForgotSubmit}
                    disabled={forgotLoading}
                    className="bg-white drop-shadow-[0px_0px_2px_rgba(0,0,0,0.06)] flex items-center justify-center px-[16px] py-[10px] rounded-[50px] w-full border border-[#f0f0f0] cursor-pointer disabled:opacity-60"
                  >
                    <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[18px] text-[#3e983a]">
                      {forgotLoading ? "Sending…" : "Send reset link"}
                    </span>
                  </button>
                  <button
                    type="button"
                    data-testid="button-forgot-cancel"
                    onClick={closeForgot}
                    className="bg-transparent border-none cursor-pointer p-0 text-center"
                  >
                    <span className="[font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica] text-[14px] text-[#41444b]/60">
                      Cancel
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
