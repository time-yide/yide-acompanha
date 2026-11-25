"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, Trash2, Plus, Send, Lock, RotateCcw, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CheckOrigem, CheckResultado } from "@/lib/check/core";
import {
  iniciarCheckAction,
  adicionarItemAction,
  editarItemAction,
  removerItemAction,
  liberarCheckAction,
  marcarFeitoAction,
  definirResultadoAction,
  fecharSemanaAction,
} from "@/lib/check/actions";

export interface ItemUI {
  id: string;
  texto: string;
  cliente_id: string | null;
  cliente_nome: string | null;
  origem: CheckOrigem;
  citacao: string | null;
  feito_assessor_em: string | null;
  resultado: CheckResultado | null;
  motivo: string | null;
}

type Cliente = { id: string; nome: string };

function useAcao() {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run(fn: () => Promise<{ error?: string }>, okMsg?: string) {
    start(async () => {
      const r = await fn();
      if (r.error) { toast.error(r.error); return; }
      if (okMsg) toast.success(okMsg);
      router.refresh();
    });
  }
  return { pending, run };
}

/** Agrupa itens por cliente, "Geral" (sem cliente) no fim. */
function agrupar(itens: ItemUI[]): Array<{ nome: string; itens: ItemUI[] }> {
  const map = new Map<string, ItemUI[]>();
  for (const i of itens) {
    const k = i.cliente_nome ?? "";
    map.set(k, [...(map.get(k) ?? []), i]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "pt-BR")))
    .map(([nome, itens]) => ({ nome: nome || "Geral (sem cliente)", itens }));
}

function OrigemTag({ origem }: { origem: CheckOrigem }) {
  if (origem === "semana_anterior") {
    return <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"><RotateCcw className="h-3 w-3" />Veio da semana passada</span>;
  }
  if (origem === "ia") {
    return <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"><Sparkles className="h-3 w-3" />IA</span>;
  }
  return null;
}

/** Recarrega a página a cada 30s enquanto a gravação é transcrita. */
export function AutoRefresh({ segundos = 30 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), segundos * 1000);
    return () => clearInterval(t);
  }, [router, segundos]);
  return null;
}

export function IniciarCheckButton({ assessorId, semana }: { assessorId: string; semana: string }) {
  const { pending, run } = useAcao();
  return (
    <Button disabled={pending} onClick={() => run(() => iniciarCheckAction(assessorId, semana), "Check-in começado")}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
      Começar check-in
    </Button>
  );
}

function ClienteSelect({ value, onChange, carteira, disabled }: { value: string; onChange: (v: string) => void; carteira: Cliente[]; disabled?: boolean }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-9 rounded-md border bg-card px-2 text-sm md:w-56"
    >
      <option value="">Geral (sem cliente)</option>
      {carteira.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
    </select>
  );
}

function ItemEditavel({ item, carteira }: { item: ItemUI; carteira: Cliente[] }) {
  const { pending, run } = useAcao();
  const [texto, setTexto] = useState(item.texto);
  const [clienteId, setClienteId] = useState(item.cliente_id ?? "");
  const mudou = texto.trim() !== item.texto || (clienteId || null) !== item.cliente_id;

  return (
    <li className="space-y-1.5 rounded-lg border bg-card p-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Input value={texto} onChange={(e) => setTexto(e.target.value)} disabled={pending} className="flex-1" />
        <ClienteSelect value={clienteId} onChange={setClienteId} carteira={carteira} disabled={pending} />
        <div className="flex gap-1">
          {mudou && (
            <Button size="sm" disabled={pending} onClick={() => run(() => editarItemAction(item.id, texto, clienteId || null), "Item salvo")}>
              Salvar
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            aria-label="Apagar item"
            onClick={() => { if (confirm("Apagar este item?")) run(() => removerItemAction(item.id)); }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <OrigemTag origem={item.origem} />
        {item.citacao && <span className="text-[11px] italic text-muted-foreground">&ldquo;{item.citacao}&rdquo;</span>}
      </div>
    </li>
  );
}

function NovoItem({ checkId, carteira }: { checkId: string; carteira: Cliente[] }) {
  const { pending, run } = useAcao();
  const [texto, setTexto] = useState("");
  const [clienteId, setClienteId] = useState("");
  return (
    <form
      className="flex flex-col gap-2 rounded-lg border border-dashed p-3 md:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const r = await adicionarItemAction(checkId, texto, clienteId || null);
          if (!r.error) { setTexto(""); }
          return r;
        });
      }}
    >
      <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Novo item (ex.: enviar relatório do mês)" disabled={pending} className="flex-1" />
      <ClienteSelect value={clienteId} onChange={setClienteId} carteira={carteira} disabled={pending} />
      <Button type="submit" variant="outline" disabled={pending || !texto.trim()}>
        <Plus className="mr-1 h-4 w-4" /> Incluir
      </Button>
    </form>
  );
}

/** Check-in (sócio/adm): revisar itens sugeridos e liberar. */
export function CheckinEditor({ checkId, itens, carteira, liberado }: { checkId: string; itens: ItemUI[]; carteira: Cliente[]; liberado: boolean }) {
  const { pending, run } = useAcao();
  return (
    <div className="space-y-4">
      {itens.length === 0 ? (
        <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          Nenhum item ainda. Grave o check-in para a IA sugerir os itens, ou inclua na mão abaixo.
        </p>
      ) : (
        agrupar(itens).map((g) => (
          <section key={g.nome} className="space-y-2">
            <h3 className="text-sm font-semibold">{g.nome}</h3>
            <ul className="space-y-2">
              {g.itens.map((i) => <ItemEditavel key={i.id} item={i} carteira={carteira} />)}
            </ul>
          </section>
        ))
      )}
      <NovoItem checkId={checkId} carteira={carteira} />
      {!liberado && (
        <div className="flex justify-end">
          <Button
            disabled={pending || itens.length === 0}
            onClick={() => { if (confirm(`Liberar ${itens.length} item(ns) para o assessor?`)) run(() => liberarCheckAction(checkId), "Liberado para o assessor"); }}
          >
            <Send className="mr-2 h-4 w-4" /> Liberar para o assessor
          </Button>
        </div>
      )}
    </div>
  );
}

