import Link from "next/link";
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/blog/config";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/blog" className="text-lg font-bold tracking-tight">
            Yide <span className="text-primary">Blog</span>
          </Link>
          <a href="https://yidedigital.com.br" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground">
            yidedigital.com.br
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">{children}</main>
      <footer className="border-t">
        <div className="mx-auto max-w-3xl px-4 py-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Yide Digital — conteúdo sobre marketing, tecnologia e IA.
        </div>
      </footer>
    </div>
  );
}
