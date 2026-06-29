# Relatório de Redes Sociais (PDF + Portal) — Design

**Data:** 2026-06-29
**Módulo:** Social Media + Portal do Cliente
**Status:** Aprovado para implementação (Fase 1)

## Objetivo

Gerar um **relatório mensal de redes sociais por cliente** (PDF), com números + miniaturas dos
posts, que a equipe baixa e que também aparece no **Portal do Cliente** pra download. Reaproveita
todo o motor de PDF e o fluxo do **Relatório de Tráfego** já existente.

## Decisões de produto (brainstorm)

1. **Conteúdo (opção B):** números (alcance, engajamento, nº de posts, etc.) **+ miniaturas dos posts**. Sem texto de IA nesta fase (determinístico).
2. **Entrega (opção C):** a equipe **baixa o PDF** e ele também **fica no Portal do Cliente**.
3. **Faseado:**
   - **Fase 1 (esta):** Relatório de Redes Sociais sozinho.
   - **Fase 2 (depois):** opção de gerar **1 PDF combinando Tráfego + Redes Sociais** (seleção de seções).

## Por que reaproveita muito

O sistema de Tráfego (`src/lib/trafego/relatorios/`) já tem: tabela `trafego_relatorios`, geração de
PDF via `generatePdfFromUrl` (puppeteer + @sparticuz/chromium), rota protegida de render
(`/relatorio-trafego-pdf/[id]`), bucket de storage, portal do cliente (`/cliente/relatorios-trafego`)
e download seguro. Vamos **espelhar esse padrão** pro social.

## Diferença-chave vs Tráfego

O relatório de Tráfego usa **IA (Claude) pra gerar slides**. O de redes sociais (opção B) é
**determinístico** — montado direto dos dados (sem IA). Isso **simplifica**: sem streaming de slides,
sem editor de slides. O conteúdo é um layout fixo preenchido com os números + miniaturas.

## Arquitetura (Fase 1)

### 1. Banco (migration manual)

Tabela `social_media_relatorios` (espelha `trafego_relatorios`, sem os campos de IA):

| Coluna | Tipo |
|---|---|
| id | uuid PK |
| cliente_id | uuid FK clients |
| organization_id | uuid FK organizations |
| periodo_inicio, periodo_fim | date |
| dados | jsonb (snapshot agregado: totais + lista de posts c/ thumb e métricas) |
| status | text ('rascunho','gerando','pronta','erro') |
| pdf_storage_path | text |
| publicado_em | timestamptz (null = rascunho/interno) |
| criado_por | uuid |
| created_at, updated_at | timestamptz |

- Índices: (cliente_id, periodo_inicio desc) e (cliente_id, publicado_em desc) where publicado_em not null.
- RLS: interno (authenticated) + policy do portal (publicado_em not null AND cliente_id = jwt client_id), igual tráfego.
- Bucket novo: `relatorios-redes-sociais` (privado), path `{org}/{id}.pdf`.

### 2. Agregação de dados

`src/lib/social-media/relatorios/dados.ts`:
- `montarDadosRelatorio(clienteId, periodoInicio, periodoFim)`:
  - Busca `social_media_posts` publicados no período (status='publicado') + suas métricas (`social_media_metricas`, somadas).
  - Retorna `DadosRelatorioSocial`: `{ totais: {posts, alcance, curtidas, comentarios, salvamentos, compartilhamentos, engajamento}, posts: [{ thumb, legenda, formato, redes, alcance, engajamento, publicado_em }], topPosts: [...] }`.
  - Thumbs = primeira mídia do post (signed URL de leitura).

### 3. PDF — render determinístico

- Rota protegida `src/app/relatorio-redes-sociais-pdf/[id]/page.tsx` (token HMAC, igual a de tráfego), que renderiza o relatório em HTML (React): capa (cliente + mês), resumo (cards de totais), grade de miniaturas dos posts com seus números, encerramento com a marca Yide.
- Geração: `generatePdfFromUrl({ htmlUrl })` (reusa o de apresenta-yide) → buffer → upload no bucket.

### 4. Server actions (`src/lib/social-media/relatorios/actions.ts`)

- `criarRelatorioSocialAction(cliente_id, periodo)` → monta `dados`, insere status 'pronta' (sem etapa de IA).
- `gerarPdfRelatorioSocialAction(id)` → `generatePdfFromUrl` da rota protegida → upload → set pdf_storage_path → signed URL (preview).
- `publicarRelatorioSocialAction(id)` → set publicado_em (vira visível no portal).
- `baixarPdfClienteSocialAction(id)` → portal-safe (cliente logado + dono + publicado) → signed URL.
- Permissão interna: `canManage` (mesmos papéis do social media).

### 5. UI interna

- `src/app/(authed)/social-media/relatorios/` (lista + nova + detalhe), espelhando `/trafego/relatorios`:
  - "Novo relatório": escolhe cliente + mês → cria → mostra preview → **Gerar PDF** → **Baixar** → **Publicar pro cliente**.

### 6. Portal do cliente

- `src/app/(cliente)/cliente/relatorios-redes-sociais/` (lista + detalhe com "Baixar PDF").
- `RelatoriosRedesSociaisSection` no home do portal (últimos publicados).
- Query `listarRelatoriosSociaisPublicados(clienteId)` (publicado_em not null), com cache.

## Tratamento de erros / borda

- Mês sem posts publicados → relatório vazio com aviso ("sem posts publicados no período"); não quebra.
- Métricas ausentes (sem o token de insights) → mostra "—" nos números, mas lista os posts.
- PDF falha → status 'erro', dá pra tentar de novo.
- Portal só serve PDF publicado (RLS + checagem na action).

## Testes

- Unit de `montarDadosRelatorio` (mock supabase): agrega totais corretamente, monta lista de posts, calcula topPosts.

## Fora de escopo (Fase 2+)

- **Combinar Tráfego + Redes Sociais num PDF só** (seleção de seções) — próxima fase.
- Texto de análise por IA (opção C).
- Gráficos de evolução (crescimento de seguidores) — depende de histórico.
- Agendamento automático de relatório mensal.

## Banco de dados

- **1 migration** (`social_media_relatorios` + bucket + RLS). Aplicação manual no Supabase.

## Reaproveitamento direto

- `generatePdfFromUrl` (apresenta-yide), padrão de token HMAC, padrão de bucket/signed URL, padrão de RLS do portal, estrutura de pastas do `/trafego/relatorios`.
