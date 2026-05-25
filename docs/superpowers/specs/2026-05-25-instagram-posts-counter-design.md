# Contagem de posts do Instagram no dashboard — design

**Data:** 2026-05-25
**Branch alvo:** `claude/instagram-posts-counter`

## Problema

Hoje, sócios e assessores não têm visibilidade de quantos posts cada cliente vem publicando no Instagram. A informação é importante pra acompanhar produtividade, conferir entrega do pacote e detectar clientes que estão atrasados em publicação. Não dá pra usar a Meta Graph API (cadastro chato, aprovação demorada).

## Objetivo

Adicionar no dashboard do **sócio** e do **assessor** uma seção que mostra, por cliente da carteira, **quantos posts no Instagram foram publicados hoje, nesta semana e neste mês**, com atualização automática diária (00:00 BRT/Cuiabá) e botão "Atualizar agora" sob demanda.

## Não-objetivo

- Postar pelo sistema (módulo `social-media` já existe pra isso, fora de escopo)
- Stories (somem em 24h, scraping menos confiável)
- Métricas de engajamento (likes/comentários) — só contagem por enquanto
- Outros assessores que não o logado verem carteira alheia (sócio sim, assessor não)
- Análise por IA — apenas contagem agregada
- Histórico longo de evolução (será só "última semana × penúltima semana" no v2)

## Arquitetura

### Reuso

| Componente | Origem | Como usa |
|-----------|--------|---------|
| Apify integration | `src/lib/gerador-leads/services/` (Apify já usado pra scraping de IG de leads) | Reusa cliente HTTP/credenciais |
| `clients.instagram_url` | já existe | URL do perfil. Cliente sem URL aparece como "—" |
| Vercel cron | `src/app/api/cron/*` | Adiciona novo endpoint diário |
| `current_user_unit_id()` RLS helper | já existe | Filtra por unidade |
| Dashboard sócio/adm e assessor | `src/components/dashboard/Dashboard*` | Adiciona seção nova |

### Novo

```
src/
├── lib/instagram-snapshots/
│   ├── tipos.ts            # Snapshot, PostRecente, ScrapeStatus, CountsBucket
│   ├── scraper.ts          # SERVER-ONLY. fetchProfileSnapshot(url) → chama Apify
│   ├── counts.ts           # Pura: countPostsInWindow(posts, window) → 3 cortes
│   ├── queries.ts          # listSnapshotsParaDashboard, getUltimoSnapshot
│   └── actions.ts          # refreshSnapshotsAction (1 ou N clientes)
│
├── app/api/cron/instagram-snapshots/route.ts   # Cron diário 00:00 BRT
│
├── components/dashboard/
│   └── InstagramPostsCard.tsx                  # Card com tabela
│
└── components/dashboard/{DashboardSocioAdm,DashboardAssessor}.tsx   # MODIFICAR: incluir o card

supabase/migrations/
└── 20260609000000_client_instagram_snapshots.sql
```

### Diagrama de dados

```
clients (instagram_url)
   │ 1
   ▼ N
client_instagram_snapshots
   • scraped_at
   • total_posts (do perfil)
   • recent_posts JSONB (até 50 posts recentes: url, timestamp, type)
   • scrape_status: 'ok' | 'profile_not_found' | 'rate_limit' | 'error'
```

A tabela só guarda **snapshots históricos**. As contagens (hoje/semana/mês) são derivadas em runtime filtrando `recent_posts` por timestamp.

### Como funciona a contagem

Apify retorna lista dos ~30-50 posts mais recentes do perfil. Cada post tem `timestamp` ISO. Pra calcular:

- **Hoje**: posts com `timestamp >= startOfDayCuiaba(now)`
- **Esta semana**: posts com `timestamp >= startOfWeekCuiaba(now)` (semana começa segunda)
- **Este mês**: posts com `timestamp >= startOfMonthCuiaba(now)`

