import { Card } from "@/components/ui/card";
import { OportunidadeCard } from "./OportunidadeCard";
import type { OportunidadeRow } from "@/lib/freela-yide/queries";

export function OportunidadesGrid({ ops }: { ops: OportunidadeRow[] }) {
  if (ops.length === 0) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Nenhuma oportunidade disponível agora.</Card>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ops.map((op) => <OportunidadeCard key={op.id} op={op} />)}
    </div>
  );
}
