"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Check, Eye } from "lucide-react";
import { toast } from "sonner";
import { switchActiveUnitAction } from "@/lib/units/actions";
import type { Unit } from "@/lib/units/schema";

interface Props {
  activeUnit: Unit;
  homeUnit: Unit;
  accessibleUnits: Unit[];
  isViewingOtherUnit: boolean;
}

/**
 * Seletor de unidade na TopBar.
 *
 * Versão SEM Radix Portal: dropdown renderizado inline (absolute position).
 * Radix DropdownMenu+Portal estava causando React error #418 (hydration
 * mismatch) em produção. Implementação manual evita o problema e é
 * suficiente pra um seletor pequeno como esse.
 */
export function UnitSwitcher({
  activeUnit,
  homeUnit,
  accessibleUnits,
  isViewingOtherUnit,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  // Hard guard pra props mal-formadas
  if (!activeUnit || !homeUnit || !Array.isArray(accessibleUnits)) {
    return null;
  }

  function handleSelect(unit: Unit) {
    if (unit.id === activeUnit.id) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      try {
        const r = await switchActiveUnitAction(unit.slug);
        if (!r.ok) {
          toast.error(r.error ?? "Falha ao alternar unidade");
          return;
        }
        toast.success(`Visualizando: ${unit.nome}`);
        setOpen(false);
        router.refresh();
      } catch (err) {
        console.error("[UnitSwitcher] switchActiveUnit falhou:", err);
        toast.error(
          err instanceof Error
            ? `Erro: ${err.message}`
            : "Falha inesperada ao alternar unidade",
        );
      }
    });
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50 ${
          isViewingOtherUnit
            ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : ""
        }`}
      >
        {isViewingOtherUnit ? (
          <Eye className="h-3.5 w-3.5" />
        ) : (
          <Building2 className="h-3.5 w-3.5" />
        )}
        <span className="max-w-[120px] truncate">{activeUnit.nome}</span>
        <ChevronDown className={`h-3 w-3 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-md border bg-popover shadow-lg"
        >
          <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Visualizar unidade
          </div>
          {accessibleUnits.map((unit) => {
            const isActive = unit.id === activeUnit.id;
            return (
              <button
                key={unit.id}
                type="button"
                onClick={() => handleSelect(unit)}
                disabled={pending}
                className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                role="menuitem"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                  <span className="truncate">{unit.nome}</span>
                </span>
                {isActive && <Check className="h-3.5 w-3.5 flex-shrink-0 text-primary" />}
              </button>
            );
          })}
          {isViewingOtherUnit && (
            <>
              <div className="my-1 border-t" />
              <button
                type="button"
                onClick={() => handleSelect(homeUnit)}
                disabled={pending}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                role="menuitem"
              >
                ← Voltar pra {homeUnit.nome}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
