import Link from "next/link";
import { Sparkles } from "lucide-react";

export function YoriEntryButton() {
  return (
    <Link
      href="/audiovisual/yori"
      prefetch={false}
      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary/80 px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:from-primary/90 hover:to-primary/70 transition-colors"
    >
      <Sparkles className="h-4 w-4" />
      Yori — Editor IA
    </Link>
  );
}
