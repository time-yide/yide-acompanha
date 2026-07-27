# Aprovação de vídeo pelo cliente — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao cliente uma tela (link público + painel logado) pra assistir o vídeo do Frame, comentar marcando o tempo, e Aprovar ou Pedir alteração — com tudo voltando pra tarefa e notificando a equipe.

**Architecture:** Reaproveita a infra do Frame interno (Bunny/`review_video`/`review_versao`/`review_comentario`, status `revisao_cliente|ajustes|aprovado`, `autor_tipo='cliente'`, `pos_x/pos_y`, o componente `Player`). Adiciona: coluna `aprovacao_token` (padrão dos links de design/post), um módulo de server actions públicas validadas por token (service-role), a página `/aprovacao-video/[token]`, o card no painel do cliente, e o botão "Copiar link" na tarefa. A sincronização tarefa↔review vira um helper compartilhado.

**Tech Stack:** Next.js (App Router, server actions), Supabase (service-role), Bunny Stream (HLS via `hls.js`), Vitest.

**Convenções do projeto:**
- Branch já criada: `feat/aprovacao-video-cliente` (a partir de `origin/main`).
- Migrations são aplicadas **manualmente** no SQL Editor do Supabase após merge (ver `MEMORY.md`). O `.sql` entra no PR; a aplicação é manual.
- Verificação: `npm run typecheck` e `npx eslint <arquivos>` antes de cada commit. Testes: `npx vitest run --exclude '**/.claude/**' <arquivo>`.
- PT nos textos e comentários.

---

## Task 0: Spike — confirmar playback público do Bunny (bloqueante)

**Files:** nenhum (verificação manual).

- [ ] **Step 1: Pegar uma playlist real**
Rodar no SQL Editor:
```sql
select v.bunny_video_id
from review_versao v
join review_video r on r.id = v.review_video_id
where v.pronto = true
order by v.created_at desc limit 1;
```
Montar a URL: `https://<BUNNY_STREAM_CDN_HOSTNAME>/<bunny_video_id>/playlist.m3u8` (o hostname está em `.env.local` / Vercel).

- [ ] **Step 2: Abrir a URL numa aba anônima (deslogado)**
Expected: o `.m3u8` baixa/abre (HTTP 200), ou toca num player HLS. Se der **403**, a library está com *Token Authentication* ligado → precisamos de URL assinada.

- [ ] **Step 3: Decidir**
- **200 (público):** seguir o plano como está — a página do cliente usa `urlPlaylist(bunny_video_id)` direto.
- **403 (token auth):** adicionar ao plano (antes da Task 4) uma função `urlPlaylistAssinada(videoId, expiraSeg)` em `src/lib/bunny/client.ts` que gera o token de CDN do Bunny (SHA256 de `securityKey + videoId + expiração`, path `/<videoId>/`), e a página do cliente passa a usar a URL assinada. Registrar a decisão no PR.

> O resto do plano assume **público** (caso comum, já que o player interno usa a URL sem assinar). Se for token-auth, só troca a origem da `playlistUrl` na Task 4.

---

## Task 1: Migration — `aprovacao_token` em `review_video`

**Files:**
- Create: `supabase/migrations/20260727000000_review_aprovacao_token.sql`

- [ ] **Step 1: Escrever a migration**
```sql
-- Link público de aprovação do cliente pro vídeo do Frame (mesmo padrão de
-- design_artes/social posts). Aplicação MANUAL no SQL Editor após o merge.
alter table public.review_video
  add column if not exists aprovacao_token uuid unique default gen_random_uuid();

-- Backfill: o default só vale pra linhas novas; gera token pras existentes.
update public.review_video
  set aprovacao_token = gen_random_uuid()
  where aprovacao_token is null;
```

- [ ] **Step 2: Regenerar os tipos (após aplicar no banco)**
> Na implementação real a migration é aplicada manualmente e depois `npm run db:types`. Durante o desenvolvimento, como os módulos de review já usam `service-role` tipado como `any` (`type SB = any`), o código compila sem os tipos atualizados. Não bloquear o restante do plano nisso.

- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/20260727000000_review_aprovacao_token.sql
git commit -m "feat(review): coluna aprovacao_token pro link de aprovação do cliente"
```

---

## Task 2: Extrair o sincronizador tarefa↔review e cobrir o caminho do cliente

Hoje `moverTarefaDoReview` é privado em `src/lib/review/actions.ts` e assume ator = membro da equipe. Vamos extrair pra um módulo compartilhado, preservando o comportamento atual e adicionando: ator **cliente** (`null`) e destino **`aprovada`**.

**Files:**
- Create: `src/lib/review/task-sync.ts`
- Create: `src/lib/review/task-sync.test.ts`
- Modify: `src/lib/review/actions.ts` (remover a função privada e importar a compartilhada)

- [ ] **Step 1: Escrever o teste (mapa de status por destino)**
`src/lib/review/task-sync.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { statusDaTarefaPorDestino } from "./task-sync";

describe("statusDaTarefaPorDestino", () => {
  it("alteracao volta o card pra Alteração", () => {
    expect(statusDaTarefaPorDestino("alteracao")).toEqual({ status: "alteracao", status_aprovacao: "ajustes_solicitados" });
  });
  it("em_aprovacao manda pra Aprovação do cliente", () => {
    expect(statusDaTarefaPorDestino("em_aprovacao")).toEqual({ status: "em_aprovacao", status_aprovacao: "em_analise" });
  });
  it("aprovada fecha a aprovação do cliente", () => {
    expect(statusDaTarefaPorDestino("aprovada")).toEqual({ status: "aprovada", status_aprovacao: "aprovada" });
  });
});
```

- [ ] **Step 2: Rodar o teste (deve falhar)**
Run: `npx vitest run --exclude '**/.claude/**' src/lib/review/task-sync.test.ts`
Expected: FAIL ("statusDaTarefaPorDestino is not a function").

- [ ] **Step 3: Escrever `task-sync.ts`**
```ts
import { revalidatePath, revalidateTag } from "next/cache";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export type DestinoTarefa = "alteracao" | "em_aprovacao" | "aprovada";

/** Mapa destino → colunas da tarefa. Pura (testável isolada). */
export function statusDaTarefaPorDestino(destino: DestinoTarefa): { status: string; status_aprovacao: string } {
  switch (destino) {
    case "alteracao": return { status: "alteracao", status_aprovacao: "ajustes_solicitados" };
    case "em_aprovacao": return { status: "em_aprovacao", status_aprovacao: "em_analise" };
    case "aprovada": return { status: "aprovada", status_aprovacao: "aprovada" };
  }
}

/**
 * Espelha a decisão do review na tarefa vinculada. `actor` = membro da equipe;
 * `null` = ação veio do CLIENTE (link público) — nesse caso não grava
 * task_revisoes (autor_id é NOT NULL/FK e o cliente não é profile) e as
 * notificações vão pra equipe da tarefa. Best-effort: sem tarefa vinculada, sai.
 */
