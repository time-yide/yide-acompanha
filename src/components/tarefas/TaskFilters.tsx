"use client";

import { useRouter, useSearchParams } from "next/navigation";
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

  function setParam(key: string, value: string | null) {
    const sp = new URLSearchParams(params.toString());
    if (!value || value === "qualquer") sp.delete(key);
    else sp.set(key, value);
    router.push(`/tarefas?${sp.toString()}`);
  }

  const prioridade = params.get("prioridade") ?? "qualquer";
  const clientId = params.get("client") ?? "qualquer";
  const atribuido = params.get("atribuido") ?? "qualquer";

  return (
    <div className="flex flex-wrap items-end gap-3">
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
