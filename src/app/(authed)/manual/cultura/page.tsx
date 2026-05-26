import {
  Heart, Zap, Users, Eye, Sparkles, Lightbulb, Crown, Award, TrendingUp, X, Target,
} from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { ManualBreadcrumb } from "@/components/manual/ManualBreadcrumb";

const VALORES = [
  {
    Icon: Zap,
    titulo: "Comunicação Ágil",
    destaque: "Velocidade é um dos nossos diferenciais.",
    descricao: "Respondemos com clareza, direção e intenção. Não deixamos clientes e equipe sem posicionamento.",
  },
  {
    Icon: Users,
    titulo: "Aproximação",
    destaque: "Não acreditamos em relações frias.",
    descricao: "Gostamos de estar próximos, entender a realidade do cliente e construir conexões verdadeiras.",
  },
  {
    Icon: Eye,
    titulo: "Transparência",
    destaque: "Clareza gera confiança.",
    descricao: "Falamos a verdade, alinhamos expectativas e tratamos desafios com maturidade.",
  },
  {
    Icon: Sparkles,
    titulo: "Personalização",
    destaque: "Cada marca possui uma necessidade diferente.",
    descricao: "Não trabalhamos com estratégias genéricas. Tudo precisa fazer sentido para o momento e objetivo de cada cliente.",
  },
  {
    Icon: Lightbulb,
    titulo: "Proatividade",
    destaque: "Não esperamos problemas aparecerem para agir.",
    descricao: "Buscamos soluções, melhorias e novas ideias constantemente.",
  },
  {
    Icon: Crown,
    titulo: "Senso de Dono",
    destaque: "Cada detalhe importa.",
    descricao: "Aqui, todos carregam responsabilidade pelo resultado final e cuidam da empresa como se fosse sua.",
  },
  {
    Icon: Award,
    titulo: "Excelência na Entrega",
    destaque: "Gostamos de fazer bem feito.",
    descricao: "Dos detalhes que aparecem e principalmente dos que ninguém vê.",
  },
  {
    Icon: TrendingUp,
    titulo: "Evolução Contínua",
    destaque: "A Yide está sempre em movimento.",
    descricao: "Aprendemos rápido, testamos, ajustamos e evoluímos constantemente.",
  },
] as const;

const NAO_COMBINA = [
  "Falta de comunicação",
  "Atendimento genérico",
  "Demora sem posicionamento",
  "Fazer “de qualquer jeito”",
  "Falta de comprometimento",
  "Ego acima do time",
  "Promessas vazias",
  "Falta de transparência",
] as const;

export default async function CulturaPage() {
  await requireAuth();

  return (
    <div className="space-y-8">
      <ManualBreadcrumb current="Cultura" />

      <header className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Heart className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cultura Yide</h1>
          <p className="text-sm text-muted-foreground">
            O jeito que pensamos, criamos e entregamos.
          </p>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="bg-gradient-to-br from-primary/15 via-card to-card p-6 sm:p-8">
          <p className="text-base font-semibold leading-relaxed">
            A Yide não nasceu para ser apenas mais uma agência.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Nascemos para construir marcas com proximidade, estratégia e velocidade.
          </p>
          <div className="mt-5 space-y-1 text-sm leading-relaxed">
            <p>Acreditamos que comunicação é experiência.</p>
            <p>Que rapidez é respeito.</p>
            <p>
              E que marcas fortes são construídas através de relacionamento, clareza
              e execução.
            </p>
          </div>
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            Nossa cultura define como trabalhamos no dia a dia, como nos posicionamos
            diante dos clientes e como construímos resultados.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <header>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            O que valorizamos
          </h2>
        </header>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {VALORES.map(({ Icon, titulo, destaque, descricao }) => (
            <article
              key={titulo}
              className="rounded-xl border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <h3 className="text-sm font-bold">{titulo}</h3>
                  <p className="text-xs font-medium text-foreground/90">{destaque}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {descricao}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <header>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            O que não combina com a Yide
          </h2>
        </header>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {NAO_COMBINA.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm">
                <X className="h-3.5 w-3.5 flex-shrink-0 text-destructive" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="bg-gradient-to-br from-primary/15 via-card to-card p-6 sm:p-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Target className="h-4 w-4" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider">Nosso objetivo</h2>
          </div>
          <p className="mt-4 text-sm leading-relaxed">
            Queremos que cada cliente sinta que existe uma equipe realmente pensando
            na marca dele.
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            Mais do que entregar serviços, queremos construir experiências, conexões
            e marcas memoráveis.
          </p>
          <blockquote className="mt-6 border-l-2 border-primary/60 pl-4 text-sm italic text-foreground/90">
            &ldquo;A forma como fazemos é tão importante quanto o resultado que
            entregamos.&rdquo;
          </blockquote>
        </div>
      </section>
    </div>
  );
}
