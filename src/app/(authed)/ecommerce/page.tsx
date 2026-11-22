import { Suspense } from "react";
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
import { parseCanal } from "@/lib/ecommerce/yideecom-vendas";
import { VendasYideEcom } from "@/components/ecommerce/VendasYideEcom";
import { SugestoesYideEcom } from "@/components/ecommerce/SugestoesYideEcom";
import { Skeleton } from "@/components/ui/skeleton";

// A aba Vendas espera o Yide Ecom buscar os pedidos no ML/Tray (pode passar de 1 min)
export const maxDuration = 300;

type Tab = "lancar" | "painel" | "vendas" | "sugestoes";

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
  searchParams: Promise<{ tab?: string; de?: string; ate?: string; assessor?: string; cliente?: string; canal?: string }>;
}) {
  const user = await requireAuth();
  if (!canAccessEcommerce(user.role, user.especialidade)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const sp = await searchParams;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const chefia = veTudo(user.role);
  const tab: Tab =
    sp.tab === "painel" && chefia
      ? "painel"
      : sp.tab === "vendas" || sp.tab === "sugestoes"
        ? sp.tab
        : "lancar";
  const lancamentosTab = tab === "lancar" || tab === "painel";
  const clienteYideEcom = sp.cliente || null;
  const de = sp.de && DATE_RE.test(sp.de) ? sp.de : inicioDoMes();
  const ate = sp.ate && DATE_RE.test(sp.ate) ? sp.ate : hoje();
  const assessorId = chefia && sp.assessor ? sp.assessor : null;

  const [clientes, manuais, assessores, yideEcom] = await Promise.all([
    listClientesEcommerce(orgId),
    lancamentosTab ? listAnuncios(orgId, user.role, user.id, { de, ate, assessorId }) : Promise.resolve([]),
    chefia && lancamentosTab ? listAssessoresEcommerce(orgId) : Promise.resolve([]),
    // Automáticos do Yide Ecom não têm assessor: somem quando filtra por assessor.
    assessorId || !lancamentosTab ? Promise.resolve(null) : listPublicadosYideEcom(de, ate),
  ]);
  const { rows: automaticos } = yideEcom?.ok ? casarPublicados(yideEcom.dados, clientes) : { rows: [] };
  const anuncios = juntarAnuncios(manuais, automaticos);
  const agg = aggregateAnuncios(anuncios);

  const tabHref = (t: Tab) => {
    const p = new URLSearchParams();
    p.set("tab", t);
    if (t !== "sugestoes") {
      p.set("de", de);
      p.set("ate", ate);
    }
    if (assessorId && (t === "lancar" || t === "painel")) p.set("assessor", assessorId);
    if (clienteYideEcom && (t === "vendas" || t === "sugestoes")) p.set("cliente", clienteYideEcom);
    return `/ecommerce?${p.toString()}`;
  };
  const abas: { id: Tab; label: string }[] = [
    { id: "lancar", label: "Lançamentos" },
    ...(chefia ? [{ id: "painel" as const, label: "Painel" }] : []),
    { id: "vendas", label: "Vendas" },
    { id: "sugestoes", label: "Sugestões" },
  ];

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

      <nav className="flex gap-1 overflow-x-auto border-b">
        {abas.map((a) => (
          <Link
            key={a.id}
            href={tabHref(a.id)}
            className={`whitespace-nowrap px-3 py-2 text-sm font-medium ${
              tab === a.id ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"
            }`}
          >
            {a.label}
          </Link>
        ))}
      </nav>

      {chefia && yideEcom && !yideEcom.ok && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          {yideEcom.erro === "nao_configurado"
            ? "Ligação com o Yide Ecom ainda não configurada: os anúncios automáticos não aparecem."
            : "Não foi possível buscar os anúncios do Yide Ecom agora. Mostrando só os lançamentos manuais."}
        </p>
      )}


      {tab !== "sugestoes" && (
        <FiltroPeriodo
          de={de}
          ate={ate}
          tab={tab}
          assessores={chefia && lancamentosTab ? assessores : undefined}
          assessorAtual={assessorId ?? undefined}
        />
      )}

      {tab === "vendas" ? (
        <Suspense key={`${de}-${ate}`} fallback={<CarregandoYideEcom texto="Buscando as vendas no Mercado Livre e na Tray..." />}>
          <VendasYideEcom de={de} ate={ate} clienteId={clienteYideEcom} canal={parseCanal(sp.canal)} mostrarLucro={chefia} />
        </Suspense>
      ) : tab === "sugestoes" ? (
        <Suspense fallback={<CarregandoYideEcom texto="Buscando as sugestões do Yide Ecom..." />}>
          <SugestoesYideEcom clienteId={clienteYideEcom} />
        </Suspense>
      ) : tab === "painel" && chefia ? (
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

function CarregandoYideEcom({ texto }: { texto: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{texto}</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
