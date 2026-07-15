# Fast Mídia — gerenciar clientes de stories pelo menu

**Data:** 2026-07-15
**Rota afetada:** `/fast-media`

## Problema

Hoje, para um cliente aparecer na grade de stories do `/fast-media`, é preciso
ir na ficha dele (`/clientes/[id]/editar`) e ligar `tem_stories` + definir a
quantidade diária. A Yasmin quer fazer isso direto do menu Fast Mídia, a
qualquer momento: adicionar cliente, definir a quantidade diária, editar e
remover — sem navegar pra ficha de cada um. Também quer que os clientes já
listados na grade fiquem "interligados" com a carteira (clientes reais).

## Investigação dos dados (2026-07-15, produção, read-only)

Base tem 156 clientes; 7 com `tem_stories = true`:

| Cliente | Status | Assessor | Diária | Duplicado? |
|---|---|---|---|---|
| Ccr | ativo | sim | 1 | não ("Ecommerce CCR" é outro cliente) |
| Delta Seguro | ativo | sim | 1 | não |
| Gallo Man | ativo | sim | 5 | não |
| Marcus Brito | ativo | sim | 1 | não |
| PetMarket | ativo | sim | 4 | não |
| Recanto Coutry | ativo | sim | 4 | não ("Ecommerce Recanto" é outro cliente) |
| Yide | ativo | sim | 4 | não |

**Conclusão:** não há entrada solta nem duplicada. Todos os 7 já são clientes
reais da carteira, `ativo` e com assessor. Portanto **não é preciso tela de
reconciliação**. O "interligar" se resolve tornando o nome do cliente clicável
(link pra ficha). ("Recanto Coutry" tem typo no cadastro; correção fora do
escopo desta feature.)

## Escopo

1. **Adicionar cliente à grade** — botão "Adicionar cliente" no `/fast-media`
   abre um dialog com seletor de cliente (só clientes `ativo` que ainda não têm
   stories, da carteira) + input de quantidade diária. Ao salvar, liga
   `tem_stories = true` e grava `quantidade_diaria_stories`.
2. **Editar quantidade diária** — em cada card da grade, botão (só pra quem
   edita) abre mini-dialog pra ajustar a diária.
3. **Remover da grade** — no mesmo mini-dialog, ação "Remover da grade" que
   desliga `tem_stories` (mantém o histórico de marcações; se readicionar
   depois, os stories já marcados reaparecem). Pede confirmação.
4. **Nome vira link pra ficha** — o nome do cliente em cada card da grade vira
   `<Link>` pra `/clientes/[id]`.

### Fora de escopo

- Cadastrar cliente novo do zero pela grade (usa a carteira existente).
- Reconciliação/merge de duplicados (não existem nos dados).
- Apagar histórico de stories ao remover (remover só tira da grade).
- Corrigir typo "Recanto Coutry".

## Modelo de dados

**Sem migration.** Reusa colunas que já existem em `clients`:

- Adicionar: `UPDATE clients SET tem_stories = true, quantidade_diaria_stories = N`
- Editar: `UPDATE clients SET quantidade_diaria_stories = N`
- Remover: `UPDATE clients SET tem_stories = false`

`N` é inteiro `1..99` (obrigatório ao adicionar).

## Segurança (RLS)

O update em `clients` roda via **service-role** (padrão de
`stories-queries.ts`), NÃO via `createClient()` com RLS. Motivo: a policy de
UPDATE em `clients` cobre `adm/socio/coordenador/assessor` (ver
`gmb-actions.ts`), mas **não `fast_midia`** — que precisa gerenciar a grade. Com
service-role, a proteção vem de:

- **Gate de role** na própria action: `["fast_midia","adm","socio","coordenador"]`
  (os mesmos que já marcam stories em `stories-actions.ts`).
- **Validação de unidade**: o `client_id` alvo precisa estar em
  `getClientIdsForActiveUnit()` (quando não-nulo), pra não permitir mexer em
  cliente de outra unidade.

## Componentes e arquivos

### `src/lib/painel/stories-queries.ts`
Nova função:
- `getClientesElegiveisStories(unitClientIds: string[] | null): Promise<{ id: string; nome: string }[]>`
  — clientes `status = 'ativo'` e `tem_stories = false`, filtrados pela unidade,
  ordenados por nome. Serve o seletor do dialog. Service-role, mesmo shape das
  outras queries do arquivo.

### `src/lib/painel/stories-actions.ts`
Três actions novas (service-role, gate de role, validação de unidade,
`revalidatePath("/fast-media")` + `("/painel")`):

- `addClienteStoriesAction(formData)` — campos `client_id` (uuidLike),
  `quantidade_diaria` (int 1..99). Verifica que o cliente existe, é `ativo`,
  está na unidade ativa e ainda não tem stories; então
  `UPDATE tem_stories=true, quantidade_diaria_stories=N`. Retorna
  `{ success }` ou `{ error }`.
- `updateClienteDiariaStoriesAction(formData)` — `client_id`,
  `quantidade_diaria` (int 1..99). `UPDATE quantidade_diaria_stories=N`.
- `removeClienteStoriesAction(formData)` — `client_id`.
  `UPDATE tem_stories=false`.

Todas usam `.select()` no update e checam length pra detectar 0 linhas
(memória: RLS/deny silencioso — aqui é service-role, mas o padrão protege
contra client_id inválido/fora da unidade).

### `src/components/fast-media/AdicionarClienteStoriesDialog.tsx` (novo)
Espelha `src/components/painel-gmb/AdicionarGmbDialog.tsx`:
- Botão "Adicionar cliente" (ícone `Plus`).
- Dialog com `SearchableSelect` (`@/components/ui/searchable-select`) das
  opções `clientesElegiveis` + `Input` numérico da quantidade diária.
- Estado vazio: mensagem quando não há cliente elegível.
- Toasts (`sonner`), `router.refresh()` no sucesso.
- Props: `clientesElegiveis: { id: string; nome: string }[]`.

### `src/components/fast-media/StoriesMonthGrid.tsx`
- Nome do cliente (`row.client_nome`) vira `<Link href={`/clientes/${row.client_id}`}>`.
- Novo botão de editar por card (ícone lápis/engrenagem), visível só quando
  `canEdit`, que abre um mini-dialog com:
  - Input da quantidade diária (1..99) → `updateClienteDiariaStoriesAction`.
  - Botão "Remover da grade" com confirmação → `removeClienteStoriesAction`.

### `src/app/(authed)/fast-media/page.tsx`
- Carrega `getClientesElegiveisStories(unitClientIds)` junto do `Promise.all`.
- Renderiza `<AdicionarClienteStoriesDialog>` no cabeçalho da seção Stories,
  visível só quando `canEdit` (`ROLES_QUE_MARCAM`).

## UX

- Quantidade diária: inteiro obrigatório 1..99.
- Remover pede confirmação e deixa claro que só tira da grade (não apaga
  histórico).
- Toasts de sucesso/erro padrão `sonner`.
- Depois de qualquer ação, revalida `/fast-media` e `/painel`.

## Testes

- Unit/action: gate de role bloqueia role não permitida; add liga `tem_stories`
  e grava diária; add rejeita cliente fora da unidade ativa; editar muda a
  diária; remover desliga `tem_stories` sem apagar `client_story_posts`;
  quantidade fora de 1..99 é rejeitada.
- Verificação: type-check + lint. UI conferida direto no PR (sem subir dev
  server — padrão do projeto).

## Deploy

- Sem migration (nada de SQL manual no Supabase).
- Sem mudança de shape de dados em `unstable_cache` (não aplicável aqui).
