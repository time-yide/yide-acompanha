# Pesquisa "Conecta Yide" + Lock Gate de pesquisas obrigatórias

**Data:** 2026-07-22
**Branch alvo:** a partir de `origin/main` (branch nova, ver memória `feedback_branch_from_origin_main`)

## Objetivo

Publicar uma pesquisa de satisfação sobre o evento interno **Conecta Yide** que o
time responde ao abrir o sistema. A pesquisa deve **travar a tela** (lock gate em
tela cheia) até a pessoa responder — mesmo padrão já usado pela avaliação de
satisfação semanal e pela captação audiovisual pendente.

Decisões da Yasmin:
- **Trava a tela** (hard lock), não versão suave.
- Respostas **identificadas** (não anônimas).
- Público: **time todo** (todos os usuários ativos).
- **Ativa agora / hoje** — não esperar. Caminho mínimo, sem checkbox reutilizável
  na UI de criação (a coluna `bloqueante` é ativada via SQL só nessa pesquisa).

## Contexto / reaproveitamento

Já existe um módulo **Pesquisas** completo (migration `20260721000001_pesquisas.sql`):
tabelas `pesquisas`, `pesquisa_perguntas`, `pesquisa_destinatarios`,
`pesquisa_respostas`; tipos de pergunta `multipla_escolha | escala | sim_nao | texto`;
opção anônima; status `rascunho | aberta | encerrada`; prazo; notificação
`pesquisa_disparada`; tela de resultados agregados. Server actions em
`src/lib/pesquisas/actions.ts` (incl. `responderPesquisaAction`), queries em
`src/lib/pesquisas/queries.ts`, componente `ResponderForm` em
`src/components/pesquisas/ResponderForm.tsx`.

**O que falta:** não existe lock gate pra pesquisas. A regra de notificação é
`mandatory: true`, mas isso só força notificação in-app/email — não trava a
navegação. Os únicos locks hoje são `SatisfactionLockGate` e
`CapturaPendenteLockGate`, montados no fim de `src/app/(authed)/layout.tsx`.

## Conteúdo da pesquisa

- **Título:** `Conecta Yide — sua opinião conta 💛`
- **Descrição:** `Queremos muito saber como foi o nosso Conecta Yide pra você! São só 2 minutinhos e sua resposta ajuda a gente a fazer os próximos ainda melhores.`
- **Anônima:** não (`anonima = false`)
- **Bloqueante:** sim (`bloqueante = true`)

Perguntas (todas obrigatórias, na ordem):

| ordem | tipo | enunciado | escala |
|---|---|---|---|
| 1 | `escala` | De 0 a 10, o quanto você gostou do Conecta Yide? | min 0, max 10 |
| 2 | `sim_nao` | Você gostaria que a gente fizesse o Conecta Yide com mais frequência? | — |
| 3 | `texto` | O que você mais gostou? | — |
| 4 | `texto` | O que você acha que a gente pode melhorar pra próxima? | — |
| 5 | `texto` | Tem alguma ideia do que podemos fazer no próximo Conecta Yide? | — |
| 6 | `texto` | Deixe algum feedback ou recado livre sobre esse momento. | — |

## Arquitetura

### 1. Migration (manual) — nova coluna `bloqueante`

`supabase/migrations/<timestamp>_pesquisas_bloqueante.sql`:

```sql
alter table public.pesquisas
  add column if not exists bloqueante boolean not null default false;
```

Aplicação manual no SQL Editor (ver memória `project_supabase_migrations_manual`).

### 2. Lock check — `src/lib/pesquisas/lock.ts` (SERVER ONLY)

Espelha `src/lib/satisfacao/lock.ts`:

- Exporta `PESQUISA_LOCK_TAG = "pesquisa-lock"`.
- `checkPesquisaLock(userId): Promise<PesquisaLockState>`.
- `PesquisaLockState = { blocked: boolean; pesquisa: { id; titulo; descricao } | null; perguntas: PerguntaRow[] }`.
- Implementação (service-role, dentro de `unstable_cache` com `revalidate: 30`,
  `tags: [PESQUISA_LOCK_TAG]`, **key incluindo o `userId`** — dado per-usuário,
  ver memória `feedback_calendario_dados_per_usuario_fora_do_cache`):
  1. Busca em `pesquisa_destinatarios` a(s) linha(s) do `userId` com
     `respondeu_em is null`, juntando `pesquisas` onde `status = 'aberta'` e
     `bloqueante = true` e `deleted_at is null`. Ordena pela mais antiga
     (`pesquisas.disparada_em asc`), pega a primeira.
  2. Se nenhuma → `{ blocked: false, pesquisa: null, perguntas: [] }`.
  3. Se achou → carrega `pesquisa_perguntas` (ordenadas por `ordem`) e retorna
     `{ blocked: true, pesquisa, perguntas }`.

