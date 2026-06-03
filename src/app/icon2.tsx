import { ImageResponse } from "next/og";
import { YIDE_MARK, MARK_ASPECT } from "@/lib/icon-mark";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// Variante "maskable" (Android adaptive icon). Maskable PRECISA preencher o
// quadrado todo — transparência aqui quebra (o sistema recorta em
// círculo/squircle e mostraria buracos). Por isso usamos o fundo escuro da
// marca (#0a0a0a) e padding maior pra respeitar a safe-zone (~80%).
export default function IconMaskable() {
  const mark = YIDE_MARK;
  const h = Math.round(size.height * 0.56);
  const w = Math.round(h * MARK_ASPECT);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0a0a",
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
