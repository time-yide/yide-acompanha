// Gravador de reunião INTERNA (sem cliente vinculado) — ex: reunião geral,
// comercial. O gravador do cliente fica em /clientes/[id]/reunioes; este é o
// caminho pra reuniões que não são de um cliente específico.
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { canRecordMeeting } from "@/lib/reunioes/permissions";
import { GravadorReuniao } from "@/components/reunioes/GravadorReuniao";

export default async function GravarReuniaoInternaPage({
  searchParams,
}: {
  searchParams: Promise<{ titulo?: string }>;
}) {
  const user = await requireAuth();
  if (!canRecordMeeting(user.role)) notFound();
  const { titulo } = await searchParams;

  return (
    <div className="mx-auto max-w-lg space-y-4 py-6">
      <Link href="/calendario" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar ao calendário
      </Link>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Gravar reunião interna</h1>
        <p className="text-sm text-muted-foreground">
          Reunião sem cliente vinculado (ex: reunião geral, comercial). A gravação fica em{" "}
          <Link href="/reunioes" className="text-primary hover:underline">Reuniões</Link>.
        </p>
      </div>
      {/* Sem clientId → gravação interna. autoAbrir já abre o gravador. */}
      <GravadorReuniao tituloInicial={titulo ?? ""} autoAbrir />
    </div>
  );
}
