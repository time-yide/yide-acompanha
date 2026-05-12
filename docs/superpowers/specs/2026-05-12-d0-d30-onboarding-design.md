# D0 → D30 — Onboarding estruturado do cliente novo

> Acompanhamento dos primeiros 30 dias após `clients.data_entrada`. Pré-cliente continua em `/onboarding` (kanban). Após `data_entrada`, este módulo assume.

## Decisões fechadas com Yasmin

- **Auto-trigger:** quando cliente vira `status = 'ativo'` → auto-cria as 9 etapas com template padrão. D0 = `data_entrada`.
- **Manual add:** botão "Adicionar cliente" em `/d0-d30` que abre modal pra escolher cliente + data D0 customizada (pra backdate clientes que entraram antes de cadastrar).
- **Itens de fluxo/saída**: literais como Yasmin mandou.
- **"Kickoff"** → renomeado pra **"Reunião marco zero"** em todos os lugares.

## Template das 9 etapas

| # | Codigo | Nome | Dias previstos | Responsável típico |
|---|---|---|---|---|
| 1 | `entrada` | Entrada do lead | D0–D2 | Comercial |
| 2 | `cadastro` | Cadastro e organização | D3–D4 | Central de relacionamento (ADM) |
| 3 | `marco_zero` | Reunião marco zero + estratégia | D5–D7 | Coordenador + Assessor |
| 4 | `trafego` | Tráfego + estratégia | D7–D12 | Assessor |
| 5 | `producao` | Planejamento e produção | D13–D23 | Coordenador + Time operacional |
| 6 | `apresentacao` | Apresentação ao cliente | D24–D26 | Assessor |
| 7 | `publicacao` | Publicação + tráfego | D30 | Assessor |
| 8 | `monitoramento` | Monitoramento e otimização | Contínuo (pós D30) | Assessor |
| 9 | `relacionamento` | Relacionamento contínuo | Contínuo (desde D5) | Coordenador + Assessor |

Itens de **fluxo** e **saídas obrigatórias** ficam num arquivo `src/lib/d0-d30/template.ts` exportado como const tipada. Quando cliente novo vira ativo, esses items são copiados pra `fluxo_checklist` e `saidas_checklist` (JSONB) da instância dele.

## Schema

```sql
create table public.client_onboarding_etapas (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  etapa_numero smallint not null check (etapa_numero between 1 and 9),
  etapa_codigo text not null,
  status text not null default 'pendente' check (status in ('pendente', 'em_progresso', 'concluido')),
  dia_inicio_previsto smallint,           -- D0/D3/D5/...; null pra contínuas
  dia_fim_previsto smallint,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  concluido_por uuid references public.profiles(id),
  observacoes text,
  fluxo_checklist jsonb not null default '[]',     -- [{label, done, done_by, done_at}]
  saidas_checklist jsonb not null default '[]',    -- [{label, done, done_by, done_at}]
  d0_date date not null,                            -- data que conta como D0 (= clients.data_entrada por padrão, customizável no manual add)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, etapa_codigo)
);
```

Status **atrasado** não é coluna — é computado em runtime: `status != 'concluido' AND today > d0_date + dia_fim_previsto`.

## Auto-trigger

Função `public.seed_client_onboarding_etapas(client_id, d0_date)` que insere as 9 etapas com itens template (vindo de constantes hard-coded no SQL).

Trigger `trg_seed_onboarding_on_ativo`:
- AFTER UPDATE ON clients
- WHEN OLD.status != 'ativo' AND NEW.status = 'ativo'
- Chama `seed_client_onboarding_etapas(NEW.id, NEW.data_entrada)` **se ainda não tem etapas criadas** (idempotente)

Trigger AFTER INSERT ON clients também, se já criar como ativo direto.

## Telas

### `/d0-d30` — lista

Linha por cliente com:
- Nome
- Dia atual (D7, D15, D30+)
- Etapa atual (em progresso ou próxima pendente)
- Progresso (X/Y itens concluídos das etapas D0-D30, ignorando 8/9 contínuas)
- Responsável principal (assessor + coordenador)
- Status semáforo: 🟢 no prazo / 🟡 atenção / 🔴 atrasado

Filtros: Todos / No prazo / Atenção / Atrasados / Por responsável.

Botão **"+ Adicionar cliente"** → modal:
- Select de clientes ativos que ainda **não** têm onboarding criado
- Date input pra D0 (default = `data_entrada`, mas editável)
- Botão "Criar onboarding"

### `/d0-d30/[id]` — detalhe

Header com nome do cliente + dia atual + barra de progresso.

Timeline horizontal das **etapas 1-7** com cores por status:

```
D0  D2  D4  D7  D12  D23  D26  D30
1 ────● 2 ────● 3 ────○ 4 ────○ 5 ────○ 6 ────○ 7
✅      ✅      ⏳        ⏳        ⏳        ⏳        ⏳
```

Cards expansíveis por etapa (1 a 9):
- Nome + dias previstos + responsáveis (com avatars dos profiles)
- Status badge
- **Fluxo** (checklist) — clica pra marcar feito (registra quem + quando)
- **Saídas obrigatórias** (checklist)
- Observações (textarea)
- Botão "Marcar etapa como concluída" (libera só se todos os itens de saída estão feitos)

Etapas 8 e 9 ficam em seção separada "Contínuas" no fim, sem timeline.

## Permissões

- **Sócio/adm**: vê e edita todos
- **Coordenador**: vê e edita todos
- **Assessor/comercial**: vê apenas clientes onde tem responsabilidade (assessor_id ou coordenador_id), pode editar
- **Outros roles** (videomaker/designer/editor): vê apenas, sem edição

## Nav

Novo item em Operação: **"D0 → D30"** com ícone `Rocket` ou `CalendarClock`. Visível pra adm, socio, coordenador, assessor, comercial.

## Fora do escopo (futuro)

- Customização de template por organização (hoje é fixo)
- Notificações automáticas quando etapa fica atrasada
- Histórico de mudanças por etapa (audit log integrado)
- Templates por tipo de pacote
