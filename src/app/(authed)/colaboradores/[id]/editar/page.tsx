import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { getColaboradorById } from "@/lib/colaboradores/queries";
import { ColaboradorForm } from "@/components/colaboradores/ColaboradorForm";
import { AvatarUpload } from "@/components/colaboradores/AvatarUpload";
import { ResetSenhaButton } from "@/components/colaboradores/ResetSenhaButton";
import { Card } from "@/components/ui/card";

export default async function EditarColaboradorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  if (!canAccess(user.role, "edit:colaboradores") && user.id !== id) {
    notFound();
  }

  let colab;
  try {
    colab = await getColaboradorById(id);
  } catch {
    notFound();
  }

  const canEditFinance = user.role === "socio";
  const canEditRole = user.role === "socio";
  const canEditMetas = user.role === "socio" || user.role === "adm";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Editar colaborador</h1>
      </header>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Foto</h2>
        <AvatarUpload userId={colab.id} nome={colab.nome} currentUrl={colab.avatar_url} />
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Dados</h2>
        <ColaboradorForm
          data={{
            id: colab.id,
            nome: colab.nome,
            telefone: colab.telefone,
            endereco: colab.endereco,
            pix: colab.pix,
            data_nascimento: colab.data_nascimento,
            data_admissao: colab.data_admissao,
            fixo_mensal: colab.fixo_mensal,
            comissao_percent: colab.comissao_percent,
            comissao_primeiro_mes_percent: colab.comissao_primeiro_mes_percent,
            role: colab.role,
            ativo: colab.ativo,
            meta_prospects_mes: colab.meta_prospects_mes,
            meta_fechamentos_mes: colab.meta_fechamentos_mes,
            meta_receita_mes: colab.meta_receita_mes,
          }}
          canEditFinance={canEditFinance}
          canEditRole={canEditRole}
          canEditMetas={canEditMetas}
        />
      </Card>

      {(user.role === "socio" || user.role === "adm") && user.id !== colab.id && (
        <Card className="p-6">
          <h2 className="mb-2 text-lg font-semibold">Senha</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Gera uma nova senha aleatória e invalida a atual. A senha aparecerá uma única vez para você copiar e enviar ao colaborador.
          </p>
          <ResetSenhaButton userId={colab.id} userNome={colab.nome} />
        </Card>
      )}
    </div>
  );
}
