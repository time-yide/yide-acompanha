import type { Metadata } from "next";
import { SITE_URL } from "@/lib/blog/config";
import { SiteShell } from "@/components/site/SiteShell";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell conteudoLargo>{children}</SiteShell>;
}
