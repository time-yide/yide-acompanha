import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { canAccessDados, podeEditarConexoes } from "@/lib/dados/access";
import { getClienteDados } from "@/lib/dados/queries";
import { calcularCliente } from "@/lib/dados/calcular";
import { periodoPadrao } from "@/lib/dados/periodo";
import { faixaNota } from "@/lib/dados/nota";
import { emailContaServico } from "@/lib/dados/google-auth";
import { ga4Cache, gscCache, lyideCache } from "@/lib/dados/opcoes-conexao";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { CanalCards } from "@/components/dados/CanalCards";
import { PerdasLista } from "@/components/dados/PerdasLista";
import { AtualizarAgoraButton } from "@/components/dados/AtualizarAgoraButton";
import { ConexoesCard } from "@/components/dados/ConexoesCard";
import { SiteGoogleCard } from "@/components/dados/SiteGoogleCard";
import type { SnapshotDados } from "@/lib/dados/tipos";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS_PERIODO = 400;
type SnapshotRow = SnapshotDados & { calculado_em: string };

export default async function DadosClientePage({
  params, searchParams,
}: { params: Promise<{ clientId: string }>; searchParams: Promise<{ de?: string; ate?: string }> }) {
  const user = await requireAuth();
  if (!canAccessDados(user.role)) { console.error("[dados/cliente] sem acesso", user.role); notFound(); }
  const orgId = await getOrganizationId(user.id);
  if (!orgId) { console.error("[dados/cliente] sem org", user.id); notFound(); }
  const { clientId } = await params;
  const sp = await searchParams;
  const cliente = await getClienteDados(orgId, user, clientId);
  if (!cliente) notFound();

  const padrao = periodoPadrao();
  // Máx. 400 dias (mesmo teto do Lyide): período maior cai no padrão.
  const dentroDoLimite = (de: string, ate: string) =>
    (new Date(`${ate}T12:00:00Z`).getTime() - new Date(`${de}T12:00:00Z`).getTime()) / 86_400_000 <= MAX_DIAS_PERIODO;
  const custom = sp.de && sp.ate && DATE_RE.test(sp.de) && DATE_RE.test(sp.ate) && sp.de <= sp.ate
    && dentroDoLimite(sp.de, sp.ate) && (sp.de !== padrao.de || sp.ate !== padrao.ate);
  const periodo = custom ? { de: sp.de!, ate: sp.ate! } : padrao;
  const editar = podeEditarConexoes(user.role);

  // Período padrão: lê o snapshot gravado. Período escolhido: calcula na hora (só este cliente).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const lerSnapshot = async (): Promise<SnapshotRow | null> => {
    const { data, error } = await sb.from("client_dados_snapshots").select("nota, canais, perdas, calculado_em")
      .eq("client_id", clientId).order("calculado_em", { ascending: false }).limit(1).maybeSingle();
    if (error) {
      // Tabela ausente (antes da migration): tratado como sem snapshot.
      if (!(error.code === "42P01" || error.code === "PGRST205" || /client_dados_snapshots/.test(error.message ?? ""))) {
        console.error("[dados/cliente] snapshot", error.message);
      }
      return null;
    }
    return (data as SnapshotRow | null) ?? null;
  };
  const [snap, opcoesGa4, opcoesGsc, opcoesLyide] = await Promise.all([
    custom ? calcularCliente(cliente, periodo) : lerSnapshot(),
    editar ? ga4Cache().catch(() => []) : [],
    editar ? gscCache().catch((): string[] => []) : [],
    editar ? lyideCache().catch(() => []) : [],
  ]);
  const cor = { risco: "text-rose-300", atencao: "text-amber-300", bom: "text-emerald-300", sem_dados: "text-white/40" }[faixaNota(snap?.nota ?? null)];

  return (
    <div className="space-y-5">
      <Link href="/dados" className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white"><ArrowLeft className="h-4 w-4" /> Dados</Link>
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div>
          <h1 className="text-3xl font-extrabold">{cliente.nome}</h1>
          <p className="text-sm text-white/50">{cliente.site_url ? `${cliente.site_url.replace(/^https?:\/\//, "")} · ` : cliente.gsc_site_url ? `${cliente.gsc_site_url.replace(/^sc-domain:/, "")} · ` : ""}{periodo.de.split("-").reverse().join("/")} a {periodo.ate.split("-").reverse().join("/")}</p>
          <form className="mt-3 flex flex-wrap items-end gap-2 text-xs text-white/60">
            <label>De <input type="date" name="de" defaultValue={periodo.de} className="ml-1 rounded border border-white/15 bg-white/5 px-2 py-1" /></label>
            <label>Até <input type="date" name="ate" defaultValue={periodo.ate} className="ml-1 rounded border border-white/15 bg-white/5 px-2 py-1" /></label>
            <button className="rounded border border-white/20 px-2 py-1 hover:bg-white/10">Aplicar</button>
          </form>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-white/50">Nota de presença</div>
            <div className={`text-4xl font-extrabold ${cor}`}>{snap?.nota ?? "—"}<span className="text-base font-normal text-white/40">/100</span></div>
          </div>
          <AtualizarAgoraButton clientId={clientId} />
        </div>
      </header>

      {!snap ? (
        <div className="rounded-xl border border-dashed border-white/15 p-10 text-center text-white/60">Calculando… clique em Atualizar agora.</div>
      ) : (
        <>
          <CanalCards canais={snap.canais} />
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="mb-3 text-sm font-medium">Onde está perdendo</h2>
            <PerdasLista perdas={snap.perdas} />
          </section>
        </>
      )}

      <ConexoesCard
        clientId={clientId} podeEditar={editar} emailContaServico={editar ? emailContaServico() : null}
        atual={{
          ga4: cliente.ga4_property_id, gsc: cliente.gsc_site_url, lyide: cliente.crm_tipo === "yide" ? cliente.crm_identifier : null,
          site: cliente.site_url, semSite: cliente.sem_site,
        }}
        opcoes={{ ga4: opcoesGa4, gsc: opcoesGsc, lyide: opcoesLyide }}
      />
      {editar && cliente.site_url && !cliente.sem_site && (
        <SiteGoogleCard
          key={`${cliente.ga4_property_id ?? ""}|${cliente.gsc_site_url ?? ""}`}
          clientId={clientId} ga4PropertyId={cliente.ga4_property_id}
          ga4MeasurementId={cliente.ga4_measurement_id} gscSiteUrl={cliente.gsc_site_url}
        />
      )}
    </div>
  );
}
