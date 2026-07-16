# Painel Mensal — cronograma + tarefa de design + coluna Design + topo limpo

**Data:** 2026-07-16 · **Rota:** `/painel`

## Objetivo (decidido com a Yasmin)

1. Tirar a coluna **Pacote/Post**; a **quantidade** do pacote passa a ser informada no **upload do cronograma**.
2. O cronograma vira **mensal**: na coluna Crono, "Add link" abre um modal com **link (drive)** + **quantidade**. Ao salvar, **cria automaticamente uma tarefa pro designer** do cliente.
3. Nova coluna **Design**: mostra se o designer **já entregou** (status da tarefa auto-criada).
4. **Simplificar o topo** (KPIs + filtros) — está muito colorido/confuso.

## Modelo de dados

Migration (manual) `20260716200000_painel_cronograma_design.sql` — em `client_monthly_checklist`:
- `cronograma_url text` — link do cronograma do mês.
- `design_task_id uuid references tasks(id) on delete set null` — a tarefa do designer.
- `pacote_post` (já existe) — a quantidade, setada no upload.

## Parte A — Upload do cronograma (substitui o fluxo atual)

Hoje: coluna Crono ("Add link") navega pra `/clientes/[id]/editar` e o crono deriva de `clients.link_estrategia`. Muda pra:

**`CronogramaModal`** (novo, client) aberto pelo `CronoCell`: campo URL (drive) + campo quantidade (int ≥ 0). Botão salvar chama a action.

**`uploadCronogramaAction(formData)`** (novo, em `src/lib/painel/actions.ts`, espelhando `setMonthlyPostsAction` — mesmo gate de permissão, service-role, `revalidateTag(PAINEL_CACHE_TAG)`):
- Campos: `client_id` (uuid), `mes_referencia` (YYYY-MM), `cronograma_url` (url), `quantidade` (coerce int ≥ 0).
- Upsert em `client_monthly_checklist` (onConflict client_id,mes_referencia): `cronograma_url`, `pacote_post = quantidade`.
- **Cria a tarefa do designer** (reusar a lógica de insert de `createTaskAction`, mas server-side direto):
  - Carrega o cliente: `designer_id, coordenador_id, nome`.
  - `atribuido_a = designer_id ?? coordenador_id ?? actor.id`.
  - `titulo = "Design — cronograma <nome> (<mes>)"`, `tipo = "arte"`, `formatos = ["feed"]` (arte exige formatos), `client_id`, `criado_por = actor.id`, `prioridade = "media"`, `descricao` com o link do crono, `status_aprovacao = "pendente_envio"`.
  - Dispara `dispatchNotification` (task_assigned) pro atribuído (igual createTaskAction).
  - Guarda o `id` da tarefa criada em `client_monthly_checklist.design_task_id`.
  - Se já existir `design_task_id` (re-upload), NÃO cria outra — atualiza só o link/quantidade (evita duplicar tarefa).
- Marca o passo crono como pronto (o `derivedDone` do queries.ts passa a olhar `cronograma_url` além de/no lugar de `link_estrategia` — ver Parte D).

## Parte B — Coluna Design (nova)

- Em `queries.ts`, o `ChecklistRow` ganha `designTaskStatus: string | null` (status da tarefa `design_task_id`, buscado num join/lookup). "entregue" = status ∈ {postada, concluida}.
- Novo cell `DesignCell`: mostra **Pendente** (âmbar) enquanto não entregue, **Entregue** (verde) quando entregue, **—** quando não há `design_task_id` (sem crono ainda). Se há tarefa, clique linka pra `/tarefas/<design_task_id>`.
- Adicionar a coluna "Design" na `PainelTable` (e ao `PACOTE_COLUMNS`/matrix como aplicável aos pacotes que têm design — os que têm crono: trafego_estrategia, estrategia, yide_360, ecommerce). Colocar logo após Crono.

## Parte C — Remover coluna Pacote/Post

- Tirar `Pacote/Post` das colunas da `PainelTable` e do card. A quantidade agora aparece como um sub-rótulo no `CronoCell` (ex.: "12 posts") quando `pacote_post > 0`.
- `setMonthlyPostsAction`/`PacotePostadosModal` podem ficar (não removê-los pra não quebrar), mas a coluna sai da UI. O `global-status.ts` que usa `pacote_post` continua válido (quantidade agora vem do crono).

## Parte D — Cronograma pronto deriva de cronograma_url

- Em `queries.ts`, onde deriva o passo cronograma de `clients.link_estrategia`, passar a considerar `client_monthly_checklist.cronograma_url` do mês (se preenchido → crono pronto). Manter o fallback de `link_estrategia` pra não regredir clientes antigos.

## Parte E — Topo mais limpo

- `PainelKpis.tsx`: trocar os 5 cards de fundos saturados por uma **faixa compacta** — números com rótulo, cores só no texto/ícone (suaves), sem blocos coloridos grandes. Manter os 5 números (Clientes, Concluídos, Em produção, Atrasados, Sem início).
- Filtros: unificar as duas linhas (chips de tipo de pacote + `AreaFilter`) num só bloco enxuto, com menos peso visual. Não remover funcionalidade, só reduzir ruído.

## Permissões / RLS

- `uploadCronogramaAction` usa o mesmo gate do `setMonthlyPostsAction` (papéis que editam o painel). A criação da tarefa via service-role (ou createClient RLS — seguir o padrão de `createTaskAction`). Checar linhas afetadas no update (RLS deny silencioso).

## Testes

- Unit da `uploadCronogramaAction`: cria tarefa pro designer_id; fallback pro coordenador quando sem designer; re-upload não duplica tarefa; grava cronograma_url + pacote_post.
- Verificação: typecheck + eslint dos arquivos alterados. UI no PR.

## Deploy

- **1 migration manual** (`20260716200000_painel_cronograma_design.sql`). Query resiliente: se as colunas ainda não existem, tratar como nulas (não quebrar o painel entre deploy e migration).
