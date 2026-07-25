import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Mic } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { listMeetings } from "@/lib/reunioes/queries";
import { canViewMeetings } from "@/lib/reunioes/permissions";
import { MeetingCard } from "@/components/reunioes/MeetingCard";
import { buttonVariants } from "@/components/ui/button";
import type { MeetingListItem } from "@/lib/reunioes/tipos";

export const dynamic = "force-dynamic";

/**
 * Sub-página do Calendário: reuniões GRAVADAS, agrupadas por cliente. Só lista o
 * que já tem gravação (recording_ready) pra achar rápido e abrir a tela de
 * detalhe (áudio/vídeo + transcrição, que já existem em /reunioes/[id]).
 * Reaproveita listMeetings (respeita visibilidade) e o MeetingCard.
 */
export default async function ReunioesGravadasPage() {
  const user = await requireAuth();
  if (!canViewMeetings(user.role)) notFound();

  const todas = await listMeetings(user);
  const gravadas = todas.filter((m) => m.recording_ready);

  // Agrupa por cliente. Sem cliente vinculado cai num grupo no fim.
  const SEM_CLIENTE = "__sem_cliente__";
  const grupos = new Map<string, { nome: string; itens: MeetingListItem[] }>();
  for (const m of gravadas) {
    const key = m.client_id ?? SEM_CLIENTE;
    const nome = m.client_nome ?? "Sem cliente vinculado";
    if (!grupos.has(key)) grupos.set(key, { nome, itens: [] });
    grupos.get(key)!.itens.push(m);
  }
  // Ordena: clientes por nome (A→Z); "Sem cliente" sempre por último.
  const blocos = [...grupos.entries()].sort(([ka, a], [kb, b]) => {
    if (ka === SEM_CLIENTE) return 1;
    if (kb === SEM_CLIENTE) return -1;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/calendario"
            className={buttonVariants({ variant: "outline", size: "sm" })}
            aria-label="Voltar pro calendário"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Mic className="h-6 w-6 text-primary" /> Reuniões gravadas
            </h1>
            <p className="text-sm text-muted-foreground">
              {gravadas.length} gravação{gravadas.length === 1 ? "" : "ões"} · agrupadas por cliente. Clique pra ouvir e ver a transcrição.
            </p>
          </div>
        </div>
      </header>

      {blocos.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhuma reunião gravada ainda. Grave uma reunião pelo botão de “play” no card do calendário ou pela ficha do cliente.
        </p>
      ) : (
        <div className="space-y-8">
          {blocos.map(([key, bloco]) => (
            <section key={key} className="space-y-3">
              <div className="flex items-center gap-2 border-b pb-1.5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{bloco.nome}</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{bloco.itens.length}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {bloco.itens.map((m) => <MeetingCard key={m.id} meeting={m} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
