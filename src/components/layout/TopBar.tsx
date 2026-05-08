import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { MobileNav } from "./MobileNav";
import { NotificationBell } from "@/components/notificacoes/NotificationBell";
import type { Role } from "@/lib/auth/permissions";
import type { SidebarBadges } from "./Sidebar";

export function TopBar({
  userId,
  nome,
  email,
  avatarUrl,
  role,
  badges,
}: {
  userId: string;
  nome: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  badges?: SidebarBadges;
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
        <MobileNav role={role} nome={nome} badges={badges} />
        <div className="flex flex-1 items-center justify-end gap-2">
          <NotificationBell userId={userId} />
          <ThemeToggle />
          <UserMenu nome={nome} email={email} avatarUrl={avatarUrl} />
        </div>
      </div>
    </header>
  );
}
