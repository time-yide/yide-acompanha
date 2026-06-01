import Link from "next/link";
import { Clapperboard } from "lucide-react";

export function EditorIaEntryButton() {
  return (
    <Link
      href="/audiovisual/editor-ia"
      prefetch={false}
      className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      <Clapperboard className="h-4 w-4" />
      Yori
    </Link>
  );
}
