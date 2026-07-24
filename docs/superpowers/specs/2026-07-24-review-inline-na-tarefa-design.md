# Review (Frame) inline na tarefa + Audiovisual como atalho — Design

**Data:** 2026-07-24
**Status:** aprovado pela Yasmin (desenho)
**Depende de:** Frame na Tarefa (review_video/versao/comentario + Bunny + `ReviewView`) já mergeado.

Centraliza a revisão de vídeo (Frame) **na tarefa**: um botão **"Review"** abre o player + comentários (estilo Frame.io) num modal, sem sair da tarefa. O módulo Audiovisual vira só um **atalho** — lista de vídeos que leva pra tarefa de cada um.

---

## 1. Objetivo

1. Na tarefa de **vídeo**, cada vídeo do bloco "Vídeos (Frame)" ganha um botão **"Review"** que abre o Frame completo (player, comentários por segundo, aprovar/pedir ajuste) **num modal na própria tarefa** — em vez de navegar pra outra tela.
2. O Audiovisual (`/audiovisual/review`) continua listando os vídeos (com status), mas cada item **leva pra tarefa** (`/tarefas/[taskId]`), onde o Review abre. Deixa de ser um sistema de review paralelo — é atalho.

**Não-objetivos:** mudar o fluxo de comentários/aprovação/trava (reusa o que existe); mexer em arte/geral; migration (reusa tabelas existentes).

---

## 2. Review inline na tarefa

**Componente `VideoDaTarefa`** (`src/components/review/VideoDaTarefa.tsx`): hoje cada vídeo é um `<Link href="/audiovisual/review/[id]">`. Passa a ser um **botão "Review"** que abre um modal.

**Novo componente `ReviewModal`** (client):
- Recebe `reviewId`.
- Ao abrir, chama uma server action `carregarReviewAction(reviewId)` que faz auth + `carregarReview(id, userId)` (query já existe) + calcula permissões, devolvendo `{ review, podeGerenciar, podeAprovar }`.
- Renderiza o **`ReviewView`** existente (props: `review`, `podeGerenciar`, `podeAprovar`) dentro de um `Dialog` grande/tela cheia (o player + comentários precisam de espaço; no mobile abre em tela cheia).
- Estado de carregando enquanto busca; erro vira toast e fecha.

`ReviewView` e todas as actions dele (comentar, nova versão, aprovar, pedir ajuste, registrar assistido, download) recebem `reviewId`/`versaoId` e **não dependem da rota** — logo funcionam iguais dentro do modal.

"Adicionar vídeo" (upload) continua como está.

---

## 3. Server action `carregarReviewAction`

Nova action em `src/lib/review/tarefa-actions.ts`:
```
carregarReviewAction(reviewId): Promise<
  { review: ReviewFull; podeGerenciar: boolean; podeAprovar: boolean } | { error: string }
>
```
- `requireAuth()`.
- `carregarReview(reviewId, user.id)` (já existe).
- `podeGerenciar` = `canAccess(role, "manage:review")` (mesma regra da tela atual).
- `podeAprovar` = gestor da tarefa OU criador da tarefa OU `manage:review` (espelha `/audiovisual/review/[id]/page.tsx` atual — copiar a lógica de lá pra não divergir).
- Retorna erro amigável se o review não existe / sem acesso.

---

## 4. Audiovisual vira atalho

**`src/lib/review/queries.ts`:**
- Adicionar `taskId: string | null` ao `ReviewListItem` e incluir `task_id` no `select` de `listarReviews`.

**`src/app/(authed)/audiovisual/review/page.tsx`:**
- Cada item: `href = r.taskId ? "/tarefas/${r.taskId}" : "/audiovisual/review/${r.id}"` (fallback pro review avulso legado sem tarefa).
- **Remover** o botão "Novo review" (review agora nasce da tarefa).
- Mantém a lista com status (Badge) e cliente.

**Rotas mantidas (fallback, sem virar entrada principal):** `/audiovisual/review/[id]` (vídeos legados sem tarefa) e `/audiovisual/review/novo` (não linkado). Baixo custo, evita quebrar links/dados antigos.

---

## 5. Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/review/VideoDaTarefa.tsx` | Vídeo vira botão "Review" que abre `ReviewModal` (em vez de Link pra outra tela). |
| `src/components/review/ReviewModal.tsx` | **Novo.** Dialog que carrega o review (via action) e renderiza `ReviewView`. |
| `src/lib/review/tarefa-actions.ts` | **Nova** `carregarReviewAction(reviewId)`. |
| `src/lib/review/queries.ts` | `ReviewListItem` ganha `taskId`; `listarReviews` inclui `task_id`. |
| `src/app/(authed)/audiovisual/review/page.tsx` | Itens linkam pra tarefa; remove "Novo review". |

---

## 6. Permissões / segurança

- Ver o modal: quem já vê a tarefa (o bloco de vídeo só aparece pra tarefa de vídeo). O `ReviewView` gateia internamente gerenciar/aprovar via `podeGerenciar`/`podeAprovar` calculados no servidor (`carregarReviewAction`) — nada é decidido só no client.
- A trava "assistir ≥90% antes de aprovar/baixar" continua valendo (é do `ReviewView` + actions existentes).

---

## 7. Testes

- **Unit (perm):** extrair a regra de `podeAprovar` (gestor/criador da tarefa OU manage:review) num helper testável e cobrir; garantir que `carregarReviewAction` a usa (mesma fonte da tela atual).
- **Unit (query):** `listarReviews` inclui `taskId` no retorno.
- Mobile: modal abre em tela cheia (checagem manual pós-deploy).
