# Relatórios de Tráfego Pago com identidade Yide — design

**Data:** 2026-05-25
**Branch alvo:** `claude/relatorios-trafego-yide` (a criar)

## Problema

Hoje a Yide não tem como entregar relatórios de tráfego pago pro cliente final com identidade visual da agência. Os assessores extraem números da Meta manualmente e montam apresentações ad-hoc — inconsistência visual, retrabalho e sem histórico no sistema.

## Objetivo

Gerar PDFs de relatório mensal (período customizável) com identidade Yide, narrativa escrita por IA em cima dos números reais, distribuídos via download direto pelo assessor e via portal do cliente.

## Não-objetivo

- Relatório interno pra equipe (sócio/coord acompanharem). Foco é cliente final.
- Geração automática agendada (cron). Sempre sob demanda do assessor.
- Edição visual avançada (mover blocos, mudar cor). Templates fixos.
- Outras plataformas (Google Ads, TikTok). Só Meta na v1.

## Arquitetura

### Reuso

| Componente | Origem | Como usa |
|------------|--------|----------|
| Templates de slide | `src/lib/apresenta-yide/tipos.ts` | Reusa `capa`, `conteudo`, `metrica`, `duas_colunas`, `topicos_numerados`, `encerramento` |
| Pipeline PDF | `src/lib/apresenta-yide/pdf-generator.ts` + `src/app/apresenta-yide-pdf/[id]` | Cria nova rota pública gêmea + chama mesmo `generatePdfFromUrl` |
| HMAC token | `src/lib/apresenta-yide/pdf-token.ts` | Reusa pra autorizar Puppeteer |
| Stream-parser IA | `src/lib/apresenta-yide/stream-parser.ts` | Reusa — JSON streaming já testado |
| Anthropic SDK | já instalado | Mesmo padrão de prompt + streaming |
| Sync Meta API | `src/lib/trafego/meta-api.ts`, `meta-sync.ts` | Chama pra puxar métricas do período |
| Portal cliente | `src/app/(portal-cliente)/portal/...` | Adiciona aba "Relatórios" |

### Novo

```
src/
├── lib/trafego/relatorios/
│   ├── actions.ts          # criarRelatorioAction, gerarSlidesAction, gerarPdfAction, publicarAction, atualizarSlideAction, excluirAction
│   ├── queries.ts          # listarRelatorios, getRelatorio, getRelatoriosClienteParaPortal
│   ├── schema.ts           # Zod
│   ├── prompt.ts           # buildPrompt(dados, objetivo) - prompt específico de tráfego
│   ├── meta-fetch.ts       # fetchDadosMeta(client, periodo) usando meta-api existente
│   └── tipos.ts            # NOVO template `grafico_barras` + reuso dos outros
│
├── app/(authed)/trafego/relatorios/
│   ├── page.tsx            # Lista por cliente, com filtro
│   ├── nova/page.tsx       # Form: cliente + período + objetivo + (preview Meta ou form manual)
│   └── [id]/page.tsx       # Detalhe: editar slides + botões "Gerar PDF" / "Publicar"
│
├── app/(authed)/trafego/page.tsx  # MODIFICAR: adicionar tabs "Campanhas" / "Relatórios"
│
├── app/relatorio-trafego-pdf/[id]/page.tsx   # Rota pública pro Puppeteer (HMAC-protegida)
│
├── app/api/trafego/relatorios/[id]/
│   ├── gerar/route.ts      # Trigger Puppeteer + salva no Storage
│   └── meta-fetch/route.ts # Endpoint pra pre-fetchar dados Meta no form de criação
│
├── components/trafego/relatorios/
│   ├── RelatoriosTab.tsx
│   ├── NovoRelatorioForm.tsx
│   ├── EditorSlides.tsx       # MOVER ou REUSAR o do apresenta-yide
│   ├── SlideGraficoBarras.tsx # NOVO
│   └── PreviewDadosMeta.tsx
│
└── app/(portal-cliente)/portal/relatorios-trafego/
    ├── page.tsx            # Lista de relatórios publicados
    └── [id]/page.tsx       # Visualizar inline + botão download PDF

supabase/migrations/
└── 20260608000000_trafego_relatorios.sql
```

