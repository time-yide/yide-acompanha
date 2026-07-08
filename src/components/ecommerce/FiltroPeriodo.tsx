"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  de: string;
  ate: string;
  tab: string;
  assessores?: { id: string; nome: string }[];
  assessorAtual?: string;
}

export function FiltroPeriodo({ de, ate, tab, assessores, assessorAtual }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(key: "de" | "ate" | "assessor", value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.set("tab", tab);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="de" className="text-xs">De</Label>
        <Input
          id="de"
          type="date"
          defaultValue={de}
          onChange={(e) => update("de", e.target.value)}
          className="h-9"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="ate" className="text-xs">Até</Label>
        <Input
          id="ate"
          type="date"
          defaultValue={ate}
          onChange={(e) => update("ate", e.target.value)}
          className="h-9"
        />
      </div>
      {assessores && assessores.length > 0 && (
        <div className="space-y-1">
          <Label htmlFor="assessor" className="text-xs">Assessor</Label>
          <select
            id="assessor"
            defaultValue={assessorAtual ?? ""}
            onChange={(e) => update("assessor", e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Todos</option>
            {assessores.map((a) => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