Reaproveitar/estender queries de `src/lib/pesquisas/queries.ts` quando possível
(há `listPesquisasPendentes`/`podeResponder`); mas o lock precisa filtrar por
`bloqueante = true` e devolver as perguntas, então uma função dedicada é mais clara.

Revalidação: `responderPesquisaAction` (existente) precisa passar a chamar
`revalidateTag(PESQUISA_LOCK_TAG)` além do que já revalida, pra o lock sumir na
hora após responder. Também `revalidatePath("/", "layout")` garante o re-render do
gate. (Verificar o que a action já revalida e só complementar.)

### 3. Componente — `src/components/pesquisas/PesquisaLockGate.tsx` (client)

Espelha `SatisfactionLockGate`:

- Props: `{ state: PesquisaLockState }`.
- Se `!state.blocked` → retorna `null`.
- Se `blocked` → overlay `fixed inset-0 z-[100]` com `bg-background/95
  backdrop-blur-md`, card centralizado (`max-w-2xl`), ícone de cadeado + header
  explicando que é rápido e obrigatório, e **reusa `ResponderForm`** passando
  `pesquisaId={state.pesquisa.id}`, `titulo`, `descricao`, `perguntas`.
- Ao enviar, `ResponderForm` já chama `responderPesquisaAction`; com a revalidação
  da tag/layout o gate deixa de renderizar no próximo ciclo. Garantir um
  `router.refresh()` no fluxo de sucesso caso o re-render não venha sozinho
  (o `ResponderForm` já importa `useRouter`).

Sem escape hatch: enquanto `blocked`, não há botão de fechar (igual aos outros
locks).

### 4. Integração no layout — `src/app/(authed)/layout.tsx`

- Import de `checkPesquisaLock` e `PesquisaLockGate`.
- Adicionar `checkPesquisaLock(user.id)` ao `Promise.all` de contagens/locks.
- Renderizar `<PesquisaLockGate state={pesquisaLock} />` junto dos outros dois
  gates, no fim do JSX. Empilhamento: mesmo `z-[100]`; como só uma pesquisa
  bloqueante existe por vez e o público é o time todo, na prática o usuário vê um
  gate de cada vez. (Aceitável; não introduzir ordenação especial.)

### 5. Seed da pesquisa — SQL (manual, roda depois da migration + do deploy)

`supabase/seeds/2026-07-22_conecta_yide.sql` (ou entregue como bloco pra colar no
SQL Editor). Idempotente/transacional:

1. Resolve `organization_id` (assumir org única; se houver mais de uma, o SQL usa a
   org da criadora) e `criado_por` (um profile `socio`/`adm` ativo — ex. a Yasmin).
2. `insert into pesquisas (... titulo, descricao, anonima=false, bloqueante=true,
   status='aberta', disparada_em=now(), criado_por, organization_id)` retornando o id.
3. `insert into pesquisa_perguntas` as 6 perguntas (ordem, tipo, enunciado,
   `escala_min/max` na 1, `obrigatoria=true`).
4. `insert into pesquisa_destinatarios (pesquisa_id, user_id)
   select <id>, p.id from profiles p where p.ativo = true` (todos os ativos).

Confirmar nomes reais das colunas de `profiles` (`ativo`) e `organizations` na
implementação. Disparar a notificação `pesquisa_disparada` é opcional aqui (o lock
já garante que todos veem); se fácil, inserir também nas notificações, senão
deixar só o lock.

## Ordem de deploy (pra ficar no ar hoje)

1. Aplicar a migration (`bloqueante`) no SQL Editor do Supabase.
2. Mergear o PR do código (lock.ts + componente + layout + revalidação da action).
   Esperar CI verde + deploy Vercel.
3. Rodar o SQL seed que cria a pesquisa e dispara pra todos os ativos.
4. A partir daí, no próximo carregamento de página de cada pessoa (inclusive quem
   já está logada), a tela trava até responder.

## Fora de escopo (YAGNI)

- Checkbox "travar sistema" na UI de criação (`DispararModal`). Fica pra uma feature
  futura se a Yasmin quiser criar pesquisas obrigatórias sozinha.
- Locks empilhados com ordenação/prioridade.
- Pesquisa anônima com lock.

## Verificação

- Type-check + lint (ver memória `feedback_skip_local_ui_test`: após passar,
  commit + PR direto).
- Testar manualmente que: (a) usuário com pesquisa bloqueante pendente vê o gate;
  (b) após responder, o gate some sem F5 manual; (c) quem já respondeu não vê o
  gate; (d) pesquisa `bloqueante=false` não trava (regressão do módulo existente).
