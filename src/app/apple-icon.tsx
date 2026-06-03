import { ImageResponse } from "next/og";
import { YIDE_MARK, MARK_ASPECT } from "@/lib/icon-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Marca laçada da Yide centralizada. Fundo transparente — o iOS achata a
// transparência sobre preto no ícone instalado (marca ciano sobre fundo escuro).
export default function AppleIcon() {
  const mark = YIDE_MARK;
  const h = Math.round(size.height * 0.7);
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
