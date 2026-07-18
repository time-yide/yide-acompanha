# Módulo de lançamentos da Programação (Sub-projeto 2)

**Data:** 2026-07-18
**Módulos:** novo `programacao` (`src/lib/programacao`, `src/components/programacao`, `src/app/(authed)/programacao`) + integração no painel de produtividade (`src/lib/produtividade/setor-metricas*`).
**Fonte:** código vive em `origin/main` (main local vive atrás — branchar de `origin/main`).

## Contexto

A produtividade da programadora (CRM conectados, usuários criados, sistemas feitos) não tem dado no sistema. Este sub-projeto cria uma tela de **lançamento manual** (espelhada no módulo de e-commerce) pra ela registrar o que fez → vira dado contável → entra no painel de "Produtividade por setor" (Sub-projeto 1, já em produção).

## Decisões (brainstorming)

- **Tipos:** `crm_conectado`, `usuario_criado`, `sistema_feito`.
- **Cliente:** obrigatório (qualquer cliente ativo — não filtra por pacote).
- **Métrica-chave (painel):** soma das quantidades no período (ex.: "12 entregas"); no bloco do setor, detalhe por tipo.
- **Acesso:** adm, sócio, `programacao`.

## Parte A — Módulo `/programacao`

Espelha o e-commerce (`anuncios_ecommerce`), reaproveitando o padrão do `AnuncioFormModal` (form compartilhado criar/editar).

### Banco — migration `lancamentos_programacao` (MANUAL)

```sql
create table if not exists public.lancamentos_programacao (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  colaborador_id uuid references public.profiles(id) on delete set null,
  data date not null default current_date,
  tipo text not null check (tipo in ('crm_conectado','usuario_criado','sistema_feito')),
  quantidade integer not null check (quantidade > 0),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  arquivado_em timestamptz
);
-- índices (org+data, client, colaborador) where arquivado_em is null
-- trigger set_updated_at; RLS permissiva (select/insert/update to authenticated) — actions usam service-role.
```
⚠️ **Aplicada manualmente no SQL Editor após o merge** (padrão do projeto). O código tolera ausência da tabela (fetch cai em vazio + loga, não quebra).

### `src/lib/programacao/`

- `tipos.ts` — `TIPOS = ['crm_conectado','usuario_criado','sistema_feito']` + `TIPO_LABELS` (`"CRM conectado"`, `"Usuário criado"`, `"Sistema feito"`) + `tipoLabel(t)`.
- `access.ts` — `PROGRAMACAO_ROLES = ['adm','socio','programacao']`; `canAccessProgramacao(role)`.
- `schema.ts` — `criarLancamentoSchema` (client_id uuid, data YYYY-MM-DD, tipo enum, quantidade int ≥1, observacao opcional) + `updateLancamentoSchema = criar.extend({id})` + `arquivarLancamentoSchema`.
- `actions.ts` — `criarLancamentoAction` / `updateLancamentoAction` / `arquivarLancamentoAction` (service-role; guard `canAccessProgramacao(actor.role)`; escopo: `veTudo` (adm/socio) edita todos, senão só `colaborador_id = actor.id`; padrão silent-update: `.select("id")` + checar length).
- `queries.ts` — `veTudo(role)` (adm/socio); `listLancamentos(orgId, role, actorId, {de,ate})` (escopo por colaborador se não-chefia; join client/colaborador nome); `listClientesAtivos(orgId)` (`status='ativo'`, `deleted_at is null`, id+nome).

### `src/components/programacao/`

- `LancamentoFormModal.tsx` — form compartilhado criar/editar (cliente `select` obrigatório, tipo `select`, quantidade, data, observação). Mesmo padrão do `AnuncioFormModal`.
- `NovoLancamentoButton.tsx` — botão que abre o modal em modo criar.
- `LancamentosList.tsx` — lista com lápis (editar) + lixeira (arquivar), reaproveitando o modal.

### `src/app/(authed)/programacao/page.tsx`

- Guarda: `canAccessProgramacao(user.role)` senão `notFound()`; `getOrganizationId(user.id)` senão `notFound()`.
- Filtro de período (de/até, default mês) + `NovoLancamentoButton` + `LancamentosList`.
- Aviso quando não há clientes ativos (botão desabilitado, igual e-commerce).

### Menu

Item "Programação" no menu/sidebar, visível a quem passa em `canAccessProgramacao`. (Seguir o padrão de como o item de e-commerce é registrado.)

## Parte B — Encaixe no painel de produtividade

Edita o Sub-projeto 1 (`setor-metricas.ts` puro + `setor-metricas-server.ts`):

- `roleParaSetor("programacao")` → `"programacao"` (hoje devolve null). Adicionar `"programacao"` ao tipo `Setor`.
- `MetricaCrua` ganha: `prog_crm`, `prog_usuarios`, `prog_sistemas`, `prog_total` (somas de quantidade por tipo + total).
- `resolveMetricaPessoa`: setor `programacao` → `valor = prog_total`, unidade contagem, rótulo `"N entregas"` (plural: "1 entrega"/"N entregas").
- `getProdutividadeSetor` (server): nova query em `lancamentos_programacao` (arquivado_em null, `data` no range, por `colaborador_id`), somando quantidade por tipo → alimenta as MetricaCrua.
- `SETORES_PAINEL` ganha `"programacao"`; `TITULO_SETOR.programacao = "Programação"`; `valorChaveSetor("programacao", p) = p.prog_total`.
- `ProdutividadeSetorSection` `COLUNAS.programacao`: **CRMs · Usuários · Sistemas · Total**.

## Casos de borda

- Tabela `lancamentos_programacao` ausente (migration não aplicada) → query volta vazia, painel/coluna mostram 0 (não quebra).
- Sem clientes ativos → botão "Novo lançamento" desabilitado + aviso.
- Programadora sem lançamentos no período → "0 entregas"; bloco Programação aparece com ela zerada (ou não aparece se ninguém tem setor programacao ativo).
- Escopo: programadora só vê/edita os próprios lançamentos (query filtra); chefia vê todos.

## Testes

- Unit (vitest, `--exclude '**/.claude/**'`):
  - `access.test.ts`: `canAccessProgramacao` (adm/socio/programacao = true; outros = false).
  - Ampliar `setor-metricas.test.ts`: `roleParaSetor("programacao") === "programacao"`; `resolveMetricaPessoa("programacao", null, {prog_total: 12, ...})` → rótulo "12 entregas" / singular "1 entrega".
- UI verificada por type-check/lint (padrão do projeto).

## Arquivos

- **Novos:** migration `..._lancamentos_programacao.sql`; `src/lib/programacao/{tipos,access,schema,actions,queries}.ts` + `access.test.ts`; `src/components/programacao/{LancamentoFormModal,NovoLancamentoButton,LancamentosList}.tsx`; `src/app/(authed)/programacao/page.tsx`.
- **Editados:** `src/lib/produtividade/setor-metricas.ts` (setor + MetricaCrua + resolve), `src/lib/produtividade/setor-metricas-server.ts` (query + agregação + bloco), `src/components/produtividade/ProdutividadeSetorSection.tsx` (COLUNAS.programacao), e o registro do menu.

## Fora de escopo

- Lucro/comissão pra programação (não tem).
- Aba "Painel" própria no /programacao (o painel de produtividade já cobre); a página é só lançamentos.
- Métricas automáticas (o dado é 100% manual, por decisão — não há rastro no sistema).
