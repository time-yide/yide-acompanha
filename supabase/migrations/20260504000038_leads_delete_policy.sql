-- supabase/migrations/20260504000038_leads_delete_policy.sql
-- Adiciona policy de DELETE em leads (faltava — mesmo bug do migration 36
-- com clients). Sem policy o RLS bloqueava silenciosamente todo DELETE,
-- fazendo deleteLeadAction retornar "lead não foi removido".
--
-- Permissão espelha a verificação no action (src/lib/leads/actions.ts):
-- sócio OU criador do lead (comercial_id = auth.uid()).

create policy "socio or creator can delete leads"
  on public.leads for delete to authenticated
  using (
    current_user_role() = 'socio'::user_role
    or comercial_id = auth.uid()
  );
