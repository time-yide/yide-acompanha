import { Inter } from "next/font/google";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { PWARegister } from "@/components/pwa/PWARegister";
import { IOSInstallBanner } from "@/components/pwa/IOSInstallBanner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

// Ícones vêm dos arquivos em src/app/: icon.svg (favicon), apple-icon.tsx
// (180x180), icon0.tsx (192x192), icon1.tsx (512x512). Não definir
// `metadata.icons` aqui — sobrescreveria a convenção.
export const metadata: Metadata = {
  title: "Yide Digital",
  description: "Sistema de acompanhamento da Yide Digital",
  manifest: "/manifest.webmanifest",
  applicationName: "Yide",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Yide",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Respeita safe-area do iPhone (notch + home indicator) quando instalado
  // como PWA — sem isso a UI cola na borda do recorte da tela.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors position="top-right" />
          <PWARegister />
          <IOSInstallBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
