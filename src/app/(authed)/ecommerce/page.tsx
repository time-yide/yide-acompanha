import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import {
  listAnuncios,
  listClientesEcommerce,
  veTudo,
} from "@/lib/ecommerce/queries";
import { aggregateAnuncios } from "@/lib/ecommerce/aggregate";
import { NovoAnuncioButton } from "@/components/ecommerce/NovoAnuncioButton";
import { AnunciosList } from "@/components/ecommerce/AnunciosList";
import { PainelEcommerce } from "@/components/ecommerce/PainelEcommerce";
import { FiltroPeriodo } from "@/components/ecommerce/FiltroPeriodo";

const ALLOWED = ["adm", "socio", "assessor_ecommerce"];

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
  searchParams: Promise<{ tab?: string; de?: string; ate?: string }>;
}) {
  const user = await requireAuth();
  if (!ALLOWED.includes(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const sp = await searchParams;
  const chefia = veTudo(user.role);
  const tab = sp.tab === "painel" && chefia ? "painel" : "lancar";
  const de = sp.de || inicioDoMes();
  const ate = sp.ate || hoje();

  const [clientes, anuncios] = await Promise.all([
    listClientesEcommerce(orgId),
    listAnuncios(orgId, user.role, user.id, { de, ate }),
  ]);
  const agg = aggregateAnuncios(anuncios);

  const tabHref = (t: string) => {
    const p = new URLSearchParams();
    p.set("tab", t);
    p.set("de", de);
    p.set("ate", ate);
    return `/ecommerce?${p.toString()}`;
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">E-commerce</h1>
          <p className="text-sm text-muted-foreground">
            Registre os anúncios subidos por cliente e acompanhe a produtividade.
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

      <FiltroPeriodo de={de} ate={ate} tab={tab} />

      {tab === "painel" && chefia ? (
        <PainelEcommerce agg={agg} />
      ) : (
        <AnunciosList
          anuncios={anuncios}
          mostrarAssessor={chefia}
          podeArquivar={true}
        />
      )}
    </div>
  );
}
