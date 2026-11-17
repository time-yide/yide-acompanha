import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { driveConfigurado } from "@/lib/google-drive/client";
import { listRecentDriveUploads } from "@/lib/google-drive/actions";
import { podeSubirProDrive } from "@/lib/google-drive/schema";
import { getTodayDate } from "@/lib/datetime/timezone";
import { UploadDriveView } from "@/components/audiovisual/UploadDriveView";

export default async function UploadDrivePage() {
  const user = await requireAuth();
  if (!podeSubirProDrive(user.role)) redirect("/audiovisual");

  if (!driveConfigurado()) {
    return (
      <div className="mx-auto max-w-2xl space-y-2 rounded-lg border bg-card p-6">
        <h1 className="text-lg font-semibold">Upload pro Google Drive não configurado</h1>
        <p className="text-sm text-muted-foreground">
          Peça pro administrador configurar <code>GOOGLE_DRIVE_ROOT_FOLDER_ID</code> e a credencial
          (<code>GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON</code> ou o trio <code>GOOGLE_DRIVE_OAUTH_*</code>) nas
          variáveis de ambiente. Enquanto isso, a entrega de captação continua aceitando o link do Drive colado.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: clients }, recentes] = await Promise.all([
    supabase
      .from("clients")
      .select("id, nome")
      .in("status", ["ativo", "em_onboarding"])
      .is("deleted_at", null)
      .order("nome"),
    listRecentDriveUploads(30),
  ]);

  return (
    <UploadDriveView
      clients={(clients ?? []).map((c) => ({ value: c.id, label: c.nome }))}
      hoje={getTodayDate()}
      recentes={recentes}
    />
  );
}