Como a janela máxima é ~30 dias e Apify retorna ~50 posts, cobre folgado. Pra contas com >50 posts/mês (raro), perdemos posts antigos — aceito na v1.

## Schema

```sql
create table public.client_instagram_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),

  scraped_at timestamptz not null default now(),

  /** Total de posts no perfil (vem direto do Apify). Pode ser null se scrape falhou. */
  total_posts int,

  /**
   * Lista de até ~50 posts mais recentes. Cada item:
   *   { url, timestamp, type: 'feed' | 'reel' }
   * Vazio se conta privada / scrape falhou.
   */
  recent_posts jsonb not null default '[]'::jsonb,

  scrape_status text not null
    check (scrape_status in ('ok', 'profile_not_found', 'rate_limit', 'error', 'no_url')),

  /** Mensagem de erro quando scrape_status != 'ok'. */
  erro text,

  /** Quem disparou: 'cron' | userId (server action manual). */
  triggered_by text not null,

  created_at timestamptz default now()
);

create index idx_client_instagram_snapshots_client_recent
  on public.client_instagram_snapshots (client_id, scraped_at desc);

-- RLS
alter table public.client_instagram_snapshots enable row level security;

-- Leitura: socio/adm/coordenador tudo (filtro unit_id é feito na query);
-- assessor/comercial só dos clientes da própria unit; cliente do portal NUNCA.
create policy "ig_snapshots select equipe"
  on public.client_instagram_snapshots for select to authenticated
  using (
    public.current_user_role() in ('socio', 'adm', 'coordenador', 'assessor', 'comercial')
  );

-- Insert/update: só via service-role (server actions e cron).
create policy "ig_snapshots write service only"
  on public.client_instagram_snapshots for all to authenticated
  using (false) with check (false);

comment on table public.client_instagram_snapshots is
  'Snapshots periódicos do perfil do Instagram do cliente via scraping Apify. '
  'Usado pra contagem de posts no dashboard.';
```

## Fluxo

### 1. Cron diário (00:00 Cuiabá = 04:00 UTC)

`POST /api/cron/instagram-snapshots` (Vercel cron):
1. Lista todos `clients` ativos com `instagram_url IS NOT NULL`
2. Pra cada um, chama `fetchProfileSnapshot(url)` em batch de 5 paralelos (rate limit)
3. Insere linha em `client_instagram_snapshots` com `triggered_by='cron'`
4. Se cliente já tem snapshot há < 6h, pula (idempotência se cron disparar 2x)
5. Erro de scraping vira snapshot com `scrape_status` apropriado e `recent_posts: []` (não bloqueia outros)

### 2. Atualização sob demanda

Botão "Atualizar contagens" no dashboard chama `refreshSnapshotsAction(clientIds)`:
- Sócio: passa todos os clientes da unidade ativa (até 108)
- Assessor: passa só os onde `assessor_id = self`
- **Cache de 1h**: se já tem snapshot há < 1h pra um client, **pula** (não bate no Apify)
- Retorna `{ refreshed: 8, cached: 100, errors: 0 }`

Também tem botão "Atualizar este cliente" por linha, com **cache de 5 min**.

### 3. Dashboard mostra

`InstagramPostsCard` busca `getUltimosSnapshots(clienteIds)` e calcula in-memory:
- Coluna **Hoje**: posts onde `timestamp >= startOfDayCuiaba(now)`
- Coluna **Semana**: posts onde `timestamp >= startOfWeekCuiaba(now)` (segunda)
- Coluna **Mês**: posts onde `timestamp >= startOfMonthCuiaba(now)`
- Coluna **Última atualização**: relative time desde `scraped_at`
- Linha clicável: leva pra `/clientes/[id]` (página do cliente)

