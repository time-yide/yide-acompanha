import { ImageResponse } from "next/og";
import { YIDE_MARK, MARK_ASPECT } from "@/lib/icon-mark";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

// Marca laçada da Yide centralizada, fundo transparente.
export default function Icon192() {
  const mark = YIDE_MARK;
  const h = Math.round(size.height * 0.72);
  const w = Math.round(h * MARK_ASPECT);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: w,
            height: h,
            backgroundImage: `url(${mark})`,
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
