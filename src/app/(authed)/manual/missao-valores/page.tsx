import { Sparkles, Rocket, Target, TrendingUp, Check } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { ManualBreadcrumb } from "@/components/manual/ManualBreadcrumb";

const VALORES = [
  "Comunicação clara",
  "Velocidade na execução",
  "Transparência sempre",
  "Proximidade sem falsidade",
  "Estratégia acima de achismo",
  "Resultado acima de desculpas",
  "Sem ego, sem enrolação",
  "Certo pelo certo",
  "Mais execução, menos promessa",
  "Quem corre mais, cresce mais",
] as const;

export default async function MissaoValoresPage() {
  await requireAuth();

  return (
    <div className="space-y-8">
      <ManualBreadcrumb current="Missão & valores" />

      <header className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Missão & Valores</h1>
          <p className="text-sm text-muted-foreground">O que move a Yide</p>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="bg-gradient-to-br from-primary/15 via-card to-card p-6 sm:p-8">
          <p className="text-base font-semibold leading-relaxed">
            Sem enrolação.
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            A Yide existe para construir marcas fortes, gerar resultado e fazer
            empresas crescerem de verdade.
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            Acreditamos em comunicação forte, posicionamento estratégico e execução
            rápida.
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Target className="h-4 w-4" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider">Missão</h2>
          </div>
          <p className="mt-4 text-sm leading-relaxed">
            Fortalecer marcas, gerar percepção de valor e ajudar nossos clientes a
            ganharem mais dinheiro através da internet.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <article className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Rocket className="h-4 w-4" />
            </div>
            <p className="text-sm font-bold">Mais movimento</p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">mais oportunidade.</p>
        </article>
        <article className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <p className="text-sm font-bold">Mais posicionamento</p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">mais crescimento.</p>
        </article>
        <article className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <TrendingUp className="h-4 w-4" />
            </div>
            <p className="text-sm font-bold">Mais resultado</p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">mais dinheiro.</p>
        </article>
      </section>

      <section className="space-y-4">
        <header>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Valores
          </h2>
        </header>
        <div className="rounded-xl border bg-card p-5">
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {VALORES.map((v) => (
              <li key={v} className="flex items-center gap-2 text-sm">
                <Check className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                <span>{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="bg-gradient-to-br from-primary/15 via-card to-card p-6 sm:p-8 text-center">
          <blockquote className="text-base font-semibold italic">
            &ldquo;Aqui a gente valoriza quem resolve.&rdquo;
          </blockquote>
        </div>
      </section>
    </div>
  );
}
