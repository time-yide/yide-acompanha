"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { STATUS_PESQUISA_DEFS } from "@/lib/gerador-leads/tipos";
import type { PesquisaRow } from "@/lib/gerador-leads/queries";

interface Props {
  pesquisas: PesquisaRow[];
}

/** Quantas pesquisas mostrar antes de pedir "Ver todas". */
const LIMITE_VISIVEL = 4;

/**
 * Mostra histórico recente de pesquisas. Faz polling a cada 5s quando tem
 * alguma rodando (status=pendente/processando) pra atualizar resultado.
 */
export function PesquisasRecentes({ pesquisas }: Props) {
  const router = useRouter();
  const [expandido, setExpandido] = useState(false);
  const temRodando = pesquisas.some((p) => p.status === "pendente" || p.status === "processando");

  useEffect(() => {
    if (!temRodando) return;
    const interval = setInterval(() => {
      router.refresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [temRodando, router]);

  if (pesquisas.length === 0) {
    return (
      <Card className="p-4 text-center text-xs text-muted-foreground">
        Nenhuma pesquisa ainda. Clica em &quot;Nova pesquisa&quot; pra começar.
      </Card>
    );
  }

  const temMais = pesquisas.length > LIMITE_VISIVEL;
  const visiveis = expandido ? pesquisas : pesquisas.slice(0, LIMITE_VISIVEL);

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {visiveis.map((p) => (
          <PesquisaItem key={p.id} p={p} />
        ))}
      </div>

      {temMais && (
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-foreground/15 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          {expandido ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" /> Ver menos
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" /> Ver todas ({pesquisas.length})
            </>
          )}
        </button>
      )}
    </div>
  );
}

function PesquisaItem({ p }: { p: PesquisaRow }) {
  const statusDef = STATUS_PESQUISA_DEFS[p.status];
  const rodando = p.status === "pendente" || p.status === "processando";
  const concluido = p.status === "concluido";
  const erro = p.status === "erro";

  const dataFmt = new Date(p.created_at).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="group flex items-center gap-3 rounded-xl bg-card px-3.5 py-3 ring-1 ring-foreground/10 transition-colors hover:ring-foreground/25">
      {/* Marcador de status à esquerda */}
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
          erro
            ? "bg-destructive/10 text-destructive"
            : concluido
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        }`}
      >
        {rodando ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : erro ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          <MapPin className="h-4 w-4" />
        )}
      </span>

      {/* Conteúdo */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold capitalize">
            {p.nicho}
            <span className="font-normal text-muted-foreground"> em </span>
            {p.cidade}
          </p>
          {/* Badge só quando NÃO concluído (concluído já é dito pelo número) */}
          {!concluido && statusDef && (
            <span
              className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${statusDef.color}`}
            >
              {rodando ? "Em fila" : statusDef.label}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {p.criado_por_nome ?? "Alguém"} · {dataFmt}
        </p>
        {erro && p.erro_mensagem && (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-destructive" title={p.erro_mensagem}>
            {p.erro_mensagem}
          </p>
        )}
      </div>

      {/* Contagem de resultados à direita */}
      {concluido && (
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold leading-none tabular-nums text-emerald-600 dark:text-emerald-400">
            {p.total_resultados}
          </p>
          <p className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
            {p.total_resultados === 1 ? "lead" : "leads"}
          </p>
          {p.total_novos < p.total_resultados && (
            <p className="text-[9px] text-muted-foreground">
              {p.total_novos} novos
            </p>
          )}
        </div>
      )}

      {rodando && (
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
          Buscando…
        </span>
      )}
    </div>
  );
}
