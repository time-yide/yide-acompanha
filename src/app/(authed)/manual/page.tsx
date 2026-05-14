import { BookOpen, Sparkles, Heart, Workflow, Users, HelpCircle, Construction } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";

interface Section {
  icon: typeof BookOpen;
  titulo: string;
  resumo: string;
  topicos: string[];
}

const SECOES: Section[] = [
  {
    icon: Heart,
    titulo: "Cultura & valores",
    resumo: "Quem somos, no que acreditamos e como nos comportamos no dia a dia.",
    topicos: ["Missão e visão", "Princípios da Yide", "Como damos feedback", "Comemorações e rituais"],
  },
  {
    icon: Workflow,
    titulo: "Como trabalhamos",
    resumo: "Processos, rituais e responsabilidades de cada área.",
    topicos: ["Fluxo do D0 → D30", "Como abrir e entregar tarefas", "Pipeline comercial", "Reuniões e cadências"],
  },
  {
    icon: Users,
    titulo: "Quem é quem",
    resumo: "Estrutura do time, responsabilidades e quem procurar pra cada assunto.",
    topicos: ["Organograma", "Áreas e responsabilidades", "Pontos focais por cliente", "Decisões: quem pode aprovar o quê"],
  },
  {
    icon: Sparkles,
    titulo: "Ferramentas",
    resumo: "Tudo que usamos no dia a dia, com guias rápidos.",
    topicos: ["Sistema interno (este aqui)", "Drive da Yide", "Meta Business Manager", "WhatsApp Business"],
  },
  {
    icon: HelpCircle,
    titulo: "FAQ & dúvidas comuns",
    resumo: "Respostas rápidas pras perguntas que mais aparecem.",
    topicos: ["Folgas e férias", "Reembolsos", "Suporte técnico", "Onboarding de novo colaborador"],
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
              Tudo que você precisa saber pra trabalhar bem na Yide
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {SECOES.map((s) => {
          const Icon = s.icon;
          return (
            <section key={s.titulo} className="rounded-2xl border bg-card p-5 transition-colors hover:bg-card/80">
              <header className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold tracking-tight">{s.titulo}</h2>
                    <p className="text-xs text-muted-foreground">{s.resumo}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Construction className="h-3 w-3" />
                  Em breve
                </span>
              </header>

              <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                {s.topicos.map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-primary/60" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <footer className="rounded-xl border border-dashed bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
        Este manual é vivo — vai sendo construído pelo time. Tem algo importante
        que devia estar aqui? Avisa a Yasmin no Escritório Virtual.
      </footer>
    </div>
  );
}
