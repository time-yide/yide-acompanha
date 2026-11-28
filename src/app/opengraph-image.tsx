import { ImageResponse } from "next/og";
import { YIDE_MARK, MARK_ASPECT } from "@/lib/icon-mark";

// Imagem de compartilhamento padrão do site (WhatsApp, LinkedIn, Facebook).
// Vale para todas as rotas que não definem a própria imagem.
export const alt = "Yide Digital: agência de marketing, vendas e IA em Cuiabá-MT";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const markH = 150;
  const markW = Math.round(markH * MARK_ASPECT);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #04121a 0%, #0a2a33 60%, #0d3b44 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: markW,
              height: markH,
              backgroundImage: `url(${YIDE_MARK})`,
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
            }}
          />
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 4, color: "#2de6e6", fontWeight: 700 }}>
            YIDE DIGITAL · CUIABÁ-MT
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", fontSize: 62, fontWeight: 800, lineHeight: 1.1 }}>
            Agência de marketing, vendas e IA
          </div>
          <div style={{ display: "flex", fontSize: 34, color: "rgba(255,255,255,0.75)" }}>
            Anúncios, conteúdo, site, e-commerce e CRM com IA no WhatsApp
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 28 }}>
          {["+100 clientes ativos", "+R$ 18 mi em anúncios", "yidedigital.com.br"].map((t, i) => (
            <div
              key={t}
              style={{
                display: "flex",
                padding: "10px 24px",
                borderRadius: 999,
                border: i === 2 ? "none" : "2px solid rgba(255,255,255,0.35)",
                background: i === 2 ? "#2de6e6" : "transparent",
                color: i === 2 ? "#04121a" : "#ffffff",
                fontWeight: i === 2 ? 700 : 400,
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
