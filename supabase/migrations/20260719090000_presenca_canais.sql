-- Presença da Yide: amplia os canais de 2 (gmn/linkedin) para 9.
-- Novos: instagram, tiktok, youtube, threads, facebook, pinterest, medium.
-- As CHECKs originais eram inline sem nome; o Postgres as nomeou automaticamente
-- presenca_posts_canal_check / presenca_checklist_canal_check. Removemos qualquer
-- check em "canal" e recriamos nomeada com os 9 valores.

-- presenca_posts
alter table public.presenca_posts drop constraint if exists presenca_posts_canal_check;
do $$
begin
  alter table public.presenca_posts
    add constraint presenca_posts_canal_check
    check (canal in ('gmn','linkedin','instagram','tiktok','youtube','threads','facebook','pinterest','medium'));
exception when duplicate_object then null;
end $$;

-- presenca_checklist
alter table public.presenca_checklist drop constraint if exists presenca_checklist_canal_check;
do $$
begin
  alter table public.presenca_checklist
    add constraint presenca_checklist_canal_check
    check (canal in ('gmn','linkedin','instagram','tiktok','youtube','threads','facebook','pinterest','medium'));
exception when duplicate_object then null;
end $$;
