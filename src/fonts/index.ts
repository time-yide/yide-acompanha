import localFont from "next/font/local";

// Fontes dentro do projeto: com next/font/google o build dependia do Google Fonts e já derrubou deploys.
export const inter = localFont({ src: "./inter-latin-wght-normal.woff2", weight: "100 900", variable: "--font-inter", display: "swap" });
export const display = localFont({ src: "./sora-latin-wght-normal.woff2", weight: "100 800", variable: "--font-display", display: "swap" });
export const sans = localFont({
  src: [
    { path: "./ibm-plex-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./ibm-plex-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./ibm-plex-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-sans-blog",
  display: "swap",
});
