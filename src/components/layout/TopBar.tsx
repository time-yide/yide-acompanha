import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { NotificationBell } from "@/components/notificacoes/NotificationBell";

export function TopBar({
  nome,
  email,
  avatarUrl,
}: {
  nome: string;
  email: string;
  avatarUrl: string | null;
}) {
  return (
    <header className="flex h-14 items-center justify-end gap-2 border-b bg-card px-6">
      <NotificationBell />
      <ThemeToggle />
      <UserMenu nome={nome} email={email} avatarUrl={avatarUrl} />
    </header>
  );
}
