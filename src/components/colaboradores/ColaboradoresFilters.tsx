"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const ROLE_OPTIONS = [
  { value: "qualquer", label: "Todos" },
  { value: "socio", label: "Sócio" },
  { value: "adm", label: "ADM" },
  { value: "comercial", label: "Comercial" },
  { value: "coordenador", label: "Coordenador" },
  { value: "assessor", label: "Assessor" },
  { value: "audiovisual_chefe", label: "Audiovisual Chefe" },
  { value: "videomaker", label: "Videomaker" },
  { value: "designer", label: "Designer" },
  { value: "editor", label: "Editor" },
];

export function ColaboradoresFilters() {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const sp = new URLSearchParams(params.toString());
    if (!value || value === "qualquer") sp.delete(key);
    else sp.set(key, value);
    router.push(`/colaboradores?${sp.toString()}`);
  }

  const role = params.get("role") ?? "qualquer";
  const status = params.get("status") ?? "ativos";
  const admissao = params.get("admissao") ?? "qualquer";

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      <div className="space-y-1">
        <Label className="text-[11px]">Papel</Label>
        <Select value={role} onValueChange={(v) => setParam("role", v as string)}>
          <SelectTrigger className="h-8 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Status</Label>
        <Select value={status} onValueChange={(v) => setParam("status", v as string)}>
          <SelectTrigger className="h-8 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Ativos</SelectItem>
            <SelectItem value="inativos">Inativos</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Admissão</Label>
        <Select value={admissao} onValueChange={(v) => setParam("admissao", v as string)}>
          <SelectTrigger className="h-8 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="qualquer">Qualquer</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
            <SelectItem value="12m">Últimos 12 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
