"use client";
import { useState, useTransition } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { salvarConexoesAction } from "@/lib/dados/actions";

interface Props {
  clientId: string; podeEditar: boolean; emailContaServico: string | null;
  atual: { ga4: string | null; gsc: string | null; lyide: string | null };
  opcoes: { ga4: Array<{ id: string; nome: string }>; gsc: string[]; lyide: Array<{ slug: string; name: string }> };
}

export function ConexoesCard({ clientId, podeEditar, emailContaServico, atual, opcoes }: Props) {
  const [ga4, setGa4] = useState(atual.ga4 ?? "");
  const [gsc, setGsc] = useState(atual.gsc ?? "");
  const [lyide, setLyide] = useState(atual.lyide ?? "");
  const [pending, start] = useTransition();
  const sel = "h-9 w-full rounded-md border border-white/15 bg-white/5 px-2 text-sm disabled:opacity-60";

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-sm font-medium">Conexões de dados</div>
      {emailContaServico && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
          Peça pro cliente adicionar como leitor no GA4 e no Search Console:
          <code className="rounded bg-white/10 px-1.5 py-0.5">{emailContaServico}</code>
          <button type="button" aria-label="Copiar e-mail" onClick={() => { navigator.clipboard.writeText(emailContaServico); toast.success("E-mail copiado"); }}>
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-xs text-white/60">Google Analytics (GA4)
          <select className={sel} value={ga4} disabled={!podeEditar} onChange={(e) => setGa4(e.target.value)}>
            <option value="">Não conectado</option>
            {opcoes.ga4.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-white/60">Search Console
          <select className={sel} value={gsc} disabled={!podeEditar} onChange={(e) => setGsc(e.target.value)}>
            <option value="">Não conectado</option>
            {opcoes.gsc.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-white/60">Empresa no Lyide
          <select className={sel} value={lyide} disabled={!podeEditar} onChange={(e) => setLyide(e.target.value)}>
            <option value="">Não conectado</option>
            {opcoes.lyide.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
          </select>
        </label>
      </div>
      {podeEditar && (
        <Button size="sm" disabled={pending} onClick={() => start(async () => {
          const r = await salvarConexoesAction({ clientId, ga4PropertyId: ga4 || null, gscSiteUrl: gsc || null, lyideSlug: lyide || null });
          if ("error" in r) toast.error(r.error); else toast.success("Conexões salvas. Clique em Atualizar agora pra ver os dados.");
        })}>{pending ? "Salvando…" : "Salvar conexões"}</Button>
      )}
    </div>
  );
}
