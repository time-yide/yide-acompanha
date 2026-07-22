-- Quando true, os resultados AGREGADOS (sem nomes) da pesquisa ficam visíveis pro
-- time todo. Default false = só a gestão (manage:pesquisas) vê, como hoje.
alter table public.pesquisas
  add column if not exists resultados_publicos boolean not null default false;
