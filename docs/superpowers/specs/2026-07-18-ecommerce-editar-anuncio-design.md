# E-commerce — editar lançamento de anúncios (+ fix permissão Felipe)

**Data:** 2026-07-18
**Módulo:** e-commerce (`src/components/ecommerce`, `src/lib/ecommerce`, `src/app/(authed)/ecommerce`)
**Fonte:** código vive em `origin/main` (main local vive atrás — branchar de `origin/main`).

## Problema

Na tela `/ecommerce`, a lista de lançamentos (`AnunciosList`) só tem o botão de **arquivar** (lixeira). Não dá pra **editar** um lançamento já criado (corrigir quantidade, cliente, data, marketplace, observação). A `updateAnuncioAction` já existe no backend — falta só a UI.

Além disso, um bug de permissão bloqueia o **Felipe** (`role=assessor` + `especialidade=ecommerce`): as três actions (`criarAnuncioAction`/`updateAnuncioAction`/`arquivarAnuncioAction`) checam `podeLancar(actor.role)` contra a lista `ROLES_LANCAM = [adm, socio, assessor_ecommerce, assistente_ecommerce]`, que **ignora** o caso assessor+especialidade que a `canAccessEcommerce` (guarda da página) permite. Resultado: o Felipe entra na página mas leva "Sem permissão" ao criar/editar/arquivar.

## Decisões (brainstorming)

- **Editar todos os campos** (cliente, quantidade, data, marketplace, observação), reaproveitando o formulário do "Novo lançamento" pré-preenchido.
- **Conserto do Felipe no mesmo PR.**

## Definições / restrições

- `updateAnuncioSchema = criarAnuncioSchema.extend({ id })` — mesmos campos + `id`. Form idêntico ao de criação.
- **Escopo já resolvido pela query:** `listAnuncios` filtra `colaborador_id = actorId` pra quem não é chefia (`veTudo`). Assessor/assistente só veem os próprios lançamentos; chefia vê todos. Logo, mostrar "editar" em toda linha visível é sempre válido — a `updateAnuncioAction` ainda reforça o escopo no server (`.eq("colaborador_id", actor.id)` quando não é chefia).

## Componentes

### 1. Formulário compartilhado — `src/components/ecommerce/AnuncioFormModal.tsx` (novo, client)

Extraído do `NovoAnuncioButton` pra virar fonte única de criar **e** editar (evita duplicar os 5 campos e o drift de UI).

- Props:
  ```ts
  interface AnuncioInitial {
    id?: string;
    client_id?: string;
    data?: string;        // YYYY-MM-DD
    quantidade?: number;
    marketplace?: string;
    observacao?: string | null;
  }
  interface Props {
    clientes: { id: string; nome: string }[];
    titulo: string;
    initial?: AnuncioInitial;
    action: (fd: FormData) => Promise<{ success: true } | { error: string }>;
    onClose: () => void;
    onDone: () => void; // chamado no sucesso (o pai faz router.refresh)
  }
  ```
- Renderiza o overlay + form com os campos (cliente `select`, quantidade, data, marketplace `select`, observação), pré-preenchidos a partir de `initial` (defaults: quantidade `1`, data hoje, marketplace o primeiro). Quando `initial?.id` existe, inclui um `<input type="hidden" name="id">`.
- Estado de erro + pending (via `useTransition`). No sucesso: `onDone()`. Fecha por clique fora / Esc / Cancelar.

### 2. `NovoAnuncioButton.tsx` (edita) — passa a usar o modal compartilhado

Mantém o botão "Novo lançamento" (desabilitado sem clientes). Ao abrir, renderiza `<AnuncioFormModal titulo="Novo lançamento de anúncios" action={criarAnuncioAction} clientes={clientes} onClose={...} onDone={() => { fecha; router.refresh() }} />` (sem `initial` → defaults).

### 3. `AnunciosList.tsx` (edita) — botão de editar por linha

- Nova prop `clientes: { id: string; nome: string }[]`.
- Cada linha ganha um botão **lápis** (`Pencil`, ao lado da lixeira), sob o mesmo gate `podeArquivar`.
- Estado `editando: AnuncioRow | null`; clicar no lápis seta a linha; renderiza um `<AnuncioFormModal titulo="Editar lançamento" initial={{ id, client_id, data, quantidade, marketplace, observacao }} action={updateAnuncioAction} clientes={clientes} onClose={() => setEditando(null)} onDone={() => { setEditando(null); router.refresh() }} />`.

### 4. `page.tsx` (edita) — passa `clientes` pra lista

`listClientesEcommerce(orgId)` já é buscado; passar `clientes={clientes}` ao `<AnunciosList>`.

### 5. `actions.ts` (edita) — fix permissão Felipe

- Importa `canAccessEcommerce` de `./access`.
- Remove `ROLES_LANCAM`/`podeLancar`; nas três actions troca `if (!podeLancar(actor.role))` por `if (!canAccessEcommerce(actor.role, actor.especialidade))`.
- `actor` vem de `requireAuth()`, que expõe `especialidade` (a page já usa `user.especialidade`).

## Casos de borda

- Sem clientes → botão "Novo lançamento" já fica desabilitado (comportamento atual); a lista de edição só aparece se houver linhas.
- Editar cliente pra um que não é e-commerce: impossível pela UI (dropdown só lista e-commerce) e a `updateAnuncioAction` valida no server via schema.
- Linha de outro colaborador: não aparece pra assessor (query já filtra); pra chefia, a action permite. Sem UX quebrada.
- Erro do server (ex.: "Nada para atualizar") aparece no form.

## Testes

- Unit (`src/lib/ecommerce/access.test.ts`, vitest) travando o caso do Felipe:
  - `canAccessEcommerce("assessor", "ecommerce")` → true
  - `canAccessEcommerce("assessor", null)` → false
  - `canAccessEcommerce("assistente_ecommerce")` → true
  - `canAccessEcommerce("assessor_ecommerce")` → true
  Rodar: `npx vitest run --exclude '**/.claude/**' src/lib/ecommerce/access.test.ts`.
- UI (formulário/edição) verificada por type-check/lint (padrão do projeto: pular teste local de UI).

## Arquivos

- **Novos:** `src/components/ecommerce/AnuncioFormModal.tsx`, `src/lib/ecommerce/access.test.ts`.
- **Editados:** `src/components/ecommerce/NovoAnuncioButton.tsx`, `src/components/ecommerce/AnunciosList.tsx`, `src/app/(authed)/ecommerce/page.tsx`, `src/lib/ecommerce/actions.ts`.
- **Sem migration.**

## Fora de escopo

- Histórico de "quem editou por último" (não pedido).
- Confirmação extra antes de salvar edição (o próprio modal já é a confirmação; arquivar mantém o `confirm()` atual).
- Reescrever a validação/insert existente.
