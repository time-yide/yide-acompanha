import { headers } from "next/headers";
import { requireAuth } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { countRecadosNaoLidos } from "@/lib/recados/queries";
import { checkSatisfactionLock } from "@/lib/satisfacao/lock";
import { SatisfactionLockGate } from "@/components/satisfacao/SatisfactionLockGate";
import { listPendenteParaVideomaker } from "@/lib/audiovisual/queries";
import { CapturaPendenteLockGate } from "@/components/audiovisual/CapturaPendenteLockGate";
import { countChannelsWithUnread } from "@/lib/escritorio/queries";

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  const isVideomaker = user.role === "videomaker";
  const [recadosNaoLidos, lockState, audiovisualPendentes, escritorioUnread] = await Promise.all([
    countRecadosNaoLidos(user.id),
    checkSatisfactionLock(user.id, user.role),
    isVideomaker ? listPendenteParaVideomaker(user.id) : Promise.resolve([]),
    countChannelsWithUnread(user.id, user.role).catch(() => 0),
  ]);
  const audiovisualOverdue = audiovisualPendentes.filter((p) => p.isOverdue);

  // Esconde o gate quando user já está em /audiovisual (pra ele poder regularizar)
  const hdrs = await headers();
  const path = hdrs.get("x-pathname") ?? "";
  const isOnAudiovisual = path.startsWith("/audiovisual");

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} nome={user.nome} badges={{ recados: recadosNaoLidos, escritorio: escritorioUnread }} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          nome={user.nome}
          email={user.email}
          avatarUrl={user.avatarUrl}
          role={user.role}
          badges={{ recados: recadosNaoLidos, escritorio: escritorioUnread }}
        />
        <main className="flex-1 overflow-auto bg-muted/20 p-3 md:p-6">{children}</main>
      </div>
      <SatisfactionLockGate state={lockState} />
      <CapturaPendenteLockGate overdue={audiovisualOverdue} hidden={isOnAudiovisual} />
    </div>
  );
}