### Diagrama de dados

```
clients ──┐
          │ N
          ▼
  trafego_relatorios ── slides JSONB
          │ N
          ▼ 1
       Storage: relatorios-trafego/{org}/{id}.pdf
```

## Schema da tabela

```sql
create table public.trafego_relatorios (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  unit_id uuid references public.units(id),

  -- Período coberto pelo relatório (inclusivo nos dois lados).
  periodo_inicio date not null,
  periodo_fim date not null,
  check (periodo_fim >= periodo_inicio),

  -- Texto livre do assessor: "queremos destacar leads qualificados".
  -- Vira input do prompt da IA.
  objetivo text,

  -- 'meta_api' = 100% Meta, 'manual' = 100% form, 'hibrido' = veio da Meta + complemento manual.
  fonte_dados text not null check (fonte_dados in ('meta_api', 'manual', 'hibrido')),

  -- Snapshot bruto do que a Meta retornou (caching: não re-bate na API se reabrir).
  dados_meta jsonb,
  -- O que o assessor digitou/editou manualmente.
  dados_manuais jsonb,

  -- Array de slides (mesmo shape do apresenta-yide + novo template grafico_barras).
  slides jsonb not null default '[]'::jsonb,

  status text not null default 'rascunho'
    check (status in ('rascunho','gerando','pronta','erro')),

  pdf_storage_path text,
  publicado_em timestamptz,

  criado_por uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_trafego_relatorios_cliente_periodo
  on public.trafego_relatorios (cliente_id, periodo_inicio desc);
create index idx_trafego_relatorios_publicado
  on public.trafego_relatorios (cliente_id, publicado_em desc)
  where publicado_em is not null;

create trigger trg_trafego_relatorios_updated_at
  before update on public.trafego_relatorios
  for each row execute function public.set_updated_at();
```

### RLS

- **SELECT**: `adm/socio` tudo; `coordenador/assessor/comercial` só clientes da própria unidade; `client_portal` só relatórios do próprio cliente com `publicado_em IS NOT NULL`.
- **INSERT/UPDATE/DELETE**: `adm/socio/coordenador/assessor/comercial` (a action ainda checa permissão via `canAccess`).

## Templates de slide

Reusa 6 do apresenta-yide e adiciona 1 novo. Total: 7.

### Novo: `grafico_barras`

```typescript
export interface SlideGraficoBarras {
  template: "grafico_barras";
  titulo: string;
  subtitulo?: string;
  unidade: "moeda" | "numero" | "percentual";
  /** Máximo 7 itens. Mais que isso vira muito pequeno no PDF. */
  dados: Array<{ label: string; valor: number }>;
  /** Texto curto abaixo do gráfico explicando o insight. */
  insight?: string;
}
```

**Renderização**: SVG cru server-side. Barras horizontais com label à esquerda, valor à direita, escala normalizada pelo maior. Sem dep nova — só JSX retornando `<svg>`. Cores: paleta Yide (verde primary, neutros).

**Por que SVG e não chart.js**: chart.js precisa rodar JS no Puppeteer, adiciona complexidade. SVG renderiza estático no SSR e o Puppeteer já vê o resultado final.

## Estrutura padrão do relatório

A IA monta os slides obedecendo a esta estrutura (declarada no system prompt):

| # | Template | Conteúdo |
|---|----------|----------|
| 1 | `capa` | Cliente · período · "Relatório de Tráfego Pago" |
| 2 | `conteudo` | Resumo executivo — 2-3 bullets do que aconteceu |
| 3 | `metrica` × 3 (uma página) | Investimento, alcance/impressões |
| 4 | `metrica` × 3 (uma página) | Resultados: cliques/CPC, conversões/CPA, leads/CPL |
| 5 | `grafico_barras` | Top campanhas por spend OU evolução semanal |
| 6 | `duas_colunas` | Comparativo período anterior × atual |
| 7 | `topicos_numerados` | Análise + próximos passos (3-5 tópicos) |
| 8 | `encerramento` | CTA + contato |

