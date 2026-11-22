"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { aplicarConexoesAction, sugerirConexoesAction } from "@/lib/dados/actions";
import type { FontesStatus, ResultadoSugestoes } from "@/lib/dados/auto-conectar/tipos";

const AVISOS: Record<keyof FontesStatus, string> = {
  meta: "Não consegui ler as páginas da Meta — confira o token META_SYSTEM_USER_TOKEN.",
  anuncios: "Não consegui ler as contas de anúncio da Meta — confira o token META_SYSTEM_USER_TOKEN.",
  ga4: "Não consegui ler as propriedades do Google Analytics — confira a conta de serviço do Google.",
  gsc: "Não consegui ler os sites do Search Console — confira a conta de serviço do Google.",
  lyide: "Não consegui ler as empresas do Lyide — confira LYIDE_API_URL e LYIDE_API_SECRET.",
};

const chave = (clientId: string, campo: string) => `${clientId}|${campo}`;

export function ConectarAutomaticoButton() {
  const [buscando, startBusca] = useTransition();
  const [salvando, startSalvar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [res, setRes] = useState<ResultadoSugestoes | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const router = useRouter();

  const total = useMemo(() => res?.sugestoes.reduce((n, s) => n + s.itens.length, 0) ?? 0, [res]);
  const avisos = res ? (Object.keys(AVISOS) as Array<keyof FontesStatus>).filter((k) => !res.fontes[k]) : [];

  const procurar = () => startBusca(async () => {
    const r = await sugerirConexoesAction();
    if ("error" in r) { toast.error(r.error); return; }
    setRes(r);
    setMarcados(new Set(r.sugestoes.flatMap((s) => s.itens.filter((i) => i.confianca === "alta").map((i) => chave(s.clientId, i.campo)))));
    setAberto(true);
  });

  const alternar = (k: string) => setMarcados((prev) => {
    const n = new Set(prev);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });

  const conectar = () => startSalvar(async () => {
    if (!res) return;
    const itens = res.sugestoes.flatMap((s) => s.itens
      .filter((i) => marcados.has(chave(s.clientId, i.campo)))
      .map((i) => ({ clientId: s.clientId, campo: i.campo, valor: i.valor })));
    if (itens.length === 0) return;
    const r = await aplicarConexoesAction(itens);
    if ("error" in r) { toast.error(r.error); return; }
    const salvas = `${r.aplicados} ${r.aplicados === 1 ? "conexão salva" : "conexões salvas"}. Clique em Atualizar agora nos clientes ou espere o cálculo da madrugada.`;
    const ignoradas = r.ignorados > 0
      ? ` ${r.ignorados} não ${r.ignorados === 1 ? "foi salva" : "foram salvas"} (a conta mudou ou a fonte não respondeu) — procure de novo.`
      : "";
    if (r.aplicados === 0 && r.ignorados > 0) toast.warning(salvas + ignoradas);
    else toast.success(salvas + ignoradas);
    setAberto(false);
    router.refresh();
  });

  return (
    <>
      <Button variant="outline" size="sm" disabled={buscando} onClick={procurar}
        className="border-teal-400/40 bg-teal-500/10 text-teal-100 hover:bg-teal-500/20">
        {buscando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1 h-4 w-4" />}
        {buscando ? "Procurando contas…" : "Conectar automaticamente"}
      </Button>

      <Dialog open={aberto} onOpenChange={(o) => { if (!salvando) setAberto(o); }}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-3 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Conectar automaticamente</DialogTitle>
            <DialogDescription>
              {total === 0
                ? "Não achei nenhuma conta nova pra conectar. Só preencho o que está vazio."
                : `Achei ${total} ${total === 1 ? "conexão" : "conexões"} em ${res?.sugestoes.length ?? 0} ${res?.sugestoes.length === 1 ? "cliente" : "clientes"}. As de “certeza alta” já vêm marcadas; confira as outras.`}
            </DialogDescription>
          </DialogHeader>

          {avisos.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
              {avisos.map((k) => (
                <li key={k} className="flex gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{AVISOS[k]}</li>
              ))}
            </ul>
          )}

          {total > 0 && (
            <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4">
              <div className="space-y-3">
                {res?.sugestoes.map((s) => (
                  <div key={s.clientId} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="mb-2 text-sm font-medium text-white">{s.clienteNome}</div>
                    <ul className="space-y-2">
                      {s.itens.map((i) => {
                        const k = chave(s.clientId, i.campo);
                        return (
                          <li key={k}>
                            <label className="flex cursor-pointer items-start gap-2 text-sm">
                              <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-teal-400"
                                checked={marcados.has(k)} disabled={salvando} onChange={() => alternar(k)} />
                              <span className="min-w-0 flex-1">
                                <span className="break-words text-white/90">{i.rotulo}</span>
                                <span className={i.confianca === "alta"
                                  ? "ml-2 inline-block rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200"
                                  : "ml-2 inline-block rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200"}>
                                  {i.confianca === "alta" ? "certeza alta" : "conferir"}
                                </span>
                                <span className="block text-xs text-white/50">{i.motivo}</span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" disabled={salvando} onClick={() => setAberto(false)}>Cancelar</Button>
            {total > 0 && (
              <Button disabled={salvando || marcados.size === 0} onClick={conectar}>
                {salvando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {salvando ? "Salvando…" : `Conectar selecionados (${marcados.size})`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
