-- supabase/migrations/20260508000054_escritorio_virtual.sql
-- Escritório Virtual: chat interno por setor, com 4 canais fixos cuja
-- membership é determinada pelo role do user (sem tabela separada de
-- membership pra v1). Real-time via Supabase Realtime.

-- 1. Enum dos canais fixos
create type public.chat_channel_kind as enum (
  'assessores_coordenadores',
  'coordenadores_estrategico',
  'audiovisual_geral',
  'designers'
);

-- 2. Tabela de canais
create table public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  kind public.chat_channel_kind not null unique,
  nome text not null,
  descricao text,
  ordem smallint not null default 0,
  created_at timestamptz not null default now()
);

-- 3. Mensagens
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  autor_id uuid not null references public.profiles(id),
  conteudo text not null check (length(conteudo) >= 1 and length(conteudo) <= 4000),
  reply_to_id uuid references public.chat_messages(id) on delete set null,
  attachment_urls text[] not null default '{}',
  mentioned_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index idx_chat_messages_channel on public.chat_messages(channel_id, created_at desc);
create index idx_chat_messages_mentions on public.chat_messages using gin (mentioned_user_ids);
create index idx_chat_messages_autor on public.chat_messages(autor_id);

-- 4. Leituras (pra badge de unread por canal)
create table public.chat_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, channel_id)
);

-- 5. Função de membership por role (1 source of truth, usada pela RLS e pela app)
create or replace function public.can_access_chat_channel(
  p_user_id uuid,
  p_channel_kind public.chat_channel_kind
) returns boolean as $$
declare
  v_role text;
begin
  select role::text into v_role from public.profiles where id = p_user_id and ativo = true;
  if v_role is null then return false; end if;

  return case p_channel_kind
    when 'assessores_coordenadores' then v_role in ('assessor', 'coordenador', 'adm', 'socio')
    when 'coordenadores_estrategico' then v_role in ('coordenador', 'audiovisual_chefe', 'adm', 'socio')
    when 'audiovisual_geral' then v_role in ('videomaker', 'editor', 'audiovisual_chefe', 'adm', 'socio')
    when 'designers' then v_role in ('designer', 'adm', 'socio')
    else false
  end;
end;
$$ language plpgsql security definer stable;

-- 6. Seed dos 4 canais fixos
insert into public.chat_channels (kind, nome, descricao, ordem) values
  ('assessores_coordenadores', 'Assessores + Coordenadores',
    'Alinhamentos gerais de clientes, estratégias, aprovações, cronogramas e demandas operacionais.', 1),
  ('coordenadores_estrategico', 'Coordenadores (estratégico)',
    'Decisões, alinhamentos internos e acompanhamento operacional da agência.', 2),
  ('audiovisual_geral', 'Audiovisual Geral',
    'Gravações, entregas, organização de captação, edições, cronogramas.', 3),
  ('designers', 'Designers',
    'Alinhamentos criativos, aprovações, organização de demandas, feedbacks.', 4);

-- 7. RLS — chat_channels
alter table public.chat_channels enable row level security;
create policy "channels read all authed"
  on public.chat_channels for select to authenticated using (true);

-- 8. RLS — chat_messages
alter table public.chat_messages enable row level security;

create policy "messages read members"
  on public.chat_messages for select to authenticated
  using (
    exists (
      select 1 from public.chat_channels c
      where c.id = channel_id
        and public.can_access_chat_channel(auth.uid(), c.kind)
    )
  );

create policy "messages insert members"
  on public.chat_messages for insert to authenticated
  with check (
    autor_id = auth.uid()
    and exists (
      select 1 from public.chat_channels c
      where c.id = channel_id
        and public.can_access_chat_channel(auth.uid(), c.kind)
    )
  );

create policy "messages update own"
  on public.chat_messages for update to authenticated
  using (autor_id = auth.uid())
  with check (autor_id = auth.uid());

create policy "messages delete own or admin"
  on public.chat_messages for delete to authenticated
  using (autor_id = auth.uid() or public.current_user_role() in ('adm', 'socio'));

-- 9. RLS — chat_reads (cada user gerencia o próprio)
alter table public.chat_reads enable row level security;
create policy "reads select own"
  on public.chat_reads for select to authenticated using (user_id = auth.uid());
create policy "reads upsert own"
  on public.chat_reads for insert to authenticated with check (user_id = auth.uid());
create policy "reads update own"
  on public.chat_reads for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 10. Habilita Realtime na tabela de mensagens (clientes vão subscribe via SDK)
alter publication supabase_realtime add table public.chat_messages;

-- 11. Bucket de Storage pra anexos do chat
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

create policy "chat-attachments read"
  on storage.objects for select to authenticated
  using (bucket_id = 'chat-attachments');

create policy "chat-attachments insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-attachments');

create policy "chat-attachments delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'chat-attachments' and owner = auth.uid());