Status visual:
- `scrape_status='ok'`: mostra contagens
- `scrape_status='profile_not_found'`: badge "Perfil não encontrado" + link "Editar URL"
- `scrape_status='rate_limit'`: badge "Tente em 5min"
- `scrape_status='error'`: badge "Erro" com tooltip da mensagem
- `scrape_status='no_url'` (cliente sem `instagram_url`): badge "Sem perfil" + link "Cadastrar"

## Integração Apify

Actor: `apify/instagram-profile-scraper` (já documentado em código existente do gerador de leads).

Input do actor:
```json
{
  "usernames": ["clientex"],
  "resultsLimit": 50,
  "addParentData": false
}
```

Output relevante por perfil:
```json
{
  "username": "clientex",
  "postsCount": 234,
  "latestPosts": [
    {
      "url": "https://www.instagram.com/p/abc123/",
      "timestamp": "2026-05-24T18:33:00.000Z",
      "type": "Image"  // ou "Video", "Sidecar" (carrossel)
    },
    // ...
  ]
}
```

Mapeamento de `type` Apify → nosso `type`:
- `"Image"` → `"feed"`
- `"Sidecar"` → `"feed"` (carrossel)
- `"Video"` → quando `productType="clips"` → `"reel"`, senão `"feed"`

## Permissões

- Apenas roles `socio`, `adm`, `coordenador`, `assessor` veem o card
- Comercial NÃO vê (não tem clientes)
- Cliente do portal não tem acesso (snapshot é interno)

## Custos estimados

Apify Instagram Profile Scraper: ~$2,30/1000 perfis raspados.

- Cron: 108 clientes × 30 dias = 3.240 scrapes/mês
- Manual com cache 1h: ~1.200 scrapes/mês
- **Total: ~4.500/mês × $0,0023 = ~$10/mês ≈ R$ 60/mês**

Free tier Apify: $5/mês. Estouro: R$ 30 reais pagos.

## Edge cases

| Cenário | Tratamento |
|---------|-----------|
| Cliente sem `instagram_url` | Snapshot virtual `scrape_status='no_url'` injetado na query (não scrapeia) |
| Perfil privado | `scrape_status='profile_not_found'`, contagens = 0, alert pro assessor |
| Apify rate limit | Mantém último snapshot OK, mostra "Tente em 5min" |
| Apify timeout/network | `scrape_status='error'`, mantém último snapshot bom |
| Cron rodando enquanto user aperta manual | Cache 1h evita dupla execução |
| Cliente sem nenhum snapshot ainda | Tabela mostra `—` em hoje/semana/mês + link "Buscar agora" |

## Testes

- `tests/unit/instagram-snapshots-counts.test.ts` — countPostsInWindow com várias janelas e datas BRT/Cuiabá
- `tests/unit/instagram-snapshots-actions.test.ts` — refresh action: idempotência, cache, RLS-by-role
- `tests/unit/instagram-snapshots-scraper.test.ts` — mapeamento Apify → tipos internos, casos de erro
- `tests/integration/instagram-snapshots-cron.test.ts` — endpoint cron: skips, paralelismo, falhas isoladas

E2E manual: cadastrar `instagram_url` em 2 clientes, esperar cron rodar ou apertar "atualizar agora", conferir contagens batem com o perfil real.

## Migração de dados

Nenhuma. Tabela nova. Snapshots vão sendo criados a partir do primeiro cron / primeiro manual.

## Rollout

PR único — feature isolada, sem flag. Migration manual no Supabase após merge (padrão do projeto). Configurar `APIFY_API_TOKEN` (já existe) + adicionar cron no `vercel.json`.

## Decisões fechadas durante o brainstorming

- Fonte: scraping via Apify (sem Meta Graph API)
- Frequência: cron diário 00:00 BRT + botão sob demanda
- Tipos de post: feed + reels (stories fora)
- Granularidade: 3 cortes simultâneos (hoje/semana/mês)
- Cache: 1h (refresh em massa), 5min (refresh individual)
- Escopo por role: sócio vê todos da unidade, assessor vê os próprios
- Sem IA, sem análise, só contagem
