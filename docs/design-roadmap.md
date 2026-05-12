# Design — Roadmap

Módulo de criação de artes/criativos por cliente, com style guide próprio
(memória de gostos), geração com IA, aprovação e integração com Social Media.

**Item de menu:** OPERAÇÃO → Design (`/design`)

**Status atual:** Fase 1 implementada (CRUD manual + style guide + estrutura).

---

## Fase 1 — CRUD manual + style guide ✅

**Status:** Implementada · **PR único**

- Página `/design` lista clientes com KPIs (total artes, aguardando, aprovadas)
- Página `/design/[clientId]` mostra biblioteca de artes + style guide lateral
- Modal "Nova arte" com upload de imagens/vídeos (Supabase Storage)
- Workflow de status: `rascunho` → `em_producao` → `aguardando_aprovacao` →
  `aprovado` / `ajustes_solicitados` → `agendado` → `publicado`
- Editar/arquivar artes
- Style guide por cliente: paletas, fontes, mood, tom de voz, marca, evitar,
  referências, exemplos aprovados
- Botão "Gerar com IA" → modal placeholder ("Em breve")
- Bucket Storage `design-criativos` (privado, signed URLs 7d)

---

## Fase 2 — Geração com IA

**Estimativa:** ~5-7 dias · **PR único**

### Provedores

- **OpenAI GPT-Image-1 / DALL-E 3** — `OPENAI_API_KEY`
- **Google Imagen 4** (via Vertex AI ou Google AI Studio) — `GOOGLE_AI_API_KEY`
- **Flux Pro 1.1** (BFL via Replicate ou direto) — `REPLICATE_API_TOKEN` ou `BFL_API_KEY`
- **Ideogram v2** — `IDEOGRAM_API_KEY`

> ⚠️ Claude (Anthropic) NÃO gera imagens — fica de fora da lista.

### Fluxo

1. Usuário clica "Gerar com IA" no `/design/[clientId]`
2. Modal abre com:
   - Seletor de provedor (mostra só os ativos por env var)
   - Campo de prompt
   - Toggle: "incluir style guide no prompt" (default ON)
   - Toggle: "gerar variações" (1, 2, 4)
   - Aspect ratio (puxa do formato selecionado)
3. Server action `generateArteAiAction`:
   - Monta prompt enriquecido com style guide:
     ```
     [Prompt do usuário]
     ---
     Estilo do cliente:
     - Paleta: #0EA5E9, #10B981
     - Fontes: Poppins (títulos), Inter (corpo)
     - Mood: Minimalista, alto contraste
     - Marca: Logo branco no canto inferior direito
     - Evitar: Tons de marrom, fotos de banco
     ---
     Referências aprovadas:
     [URLs dos exemplos_aprovados]
     ```
   - Chama API do provedor escolhido
   - Faz upload da(s) imagem(ns) gerada(s) pra `design-criativos`
   - Cria 1 `design_artes` por variação (status=rascunho, fonte_origem=ia_*, ai_prompt, ai_modelo, ai_metadata)
4. Modal mostra previews → usuário aprova/regenera/edita

### Custo

Cada provedor cobra. Default: rate-limit por usuário (ex: 10 gerações/dia).
Adicionar campo `monthly_ia_credit` em `profiles` ou `organizations` na fase.

---

## Fase 3 — Aprovação do cliente via link público

**Estimativa:** ~3 dias · **PR único** · *Diferencial competitivo*

- Cada arte tem `aprovacao_token` (uuid, já criado na Fase 1)
- Botão "Enviar pra aprovação" gera link `/aprovacao-design/[token]`
- Página pública (sem login):
  - Mostra preview das mídias + copy + hashtags
  - Botão "Aprovar" → status vira `aprovado`, registra `aprovado_por_email`
  - Botão "Pedir ajuste" → status vira `ajustes_solicitados`, salva `ajuste_observacoes`
- Notificação por email/WhatsApp pro designer responsável quando aprovar/ajustar
- Histórico de aprovações em nova tabela `design_aprovacoes_log`

---

## Fase 4 — Integração com Social Media

**Estimativa:** ~2-3 dias · **PR único** · *Depende de Social Media Fase 1*

Quando uma arte está com status `aprovado`:
- Botão "Agendar postagem" abre modal vinculado ao módulo `/social-media`
- Cria `social_media_posts` puxando midias + copy + hashtags da arte
- Status da arte vira `agendado` automaticamente
- Quando Social Media Fase 2 publicar, status da arte vira `publicado`
  (vinculado por `social_media_post_id` em `design_artes`)

---

## Fase 5 — Templates + biblioteca de criativos reutilizáveis

**Estimativa:** ~1 semana · **Pode quebrar em mini-PRs**

- Tabela `design_templates`: prompts/configurações reutilizáveis
- "Salvar como template" em qualquer arte
- Galeria de templates compartilhados na agência
- Variáveis no template: `{cliente.nome}`, `{paleta_principal}`, etc.

---

## Decisões de design

- **Style guide é JSONB** em `clients.design_style_guide` — flexível pra
  evoluir sem migration
- **Mídias em bucket Supabase** `design-criativos` (privado, signed URLs 7d)
- **Múltiplas mídias por arte** (suporta carrossel) via array `midias jsonb`
- **AI metadata** preservada em `design_artes.ai_metadata` pra auditoria/custo
- **Permissões:** designer/videomaker/editor podem criar pra qualquer cliente
  (são produtores de conteúdo); assessor/coord vê só os seus

## Inspiração / concorrentes

- **Canva** — geração + biblioteca + templates
- **Predis.ai** — IA + agendamento social media
- **Postaga / Adcreative.ai** — IA pra criativos de tráfego
- **Looka / Brandmark** — branding com IA
