"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Label } from "@/components/ui/label";

interface Props {
  tab: string;
  clientes: { id: string; nome: string }[];
  clienteAtual: string | null;
  /** Mostra o filtro de canal (só na aba Vendas). */
  canalAtual?: string | null;
}

/** Filtros de cliente e canal das abas Vendas e Sugestões (ficam na URL). */
export function FiltroYideEcom({ tab, clientes, clienteAtual, canalAtual }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(key: "cliente" | "canal", value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.set("tab", tab);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="cliente" className="text-xs">Cliente</Label>
        <select
          id="cliente"
          value={clienteAtual ?? ""}
          onChange={(e) => update("cliente", e.target.value)}
          className="h-9 max-w-[16rem] rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Todos</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </div>
      {canalAtual !== undefined && (
        <div className="space-y-1">
          <Label htmlFor="canal" className="text-xs">Canal</Label>
          <select
            id="canal"
            value={canalAtual ?? ""}
            onChange={(e) => update("canal", e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Todos</option>
            <option value="mercado_livre">Mercado Livre</option>
            <option value="tray">Tray</option>
          </select>
        </div>
      )}
    </div>
  );
}
