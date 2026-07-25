import Link from "next/link";
import { BookOpen, GraduationCap, Gamepad2, UserCog, ClipboardList, type LucideIcon } from "lucide-react";

export type ManualTabKey = "manual" | "academy" | "time" | "colaboradores" | "pesquisas";

interface Props {
  active: ManualTabKey;
  /** Aba "Colaboradores" só aparece pra quem gerencia. */
  canVerColaboradores?: boolean;
}

/**
 * Barra de abas do "Bastidores": Bastidores + Yide Academy + Time + Colaboradores
 * (só gestor) + Pesquisas. Todos saíram do menu lateral e viram abas daqui,
 * com as URLs preservadas.
 */
export function TabsManual({ active, canVerColaboradores = false }: Props) {
  const tabs: Array<{ key: ManualTabKey; label: string; href: string; Icon: LucideIcon }> = [
    { key: "manual", label: "Bastidores", href: "/manual", Icon: BookOpen },
    { key: "academy", label: "Yide Academy", href: "/academy", Icon: GraduationCap },
    { key: "time", label: "Time", href: "/time", Icon: Gamepad2 },
    ...(canVerColaboradores
      ? [{ key: "colaboradores" as const, label: "Colaboradores", href: "/colaboradores", Icon: UserCog }]
      : []),
    { key: "pesquisas", label: "Pesquisas", href: "/pesquisas", Icon: ClipboardList },
  ];

  return (
    <nav className="flex flex-wrap items-center gap-1 border-b border-border/60 pb-px">
      {tabs.map(({ key, label, href, Icon }) => {
        const isActive = key === active;
        return (
          <Link
            key={key}
            href={href}
            className={
              isActive
                ? "inline-flex items-center gap-1.5 rounded-t-lg border border-b-0 border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary shadow-[0_0_24px_-12px] shadow-primary/40"
                : "inline-flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
