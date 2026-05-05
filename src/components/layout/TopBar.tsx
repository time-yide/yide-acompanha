import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { MobileNav } from "./MobileNav";
import { NotificationBell } from "@/components/notificacoes/NotificationBell";
import type { Role } from "@/lib/auth/permissions";
import type { SidebarBadges } from "./Sidebar";

export function TopBar({
  nome,
  email,
  avatarUrl,
  role,
  badges,
}: {
  nome: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  badges?: SidebarBadges;
}) {
  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b bg-card px-4 md:px-6">
      <MobileNav role={role} nome={nome} badges={badges} />
      <div className="flex flex-1 items-center justify-end gap-2">
        <NotificationBell />
        <ThemeToggle />
        <UserMenu nome={nome} email={email} avatarUrl={avatarUrl} />
      </div>
    </header>
  );
}
