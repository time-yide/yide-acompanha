"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface SearchableOption {
  value: string;
  label: string;
}

interface Props {
  options: SearchableOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  emptyText?: string;
  /** Texto pra opção "limpar" no topo da lista. Quando passado, exibe botão. */
  clearLabel?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Select com busca por texto. Usa Popover + input nativo + lista filtrada.
 * Sem dependências externas.
 */
export function SearchableSelect({
  options, value, onChange, placeholder = "Selecione...",
  emptyText = "Nada encontrado", clearLabel, disabled, className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  // Foca o input quando abre (reset de query é feito no onOpenChange)
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  function handleOpenChange(next: boolean) {
    if (disabled) return;
    setOpen(next);
    if (!next) setQuery("");
  }

  function pick(opt: SearchableOption) {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-9 w-full items-center justify-between rounded-md border border-input bg-card px-3 py-1.5 text-sm transition-colors",
              "hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50",
              !selected && "text-muted-foreground",
              className,
            )}
          >
            <span className="truncate">{selected?.label ?? placeholder}</span>
            <span className="ml-2 flex flex-shrink-0 items-center gap-1">
              {clearLabel && selected && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleClear}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onChange(null);
                    }
                  }}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Limpar seleção"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          </button>
        }
      />
      <PopoverContent align="start" className="w-(--anchor-width) p-0" sideOffset={4}>
        <div className="p-2">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <div className="max-h-60 overflow-y-auto border-t p-1">
          {clearLabel && (
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              <span>{clearLabel}</span>
              {!selected && <Check className="h-3.5 w-3.5" />}
            </button>
          )}
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">{emptyText}</p>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => pick(opt)}
                className={cn(
                  "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted",
                  value === opt.value && "bg-muted font-medium",
                )}
              >
                <span className="truncate">{opt.label}</span>
                {value === opt.value && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
