import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { roleHome, type Role } from "@/lib/auth";

type ResetInfo = { valid: true; email: string } | { valid: false };

export const ResetPassword = (): JSX.Element => {
  const params = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery<ResetInfo>({
    queryKey: ["/api/auth/reset-password", params.token],
    queryFn: () =>
      fetch(`/api/auth/reset-password/${params.token}`).then((r) => r.json()),
  });

  const normalBorder = "border-[#e9e5dc]";
  const errorBorder = "border-[#b34d3b]";
  const inputClass = (field: string) =>
    `bg-white border ${errors[field] ? errorBorder : normalBorder} border-solid flex items-center p-[16px] rounded-[5px] w-full outline-none text-[14px] text-[#41444b] [font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica] placeholder-[#41444b]/50`;

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    if (password.length < 8) newErrors.password = "Password must be at least 8 characters.";
    if (confirm !== password) newErrors.confirm = "Passwords do not match.";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", `/api/auth/reset-password/${params.token}`, { password });
      const body = (await res.json()) as { role: Role; childIds?: string[] };
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation(roleHome(body.role, body.childIds ?? []));
    } catch {
      setErrors({ general: "Could not reset your password. The link may have expired." });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="fixed inset-0 flex items-center justify-center bg-[#f5f5f5]" data-testid="reset-loading" />;
  }

  if (!data || !data.valid) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#f5f5f5] px-[24px] text-center gap-[20px]">
        <p
          data-testid="text-reset-invalid"
          className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[24px] text-[#7a3428]"
        >
          This reset link is invalid or has expired.
        </p>
        <button
          type="button"
          data-testid="button-reset-go-login"
          onClick={() => setLocation("/")}
          className="bg-white drop-shadow-[0px_0px_2px_rgba(0,0,0,0.06)] flex items-center justify-center px-[24px] py-[10px] rounded-[50px] border border-[#f0f0f0] cursor-pointer"
        >
          <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[18px] text-[#3e983a]">
            Go to login
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col items-center bg-[#f5f5f5] px-[24px] overflow-y-auto pt-[10dvh] pb-[10dvh]">
      <div className="flex flex-col gap-[32px] items-center w-full max-w-[402px] my-auto">
        <div className="flex flex-col gap-[8px] items-center text-center">
          <p
            data-testid="text-reset-title"
            className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[32px] text-[#8f530f] tracking-[-0.5px] leading-[normal]"
          >
            Reset Password
          </p>
          <p
            data-testid="text-reset-subtitle"
            className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[18px] text-[#41444b] leading-[normal]"
          >
            Choose a new password for{" "}
            <span className="font-semibold">{data.email}</span>.
          </p>
        </div>

        <div className="flex flex-col gap-[20px] items-start w-full">
          <div className="flex flex-col gap-[4px] items-start w-full">
            <label className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[14px] text-[#41444b]">
              new password
            </label>
            <div className="relative w-full">
              <input
                data-testid="input-reset-password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors((p) => ({ ...p, password: "", general: "" }));
                }}
                className={`${inputClass("password")} pr-[44px]`}
              />
              <button
                type="button"
                data-testid="button-toggle-reset-password"
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
              <p data-testid="error-reset-password" className="text-[#b34d3b] text-[12px] [font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica]">
                {errors.password}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-[4px] items-start w-full">
            <label className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[14px] text-[#41444b]">
              confirm password
            </label>
            <input
              data-testid="input-reset-confirm"
              type={showPassword ? "text" : "password"}
              placeholder="Re-enter password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setErrors((p) => ({ ...p, confirm: "", general: "" }));
              }}
              className={inputClass("confirm")}
            />
            {errors.confirm && (
              <p data-testid="error-reset-confirm" className="text-[#b34d3b] text-[12px] [font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica]">
                {errors.confirm}
              </p>
            )}
            {errors.general && (
              <p data-testid="error-reset-general" className="text-[#b34d3b] text-[12px] [font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica]">
                {errors.general}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          data-testid="button-reset-submit"
          onClick={handleSubmit}
          disabled={submitting}
          className="bg-white drop-shadow-[0px_0px_2px_rgba(0,0,0,0.06)] flex items-center justify-center px-[16px] py-[8px] rounded-[50px] w-full border border-[#f0f0f0] cursor-pointer disabled:opacity-60"
        >
          <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[24px] text-[#3e983a]">
            {submitting ? "Saving…" : "Set new password"}
          </span>
        </button>

        <button
          type="button"
          data-testid="button-reset-back-login"
          onClick={() => setLocation("/")}
          className="bg-transparent border-none cursor-pointer p-0"
        >
          <span className="[font-family:'SF_Pro_Rounded-Regular','M_PLUS_Rounded_1c',Helvetica] text-[14px] text-[#41444b]/60">
            Back to login
          </span>
        </button>
      </div>
    </div>
  );
};
