import { requireAuth } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  getMotorStats,
  getFunilMotor,
  getConversasAtivas,
} from "@/lib/motor-prospeccao/dashboard-queries";
import { MotorFunil } from "@/components/motor-prospeccao/MotorFunil";
import { ConversasAtivasTable } from "@/components/motor-prospeccao/ConversasAtivasTable";

async function getOrgId(userId: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data } = await sb
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.organization_id ?? null;
}

export default async function MotorDashboardPage() {
  const user = await requireAuth();
  const orgId = await getOrgId(user.id);
  if (!orgId) return <p>Organização não encontrada.</p>;

  const [stats, funil, conversas] = await Promise.all([
    getMotorStats(orgId),
    getFunilMotor(orgId),
    getConversasAtivas(orgId),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Motor de Prospecção</h1>
        <p className="text-sm text-muted-foreground">
          Métricas do disparo automático de WhatsApp e IA conversacional.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">WPP hoje</p>
          <p className="text-2xl font-bold">{stats.wppEnviadosHoje}</p>
          <p className="text-xs text-muted-foreground">de {stats.maxWppDia}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Conversas ativas</p>
          <p className="text-2xl font-bold">{stats.conversasAtivas}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Reuniões (semana)</p>
          <p className="text-2xl font-bold">{stats.reunioesAgendadasSemana}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Taxa resposta</p>
          <p className="text-2xl font-bold">{stats.taxaResposta}%</p>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Funil de conversão</h2>
        <MotorFunil data={funil} />
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Conversas com IA ativa</h2>
        <ConversasAtivasTable conversas={conversas} />
      </Card>
    </div>
  );
}
