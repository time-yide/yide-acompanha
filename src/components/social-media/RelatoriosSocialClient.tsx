"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  criarRelatorioSocialAction,
  gerarPdfRelatorioSocialAction,
  publicarRelatorioSocialAction,
  baixarPdfInternoSocialAction,
} from "@/lib/social-media/relatorios/actions";

interface ClienteOpt {
  id: string;
  nome: string;
}
export interface RelatorioItem {
  id: string;
  cliente_nome: string;
  periodo_inicio: string;
  status: string;
  pdf_storage_path: string | null;
  publicado_em: string | null;
}

function ultimoDiaDoMes(ym: string): string {
  // ym = "YYYY-MM"
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate(); // dia 0 do mês seguinte = último do atual
  return `${ym}-${String(d).padStart(2, "0")}`;
}

export function RelatoriosSocialClient({
  clientes,
  relatorios,
}: {
  clientes: ClienteOpt[];
  relatorios: RelatorioItem[];
}) {
  const router = useRouter();
  const [clienteId, setClienteId] = useState("");
  const [mes, setMes] = useState("");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function criar() {
    setErro(null);
    if (!clienteId || !mes) {
      setErro("Escolha o cliente e o mês.");
      return;
    }
    startTransition(async () => {
      const r = await criarRelatorioSocialAction({
        cliente_id: clienteId,
        periodo_inicio: `${mes}-01`,
        periodo_fim: ultimoDiaDoMes(mes),
      });
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      router.refresh();
    });
  }

  async function gerarPdf(id: string) {
    setErro(null);
    setBusyId(id);
    const r = await gerarPdfRelatorioSocialAction(id);
    setBusyId(null);
    if ("error" in r) {
      setErro(r.error);
      return;
    }
    window.open(r.signedUrl, "_blank", "noopener");
    router.refresh();
  }

  async function baixar(id: string) {
    setBusyId(id);
    const r = await baixarPdfInternoSocialAction(id);
    setBusyId(null);
    if ("error" in r) {
      setErro(r.error);
      return;
    }
    window.open(r.url, "_blank", "noopener");
  }

  async function publicar(id: string) {
    setErro(null);
    setBusyId(id);
    const r = await publicarRelatorioSocialAction(id);
    setBusyId(null);
    if ("error" in r) {
      setErro(r.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Cliente</label>
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="h-9 w-56 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">Escolha...</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Mês</label>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          />
        </div>
        <Button type="button" onClick={criar} disabled={pending}>
          {pending ? "Gerando..." : "Criar relatório"}
        </Button>
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <div className="space-y-2">
        {relatorios.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum relatório ainda.</p>
        ) : (
          relatorios.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
              <div className="text-sm">
                <strong>{r.cliente_nome}</strong> · {r.periodo_inicio.slice(0, 7)}
                {r.publicado_em && (
                  <span className="ml-2 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] text-green-700 dark:text-green-300">
                    Publicado
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" disabled={busyId === r.id} onClick={() => gerarPdf(r.id)}>
                  {busyId === r.id ? "..." : r.pdf_storage_path ? "Regerar PDF" : "Gerar PDF"}
                </Button>
                {r.pdf_storage_path && (
                  <Button type="button" size="sm" variant="outline" disabled={busyId === r.id} onClick={() => baixar(r.id)}>
                    Baixar
                  </Button>
                )}
                {r.pdf_storage_path && !r.publicado_em && (
                  <Button type="button" size="sm" disabled={busyId === r.id} onClick={() => publicar(r.id)}>
                    Publicar pro cliente
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
