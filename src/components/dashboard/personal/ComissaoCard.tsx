import Link from "next/link";
import { previewMyCommission } from "@/lib/comissoes/preview";
import { Money } from "../HiddenValuesContext";

interface Props {
  userId: string;
}

export async function ComissaoCard({ userId }: Props) {
  const { result, monthRef } = await previewMyCommission(userId);
  const variavel = result?.snapshot.valor_variavel ?? 0;

  return (
    <div className="rounded-xl border bg-card p-3 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">
          Comissão estimada ({monthRef})
        </p>
        <Link href="/comissoes" className="text-xs text-primary hover:underline">
          Ver detalhes →
        </Link>
      </div>
      <p className="mt-1.5 text-xl font-bold tabular-nums sm:mt-2 sm:text-3xl"><Money value={variavel} /></p>
    </div>
  );
}
