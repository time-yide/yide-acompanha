"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Check, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { switchActiveUnitAction } from "@/lib/units/actions";
import type { Unit } from "@/lib/units/schema";

interface Props {
  activeUnit: Unit;
  homeUnit: Unit;
  accessibleUnits: Unit[];
  isViewingOtherUnit: boolean;
}

/**
 * Seletor de unidade ativa no TopBar. Só renderiza pra master users (adm/socio).
 * Pra non-master, useUnitContext devolve só a home unit e o componente pai
 * decide não passar ele pro layout (ver TopBar.tsx).
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

  function handleSelect(unit: Unit) {
    if (unit.id === activeUnit.id) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const r = await switchActiveUnitAction(unit.slug);
      if (!r.ok) {
        toast.error(r.error ?? "Falha ao alternar unidade");
        return;
      }
      toast.success(`Agora você está vendo: ${unit.nome}`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        disabled={pending}
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
        <ChevronDown className="h-3 w-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Visualizar unidade
        </DropdownMenuLabel>
        {accessibleUnits.map((unit) => {
          const isActive = unit.id === activeUnit.id;
          const isHome = unit.id === homeUnit.id;
          return (
            <DropdownMenuItem
              key={unit.id}
              onSelect={(e) => {
                e.preventDefault();
                handleSelect(unit);
              }}
              className="flex items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                <span className="truncate">{unit.nome}</span>
                {isHome && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                    minha
                  </span>
                )}
              </span>
              {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          );
        })}
        {isViewingOtherUnit && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                handleSelect(homeUnit);
              }}
              className="text-xs text-muted-foreground"
            >
              ← Voltar pra {homeUnit.nome}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
