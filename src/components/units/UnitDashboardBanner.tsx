"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Check, Loader2 } from "lucide-react";
import { switchActiveUnitAction } from "@/lib/units/actions";
import type { Unit } from "@/lib/units/schema";

interface Props {
  activeUnit: Unit;
  accessibleUnits: Unit[];
}

/**
 * Banner gigante no topo do dashboard pra master users (adm/sócio) trocarem
 * de unidade rapidinho — visível, não escondido no TopBar. Cada unidade vira
 * uma pill clicável.
 */
export function UnitDashboardBanner({
  activeUnit,
  accessibleUnits,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Se só tem 1 unidade, nem renderiza o banner (não há o que trocar)
  if (accessibleUnits.length <= 1) return null;

  function handleSelect(unit: Unit) {
    if (unit.id === activeUnit.id || pending) return;
    startTransition(async () => {
      const r = await switchActiveUnitAction(unit.slug);
      if (!r.ok) {
        toast.error(r.error ?? "Falha ao alternar unidade");
        return;
      }
      toast.success(`Visualizando: ${unit.nome}`);
      router.refresh();
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{
              backgroundColor: `${activeUnit.cor_destaque ?? "#10b981"}20`,
              color: activeUnit.cor_destaque ?? "#10b981",
            }}
          >
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Visualizando dados de
            </p>
            <p className="text-base font-bold leading-tight">{activeUnit.nome}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Trocar:
          </span>
          {accessibleUnits.map((unit) => {
            const isActive = unit.id === activeUnit.id;
            return (
              <button
                key={unit.id}
                type="button"
                onClick={() => handleSelect(unit)}
                disabled={pending || isActive}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                  isActive
                    ? "border-primary bg-primary/10 text-primary cursor-default"
                    : "hover:border-primary/40 hover:bg-muted disabled:opacity-50"
                }`}
                style={
                  isActive && unit.cor_destaque
                    ? {
                        borderColor: unit.cor_destaque,
                        backgroundColor: `${unit.cor_destaque}15`,
                        color: unit.cor_destaque,
                      }
                    : undefined
                }
              >
                {pending && !isActive ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isActive ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Building2 className="h-3.5 w-3.5 opacity-60" />
                )}
                <span>{unit.nome}</span>
                              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