Slides 3-4 podem ser fundidos se cliente tem poucas métricas (Meta API não retornou conversões, por ex.).

## Fluxo end-to-end

### 1. Assessor cria relatório

`/trafego` → tab "Relatórios" → "Novo relatório":

1. Escolhe cliente da unidade ativa
2. Escolhe período (de/até) — picker com presets "Mês passado", "Últimos 30 dias", "Customizado"
3. Sistema chama `GET /api/trafego/relatorios/meta-fetch?cliente_id=...&inicio=...&fim=...`
   - Se cliente tem `meta_ad_account_id` E sync funciona: retorna `dados_meta` populado
   - Senão: retorna `null` com motivo (`no_account` | `api_error`)
4. Form mostra preview dos dados Meta (read-only) + campos manuais sempre editáveis
   - Se Meta retornou: campos manuais pré-populados com valores Meta, marcados "editar pra ajustar"
   - Se Meta falhou: campos manuais vazios, todos required
5. Campo "Objetivo deste relatório" (textarea, opcional)
6. Botão "Gerar com IA"

### 2. Geração dos slides

1. `criarRelatorioAction` insere com `status='rascunho'` e os dados (meta + manuais)
2. Redirect pra `/trafego/relatorios/[id]`
3. Página dispara `gerarSlidesAction` no mount (status vira `gerando`)
4. Action faz streaming-call pro Claude com:
   - System prompt explicando estrutura, identidade Yide ("tom direto, números em destaque")
   - User prompt com os dados (JSON) + objetivo
5. Stream-parser vai populando `slides` JSONB conforme chegam
6. Status vira `pronta`

### 3. Revisão

- UI mostra cada slide renderizado igual no PDF + botão "Editar"
- Edição inline texto a texto (reusa `EditorSlides` do apresenta-yide)
- Cada save é uma `atualizarSlideAction`

### 4. Gerar PDF

- Botão "Gerar PDF" → `POST /api/trafego/relatorios/[id]/gerar`
- API gera HMAC, chama Puppeteer apontando pra `/relatorio-trafego-pdf/[id]?token=...`
- Puppeteer renderiza, salva em Storage `relatorios-trafego/{org_id}/{relatorio_id}.pdf`
- Update `pdf_storage_path`

### 5. Publicar pro cliente

- Botão "Disponibilizar pro cliente" → `publicarAction` seta `publicado_em = now()`
- Relatório aparece em `/portal-cliente/portal/relatorios-trafego`

### 6. Cliente vê

- Portal: lista de relatórios publicados, ordenados por `publicado_em desc`
- Click → preview inline dos slides (mesma página de assessor mas read-only) + botão "Baixar PDF"

## Prompt da IA (estrutura)

```
SYSTEM:
Você é o sistema de geração de relatórios da Yide Digital, uma agência de marketing
de Cuiabá. Cria relatórios de tráfego pago em PDF pro cliente final.

Tom: direto, números em destaque, sem jargão. Sempre conecta número com resultado
de negócio (ex: "R$ 2.300 gastos viraram 47 leads — CPL de R$ 49").

Estrutura obrigatória de slides (em ordem):
1. capa
2. conteudo (resumo executivo, 2-3 bullets)
3. metrica × 3 (investimento + alcance)
4. metrica × 3 (resultados)
5. grafico_barras (top campanhas OU evolução)
6. duas_colunas (período anterior × atual)
7. topicos_numerados (análise + próximos passos)
8. encerramento

Retorne JSON streaming no shape Slide[] do sistema.

USER:
Cliente: {nome}
Período: {inicio} a {fim}
Objetivo: {objetivo || "Não especificado"}

Dados:
{JSON com dados_meta ∪ dados_manuais}

Período anterior (mesma duração, imediatamente antes):
{JSON do comparativo, se disponível}
```

