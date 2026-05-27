# Yori — Editor de Vídeo com IA (Fase 1) — Design Doc

**Data:** 2026-05-27
**Autora:** Yasmin (brainstorming com Claude)
**Status:** Aguardando review final

## Motivação

Equipe de audiovisual da Yide gasta muito tempo em tarefa repetitiva: transcrever áudio + sincronizar legenda + estilizar texto em cada Reel/Short. Volume estimado é **50-200 vídeos curtos/mês** (foco principal: Reels de até 90s).

O **Yori** é um editor de vídeo com IA dentro do sistema, integrado ao módulo `/audiovisual`. Fase 1 entrega o workflow básico: equipe sobe vídeo → IA transcreve + estiliza legenda automaticamente → entrega MP4 pronto + SRT + transcrição texto.

Fase 2 adiciona chat conversacional ("corta os silêncios", "muda cor da legenda"). Fases posteriores cobrem cortes automáticos e geração from-scratch (Google Veo).

## Princípio de design

**Yori não é editor visual estilo Premiere.** É um pipeline declarativo: equipe descreve o que quer (via template + ajustes), sistema executa. Customização rica de aparência da legenda, mas zero edição de timeline.

## Escopo

### Inclui (Fase 1)

1. Upload de vídeo bruto (até 200MB, máx 90s de duração)
2. Transcrição automática via Groq Whisper Large-v3
3. Limpeza de pontuação via Claude
4. Geração de:
   - MP4 com legenda queimada (renderizado via Remotion no AWS Lambda)
   - Arquivo `.srt` pra editor manual
   - Arquivo `.txt` puro pra usar como caption do post
5. **3 templates de sistema** + **customização híbrida** (templates próprios reutilizáveis)
6. Histórico de jobs do usuário (últimos 30)
7. Quota de **100 jobs/org/mês** (configurável)
8. Botão destacado no topo de `/audiovisual` + ícone no nav lateral com badge de jobs prontos não baixados

### Não inclui (deferido pra fases futuras)

- ❌ Chat conversacional com a IA (Fase 2)
- ❌ Cortes automáticos de vídeos longos em vários Reels (Fase 3)
- ❌ Geração de vídeo from-scratch via Google Veo (Fase 4+)
- ❌ Editor visual com timeline (escopo de meses, não cabe)
- ❌ Upload de fonte custom (risco de licença + bugs no Lambda; 8 Google Fonts cobrem 99%)
- ❌ Integração API com CapCut (não tem API pública)
- ❌ Vídeos longos (> 90s) — limite explícito pra controlar custo/duração de processamento

## Arquitetura

### Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 16 App Router (já existente) |
| Storage | Supabase Storage (2 buckets novos) |
| Transcrição | Groq Whisper Large-v3 API |
| Limpeza texto | Claude (já assinado) |
| Renderização vídeo | Remotion + AWS Lambda |
| Background jobs | Vercel Cron a cada 30s + tabela `yori_jobs` como fila |

### Pipeline

```
User upload (~5s)
      ↓
[pending] ← cron pega
      ↓
Whisper Groq transcreve (~10-30s)
      ↓
[transcribing] progress 33%
      ↓
Claude limpa pontuação (~3s) + gera SRT/TXT
      ↓
[rendering] progress 66%
      ↓
Lambda Remotion renderiza MP4 (~20-60s)
      ↓
[done] progress 100%
```

Tempo total típico: **30-90 segundos** pra Reel de até 90s.

### Resiliência

- Cada step retry 2x com backoff exponencial antes de marcar `error`
- Cron de cleanup detecta jobs órfãos (stuck > 30min) e marca como `error`
- Mensagem de erro amigável + botão "Tentar de novo" (cria NOVO job copiando params)

## Schema

### Tabela nova: `yori_templates`

```sql
create table public.yori_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  nome text not null,
  is_system boolean not null default false,    -- true pros 3 presets pré-seedados (não editáveis)
  base_template text not null
    check (base_template in ('submagic','tiktok','reels_box')),
  primary_color text not null,                 -- hex, ex '#FFFFFF'
  highlight_color text,                        -- hex (só Submagic usa pra palavra-chave)
  font_family text not null
    check (font_family in ('inter','montserrat','bebas','oswald','poppins','roboto','anton','archivo_black')),
  font_size int not null check (font_size between 24 and 80),
  position text not null check (position in ('top','center','bottom')),
  position_y_offset int default 0,             -- ajuste fino em px
  has_shadow boolean not null default true,
  shadow_intensity int default 50 check (shadow_intensity between 0 and 100),
  animation text not null check (animation in ('pop','fade','slide','none')),
  created_at timestamptz not null default now()
);

create index yori_templates_org_idx
  on public.yori_templates(organization_id, created_at desc)
  where is_system = false;

alter table public.yori_templates enable row level security;

-- Templates do sistema são visíveis pra todos
-- Templates customizados são visíveis pra org inteira (compartilhados)
create policy yori_templates_select on public.yori_templates
  for select to authenticated using (
    is_system = true
    or organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

create policy yori_templates_insert on public.yori_templates
  for insert to authenticated with check (
    is_system = false
    and user_id = auth.uid()
  );

create policy yori_templates_update on public.yori_templates
  for update to authenticated using (
    is_system = false
    and user_id = auth.uid()
  );

create policy yori_templates_delete on public.yori_templates
  for delete to authenticated using (
    is_system = false
    and user_id = auth.uid()
  );
```

