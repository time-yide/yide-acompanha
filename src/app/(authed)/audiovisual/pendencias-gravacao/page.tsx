import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { listAlertsByAssessor, listAlertsByStatus } from "@/lib/recording-alerts/queries";
import { listVideomakersAtivos } from "@/lib/audiovisual/coord-queries";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { PendenciasGravacaoView } from "@/components/recording-alerts/PendenciasGravacaoView";
import type { AlertWithClient } from "@/lib/recording-alerts/types";

const ROLES_PERMITIDOS = ["assessor", "audiovisual_chefe", "adm", "socio"];

export default async function PendenciasGravacaoPage() {
  const user = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(user.role)) redirect("/");

  // Buscar organization_id do perfil
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (sb as any)
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile?.organization_id) redirect("/");

  let alerts: AlertWithClient[] = [];

  if (user.role === "assessor") {
    alerts = await listAlertsByAssessor(user.id, "pendente");
  } else if (user.role === "audiovisual_chefe") {
    alerts = await listAlertsByStatus(profile.organization_id, [
      "alinhado_cliente",
      "agendado",
    ]);
  } else {
    // adm, socio
    alerts = await listAlertsByStatus(profile.organization_id, [
      "pendente",
      "alinhado_cliente",
      "agendado",
    ]);
  }

  const videomakers = await listVideomakersAtivos();

  return (
    <PendenciasGravacaoView
      alerts={alerts}
      userRole={user.role}
      videomakers={videomakers}
    />
  );
}
