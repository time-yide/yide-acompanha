import Link from "next/link";
import { IdCard, Inbox, Smile } from "lucide-react";
import { countRequestsAbertas } from "@/lib/portal-requests/queries";

export type TabKey = "painel" | "satisfacao" | "solicitacoes";

interface Props {
  active: TabKey;
  /** Quando false, esconde as abas "Painel do cliente" e "Solicitações". */
  canSeePainel?: boolean;
}

// Satisfação saiu do menu lateral e virou aba dentro de Painel do
// Cliente — fluxo de relacionamento com cliente faz mais sentido junto.
// Painel do cliente é restrito a adm/sócio; satisfação é pra todos.
// Pra outros roles a aba "Painel do cliente" some, sobra só satisfação.
const ALL_TABS: Array<{ key: TabKey; label: string; href: string; Icon: typeof IdCard }> = [
  { key: "painel", label: "Painel do cliente", href: "/painel-cliente", Icon: IdCard },
  { key: "solicitacoes", label: "Solicitações", href: "/solicitacoes", Icon: Inbox },
  { key: "satisfacao", label: "Satisfação", href: "/satisfacao", Icon: Smile },
];

const TABS_RESTRITAS: TabKey[] = ["painel", "solicitacoes"];

export async function TabsPainelCliente({ active, canSeePainel = true }: Props) {
  const tabs = canSeePainel ? ALL_TABS : ALL_TABS.filter((t) => !TABS_RESTRITAS.includes(t.key));
  // Quando só sobrou 1 aba, não vale renderizar nav (ficaria visualmente
  // confuso — uma "aba" isolada no topo da página).
  if (tabs.length <= 1) return null;
  const solicitacoesAbertas = canSeePainel ? await countRequestsAbertas().catch(() => 0) : 0;
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
            {key === "solicitacoes" && solicitacoesAbertas > 0 && (
              <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold leading-5 text-white">
                {solicitacoesAbertas}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
