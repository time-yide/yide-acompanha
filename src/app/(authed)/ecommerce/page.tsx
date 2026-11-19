import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import {
  listAnuncios,
  listAssessoresEcommerce,
  listClientesEcommerce,
  veTudo,
} from "@/lib/ecommerce/queries";
import { aggregateAnuncios } from "@/lib/ecommerce/aggregate";
import { NovoAnuncioButton } from "@/components/ecommerce/NovoAnuncioButton";
import { AnunciosList } from "@/components/ecommerce/AnunciosList";
import { AnunciosResumo } from "@/components/ecommerce/AnunciosResumo";
import { PainelEcommerce } from "@/components/ecommerce/PainelEcommerce";
import { FiltroPeriodo } from "@/components/ecommerce/FiltroPeriodo";
import { canAccessEcommerce } from "@/lib/ecommerce/access";
import { listPublicadosYideEcom } from "@/lib/ecommerce/yideecom";
import { casarPublicados, juntarAnuncios } from "@/lib/ecommerce/yideecom-match";

function inicioDoMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function EcommercePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; de?: string; ate?: string; assessor?: string }>;
}) {
  const user = await requireAuth();
  if (!canAccessEcommerce(user.role, user.especialidade)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const sp = await searchParams;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const chefia = veTudo(user.role);
  const tab = sp.tab === "painel" && chefia ? "painel" : "lancar";
  const de = sp.de && DATE_RE.test(sp.de) ? sp.de : inicioDoMes();
  const ate = sp.ate && DATE_RE.test(sp.ate) ? sp.ate : hoje();
  const assessorId = chefia && sp.assessor ? sp.assessor : null;

  const [clientes, manuais, assessores, yideEcom] = await Promise.all([
    listClientesEcommerce(orgId),
    listAnuncios(orgId, user.role, user.id, { de, ate, assessorId }),
    chefia ? listAssessoresEcommerce(orgId) : Promise.resolve([]),
    // Automáticos do Yide Ecom não têm assessor: somem quando filtra por assessor.
    assessorId ? Promise.resolve(null) : listPublicadosYideEcom(de, ate),
  ]);
  const { rows: automaticos, semCliente } =
    yideEcom?.ok ? casarPublicados(yideEcom.publicados, clientes) : { rows: [], semCliente: [] };
  const anuncios = juntarAnuncios(manuais, automaticos);
  const agg = aggregateAnuncios(anuncios);

  const tabHref = (t: string) => {
    const p = new URLSearchParams();
    p.set("tab", t);
    p.set("de", de);
    p.set("ate", ate);
    if (assessorId) p.set("assessor", assessorId);
    return `/ecommerce?${p.toString()}`;
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">E-commerce</h1>
          <p className="text-sm text-muted-foreground">
            Mercado Livre e Tray entram sozinhos do Yide Ecom. Lance à mão os outros marketplaces.
          </p>
        </div>
        <NovoAnuncioButton clientes={clientes} />
      </header>

      {clientes.length === 0 && (
        <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          Nenhum cliente com pacote e-commerce ainda. Defina o pacote do cliente
          como &quot;E-commerce&quot; no cadastro para ele aparecer aqui.
        </p>
      )}

      {chefia && (
        <nav className="flex gap-2 border-b">
          <Link
            href={tabHref("lancar")}
            className={`px-3 py-2 text-sm font-medium ${
              tab === "lancar"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground"
            }`}
          >
            Lançamentos
          </Link>
          <Link
            href={tabHref("painel")}
            className={`px-3 py-2 text-sm font-medium ${
              tab === "painel"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground"
            }`}
          >
            Painel
          </Link>
        </nav>
      )}

      {chefia && yideEcom && !yideEcom.ok && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          {yideEcom.erro === "nao_configurado"
            ? "Ligação com o Yide Ecom ainda não configurada: os anúncios automáticos não aparecem."
            : "Não foi possível buscar os anúncios do Yide Ecom agora. Mostrando só os lançamentos manuais."}
        </p>
      )}

      {chefia && semCliente.length > 0 && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Clientes do Yide Ecom sem cliente e-commerce com o mesmo nome aqui (os anúncios deles não entram):{" "}
          <span className="font-medium">{semCliente.join(", ")}</span>. Deixe o nome igual nos dois sistemas.
        </p>
      )}

      <FiltroPeriodo
        de={de}
        ate={ate}
        tab={tab}
        assessores={chefia ? assessores : undefined}
        assessorAtual={assessorId ?? undefined}
      />

      {tab === "painel" && chefia ? (
        <PainelEcommerce agg={agg} />
      ) : (
        <div className="space-y-5">
          <AnunciosResumo agg={agg} lancamentos={anuncios.length} />
          <AnunciosList
            anuncios={anuncios}
            clientes={clientes}
            mostrarAssessor={chefia}
            podeArquivar={true}
          />
        </div>
      )}
    </div>
  );
}
