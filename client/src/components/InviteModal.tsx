import { createPortal } from "react-dom";

const FONT = "[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica]";

export type InviteEntry = { name: string; email: string };

type Props = {
  entries: InviteEntry[];
  onDismiss: () => void;
};

export default function InviteModal({ entries, onDismiss }: Props) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      data-testid="invite-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }}
    >
      <div
        className="bg-white rounded-[20px] shadow-[0px_4px_24px_rgba(0,0,0,0.12)] mx-[24px] w-full max-w-[360px] flex flex-col items-center px-[28px] py-[28px] gap-[20px]"
        data-testid="invite-modal"
      >
        <p
          className={`${FONT} font-semibold text-[20px] text-[#7a3428] text-center leading-[1.3]`}
          data-testid="invite-modal-title"
        >
          Invite{entries.length > 1 ? "s" : ""} sent!
        </p>

        <div className="flex flex-col gap-[12px] w-full">
          {entries.map((e, i) => (
            <div key={i} className="flex flex-col gap-[2px]" data-testid={`invite-modal-entry-${i}`}>
              <p className={`${FONT} font-semibold text-[15px] text-[#41444b] leading-[normal]`}>
                {e.name}
              </p>
              <p className={`${FONT} font-normal text-[13px] text-[#41444b]/60 leading-[normal]`}>
                {e.email}
              </p>
            </div>
          ))}
        </div>

        <button
          type="button"
          data-testid="invite-modal-dismiss"
          onClick={onDismiss}
          className="bg-white drop-shadow-[0px_0px_4px_rgba(0,0,0,0.08)] flex items-center justify-center px-[32px] py-[12px] rounded-[50px] w-full border border-[#f0f0f0] cursor-pointer mt-[4px]"
        >
          <span className={`${FONT} font-semibold text-[18px] text-[#3e983a] leading-[normal]`}>
            Got it
          </span>
        </button>
      </div>
    </div>,
    document.body,
  );
}
