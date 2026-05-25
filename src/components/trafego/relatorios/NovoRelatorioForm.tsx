"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { criarRelatorioAction } from "@/lib/trafego/relatorios/actions";
import { Card } from "@/components/ui/card";

interface Cliente {
  id: string;
  nome: string;
  meta_ad_account_id: string | null;
}

interface DadosManuais {
  spend: string;
  impressoes: string;
  alcance: string;
  cliques: string;
  cpc: string;
  ctr: string;
  conversoes: string;
  custo_por_conversao: string;
  leads: string;
  custo_por_lead: string;
}

interface MetaResult {
  ok: boolean;
  motivo?: "no_account" | "api_error";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dados?: any;
  erroDetalhe?: string;
}

const emptyDados: DadosManuais = {
  spend: "", impressoes: "", alcance: "", cliques: "",
  cpc: "", ctr: "", conversoes: "", custo_por_conversao: "",
  leads: "", custo_por_lead: "",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function NovoRelatorioForm({ clientes }: { clientes: Cliente[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [clienteId, setClienteId] = useState("");
  const [inicio, setInicio] = useState(isoDaysAgo(30));
  const [fim, setFim] = useState(todayIso());
  const [objetivo, setObjetivo] = useState("");
  const [metaResult, setMetaResult] = useState<MetaResult | null>(null);
  const [fetching, setFetching] = useState(false);
  const [dadosManuais, setDadosManuais] = useState<DadosManuais>(emptyDados);
  const [erro, setErro] = useState<string | null>(null);

  async function buscarMeta() {
    if (!clienteId) { setErro("Escolha um cliente primeiro"); return; }
    setErro(null);
    setFetching(true);
    try {
      const url = `/api/trafego/relatorios/meta-fetch?cliente_id=${clienteId}&inicio=${inicio}&fim=${fim}`;
      const res = await fetch(url);
      const json = (await res.json()) as MetaResult;
      setMetaResult(json);
      if (json.ok && json.dados) {
        setDadosManuais({
          spend: String(json.dados.spend ?? ""),
          impressoes: String(json.dados.impressoes ?? ""),
          alcance: String(json.dados.alcance ?? ""),
          cliques: String(json.dados.cliques ?? ""),
          cpc: String(json.dados.cpc ?? ""),
          ctr: String(json.dados.ctr ?? ""),
          conversoes: String(json.dados.conversoes ?? ""),
          custo_por_conversao: String(json.dados.custo_por_conversao ?? ""),
          leads: String(json.dados.leads ?? ""),
          custo_por_lead: String(json.dados.custo_por_lead ?? ""),
        });
      }
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setFetching(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    // Limpa campos vazios pra não enviar string vazia ao zod.
    const dadosLimpos: Record<string, number> = {};
    for (const [k, v] of Object.entries(dadosManuais)) {
      if (v.trim() !== "") {
        const n = Number(v);
        if (Number.isFinite(n)) dadosLimpos[k] = n;
      }
    }

    const fd = new FormData();
    fd.set("cliente_id", clienteId);
    fd.set("periodo_inicio", inicio);
    fd.set("periodo_fim", fim);
    fd.set("objetivo", objetivo);
    if (Object.keys(dadosLimpos).length > 0) {
      fd.set("dados_manuais", JSON.stringify(dadosLimpos));
    }

    startTransition(async () => {
      const r = await criarRelatorioAction(fd);
      if ("redirect" in r) {
        router.push(r.redirect);
      } else {
        setErro(r.error);
      }
    });
  }

  const clienteSelecionado = clientes.find((c) => c.id === clienteId);

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" /> Novo relatório
        </h1>
        <p className="text-sm text-muted-foreground">
          Escolha cliente e período. Se houver integração Meta, vamos puxar os números.
          Você pode editar antes de gerar.
        </p>
      </header>

      <Card className="space-y-4 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Cliente</label>
            <select
              value={clienteId}
              onChange={(e) => { setClienteId(e.target.value); setMetaResult(null); }}
              required
              className="h-9 w-full rounded-md border bg-card px-2 text-sm"
            >
              <option value="">Selecione…</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} {c.meta_ad_account_id ? "· Meta conectado" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Início</label>
              <input
                type="date"
                value={inicio}
                onChange={(e) => { setInicio(e.target.value); setMetaResult(null); }}
                required
                className="h-9 w-full rounded-md border bg-card px-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Fim</label>
              <input
                type="date"
                value={fim}
                onChange={(e) => { setFim(e.target.value); setMetaResult(null); }}
                required
                className="h-9 w-full rounded-md border bg-card px-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Objetivo deste relatório <span className="text-muted-foreground">(opcional)</span>
          </label>
          <textarea
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
            rows={2}
            placeholder='Ex: "Mostrar leads do Marco Zero e justificar aumento de verba pra próximo mês"'
            className="w-full rounded-md border bg-card p-2 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={buscarMeta}
            disabled={!clienteId || fetching}
            className="inline-flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm hover:bg-muted disabled:opacity-50"
          >
            {fetching && <Loader2 className="h-4 w-4 animate-spin" />}
            Buscar dados Meta
          </button>
          {clienteSelecionado && !clienteSelecionado.meta_ad_account_id && (
            <span className="text-xs text-muted-foreground">
              Cliente sem Meta cadastrada — preencha manual abaixo.
            </span>
          )}
        </div>

        {metaResult && (
          <div className="rounded-md border p-3 text-sm">
            {metaResult.ok ? (
              <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                Dados puxados da Meta. Revise abaixo e ajuste se necessário.
              </p>
            ) : (
              <p className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                {metaResult.motivo === "no_account"
                  ? "Cliente sem conta Meta cadastrada — preencha manualmente."
                  : "Meta API indisponível agora — preencha manualmente."}
              </p>
            )}
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Números do período
        </h2>
        <p className="text-xs text-muted-foreground">
          Deixe em branco o que não tem. A IA omite slides sem dados.
        </p>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Campo label="Investimento (R$)" value={dadosManuais.spend} onChange={(v) => setDadosManuais({ ...dadosManuais, spend: v })} />
          <Campo label="Impressões" value={dadosManuais.impressoes} onChange={(v) => setDadosManuais({ ...dadosManuais, impressoes: v })} />
          <Campo label="Alcance" value={dadosManuais.alcance} onChange={(v) => setDadosManuais({ ...dadosManuais, alcance: v })} />
          <Campo label="Cliques" value={dadosManuais.cliques} onChange={(v) => setDadosManuais({ ...dadosManuais, cliques: v })} />
          <Campo label="CPC (R$)" value={dadosManuais.cpc} onChange={(v) => setDadosManuais({ ...dadosManuais, cpc: v })} />
          <Campo label="CTR (%)" value={dadosManuais.ctr} onChange={(v) => setDadosManuais({ ...dadosManuais, ctr: v })} />
          <Campo label="Conversões" value={dadosManuais.conversoes} onChange={(v) => setDadosManuais({ ...dadosManuais, conversoes: v })} />
          <Campo label="Custo/conversão (R$)" value={dadosManuais.custo_por_conversao} onChange={(v) => setDadosManuais({ ...dadosManuais, custo_por_conversao: v })} />
          <Campo label="Leads" value={dadosManuais.leads} onChange={(v) => setDadosManuais({ ...dadosManuais, leads: v })} />
          <Campo label="Custo/lead (R$)" value={dadosManuais.custo_por_lead} onChange={(v) => setDadosManuais({ ...dadosManuais, custo_por_lead: v })} />
        </div>
      </Card>

      {erro && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
          {erro}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={pending || !clienteId}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Gerar relatório com IA
        </button>
      </div>
    </form>
  );
}

function Campo({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border bg-card px-2 text-sm tabular-nums"
      />
    </div>
  );
}
