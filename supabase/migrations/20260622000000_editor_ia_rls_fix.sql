-- supabase/migrations/20260622000000_editor_ia_rls_fix.sql
-- Aperta RLS da editor_ia_jobs: leitura escopada por organização; escrita só
-- via service-role (actions/worker). Substitui as policies abertas do PR1.

drop policy if exists editor_ia_jobs_select on public.editor_ia_jobs;
drop policy if exists editor_ia_jobs_insert on public.editor_ia_jobs;
drop policy if exists editor_ia_jobs_update on public.editor_ia_jobs;

create policy editor_ia_jobs_select on public.editor_ia_jobs
  for select to authenticated using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  );
-- INSERT/UPDATE: negados pra JWT de usuário; só service-role (que bypassa RLS) escreve.
create policy editor_ia_jobs_insert_denied on public.editor_ia_jobs
  for insert to authenticated with check (false);
create policy editor_ia_jobs_update_denied on public.editor_ia_jobs
  for update to authenticated using (false);