**Seed inicial (3 templates de sistema):**

```sql
insert into public.yori_templates
  (id, nome, is_system, base_template, primary_color, highlight_color,
   font_family, font_size, position, has_shadow, shadow_intensity, animation)
values
  ('00000000-0000-0000-0000-000000000001', 'Submagic', true, 'submagic',
   '#FFFFFF', '#FFD600', 'inter', 56, 'center', true, 70, 'pop'),
  ('00000000-0000-0000-0000-000000000002', 'TikTok Clássico', true, 'tiktok',
   '#FFFFFF', null, 'archivo_black', 48, 'bottom', true, 80, 'none'),
  ('00000000-0000-0000-0000-000000000003', 'Reels Box', true, 'reels_box',
   '#FFFFFF', null, 'inter', 42, 'bottom', false, 0, 'fade');
```

### Tabela nova: `yori_jobs`

```sql
create table public.yori_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  template_id uuid not null references public.yori_templates(id),

  -- Input
  video_filename text not null,
  video_path text,                                 -- bucket: yori-videos. Null após cleanup.
  video_duration_seconds int,
  video_size_bytes bigint,

  -- Status
  status text not null default 'pending'
    check (status in ('pending','transcribing','rendering','done','error','cancelled')),
  progress_pct int default 0,
  error_message text,

  -- Outputs
  srt_path text,
  txt_path text,
  mp4_path text,
  transcription jsonb,                              -- raw Whisper response (debug/reprocess)
  downloaded_at timestamptz,                        -- preenchido quando user baixa qualquer output

  -- Metadata
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,

  -- Custos (pra dashboard futuro)
  whisper_cost_brl numeric(10,4),
  lambda_cost_brl numeric(10,4)
);

create index yori_jobs_user_recent_idx
  on public.yori_jobs(user_id, created_at desc);

create index yori_jobs_org_status_idx
  on public.yori_jobs(organization_id, status, created_at desc);

create index yori_jobs_pending_idx
  on public.yori_jobs(created_at)
  where status in ('pending','transcribing','rendering');

create index yori_jobs_undownloaded_idx
  on public.yori_jobs(user_id)
  where status = 'done' and downloaded_at is null;

alter table public.yori_jobs enable row level security;

create policy yori_jobs_select on public.yori_jobs
  for select to authenticated using (
    user_id = auth.uid()
    or organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

create policy yori_jobs_insert on public.yori_jobs
  for insert to authenticated with check (user_id = auth.uid());

-- Update só pelo service role (worker), não pelo authenticated user
create policy yori_jobs_update_service on public.yori_jobs
  for update to authenticated using (false);
```

### Quota check (SQL helper)

```sql
create or replace function public.check_yori_quota(p_org_id uuid)
returns boolean
language sql stable as $$
  select count(*) < 100
  from public.yori_jobs
  where organization_id = p_org_id
    and created_at >= date_trunc('month', now())
    and status != 'cancelled';
$$;
```

### Storage buckets

| Bucket | Conteúdo | Retenção | Acesso |
|---|---|---|---|
| `yori-videos` | Vídeos brutos | **24 horas** | Privado (signed URLs) |
| `yori-outputs` | MP4 final + SRT + TXT | **30 dias** | Privado (signed URLs) |

Path pattern: `{org_id}/{user_id}/{job_id}/{filename}`

## Componentes

### Páginas novas

```
src/app/(authed)/audiovisual/yori/
  page.tsx                  ← lista de jobs do user + quota indicator
  novo/
    page.tsx                ← formulário: upload + escolha de template + ajustes
  [jobId]/
    page.tsx                ← status do job (polling) ou resultado final
  templates/
    page.tsx                ← CRUD de templates (sistema + meus)
```

### Componentes React

