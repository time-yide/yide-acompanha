-- Unidades por cliente — pra clientes multi-localização (ex: Gallo com 70+
-- unidades) terem registro estruturado das filiais/lojas/restaurantes.
--
-- Fase 1: só cadastro + listagem no painel do cliente. Em fase futura,
-- captações/posts/tarefas vão poder ser tagueadas por unidade pra filtros
-- por localização.

create table public.client_units (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  nome text not null,
  endereco text,
  /** Drive/pasta dessa unidade especificamente, pra cliente acessar conteúdo
      organizado por localização. Opcional. */
  drive_url text,
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_client_units_client on public.client_units(client_id);
create index idx_client_units_ativo on public.client_units(ativo) where ativo;

create trigger trg_client_units_updated_at
  before update on public.client_units
  for each row execute function public.set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.client_units enable row level security;

-- SELECT: equipe interna (adm/socio/coord/assessor/audiovisual/designer/editor/videomaker)
-- vê tudo. Cliente do portal vê unidades do próprio cliente_id.
create policy "client_units select"
  on public.client_units for select to authenticated
  using (
    public.current_user_role() in (
      'adm', 'socio', 'coordenador', 'assessor', 'audiovisual_chefe',
      'videomaker', 'designer', 'editor', 'comercial'
    )
    or client_id in (
      select client_id from public.client_portal_users
      where user_id = auth.uid() and ativo = true
    )
  );

-- INSERT/UPDATE/DELETE: adm/sócio/coordenador/assessor (gestão operacional).
-- Portal user NÃO escreve.
create policy "client_units insert"
  on public.client_units for insert to authenticated
  with check (public.current_user_role() in ('adm', 'socio', 'coordenador', 'assessor'));

create policy "client_units update"
  on public.client_units for update to authenticated
  using (public.current_user_role() in ('adm', 'socio', 'coordenador', 'assessor'))
  with check (public.current_user_role() in ('adm', 'socio', 'coordenador', 'assessor'));

create policy "client_units delete"
  on public.client_units for delete to authenticated
  using (public.current_user_role() in ('adm', 'socio', 'coordenador', 'assessor'));

comment on table public.client_units is
  'Unidades/filiais/lojas de um cliente — pra registrar estrutura multi-'
  'localização. Fase 1: cadastro + listagem. Fase futura: tag em '
  'capturas/posts/tarefas pra filtros.';
