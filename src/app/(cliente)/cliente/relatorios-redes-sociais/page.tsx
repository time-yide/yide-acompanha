import { redirect } from "next/navigation";
import { getClientPortalUser } from "@/lib/auth/client-portal-session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { BaixarRelatorioSocialButton } from "@/components/cliente/BaixarRelatorioSocialButton";

export const dynamic = "force-dynamic";

const MESES = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
function mesAno(periodoInicio: string): string {
  const [y, m] = periodoInicio.split("-");
  return `${MESES[parseInt(m, 10)] ?? ""} ${y}`;
}

export default async function RelatoriosRedesSociaisClientePage() {
  const session = await getClientPortalUser();
  if (!session) redirect("/cliente/login");

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data } = await sbAny
    .from("social_media_relatorios")
    .select("id, periodo_inicio, publicado_em")
    .eq("cliente_id", session.clientId)
    .not("publicado_em", "is", null)
    .order("publicado_em", { ascending: false });

  const relatorios = (data ?? []) as Array<{ id: string; periodo_inicio: string }>;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-bold">Relatórios de Redes Sociais</h1>
      {relatorios.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum relatório disponível ainda.</p>
      ) : (
        <div className="space-y-2">
          {relatorios.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
              <span className="text-sm font-medium">{mesAno(r.periodo_inicio)}</span>
              <BaixarRelatorioSocialButton id={r.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
