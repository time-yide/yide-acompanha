import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireEditorIaAccess } from "@/lib/editor-ia/actions";
import { NovoJobForm } from "@/components/editor-ia/NovoJobForm";

export const dynamic = "force-dynamic";

export default async function NovoEditorIaJobPage() {
  await requireEditorIaAccess();

  return (
    <div className="max-w-3xl space-y-4">
      <Link
        href="/audiovisual/editor-ia"
        prefetch={false}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Voltar
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Novo vídeo</h1>

      <NovoJobForm />
    </div>
  );
}
