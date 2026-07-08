# Módulo E-commerce — Painel de anúncios subidos por assessor

**Data:** 2026-07-08
**Status:** Aprovado (design) — aguardando plano de implementação

## Objetivo

Criar um módulo novo (`/ecommerce`) para o setor de assessoria de e-commerce.
O assessor registra quantos anúncios (listagens de marketplace) subiu para cada
cliente, e a chefia acompanha um painel consolidado de produtividade da equipe.

**Anúncio** aqui = listagem de produto em marketplace (Mercado Livre, Shopee,
Amazon, Magalu). **Não** é anúncio pago de tráfego (isso já é o módulo Tráfego).
Registro é manual, por lote/dia — sem integração com API de marketplace.

## Decisões (do brainstorming)

- Anúncio = listagem de marketplace; lançamento manual.
- Forma de lançamento: **por lote/dia** (cliente + quantidade + data), capturando
  também **marketplace** e **observação**.
- Só aparecem clientes marcados como **e-commerce**.
- **Assessor lança e vê só os próprios números; adm/sócio veem o consolidado de todos.**
- **Papel novo** dedicado: `assessor_ecommerce`.
- Painel da chefia destaca: ranking por assessor, total por cliente, evolução no
  tempo e quebra por marketplace.
- Menu: item **"E-commerce"** dentro do grupo **Operação** (ao lado de Tráfego).
- Sem vínculo fixo assessor↔cliente: qualquer assessor de e-commerce pode lançar
  para qualquer cliente e-commerce. "Ver só o que lançou" = `colaborador_id = ele`.

## Arquitetura

Reaproveita o padrão do módulo **Visitas** (`20260620000000_visitas.sql`):
tabela própria com `organization_id` + `colaborador_id`, RLS permissiva
(`using true`) e a separação por papel feita na **camada de query**, não na RLS.

### 1. Papel novo

- Migration adiciona valor ao enum: `alter type public.user_role add value 'assessor_ecommerce';`
  - **Nota Postgres:** `ADD VALUE` precisa estar commitado antes de ser usado.
    Como as migrations rodam manualmente (SQL Editor) e nenhuma policy referencia
    o valor novo (RLS é `using true`), não há uso do valor na mesma transação.
    Manter o `ADD VALUE` numa migration isolada.
- `src/lib/auth/permissions.ts`:
  - Adicionar `"assessor_ecommerce"` ao tipo `Role`.
  - `ROLE_LABELS.assessor_ecommerce = "Assessor de e-commerce"`.
  - Adicionar entrada no `matrix` (permissões mínimas; sem ações especiais além
    de acesso ao próprio módulo — validar quais actions existentes fazem sentido,
    provavelmente nenhuma das atuais).
- Formulário de colaborador (`/colaboradores/novo` e editar) já lista roles a
  partir de `ROLE_LABELS`/enum — confirmar que o papel novo aparece na seleção.

### 2. Flag de cliente e-commerce

- Migration: `alter table public.clients add column is_ecommerce boolean not null default false;`
  - Índice parcial: `create index idx_clients_is_ecommerce on public.clients(is_ecommerce) where is_ecommerce = true;`
- Toggle **"Cliente de e-commerce"** no formulário de editar cliente
  (`src/app/(authed)/clientes/[id]/editar`). Incluir no fullSelect/whitelist do
  cliente para não quebrar em prod entre deploy e migration (ver aprendizado
  "Fallback do SELECT cobre TODA coluna nova").
- No módulo `/ecommerce`, a lista de clientes para lançamento filtra
  `is_ecommerce = true` (e não arquivados).

### 3. Tabela `anuncios_ecommerce`

```sql
create table if not exists public.anuncios_ecommerce (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  colaborador_id uuid references public.profiles(id) on delete set null,
  data date not null default current_date,
  quantidade integer not null check (quantidade > 0),
  marketplace text not null check (marketplace in
    ('mercado_livre','shopee','amazon','magalu','outro')),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  arquivado_em timestamptz
);

create index if not exists anuncios_ecommerce_org_data_idx
  on public.anuncios_ecommerce(organization_id, data desc) where arquivado_em is null;
create index if not exists anuncios_ecommerce_client_idx
  on public.anuncios_ecommerce(client_id) where arquivado_em is null;
create index if not exists anuncios_ecommerce_colaborador_idx
  on public.anuncios_ecommerce(colaborador_id) where arquivado_em is null;

-- trigger updated_at (public.set_updated_at, igual às outras tabelas)

alter table public.anuncios_ecommerce enable row level security;
create policy anuncios_ecommerce_select on public.anuncios_ecommerce
  for select to authenticated using (true);
create policy anuncios_ecommerce_insert on public.anuncios_ecommerce
  for insert to authenticated with check (true);
create policy anuncios_ecommerce_update on public.anuncios_ecommerce
  for update to authenticated using (true);
```

