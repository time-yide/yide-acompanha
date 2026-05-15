-- Solicitações abertas pelo cliente via portal /cliente. Cliente abre,
-- equipe interna responde/resolve. Mais organizado que receber tudo no
-- WhatsApp.
--
-- Decisão produto (Yasmin): MVP sem comments multi-thread — 1 ação inicial
-- do cliente + 1 resposta do time + 1 resolução final. Suficiente pra
-- maioria dos casos. Comments podem vir em fase 2 se necessário.

create type public.portal_request_categoria as enum (
  'alteracao',  -- alteração em arte/vídeo já feito
  'trafego',    -- pedido de tráfego/campanha
  'reuniao',    -- agendar reunião / dúvida sobre estratégia
  'duvida',     -- dúvida geral
  'outro'
);

create type public.portal_request_status as enum (
  'aberta',         -- cliente acabou de abrir
  'em_andamento',   -- time tá trabalhando
  'concluida',      -- resolvida
  'cancelada'       -- cliente desistiu OU time inviabilizou
);

create type public.portal_request_prioridade as enum (
  'normal',
  'urgente'
);

create table public.client_portal_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  /** Quem criou (portal user). Null se o user foi excluído depois. */
  created_by_user_id uuid references auth.users(id) on delete set null,
  /** Snapshot do nome do contato na hora da criação. Persistente. */
  created_by_nome text,
  titulo text not null,
  descricao text not null,
  categoria public.portal_request_categoria not null default 'outro',
  status public.portal_request_status not null default 'aberta',
  prioridade public.portal_request_prioridade not null default 'normal',
  /** Resposta do time (uma só por MVP). */
  resposta text,
  /** Quem respondeu/resolveu (colab interno). */
  resolvido_por uuid references public.profiles(id) on delete set null,
  resolvido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_client_portal_requests_client on public.client_portal_requests(client_id);
create index idx_client_portal_requests_status on public.client_portal_requests(status) where status in ('aberta', 'em_andamento');
create index idx_client_portal_requests_created on public.client_portal_requests(created_at desc);

create trigger trg_client_portal_requests_updated_at
  before update on public.client_portal_requests
  for each row execute function public.set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.client_portal_requests enable row level security;

-- SELECT: cliente portal lê só do seu client_id; equipe interna lê tudo
create policy "portal_requests select"
  on public.client_portal_requests for select to authenticated
  using (
    public.current_user_role() in (
      'adm', 'socio', 'coordenador', 'assessor', 'audiovisual_chefe'
    )
    or client_id in (
      select client_id from public.client_portal_users
      where user_id = auth.uid() and ativo = true
    )
  );

-- INSERT: cliente portal cria solicitação só pro seu client_id
create policy "portal_requests insert from portal"
  on public.client_portal_requests for insert to authenticated
  with check (
    client_id in (
      select client_id from public.client_portal_users
      where user_id = auth.uid() and ativo = true
    )
    and created_by_user_id = auth.uid()
  );

-- UPDATE: equipe interna (responder, mudar status). Portal user NÃO edita.
create policy "portal_requests update internal"
  on public.client_portal_requests for update to authenticated
  using (
    public.current_user_role() in (
      'adm', 'socio', 'coordenador', 'assessor', 'audiovisual_chefe'
    )
  )
  with check (
    public.current_user_role() in (
      'adm', 'socio', 'coordenador', 'assessor', 'audiovisual_chefe'
    )
  );

-- Portal user pode CANCELAR a própria request enquanto status='aberta'
create policy "portal_requests cancel from portal"
  on public.client_portal_requests for update to authenticated
  using (
    created_by_user_id = auth.uid()
    and status = 'aberta'
  )
  with check (
    created_by_user_id = auth.uid()
    and status = 'cancelada'
  );

-- DELETE: só adm/sócio (hard delete raro — preferir cancelar)
create policy "portal_requests delete admin"
  on public.client_portal_requests for delete to authenticated
  using (public.current_user_role() in ('adm', 'socio'));

comment on table public.client_portal_requests is
  'Solicitações abertas pelo cliente via portal /cliente. Pra organizar '
  'pedidos (alterações, tráfego, reuniões, etc) em vez de WhatsApp.';
