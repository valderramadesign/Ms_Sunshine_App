import { useRef } from "react";
import photoFrameImg from "@assets/PhotoFrame_1780975215901.png";

const FONT = "[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica]";

export default function PolaroidUpload({
  photo,
  onSelect,
  testId,
  width = 104,
  className = "",
  initials = "",
}: {
  photo: string;
  onSelect: (file: File) => void;
  testId: string;
  width?: number;
  className?: string;
  initials?: string;
}): JSX.Element {
  const ref = useRef<HTMLInputElement>(null);
  const height = Math.round(width * (474 / 438)) - 3;
  const windowStyle = { top: "8.9%", bottom: "24.9%", left: "10.7%", right: "10.7%" } as const;
  const fontSize = Math.round(width * 0.2);

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width, height }}>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        data-testid={testId}
        className="absolute inset-0 p-0 bg-transparent border-none cursor-pointer"
        onClick={() => ref.current?.click()}
        aria-label="Upload photo"
      >
        <div className="absolute overflow-hidden" style={windowStyle}>
          {photo ? (
            <img
              src={photo}
              alt="Upload preview"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: "top center" }}
            />
          ) : null}
        </div>
        <img
          src={photoFrameImg}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full"
        />
        {!photo && (
          <div className="absolute flex flex-col items-center justify-center" style={windowStyle}>
            {initials ? (
              <span
                className={`${FONT} font-semibold leading-none`}
                style={{ fontSize, color: "#e0d9cc" }}
              >
                {initials}
              </span>
            ) : (
              <>
                <span className={`${FONT} font-light text-[#3e983a] text-[28px] leading-none`}>+</span>
                <span className={`${FONT} font-normal text-[#3e983a] text-[14px] text-center leading-tight`}>
                  upload<br />photo
                </span>
              </>
            )}
          </div>
        )}
      </button>
    </div>
  );
}
