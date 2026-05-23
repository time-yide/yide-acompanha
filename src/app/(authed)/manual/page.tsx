import Link from "next/link";
import { BookOpen, FolderOpen, ScrollText, Heart, Sparkles, Compass, PlayCircle } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";

interface Card {
  href: string;
  icon: typeof BookOpen;
  titulo: string;
  resumo: string;
}

const CARDS: Card[] = [
  {
    href: "/manual/passo-a-passo",
    icon: PlayCircle,
    titulo: "Passo a passo do sistema",
    resumo: "Vídeos curtos ensinando cada setor a usar o sistema no dia a dia.",
  },
  {
    href: "/manual/materiais",
    icon: FolderOpen,
    titulo: "Materiais",
    resumo: "Modelo de briefing, decks, planilhas e outros arquivos da equipe.",
  },
  {
    href: "/manual/regras-da-casa",
    icon: ScrollText,
    titulo: "Regras da casa",
    resumo: "Como a Yide opera no dia a dia + jornada D0 → D30 do cliente.",
  },
  {
    href: "/manual/historia",
    icon: Compass,
    titulo: "História da Yide",
    resumo: "De onde a gente veio e como chegamos até aqui.",
  },
  {
    href: "/manual/cultura",
    icon: Heart,
    titulo: "Cultura",
    resumo: "Como nos comportamos, como damos feedback, o que valorizamos.",
  },
  {
    href: "/manual/missao-valores",
    icon: Sparkles,
    titulo: "Missão & valores",
    resumo: "Pra que a gente existe e os princípios que nos guiam.",
  },
];

export default async function ManualPage() {
  await requireAuth();

  return (
    <div className="space-y-8">
      <header className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-card to-card p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Manual da Yide</h1>
            <p className="text-sm text-muted-foreground">
              Tudo que você precisa saber pra trabalhar bem aqui
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.href}
              href={c.href}
              className="group rounded-2xl border bg-card p-5 transition-all hover:border-primary/40 hover:bg-card/80"
            >
              <header className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold tracking-tight">{c.titulo}</h2>
                  <p className="text-xs text-muted-foreground">{c.resumo}</p>
                </div>
              </header>
            </Link>
          );
        })}
      </div>

      <footer className="rounded-xl border border-dashed bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
        Manual vivo, vai sendo construído pelo time. Tem algo importante que
        devia estar aqui? Avisa a Yasmin no Escritório Virtual.
      </footer>
    </div>
  );
}
