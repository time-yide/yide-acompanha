# Frame Interno — Design (review de vídeo)

**Data:** 2026-07-21
**Status:** aprovado pela Yasmin
**Contexto:** hoje o vídeo final vai no grupo do WhatsApp interno — sem controle de aprovação, comentário se perde. Esta ferramenta é um "Frame.io interno": o vídeo fica numa página com player de qualidade, cada um comenta no momento exato, pede ajuste e aprova. Interno primeiro, depois cliente. Com versões.

---

## 1. Objetivo

Fluxo de review/aprovação de vídeo:
1. Editor sobe o vídeo → **Versão 1**, status **em revisão interna**.
2. Time comenta no tempo ("no 0:12 troca a música"), pede ajustes.
3. Editor sobe **Versão 2** (v1 vai pro histórico).
4. Aprovação interna → status **em revisão cliente**.
5. Cliente acessa (link secreto **e** portal), comenta no tempo, **aprova** ou **pede ajuste** (→ nova versão).
6. Aprovado. 🎉

**Não-objetivos:** edição de vídeo, legendas, comparação lado a lado de versões (v2).

---

## 2. Hospedagem do vídeo (Bunny Stream)

**Bunny Stream** hospeda e transcodifica os vídeos e entrega o player.
- **Upload direto do navegador pro Bunny** (o vídeo NÃO passa pelos nossos servidores — sem custo/limite de upload gigante). O servidor gera a assinatura de upload; o browser envia.
- **Player:** HLS via `hls.js` (player custom, pra controlar o tempo e pular pra um comentário). Download desabilitado (sem controle de "baixar"); proteção por token opcional.
- **Miniatura/duração:** vêm do Bunny.
- **Setup (uma vez, com a Yasmin):** conta Bunny → criar **Stream Library** → pegar `API Key`, `Library ID` e o `CDN Hostname`. Env: `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_CDN_HOSTNAME`. Sem isso, o módulo fica inerte com aviso.

---

## 3. Modelo de dados (Supabase — só metadados leves; vídeo fica no Bunny)

- **`review_video`** — o projeto de review.
  `id, organization_id, cliente_id (fk clientes), titulo, status, criado_por, created_at, updated_at`.
  `status`: `revisao_interna` | `revisao_cliente` | `ajustes` | `aprovado`.
- **`review_versao`** — cada versão do vídeo.
  `id, review_video_id (fk), numero (int), bunny_video_id (guid), pronto (bool), duracao_seg (int), criado_por, created_at`.
- **`review_comentario`** — comentário no tempo.
  `id, versao_id (fk), autor_tipo ('time'|'cliente'), autor_id (uuid null), autor_nome, tempo_seg (int), corpo (text), resolvido (bool), created_at`.
- **`review_link`** — link secreto do cliente (sem login).
  `id, review_video_id (fk), token (text unique), ativo (bool), created_at`.

RLS: leitura pra `authenticated` (padrão do app); escrita via service-role com checagem no código. O acesso público do cliente (link) é servido por rota própria que valida o token via service-role (não usa a sessão).

**Migrations manuais** (4 tabelas + enums), aplicadas no SQL Editor.

---

## 4. Componentização

- `src/lib/bunny/client.ts` — wrapper da API Bunny: `criarVideo(titulo)` → guid; `assinaturaUpload(guid)` (assinatura pro browser); `statusVideo(guid)`; `apagarVideo(guid)`; helpers de URL (playlist HLS, thumbnail).
- `src/lib/review/schema.ts` — tipos + máquina de status (transições válidas, pura/testável).
- `src/lib/review/queries.ts` — listar reviews, carregar review+versões+comentários, resolver por token.
- `src/lib/review/actions.ts` — criar review, registrar versão (após upload), comentar, resolver comentário, aprovar interno, gerar link, aprovar/pedir-ajuste (cliente).
- `src/components/review/Player.tsx` — player `hls.js` client, expõe tempo atual + `seek(seg)`.
- `src/components/review/Comentarios.tsx` — painel de comentários no tempo (criar/seek/resolver).
- `src/components/review/UploadVersao.tsx` — upload direto pro Bunny (browser) + registra a versão.
- Páginas:
  - `src/app/(authed)/audiovisual/review/page.tsx` — lista.
  - `src/app/(authed)/audiovisual/review/[id]/page.tsx` — review interno.
  - `src/app/r/[token]/page.tsx` — acesso público do cliente (Fase B).
  - Integração no **portal do cliente** (Fase B).

---

## 5. Fases de construção

### Fase A — Interno (substitui o WhatsApp)
- Criar review (cliente + título) + upload v1 pro Bunny.
- Player + comentários no tempo (time) + resolver.
- Upload de novas versões + histórico.
- Aprovação interna (muda status).
- Lista de reviews no Audiovisual.
- **Entrega:** o time já para de usar o grupo do WhatsApp pra revisar.

### Fase B — Cliente
- Gerar **link secreto** → rota pública `/r/[token]` (sem login) com player + comentar + aprovar/pedir-ajuste.
- Aparecer no **portal do cliente** (logado).
- Cliente aprova (→ aprovado) ou pede ajuste (→ ajustes → nova versão).
- Notificação pro time quando o cliente responde.

---

## 6. Permissões
- Criar / upload / aprovar interno: audiovisual (videomaker, editor, fast_midia, designer, audiovisual_chefe) + adm/socio/coordenador.
- Comentar interno: qualquer colaborador autenticado do time.
- Cliente (Fase B): via link (comenta + aprova como "cliente") e via portal.

---

## 7. Erros e bordas
- Vídeo ainda processando no Bunny → player mostra "processando…" e faz polling do status.
- Upload falho → permite reenviar a versão.
- Token de link inválido/inativo → página amigável "link expirado".
- Aprovar/pedir-ajuste fora do status certo → bloqueia com aviso (máquina de status).
- Bunny não configurado → módulo inerte com aviso de setup.

---

## 8. Testes
- `schema.ts` (máquina de status) — pura, testada (transições válidas/invalidas).
- Geração de token do link — pura/determinística o suficiente pra testar formato/unicidade.
- Bunny I/O e player — camada fina + teste manual (não unit-testável sem conta/near-browser).

---

## 9. Dependências novas
- `hls.js` (player) e provavelmente `tus-js-client` (upload resumável pro Bunny).
- Conta Bunny Stream (paga, barata) + setup.

---

## 10. Critérios de aceite
### Fase A
- [ ] Criar review + subir vídeo (direto pro Bunny) → vira v1.
- [ ] Player toca com qualidade; comentários no tempo (criar/seek/resolver).
- [ ] Subir nova versão; histórico de versões.
- [ ] Aprovar internamente muda o status.
- [ ] Lista de reviews no Audiovisual. Bunny não configurado = aviso.
### Fase B
- [ ] Gerar link secreto; `/r/[token]` público com player + comentar + aprovar/pedir-ajuste.
- [ ] Aparece no portal do cliente.
- [ ] Cliente aprova/pede ajuste; time é notificado.
