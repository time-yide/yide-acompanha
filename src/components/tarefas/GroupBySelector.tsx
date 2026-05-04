"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { GroupBy } from "./TasksGroupedList";

export function GroupBySelector({ current }: { current: GroupBy }) {
  const router = useRouter();
  const params = useSearchParams();

  function setGroupBy(v: string | null) {
    const sp = new URLSearchParams(params.toString());
    if (!v || v === "prazo") sp.delete("groupBy");
    else sp.set("groupBy", v);
    router.push(`/tarefas?${sp.toString()}`);
  }

  return (
    <div className="space-y-1">
      <Label className="text-[11px]">Agrupar por</Label>
      <Select value={current} onValueChange={setGroupBy}>
        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="prazo">Prazo</SelectItem>
          <SelectItem value="cliente">Cliente</SelectItem>
          <SelectItem value="responsavel">Responsável</SelectItem>
          <SelectItem value="prioridade">Prioridade</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
