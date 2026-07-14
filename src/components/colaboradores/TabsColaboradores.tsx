import Link from "next/link";
import { UserCog, Activity } from "lucide-react";

export type ColaboradoresTabKey = "colaboradores" | "produtividade";

interface Props {
  active: ColaboradoresTabKey;
  /** Produtividade é restrita — a aba só aparece pra quem pode acessar. */
  canSeeProdutividade?: boolean;
}

/** Barra de abas: Colaboradores + Produtividade (que saiu do menu lateral). */
export function TabsColaboradores({ active, canSeeProdutividade = false }: Props) {
  const tabs = [
    { key: "colaboradores" as const, label: "Colaboradores", href: "/colaboradores", Icon: UserCog, show: true },
    { key: "produtividade" as const, label: "Produtividade", href: "/produtividade", Icon: Activity, show: canSeeProdutividade },
  ].filter((t) => t.show);

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