### 4. Telas — rota `/ecommerce` com abas

Página server component que ramifica por papel.

**Aba "Lançar"** (assessor_ecommerce + adm + socio):
- Botão "Novo lançamento" → modal/form: cliente (só e-commerce), quantidade,
  marketplace, observação (opcional), data (default hoje, editável).
- Lista de lançamentos abaixo:
  - Assessor: apenas os próprios (`colaborador_id = usuário`).
  - Chefia: todos da organização, com filtro por assessor e por período.
- Editar/arquivar o próprio lançamento (chefia pode arquivar qualquer um).
  - Arquivar via soft delete (`arquivado_em`). Lembrar: RLS permissiva torna
    `.update()` silencioso — usar `.select()` e checar length.

**Aba "Painel"** (só adm + socio):
- Filtro de período (default: mês atual).
- KPIs: total de anúncios, nº de clientes atendidos, nº de assessores ativos,
  média/dia.
- **Ranking por assessor** (quem subiu mais no período).
- **Total por cliente**.
- **Evolução no tempo** (por dia ou semana no período).
- **Quebra por marketplace**.

Server actions: criar / editar / arquivar lançamento. Data fetchers para as
agregações do painel.

### 5. Navegação

`src/components/layout/nav-config.ts`: adicionar no grupo `operacao`:
```ts
{ type: "link", href: "/ecommerce", icon: ShoppingCart, label: "E-commerce",
  roles: ["adm", "socio", "assessor_ecommerce"], badgeKey: null }
```

## Fluxo de dados

1. Assessor abre `/ecommerce` → aba "Lançar" → cria registro em
   `anuncios_ecommerce` com `colaborador_id` = ele, `organization_id` da sessão.
2. Query de listagem filtra por papel (assessor: próprio; chefia: org inteira).
3. Aba "Painel" (chefia) roda agregações sobre `anuncios_ecommerce` no período
   selecionado e monta os 4 recortes.

## Componentes e isolamento

- `src/lib/ecommerce/aggregate.ts` — **função pura** que recebe as linhas +
  período e devolve `{ porAssessor, porCliente, porTempo, porMarketplace, kpis }`.
  Testável isoladamente, sem tocar no banco.
- `src/lib/ecommerce/queries.ts` — busca linhas do Supabase (service-role /
  server), aplica filtro por papel.
- `src/lib/ecommerce/actions.ts` — server actions (criar/editar/arquivar).
- Componentes de UI em `src/components/ecommerce/` (form, lista, cards do painel,
  gráficos).

## Tratamento de erros

- Quantidade deve ser inteiro > 0 (check no banco + validação no form).
- `.update()`/arquivar: checar rows afetadas via `.select()` (RLS silenciosa).
- Cliente sem e-commerce não pode ser selecionado (lista já filtrada).
- Papel sem acesso à aba "Painel": aba não renderiza / redireciona.

## Testes

- Unit: `aggregate.ts` — casos com múltiplos assessores/clientes/marketplaces,
  período vazio, período com bordas de data.
- Unit: matriz de permissões incluindo `assessor_ecommerce`
  (`tests/unit/permissions.test.ts`).
- TDD: escrever teste da agregação antes da implementação.

## Fora de escopo (YAGNI)

- Integração automática com API de marketplace (ML/Shopee).
- Um registro por anúncio individual (link/título de produto).
- Vínculo fixo assessor↔cliente.
- Metas/quotas por assessor (pode virar fase 2 se a Yasmin pedir).

## Migrations manuais

As migrations `.sql` (enum do papel, coluna `is_ecommerce`, tabela
`anuncios_ecommerce`) precisam ser aplicadas manualmente no SQL Editor do
Supabase após o merge — a Vercel não roda migrations no deploy.
