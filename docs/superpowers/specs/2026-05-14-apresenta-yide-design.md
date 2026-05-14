# Apresenta Yide — IA gera apresentações com identidade visual fixa

**Data:** 2026-05-14
**Status:** Aprovado (v1 escopo focado em foundation + geração + PDF)

## Contexto

Yasmin quer que o time pare de montar apresentações no Gamma/Google
Slides — gastam tempo formatando, fogem da identidade visual, parecem
amador. A ideia é ter um "Gamma interno" onde o usuário só escreve o
prompt + envia o conteúdo, e a IA gera uma apresentação pronta seguindo
a identidade visual rígida da Yide (teal + dark + minimalista premium).

Comparáveis: Gamma, Linear, Notion, Stripe, Framer.

## Estado atual

- `/social-media/page.tsx` existe (placeholder + roadmap fase 1-4)
- `src/lib/ai/client.ts` já tem cliente Anthropic singleton via SDK
- `ANTHROPIC_API_KEY` já configurado no Vercel
- Sem dependências PDF instaladas

## Escopo v1

**Entrega:**
1. Subpágina `/social-media/apresenta-yide` com tab no `/social-media`
2. Lista de apresentações já criadas (histórico do usuário)
3. Botão "Nova apresentação" → entra no editor split view
4. Editor: input do prompt à esquerda + preview live à direita
5. Claude streaming gera slides JSON, preview renderiza ao vivo
6. 6 templates fixos do design system Yide
7. Exportar PDF via Puppeteer + @sparticuz/chromium

**Fora do v1 (fases 2-3):**
- Upload de arquivos como contexto (apenas texto no prompt em v1)
- Edição manual após geração (apenas regenerar do zero)
- Mais templates além dos 6 iniciais
- Imagens geradas por IA dentro dos slides
- Clonagem de apresentação anterior
- Templates por indústria

## Arquitetura

### Rotas

| Rota | Tipo | Conteúdo |
|---|---|---|
| `/social-media/apresenta-yide` | Server | Header + tab nav + lista de apresentações |
| `/social-media/apresenta-yide/nova` | Server | Editor split view (vazio, aguardando prompt) |
| `/social-media/apresenta-yide/[id]` | Server | Editor preenchido com apresentação existente (read-only + download) |

### Permissões
`adm, socio, coordenador, assessor, comercial` (quem fala com cliente).

### DB

**Tabela nova `apresentacoes_yide`:**

```sql
create table public.apresentacoes_yide (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  prompt text not null,             -- prompt original
  objetivo text,                    -- ex.: "apresentar serviços pra cliente novo"
  num_slides_alvo integer not null default 8,
  slides jsonb not null default '[]'::jsonb,  -- array de SlideData (ver shape abaixo)
  status text not null default 'rascunho',
    -- 'rascunho' | 'gerando' | 'pronta' | 'erro'
  pdf_storage_path text,            -- bucket apresentacoes-yide/[id].pdf
  criado_por uuid not null references public.profiles(id) on delete set null,
  organization_id uuid not null references public.organizations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_apresentacoes_yide_criado_por on public.apresentacoes_yide(criado_por);
create index idx_apresentacoes_yide_created_at on public.apresentacoes_yide(created_at desc);

alter table public.apresentacoes_yide enable row level security;

-- Cada user vê só as próprias. Adm/sócio vê tudo.
create policy "apresentacoes read own + adm" on public.apresentacoes_yide
  for select to authenticated using (
    criado_por = auth.uid()
    or current_user_role() in ('adm'::user_role, 'socio'::user_role)
  );

create policy "apresentacoes write own" on public.apresentacoes_yide
  for all to authenticated
  using (criado_por = auth.uid())
  with check (criado_por = auth.uid());
```

**Storage bucket `apresentacoes-yide`** (privado), com policies pra
authenticated read + dono+adm/sócio write.

### Slide shape (JSON)

