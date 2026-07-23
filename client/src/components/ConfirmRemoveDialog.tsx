import { motion, AnimatePresence } from "framer-motion";

const FONT = "[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica]";

export default function ConfirmRemoveDialog({
  open,
  title,
  message,
  confirmLabel = "remove",
  pendingLabel = "removing…",
  isPending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  pendingLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}): JSX.Element {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-[24px]"
          onClick={onCancel}
          data-testid="confirm-remove-overlay"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="w-full max-w-[340px] rounded-[20px] bg-[#fffbf2] px-[24px] py-[28px] flex flex-col items-center text-center shadow-[0px_8px_24px_rgba(0,0,0,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className={`${FONT} font-semibold text-[#8f530f] text-[22px] leading-[26px] mb-[8px]`}>{title}</p>
            <p className={`${FONT} font-normal text-[#41444b] text-[15px] leading-[21px] mb-[24px]`}>{message}</p>
            <div className="flex flex-col gap-[12px] w-full">
              <button
                data-testid="btn-confirm-remove"
                disabled={isPending}
                onClick={onConfirm}
                className={`w-full h-[48px] rounded-[100px] border-none cursor-pointer ${FONT} font-semibold text-white text-[18px]`}
                style={{ background: "#DC2626", opacity: isPending ? 0.6 : 1 }}
              >
                {isPending ? pendingLabel : confirmLabel}
              </button>
              <button
                data-testid="btn-cancel-remove"
                onClick={onCancel}
                className={`w-full bg-transparent border-none cursor-pointer ${FONT} font-semibold text-[#3e983a] text-[16px] py-[4px]`}
              >
                cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
