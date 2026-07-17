#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
REF=$(grep -E '^SUPABASE_PROJECT_ID=' .env.local | head -1 | cut -d= -f2- | tr -d '"'"'"' \r')
TOKEN=$(grep -E '^SUPABASE_ACCESS_TOKEN=' .env.local | head -1 | cut -d= -f2- | tr -d '"'"'"' \r')
API="https://api.supabase.com/v1/projects/${REF}/database/query"
run() {
  curl -s -X POST "$API" -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
    --data @- <<JSON
{"query": $(printf '%s' "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}
JSON
  echo
}
echo "=== BACKFILL: cria linha de 2026-07 pros clientes ativos (pacotes com crono) que não têm ==="
run "with ins as (
  insert into public.client_monthly_checklist (client_id, organization_id, mes_referencia)
  select c.id, c.organization_id, '2026-07'
  from public.clients c
  where c.status='ativo'
    and c.tipo_pacote in ('trafego_estrategia','estrategia','audiovisual','yide_360','ecommerce')
    and not exists (select 1 from public.client_monthly_checklist m where m.client_id=c.id and m.mes_referencia='2026-07')
  on conflict (client_id, mes_referencia) do nothing
  returning 1
) select count(*)::int as linhas_criadas from ins;"
echo "=== VERIFY: clientes ativos (com crono) SEM linha de 2026-07 (deve ser 0) ==="
run "select count(*)::int as ainda_sem_linha from public.clients c where c.status='ativo' and c.tipo_pacote in ('trafego_estrategia','estrategia','audiovisual','yide_360','ecommerce') and not exists (select 1 from public.client_monthly_checklist m where m.client_id=c.id and m.mes_referencia='2026-07');"
echo "=== VERIFY: Andre Mansor tem linha de 2026-07 agora? ==="
run "select c.nome, (m.id is not null) as tem_linha_jul from public.clients c left join public.client_monthly_checklist m on m.client_id=c.id and m.mes_referencia='2026-07' where c.nome ilike '%andre mansor%';"
