# Fast Mídia — instrução por cliente na grade de stories

**Data:** 2026-07-16
**Rota afetada:** `/fast-media`
**Depende de:** feature "gerenciar clientes de stories" (PR #605, já em `main`).

## Problema

A Fast Mídia precisa saber orientações específicas de cada cliente ao produzir
stories (ex.: tom, o que evitar, foco do mês). Hoje não há onde registrar isso.
A Yasmin quer poder adicionar uma instrução/indicação em cada cliente da grade
de stories, que a Fast Mídia lê como uma instrução para aquele cliente.

## Decisões (brainstorming)

- **Formato:** uma instrução única editável por cliente (tipo post-it fixo), não
  um histórico de comentários.
- **Escopo:** fixa do cliente — vale sempre, independe do mês selecionado.
- **Quem escreve/edita:** `adm`, `sócio`, `coordenador` (por cargo) **ou** o
  assessor do próprio cliente (`user.id === client.assessor_id`).
- **Quem lê:** todos que já veem a grade (`fast_midia`, `adm`, `sócio`,
  `coordenador`, `audiovisual_chefe`).

## Escopo

1. Nova coluna `clients.stories_instrucao` (texto, nullable).
2. A grade de `/fast-media` exibe a instrução em cada card (sempre visível
   quando preenchida).
3. Quem tem permissão vê um controle de editar (lápis / "+ instrução") que abre
   um dialog com textarea; salva/limpa a instrução.
4. Server action nova, protegida por gate de permissão + validação de unidade.

### Fora de escopo

- Histórico/lista de comentários (só um campo).
- Instrução por mês.
- Exibir a instrução no `/painel` (só no menu Fast Mídia).
- Edição pela Fast Mídia (ela só lê).

## Modelo de dados

Nova coluna, migration additiva **manual** (Supabase migrations são manuais):

```sql
-- supabase/migrations/20260716000000_clients_stories_instrucao.sql
alter table public.clients
  add column if not exists stories_instrucao text;
```

Coluna nullable, sem default além de NULL. Não referenciada por código
existente, então aplicá-la antes ou depois do deploy é seguro.

### Gap deploy → migration (regra de ouro do projeto)

O SELECT da grade passa a buscar `stories_instrucao`. Entre o deploy do código e
a aplicação manual do SQL, a coluna pode não existir e o SELECT quebraria,
esvaziando a grade em produção. Para evitar isso, `getStoriesGridForMonth` terá
**fallback resiliente**: tenta o SELECT com a coluna; se o erro indicar coluna
inexistente / schema cache, refaz o SELECT sem ela e trata `stories_instrucao`
como `null`. Assim a ordem merge-vs-SQL não quebra nada (mesma lição do fallback
do calendário).

## Permissão

- **Edita** se: `role ∈ {adm, socio, coordenador}` **ou**
  `actor.id === client.assessor_id`.
- **Lê:** qualquer viewer da grade (o gate de visualização da página já cobre).
- A action `updateClienteStoriesInstrucaoAction` roda via **service-role**
  (mesmo padrão das actions de gerenciar stories), com:
  - `requireAuth()` + checagem de permissão acima (carrega `assessor_id`,
    `organization_id` do cliente).
  - Validação de unidade (`clienteNaUnidadeAtiva`, helper já existente no
    arquivo).
  - Zod: texto até 1000 caracteres; string vazia/whitespace → grava `null`
    (limpa a instrução).
  - `.select("id")` + checagem de `length === 0` para detectar cliente
    inválido/fora da unidade.
  - `revalidatePath("/fast-media")`.

Observação: `fast_midia` NÃO pode editar — por isso o gate desta action é
diferente do `ALLOWED_ROLES` das outras (que inclui fast_midia).

## Componentes e arquivos

### `supabase/migrations/20260716000000_clients_stories_instrucao.sql` (novo)
A migration additiva acima.

### `src/lib/painel/stories-queries.ts`
- `StoriesGridRow` ganha `stories_instrucao: string | null` e `assessor_id:
  string | null` (o `assessor_id` é necessário pra UI decidir se o viewer é o
  assessor-dono).
- `getStoriesGridForMonth`: adiciona `stories_instrucao` ao SELECT com fallback
  resiliente; mapeia `assessor_id` e `stories_instrucao` no retorno.

### `src/lib/painel/stories-actions.ts`
- `updateClienteStoriesInstrucaoAction(formData)` — campos `client_id`
  (uuidLike), `instrucao` (string, ≤1000). Aplica gate de permissão + unidade,
  atualiza `clients.stories_instrucao` (trim; vazio → null).

### `src/components/fast-media/StoriesMonthGrid.tsx`
- Novo prop na grade: `viewerId: string | null` e `canEditInstrucaoManager:
  boolean`.
- Em cada `ClientStoryRow`: `podeEditarInstrucao = canEditInstrucaoManager ||
  (!!viewerId && row.assessor_id === viewerId)`.
- Bloco de instrução no card:
  - Se `row.stories_instrucao`: caixa destacada (ícone de nota + texto),
    sempre visível a todos.
  - Se `podeEditarInstrucao`: botão pra abrir dialog de edição (Textarea +
    salvar/limpar) via `updateClienteStoriesInstrucaoAction`; se não há
    instrução, mostra "+ Adicionar instrução".
  - Se não pode editar e não há instrução: nada.

### `src/app/(authed)/fast-media/page.tsx`
- Calcula `canEditInstrucaoManager = ["adm","socio","coordenador"].includes(user.role)`.
- Passa `viewerId={user.id}` e `canEditInstrucaoManager` ao `StoriesMonthGrid`.

## UX

- Instrução exibida como caixa de destaque (não confundir com o assessor/○ nº).
- Textarea com limite visível; botão "Salvar" e botão "Limpar" (limpa e fecha).
- Toasts `sonner`; `router.refresh()` após salvar.

## Testes

- Unit (action): manager edita; assessor-dono do cliente edita; outro assessor
  (id != assessor_id do cliente) é negado; `fast_midia` é negado; texto vazio
  limpa (grava null); cliente fora da unidade é negado; texto > 1000 rejeitado.
- Verificação: `npm run typecheck` + eslint dos arquivos alterados. UI conferida
  no PR (padrão do projeto: sem subir dev server).

## Deploy

- **1 migration manual** (`20260716000000_clients_stories_instrucao.sql`) via SQL
  Editor do Supabase. Graças ao fallback resiliente, não há janela de grade vazia
  independentemente da ordem merge-vs-SQL.