- `YoriEntryButton` — botão destacado em `/audiovisual` (topo)
- `YoriJobsList` + `YoriJobCard` — lista de jobs com status badges
- `YoriQuotaIndicator` — "47 / 100 vídeos usados este mês"
- `YoriUploadForm` — drag&drop + template picker + ajustes
- `YoriTemplatePicker` — grid visual dos templates (sistema + meus + "Criar novo")
- `YoriTemplateForm` — modal com color picker (`react-colorful`), font picker, slider de tamanho, toggles
- `YoriJobStatus` — barra de progresso + polling a cada 3s
- `YoriResultPreview` — preview MP4 + 3 botões de download (marca `downloaded_at` ao clicar)

### Nav lateral

Adicionar em `src/components/layout/nav-config.ts`:

```typescript
{
  href: "/audiovisual/yori",
  icon: Sparkles,    // ou Wand2
  label: "Yori",
  roles: ["videomaker", "editor", "audiovisual_chefe", "assessor", "socio", "adm"],
  badgeKey: "yoriProntos"
}
```

Badge: count de `yori_jobs.status='done' and downloaded_at is null` pro usuário atual.

## Services e Server Actions

### `src/lib/yori/actions.ts`

```ts
"use server";

// Cria job — valida quota, sobe vídeo pro Storage, cria row pending
createYoriJob(formData: FormData): Promise<{ jobId: string } | { error: string }>

// Polling — UI chama a cada 3s
getYoriJob(jobId: string): Promise<YoriJob>

// Marca download — zera badge do nav lateral
markYoriJobDownloaded(jobId: string, type: 'mp4' | 'srt' | 'txt'): Promise<void>

// Cancela job pendente
cancelYoriJob(jobId: string): Promise<void>

// CRUD de templates
createYoriTemplate(formData: FormData): Promise<{ templateId } | { error }>
updateYoriTemplate(id: string, formData: FormData): Promise<void>
deleteYoriTemplate(id: string): Promise<void>
```

### `src/lib/yori/services/groq-whisper.ts`

```ts
export interface WhisperResult {
  ok: boolean;
  error: string | null;
  text: string;
  segments: Array<{ start: number; end: number; text: string }>;
  words: Array<{ word: string; start: number; end: number }>;
}

export async function transcribeAudio(videoPath: string): Promise<WhisperResult>;
```

### `src/lib/yori/services/remotion-lambda.ts`

```ts
export interface RenderRequest {
  videoUrl: string;             // signed URL do vídeo bruto
  subtitles: Array<{ word: string; start: number; end: number }>;
  template: YoriTemplate;       // template completo (system ou custom)
}

export interface RenderResult {
  ok: boolean;
  error: string | null;
  mp4Url: string | null;        // URL temporária do Lambda
  estimatedCostBrl: number;
}

export async function renderRemotionLambda(req: RenderRequest): Promise<RenderResult>;
```

### Worker `src/app/api/cron/yori-worker/route.ts`

Endpoint cron protegido por `CRON_SECRET`. Roda a cada 30 segundos.

Lógica:
1. Pega até 5 jobs com `status in ('pending','transcribing','rendering')` ordenados por `created_at`
2. Pra cada job, executa o próximo step do pipeline
3. Idempotência via check de outputs antes de cada step

### Cron de cleanup `src/app/api/cron/yori-cleanup/route.ts`

Roda 1×/dia (~03h BRT):
- Deleta arquivos em `yori-videos` com `created_at < now() - interval '24 hours'` (deleta no Storage + nullify `video_path` na row)
- Deleta arquivos em `yori-outputs` com `created_at < now() - interval '30 days'`
- Marca jobs órfãos (status pending/transcribing/rendering há > 30min) como `error`

## Templates Remotion

Diretório novo: `remotion/`

```
remotion/
  index.ts                          ← Composition registry
  templates/
    SubmagicTemplate.tsx            ← palavra-por-palavra animada
    TikTokTemplate.tsx              ← frase branca com sombra
    ReelsBoxTemplate.tsx            ← caixa preta com texto branco
  components/
    SubtitleWord.tsx                ← componente reutilizável de palavra (com animação)
    SubtitleBox.tsx                 ← caixa de fundo opcional
  utils/
    fonts.ts                        ← carrega 8 Google Fonts via @remotion/google-fonts
    animations.ts                   ← variants de animação (pop/fade/slide/none)
```

Cada template recebe `inputProps`:
```ts
{
  videoUrl: string;
  words: Array<{ word: string; start: number; end: number }>;
  config: {
    primary_color: string;
    highlight_color: string | null;
    font_family: string;
    font_size: number;
    position: 'top' | 'center' | 'bottom';
    position_y_offset: number;
    has_shadow: boolean;
    shadow_intensity: number;
    animation: 'pop' | 'fade' | 'slide' | 'none';
  };
}
```

Lambda escolhe a composition correspondente ao `base_template` do template escolhido.

## Variáveis de ambiente (novas)

