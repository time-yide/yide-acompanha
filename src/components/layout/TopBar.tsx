import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { MobileNav } from "./MobileNav";
import { SidebarToggle } from "./SidebarToggle";
import { NotificationBell } from "@/components/notificacoes/NotificationBell";
import { UnitSwitcher } from "@/components/units/UnitSwitcher";
import type { Role } from "@/lib/auth/permissions";
import type { SidebarBadges } from "./Sidebar";
import type { UnitContext } from "@/lib/units/session";

export function TopBar({
  userId,
  nome,
  email,
  avatarUrl,
  role,
  badges,
  unitContext,
}: {
  userId: string;
  nome: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  badges?: SidebarBadges;
  unitContext: UnitContext | null;
}) {
  return (
    // sticky + safe-area-inset-top empurra o conteúdo da TopBar pra baixo do
    // notch/Dynamic Island do iOS (statusBarStyle="black-translucent" deixa
    // a UI ir atrás da barra de status; sem essa compensação o avatar e o
    // hamburger ficam eclipsados pelo relógio do sistema).
    <header
      className="sticky top-0 z-30 border-b bg-card"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex h-14 items-center justify-between gap-2 px-4 md:px-6">
        <div className="flex items-center gap-1">
          <MobileNav role={role} nome={nome} badges={badges} />
          <SidebarToggle />
        </div>
        <div className="flex flex-1 items-center justify-end gap-2">
          {/* Seletor de unidade — só renderiza pra master (adm/sócio).
              Non-master nem vê o badge da unidade aqui (Fase 1 mantém UI
              minimalista; quando for confuso aí mostramos um badge passivo). */}
          {unitContext?.isMaster && (
            <UnitSwitcher
              activeUnit={unitContext.activeUnit}
              homeUnit={unitContext.homeUnit}
              accessibleUnits={unitContext.accessibleUnits}
              isViewingOtherUnit={unitContext.isViewingOtherUnit}
            />
          )}
          <NotificationBell userId={userId} />
          <ThemeToggle />
          <UserMenu nome={nome} email={email} avatarUrl={avatarUrl} />
        </div>
      </div>
    </header>
  );
}
