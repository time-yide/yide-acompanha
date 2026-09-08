-- Adds porte_empresa (from CNPJa), num_funcionarios and faturamento_anual
-- (manual entry) to leads_gerados, enabling search/filter by company profile.

alter table leads_gerados
  add column if not exists porte_empresa text
    check (porte_empresa in ('MEI','ME','EPP','DEMAIS')),
  add column if not exists num_funcionarios integer
    check (num_funcionarios is null or num_funcionarios >= 0),
  add column if not exists faturamento_anual numeric(15,2)
    check (faturamento_anual is null or faturamento_anual >= 0);

create index if not exists idx_leads_gerados_porte
  on leads_gerados (porte_empresa)
  where arquivado_em is null and porte_empresa is not null;
