"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { DataComemorativa } from "@/lib/nichos/schema";

interface Props {
  value: DataComemorativa[];
  onChange: (v: DataComemorativa[]) => void;
}

export function DatasComemoTable({ value, onChange }: Props) {
  function add() {
    onChange([...value, { data: "", nome: "" }]);
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function update(idx: number, field: keyof DataComemorativa, val: string) {
    const next = value.map((row, i) =>
      i === idx ? { ...row, [field]: val } : row
    );
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[100px_1fr_36px] gap-2 text-xs font-medium text-muted-foreground">
        <span>Data (MM-DD)</span>
        <span>Nome</span>
        <span />
      </div>
      {value.map((row, idx) => (
        <div key={idx} className="grid grid-cols-[100px_1fr_36px] gap-2">
          <Input
            value={row.data}
            onChange={(e) => update(idx, "data", e.target.value)}
            placeholder="01-15"
            pattern="\d{2}-\d{2}"
            className="h-8 text-sm"
          />
          <Input
            value={row.nome}
            onChange={(e) => update(idx, "nome", e.target.value)}
            placeholder="Dia do cliente"
            className="h-8 text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => remove(idx)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-1"
        onClick={add}
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        Adicionar data
      </Button>
    </div>
  );
}
