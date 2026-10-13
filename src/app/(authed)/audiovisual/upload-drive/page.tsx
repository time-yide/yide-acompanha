import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isDriveConfigurado, listRecentUploads } from "@/lib/google-drive/actions";
import { UploadDriveView } from "@/components/audiovisual/UploadDriveView";

const ROLES_QUE_VEEM = [
  "videomaker", "fast_midia", "audiovisual_chefe", "editor",
  "coordenador", "assessor", "adm", "socio",
];

export default async function UploadDrivePage() {
  const user = await requireAuth();
  if (!ROLES_QUE_VEEM.includes(user.role)) notFound();

  const configurado = await isDriveConfigurado();
  if (!configurado) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p className="text-lg font-medium">Google Drive não configurado</p>
        <p className="text-sm mt-1">
          Configure GOOGLE_SERVICE_ACCOUNT_JSON e GOOGLE_DRIVE_ROOT_FOLDER_ID nas variáveis de ambiente.
        </p>
      </div>
    );
  }

  const supabase = createServiceRoleClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, nome")
    .in("status", ["ativo", "em_onboarding"])
    .order("nome");

  const recentUploads = await listRecentUploads(30);

  return (
    <UploadDriveView
      clients={(clients ?? []).map((c) => ({ value: c.id, label: c.nome }))}
      recentUploads={recentUploads}
    />
  );
}