```typescript
type SlideTemplate =
  | "capa"
  | "conteudo"
  | "duas_colunas"
  | "metrica"
  | "topicos_numerados"
  | "encerramento";

interface Slide {
  template: SlideTemplate;
  /** Conteúdo dependente do template — Claude preenche conforme a struct */
  content:
    | { template: "capa"; titulo: string; subtitulo?: string }
    | { template: "conteudo"; titulo: string; texto?: string; bullets?: string[] }
    | { template: "duas_colunas"; titulo: string; coluna_esquerda: { titulo: string; texto: string }; coluna_direita: { titulo: string; texto: string } }
    | { template: "metrica"; numero: string; label: string; descricao?: string }
    | { template: "topicos_numerados"; titulo: string; topicos: Array<{ titulo: string; texto?: string }> }
    | { template: "encerramento"; mensagem: string; cta?: string };
}
```

### AI: prompt + streaming

**Modelo:** `claude-sonnet-4-5-20250929` (melhor qualidade de
reasoning estrutural; haiku é fraco demais pra organizar deck completo).

**Prompt template (system):**

```
Você é o gerador de apresentações Yide. Recebe um prompt do usuário
e devolve um JSON de slides estritamente nesse formato:

{ "titulo": string, "slides": Slide[] }

Onde Slide é um discriminated union com 6 templates: capa, conteudo,
duas_colunas, metrica, topicos_numerados, encerramento.

Regras:
- Sempre começa com 1 slide "capa" e termina com 1 slide "encerramento"
- Entre eles, distribui o conteúdo pelos templates intermediários
- Total de slides: entre 5 e 15, alvo do usuário definido em num_slides
- Textos curtos: títulos até 60 chars, parágrafos até 250 chars,
  bullets de 3 a 5 itens cada
- Tom: profissional, direto, sem jargão técnico desnecessário
- Conteúdo SEMPRE em pt-BR
- Não inventa dados/números; usa só o que o usuário forneceu
- Retorna APENAS o JSON, sem markdown wrapping nem texto adicional
```

**Streaming:** server action retorna `ReadableStream`. Cliente faz
`fetch` e lê tokens incrementalmente. JSON parser tolerante a
incompletude (parsea cada slide assim que aparece no stream).

Implementação: usar `client.messages.stream()` do SDK Anthropic.
Parsing de JSON parcial: regex que detecta `}` balanceado dentro de
`"slides": [`.

### UI: split view

```
┌────────────────────────────────────────────────────────────┐
│ Apresenta Yide — Nova apresentação                          │
├──────────────────────────┬─────────────────────────────────┤
│ ← LADO ESQUERDO (40%)    │ ← LADO DIREITO (60%)            │
│                          │                                  │
│ Título: [_____]          │ [Preview slide 1]                │
│ Prompt: [_______________]│ [Preview slide 2]                │
│ Objetivo: [______]       │ [Preview slide 3]                │
│ Slides: 5──[8]──15       │ ...                              │
│                          │                                  │
│ [Gerar com IA →]         │ [Baixar PDF]                     │
└──────────────────────────┴─────────────────────────────────┘
```

**Componentes:**
- `ApresentaYideEditor.tsx` — split view client component, gerencia state
- `PromptForm.tsx` — formulário lado esquerdo
- `SlidePreview.tsx` — wrapper que recebe um Slide e renderiza o template apropriado
- `slides/SlideCapa.tsx`, `SlideConteudo.tsx`, etc. — 6 templates

**Animações:**
- Slide aparece no preview com fade-in + slide-up suave (200ms)
- Cursor pulsante na posição do slide sendo gerado (efeito "typing")

### Design system dos slides

**Cores fixas:**
- Background slide: `bg-gradient-to-br from-[#0a0a0a] via-[#0f1419] to-[#0a0a0a]` (preto-grafite com leve gradiente)
- Primary teal: `#3DC4BC` (Yide brand)
- Texto principal: branco / branco-90%
- Texto secundário: gray-400
- Acento glow: `shadow-[0_0_40px_-10px] shadow-primary/40`

**Tipografia:**
- Título grande (capa): `text-5xl font-bold tracking-tight`
- Título de slide: `text-3xl font-bold`
- Subtítulo: `text-xl text-gray-300`
- Corpo: `text-base text-gray-200`
- Caption: `text-sm text-gray-400`

