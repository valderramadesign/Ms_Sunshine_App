import { useLocation } from "wouter";
import BottomCTA from "@/components/BottomCTA";
import successIcon from "@assets/SuccessIcon 1.png";
import { useSchoolLogo } from "@/lib/useSchoolLogo";

export const Success = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const logoSrc = useSchoolLogo();

  return (
    <div className="flex flex-col h-dvh items-center relative overflow-hidden bg-[#f5f5f5]">

      {/* Ms.Sunshine logo */}
      <div className="flex flex-col items-center w-full flex-shrink-0 pt-[32px]">
        <img
          src={logoSrc}
          alt="Ms. Sunshine"
          data-testid="img-success-logo"
          className="w-[210px] h-auto object-contain"
        />
      </div>

      {/* Centered checkmark + message */}
      <div className="flex-1 flex flex-col items-center justify-center px-[24px] gap-[12px] mb-[60px] min-h-0">
        <img
          src={successIcon}
          alt="Success"
          data-testid="img-success-checkmark"
          className="w-[238px] max-w-full h-auto block"
        />
        <p
          data-testid="text-success-message"
          className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[#7a3428] text-[32px] text-center tracking-[-0.5px] leading-[32px] m-0 max-w-[302px]"
        >
          Activity was successfully added
        </p>
      </div>

      {/* Bottom CTA */}
      <BottomCTA>
        <button
          data-testid="btn-back-school"
          className="w-full h-[44px] rounded-[50px] flex items-center justify-center cursor-pointer bg-white border border-[#f0f0f0] shadow-[0px_0px_4px_0px_rgba(0,0,0,0.06)]"
          onClick={() => setLocation("/school")}
        >
          <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#3e983a] text-[24px] font-semibold leading-[normal]">
            Back to School
          </span>
        </button>
      </BottomCTA>
    </div>
  );
};
