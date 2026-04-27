import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TopBar({ nome, email }: { nome: string; email: string }) {
  return (
    <header className="flex h-14 items-center justify-end gap-2 border-b bg-card px-6">
      <Button variant="ghost" size="icon" aria-label="Notificações">
        <Bell className="h-4 w-4" />
      </Button>
      <ThemeToggle />
      <UserMenu nome={nome} email={email} />
    </header>
  );
}
