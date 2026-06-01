# Comercial: Ligação / Rua + módulo Visitas

**Data:** 2026-05-31
**Branch:** `feat/comercial-visitas` (base `origin/main`)

## Objetivo

1. Dividir o grupo de menu **"Comercial"** em dois: **Comercial Ligação** (os módulos atuais) e **Comercial Rua** (novo).
2. Criar o módulo **Visitas** (Comercial Rua): registrar visitas de rua e, dentro de cada uma, os leads conseguidos — integrados ao Gerador de Leads.

## Decisões (alinhadas)
- Menu: **2 grupos** lado a lado (o nav suporta grupo→itens, 2 níveis — não aninhado).
  - **Comercial Ligação**: Ligações, Onboarding, Gerador de Leads, Conversas.
  - **Comercial Rua**: Visitas.
- Leads da visita = registros em `leads_gerados` com `fonte='visita'` + `visita_id` (integrado ao pipeline: status, botão Ligar, aparece no Gerador de Leads filtrando por origem visita).
- Papéis: mesmos do Comercial hoje (adm/socio/comercial/coordenador/assessor).
- Visita **sem status** (mantém simples).

## Menu (nav-config.ts)
Substituir o grupo `id: "comercial"` por dois grupos:
- `id: "comercial-ligacao"`, label **"Comercial Ligação"**, items: Ligações (`/ligacoes`), Onboarding (`/onboarding`), Gerador de Leads (`/gerador-leads`), Conversas (`/conversas`).
- `id: "comercial-rua"`, label **"Comercial Rua"**, items: Visitas (`/visitas`).

Ícone de Visitas: `MapPin` (ou `Footprints`/`Map` do lucide). Mesmos `roles`.

## Módulo Visitas

### Rotas
- `src/app/(authed)/visitas/page.tsx` — lista de visitas + KPI simples (total de visitas, total de leads de rua) + botão "Nova visita".
- `src/app/(authed)/visitas/[id]/page.tsx` — detalhe da visita: dados da visita + lista dos leads conseguidos + botão "Adicionar lead".

### Lib (`src/lib/visitas/`)
- `tipos.ts` — tipos/constantes (ex.: nada de enum de status por ora).
- `schema.ts` — Zod: `criarVisitaSchema`, `updateVisitaSchema`, `adicionarLeadVisitaSchema`, `arquivarVisitaSchema`.
- `queries.ts` — `listVisitas(orgId)` (com contagem de leads), `getVisita(orgId, id)`.
- `actions.ts` — `criarVisitaAction`, `updateVisitaAction`, `arquivarVisitaAction`, `adicionarLeadVisitaAction`.

### Componentes (`src/components/visitas/`)
- `VisitasTable.tsx` (ou cards) — lista de visitas.
- `NovaVisitaButton.tsx` — modal de criar/editar visita.
- `AdicionarLeadVisitaButton.tsx` — modal de adicionar lead à visita (empresa, telefone, whatsapp, contato, observação).
- Para listar os leads da visita: **reusar `LeadsTable` + `LeadActions`** do Gerador de Leads (já trazem status, botão Ligar etc.).

## Modelo de dados (1 migration)

`supabase/migrations/20260620000000_visitas.sql`:

1. Tabela `visitas`:
   - `id uuid pk default gen_random_uuid()`
   - `organization_id uuid not null references organizations(id) on delete cascade`
   - `colaborador_id uuid references profiles(id) on delete set null` (quem fez a visita)
   - `data date not null`
   - `titulo text not null` (ex.: "Centro - manhã")
   - `bairro text`, `cidade text`
   - `observacoes text`
   - `created_at timestamptz default now()`, `updated_at timestamptz default now()`, `arquivado_em timestamptz`
   - índices por `(organization_id, data desc)` e `colaborador_id`; trigger `set_updated_at`; RLS `authenticated` select/insert/update (padrão do projeto, igual `ligacoes`).

2. `leads_gerados`:
   - `add column if not exists visita_id uuid references public.visitas(id) on delete set null`
   - índice `(visita_id)`
   - atualizar o `check` de `fonte` para incluir `'visita'` (hoje: `outscraper, apify, manual`).

> A migration é aplicada manualmente no Supabase após o merge (padrão do projeto).

## Integração com Gerador de Leads
- `LeadGeradoRow` + `listLeadsGerados`: adicionar `visita_id` ao SELECT e à interface; adicionar filtro opcional `visitaId` (pra o detalhe da visita listar só os leads dela). Bumpar a cache key se a listagem usar `unstable_cache` e o shape mudar.
- `adicionarLeadVisitaAction`: insere em `leads_gerados` com `organization_id`, `empresa`, `telefone`, `whatsapp`, `decisor_nome` (contato), `observacoes`, `status='novo'`, `fonte='visita'`, `visita_id`, `responsavel_id = actor.id`.
- (Opcional, fácil) No Gerador de Leads, permitir filtrar por origem "visita" — fora do MVP, só se sobrar.

## Testes
- Unit (Vitest): schemas (`criarVisitaSchema` aceita data+titulo, rejeita sem; `adicionarLeadVisitaSchema` aceita empresa+algum contato).
- Type-check + lint. Sem teste E2E.

## Fora de escopo (YAGNI)
- Status/etapas da visita; geolocalização/mapa; rota planejada.
- Conversão automática de lead de visita em cliente (usa o pipeline existente).
- Filtro "origem visita" no Gerador de Leads (opcional, depois).

## Riscos / atenção
- **Fallback do SELECT**: ao adicionar `visita_id` ao SELECT de `listLeadsGerados`, garantir que a migration esteja aplicada antes do deploy (ou o SELECT falha). Como migration é manual pós-merge, aplicar logo após o merge. Se houver catch de fallback com whitelist de colunas, incluir `visita_id`.
- **Cache key**: bumpar se `listLeadsGerados`/lista de visitas usar `unstable_cache` e o shape mudar.
- Menu: trocar o `id` do grupo muda a preferência aberto/fechado salva (localStorage) — aceitável (grupos novos começam abertos).