**Logo Yide:** canto inferior direito de todo slide (exceto capa que
tem logo grande centralizada). Fonte da logo: existe em `/public/icon1`
(usar SVG inline ou img).

**Aspect ratio:** 16:9 (1920x1080 px no PDF). Preview escala
proporcional pra caber na largura da coluna direita.

### PDF generation

**Server action:** `gerarPdfApresentacaoAction(apresentacaoId)`.

Stack:
- `puppeteer-core@^21` (sem Chromium bundled)
- `@sparticuz/chromium@^121` (binário pra serverless Vercel)

Fluxo:
1. Server action carrega a apresentação do DB
2. Renderiza HTML completo (todas as páginas) numa rota interna
   `/api/internal/apresenta-yide-pdf/[id]` — protegida por token
3. Puppeteer abre essa URL, espera carregar, gera PDF (formato A4
   landscape, sem header/footer)
4. Salva PDF em `apresentacoes-yide/[id].pdf` no Storage
5. Atualiza `pdf_storage_path` na linha do DB
6. Retorna signed URL pra download

**Vercel config:** função `gerarPdfApresentacaoAction` precisa de
`maxDuration: 60` (default 10s não é suficiente). Adicionar via
route segment config no api route.

**Custo Vercel:** o Chromium do `@sparticuz/chromium` é ~50MB. Vercel
Pro permite até 250MB de função size — OK.

### Server actions

```typescript
// src/lib/apresenta-yide/actions.ts
async function createApresentacaoAction(formData): Promise<{ id }>;
async function gerarSlidesStreamAction(id): Promise<ReadableStream>;
async function gerarPdfApresentacaoAction(id): Promise<{ signedUrl }>;
async function deleteApresentacaoAction(formData): Promise<void>;
```

### Queries

```typescript
// src/lib/apresenta-yide/queries.ts
async function listApresentacoes(userId): Promise<ApresentacaoRow[]>;
async function getApresentacao(id): Promise<ApresentacaoDetail>;
```

## Edge cases

- **Claude retorna JSON malformado** → loga, marca status `erro`,
  oferece "Tentar de novo" no UI.
- **Stream interrompido no meio** → slides parcialmente recebidos
  ficam salvos. Status `gerando` precisa de timeout de 60s pra
  voltar a `erro`.
- **Usuário fecha aba durante geração** → server action continua até
  o fim e salva. Quando reabre, slides estão lá.
- **PDF generation falha** → status fica `pronta` mas `pdf_storage_path`
  null. UI mostra "Gerar PDF" novamente.
- **Prompt vazio ou < 20 chars** → bloqueia client + server side.
- **Mais de 20 apresentações por user** → não há limite duro, mas
  lista paginada (10 por página).

## Testes

**Unit (`tests/unit/apresenta-yide-*`):**
- Parsing de JSON parcial do stream (slides chegando incrementalmente)
- Validação de shape dos templates
- Lógica de quantidade de slides (5-15 hard caps)

**E2E (manual em v1):**
- Criar apresentação → gerar → baixar PDF → abrir PDF e ver visual

## Implementação em fases

Mesmo dentro de v1, divido em 3 PRs sequenciais:

**PR 1 — Foundation:**
- Migration (tabela + bucket)
- Server actions create/list/delete
- Queries
- Página de listagem + página de criação vazia
- Tab no /social-media

**PR 2 — Geração + preview:**
- 6 templates como React components
- Server action de streaming com Claude
- Editor split view
- Preview ao vivo dos slides

**PR 3 — Export PDF:**
- Install puppeteer-core + @sparticuz/chromium
- Route interna pra renderização HTML do deck
- Server action de geração de PDF
- Botão "Baixar PDF" + integração com Storage

## Fora de escopo (v2+)

- Upload de arquivos (PDF/docx) como contexto
- Edição inline de slides após geração
- Mais templates (gráficos, fotos, citações, etc.)
- IA gerando imagens dentro dos slides
- Templates por indústria (saúde, varejo, etc.)
- Marca-d'água do cliente final
- Compartilhamento via link público (sem login)