## Distribuição

**Assessor**:
- `/trafego/relatorios/[id]` → botão "Baixar PDF" (signed URL do Storage, 5min)
- Compartilha link/anexa em WhatsApp/email manualmente

**Cliente** (portal):
- Item "Relatórios de Tráfego" no menu lateral do portal
- Lista cronológica de relatórios `publicado_em IS NOT NULL`
- Detalhe: preview inline + "Baixar PDF" (signed URL)

## Cache / invalidação

- Cache tag `trafego_relatorios:${clienteId}` — invalida em create/update/publicar
- Lista geral usa `unstable_cache` com tag `trafego_relatorios:list:${unitId}`

## Tratamento de erros

| Cenário | Tratamento |
|---------|-----------|
| Meta API timeout/falha | Status fica `rascunho`, mostra alerta "Não conseguimos puxar da Meta, preencha manual" |
| IA falha no streaming | Status vira `erro`, botão "Tentar de novo" preserva dados originais |
| Puppeteer falha | Status mantém `pronta`, mostra erro inline, botão "Gerar PDF" continua disponível |
| Cliente sem dados no período | Bloqueia geração com mensagem "Período sem dados Meta — escolha outro ou preencha manual" |

## Permissões

- `manage:trafego_relatorios` — novo permission key
- Concedido a: `socio`, `adm`, `coordenador`, `assessor` (assessor só dos clientes da unidade)
- `comercial` NÃO emite relatório (não é função dele)
- Cliente do portal: só lê `publicado_em IS NOT NULL` dos seus

## Testes

- `tests/unit/trafego-relatorios-actions.test.ts` — criar, publicar, RLS
- `tests/unit/trafego-relatorios-prompt.test.ts` — prompt monta JSON correto
- `tests/unit/grafico-barras-svg.test.tsx` — renderização do SVG (snapshot)
- `tests/integration/trafego-relatorios.test.ts` — fluxo create → gerar → publicar
- E2E manual: assessor cria, revisa, publica; cliente baixa do portal

## Migração de dados

Nenhuma. Tabela nova, nada existente pra migrar.

## Rollout

PR único — feature isolada, sem flag. Migration aplicada manualmente no Supabase após merge (padrão do projeto).

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| IA inventa números (hallucination) | Prompt instrui "use APENAS os números do JSON, não calcule novos"; dados Meta+manuais ficam no `dados_meta`/`dados_manuais` pra audit |
| PDF demorando muito (>30s) | Puppeteer com timeout 60s; status `gerando` → `erro` no timeout; botão "tentar de novo" |
| Cliente vendo relatório antes de revisar | `publicado_em IS NULL` no portal por padrão. Só aparece após assessor clicar "publicar" |
| Storage crescendo sem controle | Aceito na v1 (volume baixo, ~5 MB por PDF). Cleanup futuro se virar problema |

## Estimativa

PR único, ~25-35 arquivos novos/modificados. Ordem de implementação:

1. Migration + tipos + schema
2. Server actions (CRUD + queries)
3. Meta fetch + prompt + streaming
4. UI assessor (tab, lista, nova, detalhe)
5. Template `grafico_barras` (SVG)
6. Rota pública PDF + geração via Puppeteer
7. Portal do cliente (lista + detalhe)
8. Testes

## Decisões fechadas durante o brainstorming

- Destinatário: cliente final
- Geração: sob demanda com IA
- Tamanho: 5-8 slides (padrão)
- Fonte de dados: Meta API quando disponível + form manual fallback (`hibrido`)
- Entrega: PDF download + portal do cliente
- Período: customizável (de/até) com presets
- Localização no menu: dentro de `/trafego` (tab "Relatórios")
- Gráficos: template novo `grafico_barras` (SVG server-side)
- Fallback Meta: form manual sempre disponível, complementa o que veio
