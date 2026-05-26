"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface ProfileOption { id: string; nome: string; }
interface ClientOption { id: string; nome: string; }

interface Props {
  profiles: ProfileOption[];
  clientes: ClientOption[];
  showAtribuido: boolean;
}

export function TaskFilters({ profiles, clientes, showAtribuido }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  // Busca: estado local controlado + debounce 300ms antes de empurrar pra URL.
  // router.replace (em vez de push) mantém foco do input.
  const [q, setQ] = useState(() => params.get("q") ?? "");

  useEffect(() => {
    const t = setTimeout(() => {
      const sp = new URLSearchParams(params.toString());
      if (q.trim()) sp.set("q", q.trim());
      else sp.delete("q");
      router.replace(`/tarefas?${sp.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function setParam(key: string, value: string | null) {
    const sp = new URLSearchParams(params.toString());
    if (!value || value === "qualquer") sp.delete(key);
    else sp.set(key, value);
    router.push(`/tarefas?${sp.toString()}`);
  }

  // Mês precisa preservar "qualquer" no URL pra desativar o default
  // do server (mês atual). Sem isso, escolher "qualquer" cairia de volta
  // no mês atual no próximo render.
  // Tipo aceita null pra bater com a assinatura do Radix Select onValueChange.
  // Na prática value sempre vem string (deselecionar Select Item não dispara).
  function setMesParam(value: string | null) {
    if (value === null) return;
    const sp = new URLSearchParams(params.toString());
    sp.set("mes", value);
    router.push(`/tarefas?${sp.toString()}`);
  }

  const prioridade = params.get("prioridade") ?? "qualquer";
  const clientId = params.get("client") ?? "qualquer";
  const atribuido = params.get("atribuido") ?? "qualquer";

  // Mês de criação: server aplica default = mês atual quando URL não tem `mes`.
  // Aqui no client, se o param está ausente, mostramos o mês atual como
  // selecionado (mesmo cálculo do servidor). "qualquer" no URL é explícito.
  const mesAtual = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  })();
  const mesParam = params.get("mes");
  const mes = mesParam ?? mesAtual;

  // Últimos 12 meses (sem futuros, faz menos sentido pra "mês de criação").
  // Gerado client-side determinístico pelo mês corrente.
  const mesOptions = (() => {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
        .replace(".", "")
        .replace(/^./, (c) => c.toUpperCase());
      opts.push({ value, label });
    }
    return opts;
  })();

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1 flex-1 min-w-[220px]">
        <Label className="text-[11px]">Buscar</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por título da tarefa..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-8 pl-7 pr-7 text-sm"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Limpar busca"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Prioridade</Label>
        <Select value={prioridade} onValueChange={(v) => setParam("prioridade", v)}>
          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="qualquer">Qualquer</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Mês (criação)</Label>
        <Select value={mes} onValueChange={setMesParam}>
          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {mesOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
            <SelectItem value="qualquer">Qualquer (todos)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Cliente</Label>
        <Select value={clientId} onValueChange={(v) => setParam("client", v)}>
          <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="qualquer">Qualquer</SelectItem>
            {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {showAtribuido && (
        <div className="space-y-1">
          <Label className="text-[11px]">Responsável</Label>
          <Select value={atribuido} onValueChange={(v) => setParam("atribuido", v)}>
            <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="qualquer">Qualquer</SelectItem>
              {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
