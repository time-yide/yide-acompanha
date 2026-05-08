import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { Money } from "../HiddenValuesContext";

interface Props {
  userId: string;
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
    <div className="rounded-xl border bg-card p-3 sm:p-5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">Seu fixo mensal</p>
      <p className="mt-1.5 text-xl font-bold tabular-nums sm:mt-2 sm:text-3xl"><Money value={valor} /></p>
    </div>
  );
}
