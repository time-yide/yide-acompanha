import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { RelatoriosSocialClient, type RelatorioItem } from "@/components/social-media/RelatoriosSocialClient";

export const dynamic = "force-dynamic";

const ROLES = [
  "adm", "socio", "comercial", "coordenador", "assessor",
  "designer", "videomaker", "editor", "audiovisual_chefe",
];

export default async function RelatoriosSocialPage() {
  const user = await requireAuth();
  if (!ROLES.includes(user.role)) {
    return <div className="p-6 text-sm text-muted-foreground">Sem permissão.</div>;
  }

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  const [{ data: clientesRaw }, { data: relsRaw }] = await Promise.all([
    sbAny.from("clients").select("id, nome").eq("status", "ativo").order("nome"),
    sbAny
      .from("social_media_relatorios")
      .select("id, periodo_inicio, status, pdf_storage_path, publicado_em, cliente:clients(nome)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const clientes = ((clientesRaw ?? []) as Array<{ id: string; nome: string }>).map((c) => ({
    id: c.id,
    nome: c.nome,
  }));

  const relatorios: RelatorioItem[] = ((relsRaw ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    cliente_nome: ((r.cliente as { nome?: string } | null)?.nome) ?? "Cliente",
    periodo_inicio: r.periodo_inicio as string,
    status: r.status as string,
    pdf_storage_path: (r.pdf_storage_path as string | null) ?? null,
    publicado_em: (r.publicado_em as string | null) ?? null,
  }));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Relatórios de Redes Sociais</h1>
        <p className="text-sm text-muted-foreground">
          Gere o relatório mensal do cliente (PDF) e publique no portal dele.
        </p>
      </header>
      <RelatoriosSocialClient clientes={clientes} relatorios={relatorios} />
    </div>
  );
}