/** Visão do assessor durante a semana: marcar feito. */
export function ChecklistAssessor({ itens, editavel }: { itens: ItemUI[]; editavel: boolean }) {
  const { pending, run } = useAcao();
  const feitos = itens.filter((i) => i.feito_assessor_em).length;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{feitos} de {itens.length} marcado(s) como feito.</p>
      {agrupar(itens).map((g) => (
        <section key={g.nome} className="space-y-2">
          <h3 className="text-sm font-semibold">{g.nome}</h3>
          <ul className="space-y-2">
            {g.itens.map((i) => {
              const feito = !!i.feito_assessor_em;
              return (
                <li key={i.id} className={cn("flex items-start gap-3 rounded-lg border bg-card p-3", feito && "bg-emerald-500/5")}>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 accent-emerald-600"
                    checked={feito}
                    disabled={!editavel || pending}
                    onChange={(e) => run(() => marcarFeitoAction(i.id, e.target.checked))}
                    aria-label={`Marcar "${i.texto}" como feito`}
                  />
                  <div className="space-y-1">
                    <p className={cn("text-sm", feito && "text-muted-foreground line-through")}>{i.texto}</p>
                    <OrigemTag origem={i.origem} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ItemCheckout({ item }: { item: ItemUI }) {
  const { pending, run } = useAcao();
  const [motivo, setMotivo] = useState(item.motivo ?? "");
  return (
    <li className={cn(
      "space-y-2 rounded-lg border bg-card p-3",
      item.resultado === "feito" && "border-emerald-500/40 bg-emerald-500/5",
      item.resultado === "nao_feito" && "border-destructive/40 bg-destructive/5",
    )}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-sm">{item.texto}</p>
          <div className="flex flex-wrap items-center gap-2">
            <OrigemTag origem={item.origem} />
            <span className="text-[11px] text-muted-foreground">
              {item.feito_assessor_em ? "Assessor marcou como feito" : "Assessor não marcou"}
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={item.resultado === "feito" ? "default" : "outline"}
            disabled={pending}
            onClick={() => run(() => definirResultadoAction(item.id, item.resultado === "feito" ? null : "feito", null))}
          >
            <Check className="mr-1 h-4 w-4" /> Feito
          </Button>
          <Button
            size="sm"
            variant={item.resultado === "nao_feito" ? "destructive" : "outline"}
            disabled={pending}
            onClick={() => run(() => definirResultadoAction(item.id, item.resultado === "nao_feito" ? null : "nao_feito", motivo))}
          >
            <X className="mr-1 h-4 w-4" /> Não feito
          </Button>
        </div>
      </div>
      {item.resultado === "nao_feito" && (
        <div className="flex flex-col gap-2 md:flex-row">
          <Textarea
            rows={1}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo (obrigatório)"
            className="flex-1"
          />
          {motivo.trim() !== (item.motivo ?? "") && (
            <Button size="sm" disabled={pending} onClick={() => run(() => definirResultadoAction(item.id, "nao_feito", motivo), "Motivo salvo")}>
              Salvar motivo
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

/** Check-out (sócio/adm): conferir e fechar a semana. */
export function CheckoutPanel({ checkId, itens }: { checkId: string; itens: ItemUI[] }) {
  const { pending, run } = useAcao();
  const decididos = itens.filter((i) => i.resultado).length;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Confira cada item com o assessor. {decididos} de {itens.length} conferido(s).
      </p>
      {agrupar(itens).map((g) => (
        <section key={g.nome} className="space-y-2">
          <h3 className="text-sm font-semibold">{g.nome}</h3>
          <ul className="space-y-2">{g.itens.map((i) => <ItemCheckout key={i.id} item={i} />)}</ul>
        </section>
      ))}
      <div className="flex justify-end">
        <Button
          disabled={pending || itens.length === 0}
          onClick={() => {
            if (confirm("Fechar a semana? Os itens não feitos vão para o check-in de segunda.")) {
              run(() => fecharSemanaAction(checkId), "Semana fechada");
            }
          }}
        >
          <Lock className="mr-2 h-4 w-4" /> Fechar semana
        </Button>
      </div>
    </div>
  );
}

/** Resultado de uma semana fechada (leitura). */
export function ResultadoSemana({ itens }: { itens: ItemUI[] }) {
  const feitos = itens.filter((i) => i.resultado === "feito").length;
  const pct = itens.length ? Math.round((feitos / itens.length) * 100) : 0;
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-2xl font-bold">{pct}%</p>
        <p className="text-sm text-muted-foreground">{feitos} de {itens.length} item(ns) feitos nesta semana.</p>
      </div>
      {agrupar(itens).map((g) => (
        <section key={g.nome} className="space-y-2">
          <h3 className="text-sm font-semibold">{g.nome}</h3>
          <ul className="space-y-2">
            {g.itens.map((i) => (
              <li key={i.id} className="flex items-start gap-2 rounded-lg border bg-card p-3 text-sm">
                {i.resultado === "feito"
                  ? <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                  : <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />}
                <div>
                  <p>{i.texto}</p>
                  {i.resultado === "nao_feito" && i.motivo && (
                    <p className="text-xs text-muted-foreground">Motivo: {i.motivo}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
