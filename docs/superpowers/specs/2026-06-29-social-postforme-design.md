# Social Media — TikTok / YouTube / LinkedIn via Post for Me

**Data:** 2026-06-29
**Módulo:** Social Media (`/social-media`)
**Status:** Aprovado para implementação (build aguarda a `POST_FOR_ME_API_KEY`)

## Objetivo

Permitir publicar e agendar posts em **TikTok, YouTube (Shorts) e LinkedIn** reaproveitando o
compositor/agendamento que já existe, usando o agregador **Post for Me** (Quickstart = sem precisar
passar pela aprovação de cada plataforma). Arquitetura com **camada trocável** pra migrar essas
redes pra integração nativa no futuro, sem mexer no resto.

## Decisões de produto (brainstorm)

1. **Redes nesta entrega:** TikTok, YouTube, LinkedIn. **Google Meu Negócio fica fora** (Post for Me não cobre — vai separado depois).
2. **Quem conecta:** a equipe Yide (botões "Conectar X" por cliente, igual o setup do Meta).
3. **Camada trocável:** publicação por *adaptador por rede* (Meta nativo pra IG/FB; Post for Me pra TikTok/YT/LinkedIn).

## Pré-requisito operacional (Yasmin, antes do build)

1. Criar conta em **postforme.dev** (plano ~$10/mês).
2. Pegar a **API key** no painel → configurar `POST_FOR_ME_API_KEY` no Vercel (todos os ambientes) + redeploy.
   Sem a chave, a UI mostra "não configurado" e nada quebra.

## API do Post for Me (base `https://api.postforme.dev/v1`, auth Bearer)

- `POST /v1/social-accounts/auth-url` → gera URL de OAuth pra conectar uma conta (por plataforma).
- `GET /v1/social-accounts` → lista contas conectadas (id, platform, username...).
- `POST /v1/social-accounts/{id}/disconnect` → desconecta.
- `POST /v1/social-posts` → publica: `{ caption, social_accounts: [ids], media: [{url}], ...config por plataforma }`.
- `GET /v1/social-post-results` → status do post (publicado/erro) por conta.
- `POST /v1/media/create-upload-url` → (opcional) upload de mídia; também aceita URL pública.

> Os nomes exatos de campos (params do `auth-url`, formato de `media`, configs por plataforma, e
> o mecanismo de captura da conta após o OAuth) serão **fixados na implementação contra a API real**
> (com a chave + docs autenticadas). Esta spec define o comportamento; o plano fixa os campos.

## Arquitetura

### 1. Banco (migration manual)

Tabela `client_postforme_accounts` (conta conectada por cliente+rede):

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `client_id` | uuid FK → clients | on delete cascade |
| `plataforma` | text | 'tiktok' \| 'youtube' \| 'linkedin' |
| `account_id` | text | ID da conta no Post for Me |
| `username` | text null | exibição |
| `conectado_em` | timestamptz | |
| unique `(client_id, plataforma)` | | 1 conta por rede por cliente |

RLS no padrão das outras social (`authenticated` select/insert/update/delete; escrita real via service-role nas actions).

### 2. Cliente HTTP (server-only)

`src/lib/social-media/postforme.ts`:
- `pfmFetch(path, {method, body})` → injeta `Authorization: Bearer POST_FOR_ME_API_KEY`, base v1, trata erro/JSON.
- `gerarAuthUrl(plataforma, opts)` → POST /social-accounts/auth-url.
- `listarContas()` / `getConta(id)` → GET /social-accounts.
- `publicarPostforme({ accountIds, caption, mediaUrls, ... })` → POST /social-posts; retorna `{ postId } | { error }`.
- `getResultado(postId)` → GET /social-post-results.

### 3. Camada de publicação trocável (adaptador)

- `src/lib/social-media/publishers/` com a ideia de **um publisher por rede**:
  - `meta` (já existe via `meta-publish.ts`) → instagram, facebook.
  - `postforme` → tiktok, youtube, linkedin.
- `publish-actions.ts` decide, por rede do post, qual publisher chamar. Pra trocar TikTok pra nativo no futuro = trocar o mapeamento daquela rede.

### 4. Conectar contas (UI)

- No `AccountsModal` (modal "Contas" do cliente), seção nova "Outras redes (via Post for Me)":
  - Linha por rede (TikTok/YouTube/LinkedIn): mostra **conectado ✓ (@user)** ou botão **"Conectar"**.
  - "Conectar" → server action chama `gerarAuthUrl` → abre o link (nova aba) → após autorizar, a conta é capturada e salva (mecanismo de captura fixado na implementação: callback/route ou re-listagem por `external_id`).
  - "Desconectar" → action chama disconnect + remove a linha.

### 5. Compositor + redes

- `tipos.ts` (`REDES`/`REDES_VALIDAS`): adicionar `tiktok`, `youtube` (LinkedIn já existe como placeholder — ativar). Tirar o selo "Fase 4" das que entrarem.
- `PostFormModal`: as novas redes aparecem nos checkboxes.
- **Validação de formato por rede:** TikTok/YouTube exigem **vídeo** nas mídias; LinkedIn aceita texto/imagem. Se a combinação for inválida (ex: TikTok sem vídeo), avisa antes de salvar/publicar.

### 6. Publicar + status

- `publishPostById` (cron + manual): pras redes do Post for Me, chama `publicarPostforme` com as contas do cliente + legenda + URLs de mídia (signed URLs já geradas). Grava resultado/erro por rede (reusa `social_media_publicacoes` ou campos do post).
- Status: consulta `getResultado` (no cron seguinte ou sob demanda) e reflete no post.

## Tratamento de erros / borda

- `POST_FOR_ME_API_KEY` ausente → actions retornam erro amigável; UI mostra "não configurado".
- Cliente sem a conta conectada pra uma rede marcada → erro claro ("conecte o TikTok do cliente primeiro").
- Formato incompatível (TikTok sem vídeo) → bloqueia com aviso.
- Falha numa rede não derruba as outras (publica nas que der; marca falha nas que não).

## Testes

- Unit test do `postforme.ts` com `fetch` mockado: monta request de publicação correto; trata erro da API; mapeia resultado.
- Unit test da validação de formato por rede (TikTok exige vídeo, etc.).

## Fora de escopo (depois)

- Google Meu Negócio (Post for Me não cobre).
- Métricas dessas 3 redes.
- Conexão self-service pelo cliente (link enviado ao cliente).
- Migração pra nativo (a arquitetura deixa pronto, mas a troca em si é outro projeto).

## Banco de dados

- **1 migration** (`client_postforme_accounts`). Aplicação **manual** no Supabase após o merge.

## Config / dependência

- Env: `POST_FOR_ME_API_KEY` (Vercel).
- Sem dependência npm nova obrigatória (HTTP direto via `fetch`); opcionalmente o SDK oficial, decidido no plano.
