-- supabase/migrations/20260508000053_soft_delete_columns.sql
-- Adiciona soft-delete (deleted_at + deleted_by) em clients, leads e tasks.
-- A partir daqui, "excluir" no app vira UPDATE deleted_at=now() em vez de DELETE
-- físico — items ficam recuperáveis via /lixeira por 30 dias.

alter table public.clients
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles(id);

alter table public.leads
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles(id);

alter table public.tasks
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles(id);

-- Índices parciais — só itens deletados, fica leve.
create index idx_clients_deleted_at on public.clients(deleted_at) where deleted_at is not null;
create index idx_leads_deleted_at on public.leads(deleted_at) where deleted_at is not null;
create index idx_tasks_deleted_at on public.tasks(deleted_at) where deleted_at is not null;
