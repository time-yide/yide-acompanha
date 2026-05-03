import { tipoPacoteBadge, type TipoPacote } from "@/lib/painel/pacote-matrix";
import { cn } from "@/lib/utils";

interface Props {
  pacote: TipoPacote;
  numeroUnidades?: number;
}

export function TipoPacoteBadge({ pacote, numeroUnidades = 1 }: Props) {
  const meta = tipoPacoteBadge(pacote);
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold",
          meta.classes,
        )}
      >
        {meta.label}
      </span>
      {numeroUnidades > 1 && (
        <span className="text-[10px] text-muted-foreground">· {numeroUnidades} unidades</span>
      )}
    </div>
  );
}
