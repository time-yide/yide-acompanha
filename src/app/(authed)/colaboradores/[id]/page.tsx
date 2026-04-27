import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { getColaboradorById } from "@/lib/colaboradores/queries";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";

const roleLabels: Record<string, string> = {
  adm: "ADM",
  socio: "Sócio",
  comercial: "Comercial",
  coordenador: "Coordenador",
  assessor: "Assessor",
  videomaker: "Videomaker",
  designer: "Designer",
  editor: "Editor",
  audiovisual_chefe: "Audiovisual Chefe",
};

function initials(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function ColaboradorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const canEdit = canAccess(user.role, "edit:colaboradores");
  const canSeeFinance = canAccess(user.role, "view:other_commissions") || user.id === id;

  let colab;
  try {
    colab = await getColaboradorById(id);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {colab.avatar_url ? (
            <Image
              src={colab.avatar_url}
              alt={colab.nome}
              width={96}
              height={96}
              className="h-24 w-24 rounded-full object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted text-2xl font-semibold text-muted-foreground">
              {initials(colab.nome)}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{colab.nome}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="secondary">{roleLabels[colab.role] ?? colab.role}</Badge>
              {colab.ativo ? (
                <Badge variant="outline" className="border-green-500/40 text-green-600 dark:text-green-400">
                  Ativo
                </Badge>
              ) : (
                <Badge variant="outline">Inativo</Badge>
              )}
            </div>
          </div>
        </div>
        {canEdit && (
          <Link
            href={`/colaboradores/${id}/editar`}
            className="group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background text-sm font-medium whitespace-nowrap transition-all outline-none select-none hover:bg-muted hover:text-foreground h-8 gap-1.5 px-2.5"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </Link>
        )}
      </header>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Dados pessoais</h2>
        <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <Field label="Email" value={colab.email} />
          <Field label="Telefone" value={colab.telefone} />
          <Field label="Endereço" value={colab.endereco} className="md:col-span-2" />
          <Field
            label="Data de nascimento"
            value={colab.data_nascimento ? new Date(colab.data_nascimento).toLocaleDateString("pt-BR") : null}
          />
          <Field
            label="Data de admissão"
            value={colab.data_admissao ? new Date(colab.data_admissao).toLocaleDateString("pt-BR") : null}
          />
        </dl>
      </Card>

      {canSeeFinance && (
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Dados financeiros</h2>
          <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <Field label="Pix" value={colab.pix} />
            <Field
              label="Fixo mensal"
              value={Number(colab.fixo_mensal).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            />
            <Field label="% Comissão (assessor/coord)" value={`${colab.comissao_percent}%`} />
            <Field label="% Comissão 1º mês (comercial)" value={`${colab.comissao_primeiro_mes_percent}%`} />
          </dl>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}