```ts
// src/lib/env.ts
GROQ_API_KEY: z.string().optional(),
AWS_ACCESS_KEY_ID: z.string().optional(),
AWS_SECRET_ACCESS_KEY: z.string().optional(),
AWS_REGION: z.string().optional(),
REMOTION_LAMBDA_FUNCTION_NAME: z.string().optional(),
REMOTION_LAMBDA_SITE_NAME: z.string().optional(),
```

Sem essas vars → endpoint `/yori/novo` mostra mensagem "Yori indisponível, contate o admin" (graceful fallback).

## Permissões

Roles que veem o Yori (nav + páginas): `videomaker`, `editor`, `audiovisual_chefe`, `assessor`, `socio`, `adm`

Os outros roles (coordenador, designer, comercial) **não** veem o link no nav nem podem acessar `/audiovisual/yori`. Tentar acessar redireciona pra `/audiovisual`.

## Limites e proteções

| Limite | Valor | Motivo |
|---|---|---|
| Duração max do vídeo | 90 segundos | Custo de processamento + foco em Reels |
| Tamanho max do upload | 200 MB | Cobre ~3min 1080p (mas duração já limita) |
| Quota por org/mês | 100 jobs | Alinhado com volume informado (50-200) |
| Jobs simultâneos por user | 3 | Evita usuário travar toda quota |
| Timeout total do job | 5 min | Mata jobs travados |
| Templates customizados por org | 50 | Evita explosão |

## Custos

| Item | Mensal estimado |
|---|---|
| Groq Whisper (~100 vídeos × 1min) | R$ 5 |
| AWS Lambda Remotion (~100 renders) | R$ 60-100 |
| Claude (limpeza de pontuação) | R$ 1 |
| Storage Supabase | incluso no plano Pro |
| **Total adicional** | **R$ 70-110/mês** |

## Tratamento de erros

| Cenário | Comportamento |
|---|---|
| Quota mensal estourada | Botão "Gerar" desabilitado, mensagem amigável com data de reset |
| Upload falha (rede) | UI mostra erro de upload, job não é criado |
| Whisper retorna 429 | Worker faz backoff exponencial até 2 retries |
| Lambda Remotion falha | 2 retries automáticos, depois `status=error` + "Tentar de novo" |
| Vídeo > 90s no upload | Validação client-side via `<video>` element (carrega metadata sem renderizar). Se duração > 90s, erro local antes do upload começar. Backend faz segunda validação no `createYoriJob` via ffprobe.wasm (fallback) |
| Lambda timeout | Marca job como `error: 'Renderização demorou demais. Tente vídeo mais curto.'` |
| Worker para de rodar | Cron de cleanup detecta jobs stuck e marca como error |

## Métricas de sucesso

Medir 60 dias após launch:

1. **Volume:** quantos jobs criados/mês (meta: ≥ 50/mês — pelo menos metade do volume estimado)
2. **Taxa de sucesso:** % de jobs que terminam em `status=done` (meta: ≥ 90%)
3. **Tempo médio:** mediana de tempo total do job (meta: ≤ 90s pra Reels de 60s)
4. **Adoção:** % do time autorizado (videomaker/editor/etc) que usou ao menos 1 vez (meta: ≥ 70%)
5. **Custo real vs estimado:** monitorar e ajustar plano

## Riscos & mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Lambda Remotion mais caro que estimado | Média | Monitor de custo na dashboard de uso; alarme se passar R$200/mês |
| Whisper Groq fora do ar | Baixa | Fallback pra OpenAI Whisper (mais caro mas estável) — adiar pra Fase 1.5 se acontecer |
| Custo de storage explode | Baixa | Cron de cleanup roda diário; limites de retenção firmes |
| Equipe não usa o Yori (preferência por workflow atual) | Média | Onboarding com videomaker antes do launch; coletar feedback nas primeiras 2 semanas |
| Vídeo brutos sensíveis sendo subidos (LGPD) | Baixa | Retenção 24h + signed URLs + nunca exposição pública. Documentar no manual da equipe |

## Plano de rollout

1. **PR 1 (esta spec, ~1.5 semana de dev):** Schema + Storage + Whisper + UI básica + 3 templates de sistema + customização híbrida. Deploy atrás de feature flag baseada em env var `YORI_ENABLED` (string opcional no `env.ts`; se ausente ou ≠ "true", nav lateral esconde o item e rotas redirecionam pra `/audiovisual`).
2. **Pilot 1 semana** com videomaker da equipe — coletar feedback, ajustar templates de sistema se necessário.
3. **Habilitar pra editor + audiovisual_chefe** — semana 2 pós-launch.
4. **Habilitar pra assessor + socio + adm** — semana 4 pós-launch.
5. **Fase 2 (depois de validar Fase 1):** chat conversacional pra ajustes ("muda cor", "remove silêncio").
