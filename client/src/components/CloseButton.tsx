interface CloseButtonProps {
  onClick: () => void;
  testId?: string;
}

export function CloseButton({ onClick, testId = "btn-close" }: CloseButtonProps) {
  return (
    <button
      data-testid={testId}
      className="flex items-center justify-center w-[40px] h-[40px] rounded-full bg-white border-none cursor-pointer p-0 flex-shrink-0 shadow-[0px_1px_3px_rgba(0,0,0,0.08)] self-center"
      onClick={onClick}
      aria-label="Close"
    >
      <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
        <path d="M12 4L4 12M4 4L12 12" stroke="#41444B" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}
