import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listTasks, filterTasksByPrazo, type PrazoFilter, type TaskFilters as TaskFiltersData } from "@/lib/tarefas/queries";
import { TasksList } from "@/components/tarefas/TasksList";
import { TaskFilters } from "@/components/tarefas/TaskFilters";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

type Aba = "minhas" | "criadas" | "todas";

const PRAZO_VALUES: PrazoFilter[] = ["hoje", "semana", "vencidas", "sem_prazo", "qualquer"];

function parsePrazo(v: string | undefined): PrazoFilter {
  return PRAZO_VALUES.includes(v as PrazoFilter) ? (v as PrazoFilter) : "qualquer";
}

interface SearchParams {
  aba?: string;
  status?: string;
  prioridade?: string;
  prazo?: string;
  client?: string;
  atribuido?: string;
}

export default async function TarefasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireAuth();

  const aba: Aba =
    params.aba === "criadas" ? "criadas" : params.aba === "todas" ? "todas" : "minhas";

  const filters: TaskFiltersData = {};
  if (params.prioridade && params.prioridade !== "qualquer") {
    filters.prioridade = [params.prioridade as "alta" | "media" | "baixa"];
  }
  if (params.client && params.client !== "qualquer") filters.clientId = params.client;

  if (params.status === "em_andamento") filters.status = ["em_andamento"];
  else if (params.status === "concluida") filters.status = ["concluida"];
  else if (params.status === "todas") filters.status = undefined;
  else filters.status = ["aberta", "em_andamento"]; // 'abertas' default

  if (aba === "minhas") filters.atribuidoA = user.id;
  else if (aba === "criadas") filters.criadoPor = user.id;
  else if (aba === "todas" && params.atribuido && params.atribuido !== "qualquer") {
    filters.atribuidoA = params.atribuido;
  }

  let tasks = await listTasks(filters);
  tasks = filterTasksByPrazo(tasks, parsePrazo(params.prazo));

  const supabase = await createClient();
  const [{ data: profiles = [] }, { data: clientes = [] }] = await Promise.all([
    supabase.from("profiles").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("clients").select("id, nome").eq("status", "ativo").order("nome"),
  ]);

  function tabHref(slug: Aba) {
    const sp = new URLSearchParams();
    if (slug !== "minhas") sp.set("aba", slug);
    return `/tarefas?${sp.toString()}`;
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
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tarefas</h1>
          <p className="text-sm text-muted-foreground">{tasks.length} resultado(s)</p>
        </div>
        <Link href="/tarefas/nova">
          <Button>
            <Plus className="mr-2 h-4 w-4" />Nova tarefa
          </Button>
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        {tabLink("minhas", "Atribuídas a mim")}
        <span className="text-muted-foreground">·</span>
        {tabLink("criadas", "Criadas por mim")}
        <span className="text-muted-foreground">·</span>
        {tabLink("todas", "Todas")}
      </div>

      <TaskFilters
        profiles={(profiles ?? []) as { id: string; nome: string }[]}
        clientes={(clientes ?? []) as { id: string; nome: string }[]}
        showAtribuido={aba === "todas"}
      />

      <TasksList tasks={tasks} />
    </div>
  );
}
