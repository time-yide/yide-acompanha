-- Performance do painel "14 Batidas" (/batidas).
--
-- A montagem da cadência (src/lib/batidas/queries.ts) busca, por org, todos os
-- leads/leads_gerados e então filtra lead_attempts e ligacoes por
-- .in(lead_gerado_id, [...]) / .in(lead_id, [...]). leads_gerados e
-- lead_attempts já têm os índices certos, mas faltavam estes:
--
--  1) ligacoes(lead_gerado_id) e ligacoes(lead_id): FKs não são indexadas
--     automaticamente no Postgres. Sem isso, fetchLigacoes faz seq scan da
--     tabela ligacoes inteira (que cresce a cada ligação) duas vezes por
--     carregamento da página.
--  2) leads(organization_id): pra roles que veem tudo (sócio/adm/coordenador),
--     a query de leads filtra só por organization_id, sem índice -> seq scan.
--
-- Índices parciais em ligacoes batem com o filtro `arquivado_em is null` usado
-- na query. `if not exists` deixa a migration idempotente.

create index if not exists ligacoes_lead_gerado_idx
  on public.ligacoes(lead_gerado_id)
  where arquivado_em is null;

create index if not exists ligacoes_lead_idx
  on public.ligacoes(lead_id)
  where arquivado_em is null;

create index if not exists leads_org_idx
  on public.leads(organization_id);
