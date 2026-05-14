"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  maxItems?: number;
  minItems?: number;
}

/**
 * Lista editável de strings — bullets, tópicos, etc. Botão "+" adiciona
 * item ao fim, "×" remove. Respeita maxItems/minItems pra desabilitar
 * os botões nos limites.
 */
export function ArrayInput({
  label,
  values,
  onChange,
  placeholder,
  maxItems = 10,
  minItems = 0,
}: Props) {
  function setAt(i: number, value: string) {
    const next = values.slice();
    next[i] = value;
    onChange(next);
  }

  function removeAt(i: number) {
    const next = values.slice();
    next.splice(i, 1);
    onChange(next);
  }

  function addItem() {
    if (values.length >= maxItems) return;
    onChange([...values, ""]);
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="space-y-2">
        {values.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={v}
              onChange={(e) => setAt(i, e.target.value)}
              placeholder={placeholder}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => removeAt(i)}
              disabled={values.length <= minItems}
              aria-label="Remover item"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {values.length < maxItems && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Adicionar item
          </Button>
        )}
      </div>
    </div>
  );
}
