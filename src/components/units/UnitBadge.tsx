import { Building2 } from "lucide-react";
import type { Unit } from "@/lib/units/schema";

interface Props {
  /** unit_id da entidade (cliente, etc). */
  unitId: string | null | undefined;
  /** Lista de unidades pra mapear id → nome/cor (passada pelo server). */
  units: Pick<Unit, "id" | "nome" | "cor_destaque">[];
  /** Variante compacta — só ícone + nome curto. */
  size?: "sm" | "md";
}

/**
 * Badge visual mostrando a unidade de um item (cliente, tarefa, etc).
 * Em Fase 2 é renderizado só pra master users — non-master só vê dados
 * da própria unidade, então o badge seria redundante.
 */
export function UnitBadge({ unitId, units, size = "sm" }: Props) {
  if (!unitId) return null;
  const unit = units.find((u) => u.id === unitId);
  if (!unit) return null;
  const color = unit.cor_destaque ?? "#10b981";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 font-medium ${
        size === "sm" ? "py-0 text-[10px]" : "py-0.5 text-xs"
      }`}
      style={{
        borderColor: `${color}40`,
        backgroundColor: `${color}15`,
        color,
      }}
    >
      <Building2 className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {unit.nome}
    </span>
  );
}