export async function syncTarefaComReview(
  sb: SB,
  reviewId: string,
  destino: DestinoTarefa,
  actor: { id: string; nome: string } | null,
): Promise<void> {
  const { data: rv } = await sb.from("review_video").select("task_id").eq("id", reviewId).maybeSingle();
  const taskId = rv?.task_id as string | null | undefined;
  if (!taskId) return;
  const { data: task } = await sb
    .from("tasks")
    .select("id, titulo, atribuido_a, participantes_ids, criado_por, client_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return;

  const { status, status_aprovacao } = statusDaTarefaPorDestino(destino);
  await sb.from("tasks").update({ status, status_aprovacao }).eq("id", taskId);

  // Timeline só quando é a equipe (autor_id NOT NULL). Cliente não vira linha aqui.
  if (actor) {
    await sb.from("task_revisoes").insert({
      task_id: taskId,
      autor_id: actor.id,
      tipo: destino === "alteracao" ? "ajustes" : "envio",
      observacoes: destino === "alteracao" ? "Alterações pedidas no Frame — ver comentários no vídeo." : null,
    });
  }

  const participantes = (task.participantes_ids ?? []) as string[];
  const equipe = [task.atribuido_a, task.criado_por, ...participantes].filter(
    (id: string | null): id is string => !!id && id !== actor?.id,
  );
  const dedup = Array.from(new Set(equipe));

  if (destino === "alteracao") {
    const msg = actor
      ? "Foram pedidas alterações no Frame — veja os comentários no vídeo."
      : "O cliente pediu alterações — veja os comentários no vídeo.";
    if (dedup.length > 0) {
      await dispatchNotification({
        evento_tipo: "task_alteracao_solicitada",
        titulo: actor ? `Ajustes solicitados: ${task.titulo}` : `Cliente pediu alteração: ${task.titulo}`,
        mensagem: msg,
        link: `/tarefas/${taskId}`,
        user_ids_extras: dedup,
        source_user_id: actor?.id,
      });
    }
  } else if (destino === "em_aprovacao") {
    if (task.criado_por && task.criado_por !== actor?.id) {
      await dispatchNotification({
        evento_tipo: "task_assigned",
        titulo: "Vídeo aprovado internamente",
        mensagem: `${actor?.nome ?? "A equipe"} aprovou no Frame e enviou pra aprovação: "${task.titulo}"`,
        link: `/tarefas/${taskId}`,
        user_ids_extras: [task.criado_por],
        source_user_id: actor?.id,
      });
    }
  } else {
    // aprovada (pelo cliente)
    if (dedup.length > 0) {
      await dispatchNotification({
        evento_tipo: "task_assigned",
        titulo: "Cliente aprovou o vídeo",
        mensagem: `O cliente aprovou o vídeo: "${task.titulo}".`,
        link: `/tarefas/${taskId}`,
        user_ids_extras: dedup,
        source_user_id: actor?.id,
      });
    }
  }

  revalidateTag("tasks", "default");
  revalidatePath(`/tarefas/${taskId}`);
  revalidatePath("/tarefas");
  if (task.client_id) revalidatePath(`/clientes/${task.client_id}/tarefas`);
}
```

- [ ] **Step 4: Rodar o teste (deve passar)**
Run: `npx vitest run --exclude '**/.claude/**' src/lib/review/task-sync.test.ts`
Expected: PASS.

- [ ] **Step 5: Refatorar `actions.ts` pra usar o helper**
Em `src/lib/review/actions.ts`: apagar a função privada `moverTarefaDoReview` (linhas ~122-191) e o `import` não usado; adicionar no topo `import { syncTarefaComReview } from "./task-sync";`. Trocar as 2 chamadas:
- em `pedirAlteracaoAction`: `await moverTarefaDoReview(sb, reviewId, "alteracao", user);` → `await syncTarefaComReview(sb, reviewId, "alteracao", { id: user.id, nome: user.nome });`
- em `aprovarVideoAction`: `await moverTarefaDoReview(sb, reviewId, "em_aprovacao", user);` → `await syncTarefaComReview(sb, reviewId, "em_aprovacao", { id: user.id, nome: user.nome });`
Manter `revalidateTag`/`revalidatePath` imports (ainda usados noutras funções).

- [ ] **Step 6: Typecheck + lint + testes do review**
Run: `npm run typecheck && npx eslint src/lib/review/actions.ts src/lib/review/task-sync.ts && npx vitest run --exclude '**/.claude/**' src/lib/review`
Expected: tudo verde (nenhuma regressão nos testes existentes de review).

- [ ] **Step 7: Commit**
```bash
git add src/lib/review/task-sync.ts src/lib/review/task-sync.test.ts src/lib/review/actions.ts
git commit -m "refactor(review): extrai syncTarefaComReview (suporta ator cliente + destino aprovada)"
```

---

## Task 3: Server — módulo público por token (`aprovacao-cliente.ts`)

**Files:**
- Create: `src/lib/review/aprovacao-cliente.ts`
- Create: `src/lib/review/aprovacao-cliente.test.ts`

Regras: todas as funções recebem o `token` (uuid). Validam formato, buscam via service-role, e só agem se o review está em `revisao_cliente`. A leitura devolve **só** comentários do cliente.

- [ ] **Step 1: Teste da validação de token + filtro de comentários**
`src/lib/review/aprovacao-cliente.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { tokenValido, soComentariosDoCliente } from "./aprovacao-cliente";

describe("tokenValido", () => {
  it("aceita uuid", () => {
    expect(tokenValido("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(true);
  });
  it("rejeita lixo", () => {
    expect(tokenValido("../etc/passwd")).toBe(false);
    expect(tokenValido("")).toBe(false);
  });
});

describe("soComentariosDoCliente", () => {
  it("remove comentários internos (autor_tipo=time)", () => {
    const cs = [
      { id: "a", autor_tipo: "cliente", corpo: "x" },
      { id: "b", autor_tipo: "time", corpo: "interno" },
    ] as { id: string; autor_tipo: "time" | "cliente"; corpo: string }[];
    expect(soComentariosDoCliente(cs).map((c) => c.id)).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: Rodar (deve falhar)**
Run: `npx vitest run --exclude '**/.claude/**' src/lib/review/aprovacao-cliente.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Escrever `aprovacao-cliente.ts`**
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { urlPlaylist, urlThumbnail } from "@/lib/bunny/client";
import { podeTransicionar, type ReviewStatus } from "./schema";
import { syncTarefaComReview } from "./task-sync";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
type Res<T> = T | { error: string };

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
export function tokenValido(token: string): boolean {
  return UUID.test(token);
}

export interface ComentarioCliente {
  id: string; autor_tipo: "time" | "cliente"; autor_nome: string;
  tempo_seg: number; corpo: string; pos_x: number | null; pos_y: number | null; created_at: string;
}
/** Esconde os comentários internos da equipe — o cliente só vê os dele. */
export function soComentariosDoCliente<T extends { autor_tipo: "time" | "cliente" }>(cs: T[]): T[] {
  return cs.filter((c) => c.autor_tipo === "cliente");
}

export interface ReviewCliente {
  reviewId: string;
  titulo: string;
  status: ReviewStatus;
  clienteNome: string;
  versaoId: string | null;
  playlistUrl: string;
  thumbUrl: string;
  pronto: boolean;
  comentarios: ComentarioCliente[];
}

/** Carrega o review pra tela pública. null = token inválido ou inexistente. */
export async function getReviewPorToken(token: string): Promise<ReviewCliente | null> {
  if (!tokenValido(token)) return null;
  const sb = createServiceRoleClient() as SB;
  const { data: rv } = await sb
    .from("review_video")
    .select("id, titulo, status, cliente_id")
    .eq("aprovacao_token", token)
    .maybeSingle();
  if (!rv) return null;

  const { data: cliente } = rv.cliente_id
    ? await sb.from("clients").select("nome").eq("id", rv.cliente_id).maybeSingle()
    : { data: null };

  const { data: versao } = await sb
    .from("review_versao")
    .select("id, bunny_video_id, pronto")
    .eq("review_video_id", rv.id)
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle();

  let comentarios: ComentarioCliente[] = [];
  if (versao) {
    const { data: cs } = await sb
      .from("review_comentario")
      .select("id, autor_tipo, autor_nome, tempo_seg, corpo, pos_x, pos_y, created_at")
      .eq("versao_id", versao.id)
      .order("tempo_seg", { ascending: true });
    comentarios = soComentariosDoCliente((cs ?? []) as ComentarioCliente[]);
  }

  return {
    reviewId: rv.id,
    titulo: rv.titulo,
    status: rv.status as ReviewStatus,
    clienteNome: (cliente?.nome as string | undefined) ?? "Cliente",
    versaoId: versao?.id ?? null,
    playlistUrl: versao ? urlPlaylist(versao.bunny_video_id) : "",
    thumbUrl: versao ? urlThumbnail(versao.bunny_video_id) : "",
    pronto: !!versao?.pronto,
    comentarios,
  };
}

/** Busca review + versão atual a partir do token, garantindo estado revisao_cliente. */
async function reviewEmRevisaoCliente(sb: SB, token: string): Promise<{ id: string; status: ReviewStatus; versaoId: string | null; clienteNome: string } | { error: string }> {
  if (!tokenValido(token)) return { error: "Link inválido" };
  const { data: rv } = await sb.from("review_video").select("id, status, cliente_id").eq("aprovacao_token", token).maybeSingle();
  if (!rv) return { error: "Vídeo não encontrado" };
  const { data: versao } = await sb.from("review_versao").select("id").eq("review_video_id", rv.id).order("numero", { ascending: false }).limit(1).maybeSingle();
  const { data: cliente } = rv.cliente_id ? await sb.from("clients").select("nome").eq("id", rv.cliente_id).maybeSingle() : { data: null };
  return { id: rv.id, status: rv.status as ReviewStatus, versaoId: versao?.id ?? null, clienteNome: (cliente?.nome as string | undefined) ?? "Cliente" };
}

/** Cliente comenta marcando o tempo (e opcionalmente o ponto). Só em revisao_cliente. */
export async function comentarComoClienteAction(
  token: string, tempoSeg: number, corpo: string, posX?: number | null, posY?: number | null,
): Promise<Res<{ ok: true }>> {
  if (!corpo.trim()) return { error: "Escreva o comentário" };
  const sb = createServiceRoleClient() as SB;
  const rv = await reviewEmRevisaoCliente(sb, token);
  if ("error" in rv) return rv;
  if (rv.status !== "revisao_cliente") return { error: "Este vídeo não está aberto pra comentários agora." };
  if (!rv.versaoId) return { error: "Vídeo ainda processando." };
  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
  const temPino = typeof posX === "number" && typeof posY === "number" && isFinite(posX) && isFinite(posY);
  await sb.from("review_comentario").insert({
    versao_id: rv.versaoId, autor_tipo: "cliente", autor_id: null, autor_nome: rv.clienteNome,
    tempo_seg: Math.max(0, Math.round(tempoSeg)), corpo: corpo.trim(),
    pos_x: temPino ? clamp01(posX as number) : null,
    pos_y: temPino ? clamp01(posY as number) : null,
  });
  revalidatePath(`/aprovacao-video/${token}`);
  return { ok: true };
}

/** Cliente aprova: review → aprovado, tarefa → aprovada, notifica a equipe. */
export async function aprovarComoClienteAction(token: string): Promise<Res<{ ok: true }>> {
  const sb = createServiceRoleClient() as SB;
  const rv = await reviewEmRevisaoCliente(sb, token);
  if ("error" in rv) return rv;
  if (!podeTransicionar(rv.status, "aprovado")) return { error: "Este vídeo não está aguardando sua aprovação." };
  await sb.from("review_video").update({ status: "aprovado", updated_at: new Date().toISOString() }).eq("id", rv.id);
  await syncTarefaComReview(sb, rv.id, "aprovada", null);
  revalidatePath(`/aprovacao-video/${token}`);
  return { ok: true };
}

/** Cliente pede alteração: review → ajustes, tarefa → alteração, notifica a equipe. */
export async function pedirAlteracaoComoClienteAction(token: string): Promise<Res<{ ok: true }>> {
  const sb = createServiceRoleClient() as SB;
  const rv = await reviewEmRevisaoCliente(sb, token);
  if ("error" in rv) return rv;
  if (!podeTransicionar(rv.status, "ajustes")) return { error: "Este vídeo não está aberto pra pedir alteração." };
  await sb.from("review_video").update({ status: "ajustes", updated_at: new Date().toISOString() }).eq("id", rv.id);
  await syncTarefaComReview(sb, rv.id, "alteracao", null);
  revalidatePath(`/aprovacao-video/${token}`);
  return { ok: true };
}
```

- [ ] **Step 4: Rodar os testes (devem passar)**
Run: `npx vitest run --exclude '**/.claude/**' src/lib/review/aprovacao-cliente.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint**
Run: `npm run typecheck && npx eslint src/lib/review/aprovacao-cliente.ts`
Expected: verde.

- [ ] **Step 6: Commit**
```bash
git add src/lib/review/aprovacao-cliente.ts src/lib/review/aprovacao-cliente.test.ts
git commit -m "feat(review): server actions públicas de aprovação do cliente (por token)"
```

---

## Task 4: Página pública `/aprovacao-video/[token]` + componente do cliente

**Files:**
- Create: `src/app/aprovacao-video/[token]/page.tsx`
- Create: `src/app/aprovacao-video/[token]/ApprovalVideoClient.tsx`

Reaproveita o `Player` (`src/components/review/Player.tsx`) — autocontido, só precisa de `playlistUrl` e marcadores.

- [ ] **Step 1: Página server (busca por token, sem login)**
`src/app/aprovacao-video/[token]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { getReviewPorToken } from "@/lib/review/aprovacao-cliente";
import { ApprovalVideoClient } from "./ApprovalVideoClient";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const review = await getReviewPorToken(token);
  if (!review) notFound();
  return <ApprovalVideoClient token={token} review={review} />;
}
```

- [ ] **Step 2: Componente do cliente (player + comentar + aprovar/pedir alteração)**
`src/app/aprovacao-video/[token]/ApprovalVideoClient.tsx`:
```tsx
"use client";

import { useRef, useState } from "react";
import { CheckCircle2, MessageSquarePlus, RotateCcw } from "lucide-react";
import { Player, type PlayerHandle, fmtTempo } from "@/components/review/Player";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewCliente } from "@/lib/review/aprovacao-cliente";
import {
  comentarComoClienteAction, aprovarComoClienteAction, pedirAlteracaoComoClienteAction,
} from "@/lib/review/aprovacao-cliente";

export function ApprovalVideoClient({ token, review }: { token: string; review: ReviewCliente }) {
  const [status, setStatus] = useState(review.status);
  const [comentarios, setComentarios] = useState(review.comentarios);
  const [corpo, setCorpo] = useState("");
  const [pino, setPino] = useState<{ x: number; y: number } | null>(null);
  const [modoPino, setModoPino] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const playerRef = useRef<PlayerHandle>(null);

  const podeAgir = status === "revisao_cliente";

  async function enviarComentario() {
    if (!corpo.trim()) return;
    setEnviando(true); setErro(null);
    const t = playerRef.current?.tempoAtual() ?? 0;
    const r = await comentarComoClienteAction(token, t, corpo, pino?.x ?? null, pino?.y ?? null);
    setEnviando(false);
    if ("error" in r) { setErro(r.error); return; }
    setComentarios((prev) => [...prev, {
      id: crypto.randomUUID(), autor_tipo: "cliente", autor_nome: review.clienteNome,
      tempo_seg: Math.round(t), corpo: corpo.trim(), pos_x: pino?.x ?? null, pos_y: pino?.y ?? null,
      created_at: new Date().toISOString(),
    }]);
    setCorpo(""); setPino(null); setModoPino(false);
  }

  async function aprovar() {
    setEnviando(true); setErro(null);
    const r = await aprovarComoClienteAction(token);
    setEnviando(false);
    if ("error" in r) { setErro(r.error); return; }
    setStatus("aprovado");
  }

  async function pedirAlteracao() {
    if (comentarios.length === 0) { setErro("Escreva pelo menos um comentário dizendo o que mudar."); return; }
    setEnviando(true); setErro(null);
    const r = await pedirAlteracaoComoClienteAction(token);
    setEnviando(false);
    if ("error" in r) { setErro(r.error); return; }
    setStatus("ajustes");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">{review.titulo}</h1>
        <p className="text-sm text-muted-foreground">Assista, comente e aprove ou peça alteração.</p>
      </header>

      {!review.pronto ? (
        <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          O vídeo ainda está processando. Recarregue em alguns instantes.
        </div>
      ) : (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border">
          <Player
            ref={playerRef}
            playlistUrl={review.playlistUrl}
            marcadores={comentarios.map((c) => c.tempo_seg)}
            onMarcadorClick={(seg) => playerRef.current?.seek(seg)}
            modoPino={modoPino}
            pino={pino}
            onPinPlace={(x, y) => setPino({ x, y })}
          />
        </div>
      )}

      {status === "aprovado" && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Vídeo aprovado. Obrigado!
        </div>
      )}
      {status === "ajustes" && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          Alteração enviada pra equipe. Você recebe uma nova versão em breve.
        </div>
      )}
      {status === "revisao_interna" && (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
          A equipe ainda está ajustando este vídeo. Aguarde o envio.
        </div>
      )}

      {podeAgir && (
        <>
          <div className="space-y-2 rounded-xl border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Comentar {pino ? "(ponto marcado)" : ""}</p>
              <button type="button" onClick={() => setModoPino((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-primary">
                <MessageSquarePlus className="h-3.5 w-3.5" /> {modoPino ? "Cancelar marcação" : "Marcar ponto no vídeo"}
              </button>
            </div>
            <Textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={2}
              placeholder="Ex.: no 0:12 trocar a música…" maxLength={1000} />
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={enviarComentario} disabled={enviando || !corpo.trim()}>
                Adicionar comentário
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={aprovar} disabled={enviando} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Aprovar
            </Button>
            <Button type="button" variant="outline" onClick={pedirAlteracao} disabled={enviando}>
              <RotateCcw className="mr-1.5 h-4 w-4" /> Pedir alteração
            </Button>
          </div>
        </>
      )}

      {comentarios.length > 0 && (
        <ul className="space-y-1.5">
          {comentarios.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => playerRef.current?.seek(c.tempo_seg)}
                className="flex w-full items-start gap-2 rounded-lg border bg-card px-3 py-2 text-left text-sm hover:bg-muted/50">
                <span className="font-mono text-xs text-primary">{fmtTempo(c.tempo_seg)}</span>
                <span className="min-w-0 flex-1">{c.corpo}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {erro && <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + lint**
Run: `npm run typecheck && npx eslint "src/app/aprovacao-video/[token]/page.tsx" "src/app/aprovacao-video/[token]/ApprovalVideoClient.tsx"`
Expected: verde. (Se acusar `crypto.randomUUID`, trocar por um contador local — o id é só key otimista.)

- [ ] **Step 4: Commit**
```bash
git add "src/app/aprovacao-video"
git commit -m "feat(review): página pública de aprovação de vídeo do cliente"
```

---

## Task 5: Card "Vídeos pra aprovar" no painel do cliente

**Files:**
- Create: `src/lib/cliente-portal/videos-aprovar.ts`
- Modify: `src/app/(cliente)/cliente/page.tsx` (renderizar o card quando houver itens)

- [ ] **Step 1: Query dos reviews aguardando o cliente**
`src/lib/cliente-portal/videos-aprovar.ts`:
```ts
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface VideoParaAprovar { reviewId: string; titulo: string; token: string; }

/** Reviews do cliente logado em revisao_cliente, com link de aprovação. */
export async function listarVideosParaAprovar(clienteId: string): Promise<VideoParaAprovar[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data } = await sb
    .from("review_video")
    .select("id, titulo, aprovacao_token")
    .eq("cliente_id", clienteId)
    .eq("status", "revisao_cliente")
    .order("updated_at", { ascending: false });
  return ((data ?? []) as { id: string; titulo: string; aprovacao_token: string }[])
    .map((r) => ({ reviewId: r.id, titulo: r.titulo, token: r.aprovacao_token }));
}
```

- [ ] **Step 2: Renderizar no painel**
Em `src/app/(cliente)/cliente/page.tsx`, descobrir o `clienteId` do portal (seguir o padrão já usado na página — provavelmente via `client_portal_users`/sessão do portal). Chamar `listarVideosParaAprovar(clienteId)` e, se `length > 0`, renderizar antes das outras seções:
```tsx
{videosParaAprovar.length > 0 && (
  <section className="rounded-2xl border bg-card p-6">
    <h2 className="text-sm font-bold uppercase tracking-wider">Vídeos pra aprovar</h2>
    <ul className="mt-3 space-y-2">
      {videosParaAprovar.map((v) => (
        <li key={v.reviewId}>
          <a href={`/aprovacao-video/${v.token}`}
             className="flex items-center justify-between rounded-lg border bg-background/50 px-3 py-2 text-sm hover:bg-muted/50">
            <span className="truncate">{v.titulo}</span>
            <span className="text-primary">Assistir e aprovar →</span>
          </a>
        </li>
      ))}
    </ul>
  </section>
)}
```
> Ao editar, ler primeiro `src/app/(cliente)/cliente/page.tsx` inteiro pra reaproveitar como o `clienteId` já é resolvido e onde encaixar a seção. Não duplicar auth.

- [ ] **Step 3: Typecheck + lint**
Run: `npm run typecheck && npx eslint src/lib/cliente-portal/videos-aprovar.ts "src/app/(cliente)/cliente/page.tsx"`
Expected: verde.

- [ ] **Step 4: Commit**
```bash
git add src/lib/cliente-portal/videos-aprovar.ts "src/app/(cliente)/cliente/page.tsx"
git commit -m "feat(portal): card de vídeos pra aprovar no painel do cliente"
```

---

## Task 6: Botão "Copiar link do cliente" na tela de review da tarefa

Quando o review está em `revisao_cliente`, a equipe precisa copiar o link público pra mandar no WhatsApp. Espelha o `ApprovalLinkButtons` do design.

**Files:**
- Modify: `src/components/review/ReviewView.tsx` (renderizar o botão quando status = `revisao_cliente`)
- Modify: `src/lib/review/queries.ts` (incluir `aprovacao_token` no carregamento do review, se ainda não vem)

- [ ] **Step 1: Expor o token no carregamento do review**
Ler `src/lib/review/queries.ts` (`carregarReview`) e adicionar `aprovacao_token` ao `select` do `review_video` e ao tipo devolvido (ex.: `aprovacaoToken: string`).

- [ ] **Step 2: Botão "Copiar link" no ReviewView**
Ler `src/components/review/ReviewView.tsx`; onde já mostra o status/ações, adicionar (client component) quando `status === "revisao_cliente"`:
```tsx
{status === "revisao_cliente" && aprovacaoToken && (
  <button type="button"
    onClick={() => {
      const url = `${window.location.origin}/aprovacao-video/${aprovacaoToken}`;
      navigator.clipboard?.writeText(url).catch(() => window.prompt("Copia esse link:", url));
    }}
    className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
    Copiar link do cliente
  </button>
)}
```
> Reaproveitar o padrão exato de `src/components/design/ApprovalLinkButtons.tsx` (fallback `window.prompt` quando o clipboard falha).

- [ ] **Step 3: Typecheck + lint**
Run: `npm run typecheck && npx eslint src/components/review/ReviewView.tsx src/lib/review/queries.ts`
Expected: verde.

- [ ] **Step 4: Commit**
```bash
git add src/components/review/ReviewView.tsx src/lib/review/queries.ts
git commit -m "feat(review): botão copiar link do cliente quando em revisão do cliente"
```

---

## Task 7: Verificação ponta-a-ponta + PR

**Files:** nenhum (validação).

- [ ] **Step 1: Aplicar a migration no SQL Editor** (Task 1) e rodar `npm run db:types` se for atualizar os tipos.

- [ ] **Step 2: Suíte + build**
Run: `npm run typecheck && npx eslint . && npx vitest run --exclude '**/.claude/**' src/lib/review`
Expected: verde.

- [ ] **Step 3: Fluxo manual (dev ou preview)**
1. Numa tarefa de vídeo, subir vídeo → revisão interna → aprovar interno (vira `revisao_cliente`).
2. Copiar o link do cliente (Task 6) → abrir numa aba anônima.
3. Comentar marcando o tempo; conferir que aparece o marcador na timeline.
4. Pedir alteração → conferir: tarefa foi pra "Alteração", equipe notificada, tela do cliente mostra "enviado".
5. Subir nova versão (volta a `revisao_interna`) → aprovar interno de novo → cliente vê a nova versão pelo mesmo link.
6. Aprovar → conferir: review `aprovado`, tarefa `aprovada`, equipe notificada, comentários internos nunca apareceram pro cliente.
7. Abrir o painel logado do cliente → o card "Vídeos pra aprovar" some depois de aprovar.

- [ ] **Step 4: Abrir PR e mergear após CI verde**
```bash
git push -u origin feat/aprovacao-video-cliente
gh pr create --base main --title "feat(review): aprovação de vídeo pelo cliente (link público + painel)" --body "<resumo + link pro spec + nota da migration manual>"
```
Esperar `ci.yml` (`test`) verde → `gh pr merge --squash --delete-branch`. **Aplicar a migration manualmente** no SQL Editor (a coluna `aprovacao_token`).

---

## Cobertura do spec (self-review)

- Link público por token → Task 1 (coluna), Task 3 (getReviewPorToken), Task 4 (página). ✅
- Painel logado do cliente → Task 5. ✅
- Player + comentar marcando tempo (e ponto) → Task 4 (reusa `Player`), Task 3 (`comentarComoClienteAction` com `pos_x/pos_y`). ✅
- Aprovar / Pedir alteração → Task 3 (ações) + Task 4 (botões). ✅
- Não mostrar comentários internos → `soComentariosDoCliente` (Task 3). ✅
- Volta pra tarefa + notifica equipe → Task 2 (`syncTarefaComReview`, destinos alteracao/aprovada, ator cliente). ✅
- Laço de revisão (nova versão → revisao_interna) → já existe (`novaVersaoAction`); confirmado no fluxo manual (Task 7). ✅
- "Enviar pro cliente" / copiar link na tarefa → Task 6. ✅
- Risco playback Bunny → Task 0 (spike). ✅

**Fora de escopo (v1), conforme spec:** e-mail automático pro cliente, thread de resposta a comentário, resolver comentário do cliente na tela dele, múltiplos vídeos numa tarefa com aprovação individual.
