# Social Media — Roadmap

Módulo de gestão de postagens nas redes sociais (estilo mLabs). Substitui o uso
externo de ferramentas tipo mLabs/Etus/Postgrain pra clientes da agência.

**Item de menu:** OPERAÇÃO → Social Media (`/social-media`)

**Status atual:** Placeholder (PR que adicionou esse doc também adicionou a
página/menu de "em construção").

---

## Fase 1 — Calendário + criação manual

**Estimativa:** ~3 dias · **PR único**

- Página `/social-media` lista clientes com calendário visual
- Página `/social-media/[clientId]` calendário mensal/semanal
- Modal "Novo post":
  - Upload de imagem/vídeo (Supabase Storage bucket `social-media-creatives`)
  - Legenda + hashtags + primeiro comentário
  - Escolha de data/hora de publicação
  - Escolha de redes (IG, FB) — multi-select
  - Status: `rascunho` | `agendado` | `aprovado` | `publicado` | `falha`
- Filtros por cliente, status, rede
- Não publica ainda — só salva no sistema

**Tabelas novas:**
- `social_media_posts` — id, client_id, autor_id, midias (jsonb com URLs), legenda,
  primeiro_comentario, hashtags, redes (text[]), agendar_para (timestamptz),
  status, created_at
- `social_media_publicacoes` — id, post_id, rede, external_id, publicado_em, erro
  (1 linha por rede onde o post foi publicado)

**Sem dependências externas.** Pode mergear independente da Fase 2.

---

## Fase 2 — Publicação automática (Meta)

**Estimativa:** ~5 dias · **PR único**

- Cadastro `clients.instagram_business_id` + `clients.facebook_page_id`
- Cron `/api/cron/social-media-publisher` roda a cada 5min
  - Busca posts com `status='agendado'` e `agendar_para <= now()`
  - Pra cada rede selecionada, chama Meta Graph API
  - Sucesso → status `publicado` + grava em `social_media_publicacoes`
  - Erro → status `falha` + registra mensagem
- Suporte a:
  - Feed image (single)
  - Feed carrossel (múltiplas imagens)
  - Reels (vídeo)
  - Facebook Page post (texto, imagem, vídeo, link)
  - Stories — só com permissão extra `instagram_content_publish` no app
- Sync diário de stats: `/api/cron/social-media-stats`
  - Pra cada `social_media_publicacoes`, busca insights:
    - Curtidas, comentários, salvamentos, alcance, impressões
  - Grava em `social_media_post_stats` (post_id, dia, key, valor)

**Token:** mesmo System User Token do Tráfego Fase 2 (env `META_ACCESS_TOKEN`).
Permissões necessárias: `pages_manage_posts`, `instagram_content_publish`,
`pages_read_engagement`, `instagram_basic`.

**Pré-requisitos da agência:**
- Cada Instagram do cliente como Business/Creator
- Vinculado a uma Facebook Page dentro da BM
- App Meta criado com Marketing API + permissões acima

---

## Fase 3 — Aprovação do cliente

**Estimativa:** ~3 dias · **PR único** · *Diferencial competitivo do mLabs*

- Cada post gera link público `/aprovacao/[token]` (sem login)
- `social_media_posts.aprovacao_token` (uuid único, sem index search)
- Cliente abre link, vê preview de como vai ficar publicado
- Aprova ou pede ajuste com comentário
- Workflow:
  - Quando configurado pra cliente: post fica `aguardando_aprovacao` antes de
    `agendado`. Só vai pra `agendado` depois de aprovado.
  - Configuração no client: `requer_aprovacao_post boolean default false`
- Notificação ao aprovar/reprovar:
  - Email pro autor do post
  - WhatsApp pro coordenador do cliente (se tiver número cadastrado)
- Histórico de aprovações em `social_media_aprovacoes`

---

## Fase 4 — Multi-rede + extras

**Estimativa:** ~1 semana · **Pode quebrar em mini-PRs**

### LinkedIn Company Page
- OAuth 2.0 por página (token expira a cada 60 dias — refresh flow)
- POST a `/v2/ugcPosts` ou `/v2/shares`
- `clients.linkedin_company_id` + `clients.linkedin_oauth_token`

### Google Meu Negócio
- API My Business Posts (`localPosts.create`)
- Já temos `clients.gmn_url` — adicionar `clients.gmn_location_id`

### Biblioteca de templates
- Tabela `social_media_templates`: legenda padrão, hashtags padrão por categoria
- Modal "Usar template" no novo post

### Repostar / duplicar com adaptação por rede
- Botão "Duplicar" copia post pra outra data
- Editor por rede: pode customizar legenda diferente IG vs LinkedIn

### Inbox unificada
- Cron sincroniza DMs/comentários do Meta
- Tabela `social_media_inbox` (rede, conversa_id, autor, mensagem, lida)
- Página `/social-media/inbox` agrupada por cliente

---

## Decisões de design

- **Upload de mídia** vai pra bucket Supabase `social-media-creatives` (privado).
  Pra publicar via Meta, gera URL pública temporária (signed URL 1h).
- **Stats** ficam em tabela separada (key/value) pra acomodar métricas novas
  sem migration — mesmo padrão de `trafego_metricas_diarias`.
- **Múltiplas contas por cliente:** suportar 1 Instagram + 1 Facebook por cliente
  no MVP. Multi-conta (vários IGs por cliente) só se virar demanda real.
- **Permissões:** assessor/coord vê só os seus clientes; designer/videomaker/editor
  vê todos pra criar conteúdo; adm/sócio vê tudo.

## Ferramentas competidoras pra inspirar

- **mLabs** — referência principal, agência brasileira
- **Etus** — calendário visual bonito
- **Postgrain** — UX de aprovação cliente bem feita
- **Buffer / Hootsuite** — gringo, mais corporate
