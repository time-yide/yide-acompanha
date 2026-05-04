-- supabase/migrations/20260504000036_clients_delete_policy.sql
-- Adiciona policy de DELETE em clients (faltava — RLS estava silenciosamente
-- filtrando todo DELETE pra zero rows, fazendo deleteClienteAction parecer
-- que funcionava mas o cliente continuava na tabela).

create policy "adm/socio can delete clients"
  on public.clients for delete to authenticated
  using (current_user_role() = any (array['adm', 'socio']::user_role[]));
