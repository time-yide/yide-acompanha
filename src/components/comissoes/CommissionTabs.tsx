import Link from "next/link";

interface Tab { slug: string; label: string; href: string; }

interface Props {
  active: "minhas" | "visao-geral" | "fechamento";
  showVisaoGeral: boolean;
  showFechamento: boolean;
  pendingMesesCount: number;
}

export function CommissionTabs({ active, showVisaoGeral, showFechamento, pendingMesesCount }: Props) {
  const tabs: Tab[] = [];
  if (showVisaoGeral) tabs.push({ slug: "visao-geral", label: "Visão geral", href: "/comissoes/visao-geral" });
  tabs.push({ slug: "minhas", label: "Minhas comissões", href: "/comissoes/minhas" });
  if (showFechamento) tabs.push({ slug: "fechamento", label: "Fechamento", href: "/comissoes/fechamento" });

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {tabs.map((t, i) => (
        <span key={t.slug} className="flex items-center gap-3">
          <Link
            href={t.href}
            className={active === t.slug
              ? "font-semibold text-primary"
              : "text-muted-foreground hover:text-foreground"}
          >
            {t.label}
            {t.slug === "fechamento" && pendingMesesCount > 0 && (
              <span className="ml-2 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
                {pendingMesesCount}
              </span>
            )}
          </Link>
          {i < tabs.length - 1 && <span className="text-muted-foreground">·</span>}
        </span>
      ))}
    </div>
  );
}
