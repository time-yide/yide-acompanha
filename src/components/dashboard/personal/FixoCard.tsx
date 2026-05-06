import { createServiceRoleClient } from "@/lib/supabase/service-role";

interface Props {
  userId: string;
}

function formatBRL(n: number): string {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function getFixoMensal(userId: string): Promise<number> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("profiles")
    .select("fixo_mensal")
    .eq("id", userId)
    .single();
  return Number(data?.fixo_mensal ?? 0);
}

export async function FixoCard({ userId }: Props) {
  const valor = await getFixoMensal(userId);
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Seu fixo mensal</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{formatBRL(valor)}</p>
    </div>
  );
}
