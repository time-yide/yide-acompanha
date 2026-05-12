import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Trash2,
  CheckCircle2,
  Clock,
  Users,
  PlayCircle,
  AlertTriangle,
} from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import {
  getCursoById,
  listResponsaveisDoCurso,
  listMinhasTentativas,
  listTentativasDoCurso,
} from "@/lib/academy/queries";
import { deleteCursoAction } from "@/lib/academy/actions";
import { NOTA_MINIMA, QUESTOES_POR_CURSO } from "@/lib/academy/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Linkify } from "@/lib/utils/linkify";
import { APP_TIMEZONE } from "@/lib/datetime/timezone";

function isPrivileged(role: string): boolean {
  return role === "adm" || role === "socio";
}

function formatDateTimeBR(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", { timeZone: APP_TIMEZONE })} às ${d.toLocaleTimeString("pt-BR", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit" })}`;
}

export default async function CursoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ prova?: string; acertos?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireAuth();

  const curso = await getCursoById(id);
  if (!curso) notFound();

  const isCriador = curso.criado_por === user.id;
  const isAdmin = isPrivileged(user.role);
  const canDelete = isCriador || isAdmin;

  const [responsaveis, minhasTentativas, allTentativas] = await Promise.all([
    listResponsaveisDoCurso(id),
    listMinhasTentativas(id, user.id),
    isCriador || isAdmin ? listTentativasDoCurso(id) : Promise.resolve([]),
  ]);

  const isResponsavel = responsaveis.some((r) => r.participante_id === user.id);
  const minhasAprovadas = minhasTentativas.filter((t) => t.aprovado);
  const aprovado = minhasAprovadas.length > 0;
  const tentativasFeitas = minhasTentativas.length;
  const ultimaTentativa = minhasTentativas[0] ?? null;

  // Banner de feedback após submeter prova
  const provaResultado = sp.prova === "ok" ? "ok" : sp.prova === "fail" ? "fail" : null;
  const provaAcertos = sp.acertos ?? null;

  async function deleteCurso() {
    "use server";
    await deleteCursoAction(id);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/academy" className="inline-flex">
          <Button variant="ghost" size="sm" className="-ml-2">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Voltar pra Yide Academy
          </Button>
        </Link>
      </div>

      {provaResultado === "ok" && (
        <div className="flex items-start gap-3 rounded-lg border-2 border-emerald-500/50 bg-emerald-500/10 p-4">
          <CheckCircle2 className="mt-0.5 h-6 w-6 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
              Treinamento concluído!
            </p>
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Você acertou <strong>{provaAcertos}/{QUESTOES_POR_CURSO}</strong> e ganhou 100 pontos no ranking.
            </p>
          </div>
        </div>
      )}
      {provaResultado === "fail" && (
        <div className="flex items-start gap-3 rounded-lg border-2 border-amber-500/50 bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-6 w-6 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
              Você ainda não passou — tente de novo
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Acertou <strong>{provaAcertos}/{QUESTOES_POR_CURSO}</strong>. Precisa de pelo menos {NOTA_MINIMA} pra concluir. Revise o material e tente quantas vezes precisar.
            </p>
          </div>
        </div>
      )}

      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{curso.titulo}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Criado por {curso.criador?.nome ?? "—"} · {formatDateTimeBR(curso.criado_em)}
          </p>
        </div>
        {canDelete && (
          <form action={deleteCurso}>
            <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
              <Trash2 className="mr-1 h-4 w-4" />
              Excluir
            </Button>
          </form>
        )}
      </header>

      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold">Material do treinamento</h2>
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          <Linkify text={curso.descricao} />
        </div>
      </Card>

      {isResponsavel && (
        <Card className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Prova final</h2>
              <p className="text-xs text-muted-foreground">
                {QUESTOES_POR_CURSO} questões · precisa acertar pelo menos {NOTA_MINIMA} pra concluir · pode tentar quantas vezes precisar
              </p>
            </div>
            {aprovado ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                APROVADO
              </span>
            ) : tentativasFeitas > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                <Clock className="h-3.5 w-3.5" />
                EM ANDAMENTO
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                A FAZER
              </span>
            )}
          </div>

          {tentativasFeitas > 0 && (
            <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Suas tentativas
              </p>
              <ul className="space-y-1 text-xs">
                {minhasTentativas.map((t, i) => (
                  <li key={t.id} className="flex items-center justify-between">
                    <span>
                      Tentativa {minhasTentativas.length - i} · {formatDateTimeBR(t.criado_em)}
                    </span>
                    <span className={t.aprovado ? "font-bold text-emerald-600 dark:text-emerald-400" : "font-medium text-muted-foreground"}>
                      {t.acertos}/{QUESTOES_POR_CURSO}{t.aprovado ? " · aprovado" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!aprovado && (
            <Link href={`/academy/${id}/prova`}>
              <Button size="lg" className="w-full sm:w-auto">
                <PlayCircle className="mr-2 h-4 w-4" />
                {tentativasFeitas === 0 ? "Iniciar prova" : `Tentar de novo (${tentativasFeitas + 1}ª vez)`}
              </Button>
            </Link>
          )}
          {aprovado && ultimaTentativa && (
            <p className="text-xs text-muted-foreground">
              Você foi aprovado com {ultimaTentativa.acertos}/{QUESTOES_POR_CURSO} em {formatDateTimeBR(ultimaTentativa.criado_em)}.
            </p>
          )}
        </Card>
      )}

      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">
            Responsáveis ({responsaveis.length})
          </h2>
        </div>
        {(isCriador || isAdmin) ? (
          <ResponsaveisProgresso
            responsaveis={responsaveis}
            tentativas={allTentativas}
          />
        ) : (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {responsaveis.map((r) => (
              <li key={r.participante_id}>{r.participante?.nome ?? "—"}</li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ResponsaveisProgresso({
  responsaveis,
  tentativas,
}: {
  responsaveis: Awaited<ReturnType<typeof listResponsaveisDoCurso>>;
  tentativas: Awaited<ReturnType<typeof listTentativasDoCurso>>;
}) {
  // Constrói: por participante, melhor acertos + se aprovou
  const stats = new Map<string, { melhorAcertos: number; aprovado: boolean; tentativas: number }>();
  for (const t of tentativas) {
    const cur = stats.get(t.participante_id) ?? { melhorAcertos: 0, aprovado: false, tentativas: 0 };
    cur.tentativas++;
    if (t.acertos > cur.melhorAcertos) cur.melhorAcertos = t.acertos;
    if (t.aprovado) cur.aprovado = true;
    stats.set(t.participante_id, cur);
  }
  return (
    <ul className="space-y-1.5 text-sm">
      {responsaveis.map((r) => {
        const s = stats.get(r.participante_id);
        return (
          <li key={r.participante_id} className="flex items-center justify-between gap-2">
            <span>{r.participante?.nome ?? "—"}</span>
            {s?.aprovado ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Aprovado · {s.melhorAcertos}/{QUESTOES_POR_CURSO}
              </span>
            ) : s ? (
              <span className="text-xs text-amber-700 dark:text-amber-400">
                {s.tentativas} tentativa{s.tentativas > 1 ? "s" : ""} · melhor {s.melhorAcertos}/{QUESTOES_POR_CURSO}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Não iniciou</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
