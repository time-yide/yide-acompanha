import { redirect } from "next/navigation";
import { Star } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { listClientesGmb, listClientesSemGmb } from "@/lib/painel-gmb/queries";
import { PainelGmbSummaryCards } from "@/components/painel-gmb/PainelGmbSummary";
import { PainelGmbList } from "@/components/painel-gmb/PainelGmbList";
import { AdicionarGmbDialog } from "@/components/painel-gmb/AdicionarGmbDialog";
import { TabsTrafego } from "@/components/trafego/TabsTrafego";

const ROLES_PERMITIDOS = ["adm", "socio", "coordenador", "assessor", "audiovisual_chefe"];

export default async function PainelGmbPage() {
  const user = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(user.role)) redirect("/");

  const placesApiEnabled = !!process.env.GOOGLE_PLACES_API_KEY;
  const [{ clientes, summary }, clientesSemGmb] = await Promise.all([
    listClientesGmb(),
    listClientesSemGmb(),
  ]);

  return (
    <div className="space-y-6">
      <TabsTrafego active="gmb" />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Star className="h-6 w-6 fill-current" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Painel Google Meu Negócio</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhamento de notas e reviews dos clientes monitorados.
              {placesApiEnabled
                ? " Atualizado automaticamente via Google Places API."
                : " Modo manual - assessor digita os números."}
            </p>
          </div>
        </div>
        {/* Botão pra cadastrar GMB de um cliente direto do painel */}
        <AdicionarGmbDialog
          clientesElegiveis={clientesSemGmb}
          placesApiEnabled={placesApiEnabled}
        />
      </header>

      <PainelGmbSummaryCards summary={summary} />

      {clientes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 p-10 text-center">
          <Star className="h-10 w-10 text-amber-500/40" />
          <div className="space-y-1">
            <p className="font-medium">Nenhum cliente com GMB cadastrado ainda</p>
            <p className="text-sm text-muted-foreground">
              Clique em <strong>&ldquo;Adicionar GMB&rdquo;</strong> no canto superior direito pra cadastrar
              o primeiro cliente. Você precisa apenas do link do Google Maps.
            </p>
          </div>
          {clientesSemGmb.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhum cliente ativo disponível pra cadastrar. Cadastre clientes em <code>/clientes</code> primeiro.
            </p>
          )}
        </div>
      ) : (
        <PainelGmbList clientes={clientes} />
      )}

      {!placesApiEnabled && (
        <p className="rounded-lg border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
          💡 Pra ativar atualização automática, configure <code>GOOGLE_PLACES_API_KEY</code> no Vercel.
          Sem isso, os dados ficam em modo manual (assessor preenche em <code>/clientes/[id]/gmb</code>).
        </p>
      )}
    </div>
  );
}
