import { requireClientPortalAuth } from "@/lib/auth/client-portal-session";
import { getClientPortalData } from "@/lib/painel-cliente/queries";
import { ClientPortalHeader } from "@/components/cliente-portal/ClientPortalHeader";
import { HeroSection } from "@/components/cliente-portal/HeroSection";
import { ContratoSection } from "@/components/cliente-portal/ContratoSection";
import { TrafegoSection } from "@/components/cliente-portal/TrafegoSection";
import { PastaSection } from "@/components/cliente-portal/PastaSection";
import { CRMPlaceholderSection } from "@/components/cliente-portal/CRMPlaceholderSection";

export default async function ClientePainelPage() {
  const user = await requireClientPortalAuth();
  const data = await getClientPortalData(user.clientId);

  if (!data) {
    // Edge case: cliente foi excluído mas o portal user não foi revogado.
    // Tela amigável ao invés de crash.
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Conta indisponível</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Seu cadastro não está mais ativo no nosso sistema. Entre em contato com a
          Yide pra regularizar.
        </p>
      </div>
    );
  }

  return (
    <>
      <ClientPortalHeader nomeContato={user.nomeContato} clientNome={data.cliente.nome} />

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:py-8">
        <HeroSection
          nomeContato={user.nomeContato}
          clientNome={data.cliente.nome}
          dataEntrada={data.cliente.data_entrada}
        />
        <ContratoSection cliente={data.cliente} assessor={data.assessor} />
        <TrafegoSection
          google={data.cliente.valor_trafego_google}
          meta={data.cliente.valor_trafego_meta}
        />
        <PastaSection driveUrl={data.cliente.drive_url} />
        <CRMPlaceholderSection />
      </main>
    </>
  );
}
