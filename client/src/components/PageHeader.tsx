import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actionText?: string;
  onAction?: () => void;
  backTo?: string;
  onBackClick?: () => void;
  onBack?: () => void;
  onTitleClick?: () => void;
  actionNode?: React.ReactNode;
  hideTitleRow?: boolean;
  disableHeaderNav?: boolean;
};

export default function PageHeader({
  title,
  subtitle,
  actionText,
  onAction,
  backTo,
  onBackClick,
  onBack,
  onTitleClick,
  actionNode,
  hideTitleRow,
  disableHeaderNav,
}: PageHeaderProps) {
  const [, setLocation] = useLocation();
  const { role } = useAuth();
  const isParent = role === "parent";
  const navDisabled = disableHeaderNav || isParent;

  const handleBack = () => {
    if (onBack) onBack();
    if (onBackClick) {
      onBackClick();
    } else if (backTo) {
      setLocation(backTo);
    }
  };

  const showBack = !!(backTo || onBackClick);

  return (
    <div className="flex flex-col items-center w-full flex-shrink-0" data-testid="page-header">
      <img className={`w-full h-7 flex-shrink-0 object-cover ${navDisabled ? "" : "cursor-pointer"}`} alt="Color bar" src="/figmaAssets/group-2.png" onClick={navDisabled ? undefined : () => setLocation("/home")} data-testid="link-home-header" />
      {!hideTitleRow && (
        <div
          className="flex w-full items-baseline justify-between flex-shrink-0 mt-[22px] mb-[8px]"
          style={{ paddingLeft: 24, paddingRight: 24, minHeight: 40 }}
        >
          <div className="flex items-baseline gap-[12px]">
            {showBack && (
              <button
                data-testid="button-back"
                onClick={handleBack}
                className="flex items-center justify-center w-[40px] h-[40px] rounded-full bg-[#ffffff] border-none cursor-pointer p-0 flex-shrink-0 shadow-[0px_1px_3px_rgba(0,0,0,0.08)] self-center"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M9 15L4 10L9 5" stroke="#41444B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="4" y1="10" x2="16" y2="10" stroke="#41444B" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            )}
            <div className="flex items-baseline gap-[8px]">
              <span
                data-testid="text-page-title"
                className={`[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[32px] tracking-[-0.50px] leading-[normal] whitespace-nowrap text-[#7a3428]${onTitleClick ? " cursor-pointer" : ""}`}
                onClick={onTitleClick}
              >
                {title}
              </span>
              {subtitle && (
                <span
                  data-testid="text-page-subtitle"
                  className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#1B5C68] text-[16px] leading-[normal] whitespace-nowrap"
                >
                  {subtitle}
                </span>
              )}
            </div>
          </div>

          {actionNode ? (
            actionNode
          ) : actionText ? (
            <button
              data-testid="button-page-action"
              onClick={onAction}
              className="bg-transparent border-none cursor-pointer p-0"
            >
              <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal text-[#1B5C68] text-[16px] leading-[18px] whitespace-nowrap">
                {actionText}
              </span>
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
