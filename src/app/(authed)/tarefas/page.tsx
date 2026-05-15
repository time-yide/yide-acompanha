import Link from "next/link";
import { Suspense } from "react";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listTasks, type TaskFilters as TaskFiltersData } from "@/lib/tarefas/queries";
import { TasksBoard } from "@/components/tarefas/TasksBoard";
import { TasksGroupedList, type GroupBy } from "@/components/tarefas/TasksGroupedList";
import { TaskFilters } from "@/components/tarefas/TaskFilters";
import { ViewToggle } from "@/components/tarefas/ViewToggle";
import { GroupBySelector } from "@/components/tarefas/GroupBySelector";
import { TaskToastFlash } from "@/components/tarefas/TaskToastFlash";
import { TasksRealtimeWatcher } from "@/components/tarefas/TasksRealtimeWatcher";
import { buttonVariants } from "@/components/ui/button";
import { Plus } from "lucide-react";

type Aba = "minhas" | "criadas" | "todas";
type View = "board" | "list";

const VALID_GROUP_BY: GroupBy[] = ["prazo", "cliente", "responsavel", "prioridade"];

interface SearchParams {
  aba?: string;
  view?: string;
  groupBy?: string;
  prioridade?: string;
  client?: string;
  atribuido?: string;
  q?: string;
  toast?: string;
}

export default async function TarefasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireAuth();

  const aba: Aba =
    params.aba === "minhas" ? "minhas" : params.aba === "criadas" ? "criadas" : "todas";
  const view: View = params.view === "list" ? "list" : "board";
  const groupBy: GroupBy = VALID_GROUP_BY.includes(params.groupBy as GroupBy)
    ? (params.groupBy as GroupBy)
    : "prazo";

  const filters: TaskFiltersData = {};
  if (params.prioridade && params.prioridade !== "qualquer") {
    filters.prioridade = [params.prioridade as "alta" | "media" | "baixa"];
  }
  if (params.client && params.client !== "qualquer") filters.clientId = params.client;
  if (params.q && params.q.trim()) filters.q = params.q.trim();

  // Sem filtro de status — Quadro mostra todas as colunas; Lista agrupa concluídas em seção própria
  if (aba === "minhas") filters.atribuidoA = user.id;
  else if (aba === "criadas") filters.criadoPor = user.id;
  else if (aba === "todas" && params.atribuido && params.atribuido !== "qualquer") {
    filters.atribuidoA = params.atribuido;
  }

  // Paraleliza tudo: tasks + profiles + clientes (são independentes).
  const supabase = await createClient();
  const [tasks, { data: profiles = [] }, { data: clientes = [] }] = await Promise.all([
    listTasks(filters),
    supabase.from("profiles").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("clients").select("id, nome").eq("status", "ativo").order("nome"),
  ]);

  function tabHref(slug: Aba) {
    const sp = new URLSearchParams();
    if (slug !== "todas") sp.set("aba", slug);
    if (view !== "board") sp.set("view", view);
    const qs = sp.toString();
    return qs ? `/tarefas?${qs}` : `/tarefas`;
  }

  function tabLink(slug: Aba, label: string) {
    const active = aba === slug;
    return (
      <Link
        key={slug}
        href={tabHref(slug)}
        className={active ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}
      >
        {label}
      </Link>
    );
  }

  return (
    <div className="space-y-5">
      <Suspense fallback={null}><TaskToastFlash /></Suspense>
      {/* Re-renderiza a lista quando qualquer task muda (status, atribuição,
          criação, conclusão) — quem tá com /tarefas aberto vê ao vivo. */}
      <TasksRealtimeWatcher />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tarefas</h1>
          <p className="text-sm text-muted-foreground">{tasks.length} resultado(s)</p>
        </div>
        {/* <a> em vez de <Link> intencional: o intercepting route @modal/(.)[id]
            captura navegação client-side pra QUALQUER segmento-filho de
            /tarefas — inclusive o literal "nova". O UUID guard no modal
            retorna null, mas em alguns casos o roteamento paralelo do Next
            confunde os slots e a navegação não atualiza children pra
            mostrar /tarefas/nova/page.tsx. Hard navigation via <a> contorna
            o problema forçando full page load, escapando da intercepção.
            Mesma técnica usada no botão "Editar / Ver página completa"
            dentro do modal. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/tarefas/nova"
          className={buttonVariants()}
        >
          <Plus className="mr-2 h-4 w-4" />Nova tarefa
        </a>
      </header>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        {tabLink("todas", "Todas")}
        <span className="text-muted-foreground">·</span>
        {tabLink("minhas", "Atribuídas a mim")}
        <span className="text-muted-foreground">·</span>
        {tabLink("criadas", "Criadas por mim")}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-end gap-3">
          <ViewToggle current={view} />
          {view === "list" && <GroupBySelector current={groupBy} />}
        </div>
        <TaskFilters
          profiles={(profiles ?? []) as { id: string; nome: string }[]}
          clientes={(clientes ?? []) as { id: string; nome: string }[]}
          showAtribuido={aba === "todas"}
        />
      </div>

      {view === "board" ? (
        <TasksBoard tasks={tasks} userRole={user.role} />
      ) : (
        <TasksGroupedList tasks={tasks} groupBy={groupBy} userRole={user.role} />
      )}
    </div>
  );
}
