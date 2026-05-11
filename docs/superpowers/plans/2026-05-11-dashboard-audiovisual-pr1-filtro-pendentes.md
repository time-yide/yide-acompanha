# PR 1 — Filtro de Pendentes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restringir a seção "Tarefas pendentes" (em 3 lugares) a mostrar apenas tarefas com status `aberta`, `em_andamento` ou `alteracao` — escondendo `em_aprovacao`, `aprovada`, `concluida`, `agendado` e `postada`.

**Architecture:** Mudança pontual de filtro em 2 funções server-side (`getMinhasTarefasPendentes` e `getEquipeAudiovisual.editores.pendentesList`) + adição de 1 label faltando no dialog detalhe. Sem mudança de shape de dados, sem bump de cache key — o filtro já existente vira mais restritivo.

**Tech Stack:** Next.js (app router), Supabase JS client, `unstable_cache` + tag invalidation, TypeScript estrito, vitest pra tests.

**Spec de referência:** [`docs/superpowers/specs/2026-05-11-dashboard-audiovisual-revamp-design.md`](../specs/2026-05-11-dashboard-audiovisual-revamp-design.md) — PR 1.

---

## Task 0: Preparar branch isolada a partir de `main`

**Contexto:** O worktree atual está em `claude/busy-lalande-2ae9b6`, que já contém:
- `ce197df` — fix mobile audiovisual (já no PR #196 contra main)
- `c1e4409` — commit do spec doc (só local; não pushed)

A preferência do usuário é "PR sempre separado da main". Por isso, criamos branch nova diretamente a partir de `origin/main` e levamos o spec doc junto via cherry-pick (assim reviewers do PR 1 já enxergam o spec).

**Files:** nenhum — só operações git.

- [ ] **Step 1: Verificar que tudo está comitado e working tree limpo**

Run: `git status`
Expected: `working tree clean` (sem arquivos modificados ou untracked).

Se houver alteração pendente, parar e perguntar ao usuário.

- [ ] **Step 2: Anotar o hash do commit do spec doc**

Run: `git log --oneline -5`
Expected: ver que `c1e4409` (ou hash equivalente) é o commit do spec. **Memorizar o hash exato.** Se diferente de `c1e4409`, usar o hash real nos próximos passos.

- [ ] **Step 3: Fetch da main**

Run: `git fetch origin main`
Expected: sem erro.

- [ ] **Step 4: Criar branch nova a partir de origin/main**

Run: `git switch -c claude/audiovisual-pendentes-filtro origin/main`
Expected: branch nova ativa, working tree muda pra estado da main (o fix mobile e o spec doc somem temporariamente — voltam no próximo passo).

- [ ] **Step 5: Cherry-pick do spec doc**

Run: `git cherry-pick c1e4409` (substituir pelo hash real anotado no Step 2)
Expected: commit aplicado, `docs/superpowers/specs/2026-05-11-dashboard-audiovisual-revamp-design.md` agora está na nova branch.

Se houver conflito (improvável, pois o arquivo é novo), parar e perguntar.

- [ ] **Step 6: Verificar estado**

Run: `git log --oneline -3 && git status`
Expected:
- HEAD em `claude/audiovisual-pendentes-filtro`, sem mudanças pendentes
- Top commit é o cherry-pick do spec doc
- Commit anterior é o HEAD da main

---

## Task 1: Restringir filtro em `MinhasTarefasPendentes`

**Files:**
- Modify: `src/lib/dashboard/personal.ts:49`

Função `_getMinhasTarefasPendentesImpl` filtra hoje qualquer status que não seja `concluida`. Restringir pra somente os 3 statuses operacionais.

- [ ] **Step 1: Editar o filtro**

Em `src/lib/dashboard/personal.ts`, na função `_getMinhasTarefasPendentesImpl`, trocar a linha:

```ts
    .neq("status", "concluida")
```

por:

```ts
    .in("status", ["aberta", "em_andamento", "alteracao"])
```

Não mexer em mais nada no arquivo. Não bumpar cache key (shape do retorno é igual).

- [ ] **Step 2: Verificar com type-check**

Run: `npm run typecheck`
Expected: nenhum erro em `src/lib/dashboard/personal.ts`. (Erro pré-existente em `src/lib/push/server.ts` sobre `web-push` é OK — ignorar.)

- [ ] **Step 3: Lint do arquivo**

Run: `npm run lint -- src/lib/dashboard/personal.ts`
Expected: sem erros nem warnings.

- [ ] **Step 4: Commit**

```bash
git add src/lib/dashboard/personal.ts
git commit -m "$(cat <<'EOF'
fix(dashboard): pendentes mostra só Aberta + Em andamento + Alteração

Filtro em MinhasTarefasPendentes restringe pra status operacionais
reais. Antes mostrava qualquer status != concluida, incluindo
em_aprovacao, aprovada, agendado e postada — que já saíram do
trabalho operacional e poluíam a lista.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Restringir filtro na coluna "Pendentes" da tabela de Edição

**Files:**
- Modify: `src/lib/dashboard/audiovisual.ts:160`

Função `_getEquipeAudiovisualImpl` constrói `pendentesList` por editor. Mesmo filtro restritivo.

- [ ] **Step 1: Editar o filtro**

Em `src/lib/dashboard/audiovisual.ts`, dentro do `.map((p) => {...})` que constrói `editores`, na construção de `pendentesList`, trocar:

```ts
      const pendentesList: TaskItem[] = tasks
        .filter(
          (t) =>
            t.status !== "concluida" &&
            (t.atribuido_a === p.id || (t.participantes_ids ?? []).includes(p.id)),
        )
```

por:

```ts
      const pendentesList: TaskItem[] = tasks
        .filter(
          (t) =>
            ["aberta", "em_andamento", "alteracao"].includes(t.status) &&
            (t.atribuido_a === p.id || (t.participantes_ids ?? []).includes(p.id)),
        )
```

Não mudar cache key (shape igual; `agregados.totalPendentes` segue refletindo a soma de `pendentesList.length`).

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: sem erro em `src/lib/dashboard/audiovisual.ts`.

- [ ] **Step 3: Lint do arquivo**

Run: `npm run lint -- src/lib/dashboard/audiovisual.ts`
Expected: sem erros nem warnings.

- [ ] **Step 4: Commit**

```bash
git add src/lib/dashboard/audiovisual.ts
git commit -m "$(cat <<'EOF'
fix(dashboard): coluna 'Pendentes' da equipe mostra só ação operacional

Mesmo filtro restritivo do MinhasTarefasPendentes aplicado em
pendentesList por editor. Coluna 'Pendentes' e agregado
totalPendentes agora batem com 'só Aberta + Em andamento + Alteração'.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Adicionar label "Alteração" no dialog detalhe

**Files:**
- Modify: `src/components/dashboard/audiovisual/MemberDetailDialog.tsx:18-24`

`STATUS_LABEL` cobre `aberta`, `em_andamento`, `em_aprovacao`, `aprovada`, `postada` — mas falta `alteracao`. Com o filtro novo, tasks com status `alteracao` passam a aparecer e o dialog renderiza o string literal `"alteracao"` em vez de "Alteração".

- [ ] **Step 1: Adicionar o label**

Em `src/components/dashboard/audiovisual/MemberDetailDialog.tsx`, no objeto `STATUS_LABEL`:

```ts
const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  em_aprovacao: "Em aprovação",
  aprovada: "Aprovada",
  postada: "Postada",
};
```

Adicionar entry `alteracao: "Alteração"`, deixando:

```ts
const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  alteracao: "Alteração",
  em_aprovacao: "Em aprovação",
  aprovada: "Aprovada",
  postada: "Postada",
};
```

- [ ] **Step 2: Type-check + lint**

Run: `npm run typecheck && npm run lint -- src/components/dashboard/audiovisual/MemberDetailDialog.tsx`
Expected: sem erros novos em ambos.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/audiovisual/MemberDetailDialog.tsx
git commit -m "$(cat <<'EOF'
fix(dashboard): label 'Alteração' no dialog detalhe de membro

STATUS_LABEL cobria 5 statuses mas faltava 'alteracao'. Com o
filtro novo de pendentes mostrando alteracao, o dialog renderizava
'alteracao' literal — agora mostra 'Alteração'.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Push e abrir PR

**Files:** nenhum — apenas operações git/gh.

Pré-requisito: já estar na branch `claude/audiovisual-pendentes-filtro` com 4 commits acima de origin/main (spec doc + 3 commits dos filtros). Verificar antes:

```bash
git log --oneline origin/main..HEAD
```

Expected: 4 linhas (spec doc + filtro personal.ts + filtro audiovisual.ts + label Alteração).

- [ ] **Step 1: Push da branch**

Run: `git push -u origin claude/audiovisual-pendentes-filtro`
Expected: branch criada no remote sem rejected. Tracking configurado.

- [ ] **Step 2: Abrir PR**

Run:
```bash
gh pr create --base main --title "fix(dashboard): pendentes mostra só Aberta + Em andamento + Alteração" --body "$(cat <<'EOF'
## Problema

A seção "Tarefas pendentes" mostrava tudo que não fosse \`concluida\` — incluindo \`em_aprovacao\`, \`aprovada\`, \`agendado\` e \`postada\`. Isso gerava confusão operacional: tarefas que já saíram do lado do editor/criador apareciam misturadas com o que realmente precisa de ação.

## Mudança

Filtro restringido a **somente os 3 statuses operacionais**: \`aberta\`, \`em_andamento\` e \`alteracao\`.

Aplicado em 3 lugares:

- **A) MinhasTarefasPendentes** ([personal.ts:49](src/lib/dashboard/personal.ts:49)) — seção do topo de todos os dashboards
- **B) Coluna "Pendentes" da tabela de Edição** ([audiovisual.ts:160](src/lib/dashboard/audiovisual.ts:160)) — agregados também batem
- **C) Dialog detalhe** ([MemberDetailDialog.tsx:18](src/components/dashboard/audiovisual/MemberDetailDialog.tsx:18)) — herda B + adiciona label "Alteração" que faltava

Visibilidade: mantém comportamento atual (cada usuário vê só as próprias em A).

Status \`aprovada\` também sai (confirmado: tarefa aprovada não precisa de ação operacional).

## Test plan

- [ ] Videomaker logado → "Tarefas pendentes" mostra só status \`aberta\`/\`em_andamento\`/\`alteracao\` próprios
- [ ] Audiovisual_chefe → coluna "Pendentes" da tabela editores e dialog batem com soma visível
- [ ] Tarefa em \`em_aprovacao\`/\`aprovada\`/\`concluida\`/\`agendado\`/\`postada\` **não** aparece em nenhum dos 3 lugares
- [ ] Dialog mostra "Alteração" (não "alteracao") quando filtra task com status \`alteracao\`

## Contexto

Primeiro PR de 4 do refactor "Dashboard Audiovisual — Revamp". Spec completo: [docs/superpowers/specs/2026-05-11-dashboard-audiovisual-revamp-design.md](docs/superpowers/specs/2026-05-11-dashboard-audiovisual-revamp-design.md).

Próximos PRs (independentes, virão depois):
- PR 2 — Reestruturação Videomakers + Editores (Próximas/Hoje/Concluídas)
- PR 3 — Painel Audiovisual novo (últimos 3 dias)
- PR 4 — Abas no /audiovisual (Pendente entrega + Pendente delegação)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: URL do PR retornada (ex: `https://github.com/time-yide/yide-acompanha/pull/N`).

- [ ] **Step 3: Reportar URL pro usuário**

Mensagem curta com a URL do PR. Atualizar o todo list marcando Task 4 como completed.

---

## Notas operacionais

**Sem testes unitários novos.** Razões:
- Mudança é única instrução `.in()` substituindo `.neq()` (filtro Supabase) + Array.includes — type-check pega typos
- Sem helpers extraídos pra testar isoladamente
- Test plan manual no PR cobre os cenários funcionais
- Preferência registrada do usuário: pular teste local de UI, ir direto pro PR após type-check/lint passar

**Sem bump de cache key.** Razões:
- Shape do retorno é igual (mesmas colunas, mesmos tipos)
- O filtro novo é um subconjunto do filtro antigo — todo registro que passa pelo filtro novo já passava pelo antigo
- TTL de 30s/60s desatualiza naturalmente
- Bump seria desperdício de invalidação

**Erro pré-existente no type-check.** `src/lib/push/server.ts` reporta `Cannot find module 'web-push'`. Não relacionado a este PR; já existe na main. Ignorar.

**Branch isolada (Task 0).** Esse plano cria `claude/audiovisual-pendentes-filtro` a partir de `origin/main` e cherry-picka o commit do spec doc — assim o PR 1 não fica empilhado no PR #196 (fix mobile) e reviewers já enxergam o spec na própria PR. Após o merge na main, PRs 2/3/4 partem de uma main que já contém o spec.

**Comitar diretamente sem failing test.** Não estamos usando TDD em PR 1 porque a mudança é tão pequena (substituição de filtro + 1 label) que o tempo pra extrair uma função testável e simular Supabase seria muito maior que o ganho. O test plan manual no PR cobre os cenários funcionais.
