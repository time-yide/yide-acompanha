# Aprovação de vídeo pelo cliente (Frame → cliente)

**Data:** 2026-07-27
**Status:** aprovado no brainstorm, aguardando revisão do spec

## Problema

Hoje o vídeo sobe pro Frame (Bunny) dentro do sistema e passa por **revisão interna** da equipe (player + comentários com marcação de tempo). Mas **não existe forma de mandar esse vídeo pro cliente aprovar**: o player é interno (exige login da equipe) e a URL crua do Bunny é técnica. O status `revisao_cliente` já existe no banco, mas nunca teve tela.

Resultado: a aprovação do cliente acontece por fora (WhatsApp/Drive), sem registro no sistema.

## Objetivo

Dar ao cliente uma tela pra **assistir o vídeo**, **comentar marcando o tempo** e **Aprovar** ou **Pedir alteração** — acessível por **link público** (sem login) **e** pelo **painel logado** do cliente. As respostas do cliente voltam pra tarefa e notificam a equipe.

## Fluxo (confirmado no brainstorm)

1. Editor sobe o vídeo → `revisao_interna` (Frame atual, comentários da equipe). *(já existe)*
2. **Assessor/equipe revisa primeiro**; pode pedir ajuste pro editor (nova versão) — *(já existe)*.
3. Equipe satisfeita → **"Enviar pro cliente"** → status vira `revisao_cliente` e o link fica disponível. *(hoje `aprovarInternoAction` já faz essa transição; falta expor o link)*
4. **Cliente** assiste (link público ou painel) e pode:
   - **Aprovar** → status `aprovado`; tarefa vai pra aprovada/concluída.
   - **Pedir alteração** → comentários com tempo (`autor_tipo='cliente'`, `tempo_seg`); status `ajustes`; tarefa volta pra "alteração".
5. Se pediu alteração → **notifica a equipe** → editor sobe nova versão → **volta pra revisão interna (assessor)** → reenvia pro cliente. Vai nesse laço até o cliente **aprovar**. O cliente sempre vê a **versão mais recente**.

## O que JÁ existe (reaproveitar)

- Tabelas `review_video` (tem `task_id`, `cliente_id`, `status`, `titulo`), `review_versao` (`bunny_video_id`, `numero`, `pronto`, `duracao_seg`), `review_comentario` (`autor_tipo` `time|cliente`, `tempo_seg`, `corpo`, `autor_nome`, `resolvido`).
- Enum `review_status`: `revisao_interna | revisao_cliente | ajustes | aprovado`.
- Player interno + comentários com tempo (`src/lib/review`, `src/lib/bunny/client`: `urlPlaylist`, `urlThumbnail`, `statusVideo`).
- Transição interna → cliente: `aprovarInternoAction` (`revisao_interna` → `revisao_cliente`).
- **Padrão de link público por token** (design/post): coluna `aprovacao_token uuid unique default gen_random_uuid()`, página `/aprovacao-{tipo}/[token]` que valida o UUID e busca via **service-role** (sem login), e `ApprovalClient`/`ApprovalLinkButtons` (copiar link + enviar).
- Sistema de notificação (usado em `src/lib/review/actions.ts`).

## O que falta construir

### 1. Dado (migration — aplicação MANUAL no SQL Editor, padrão do projeto)
- `alter table review_video add column aprovacao_token uuid unique default gen_random_uuid();`
- (opcional) `enviado_cliente_em timestamptz` pra registrar quando foi enviado.
- **RLS:** nada de anon. Todo acesso público passa por **server actions com service-role validando o token** (mesmo padrão do design). As policies atuais (`using(true)` pra authenticated) continuam.

### 2. Server — acesso público por token (service-role)
Em `src/lib/review/aprovacao-cliente.ts` (novo):
- `getReviewPorToken(token)`: valida UUID; busca review + **versão atual** (maior `numero`, `pronto`) + `playlistUrl`/`thumbUrl` + comentários **só do cliente** (`autor_tipo='cliente'`) + status. Retorna `null` se token inválido.
- `comentarComoClienteAction(token, tempo_seg, corpo, nome?)`: insere `review_comentario` com `autor_tipo='cliente'`, `tempo_seg`, `autor_nome` (nome do cliente ou "Cliente"). Só permite se status = `revisao_cliente`.
- `aprovarComoClienteAction(token)`: status → `aprovado`; atualiza a tarefa vinculada (`task_id`) pro status de aprovado; **notifica a equipe** (responsável/criador) com link `/tarefas/{task_id}`.
- `pedirAlteracaoComoClienteAction(token)`: status → `ajustes`; tarefa volta pra "alteração"; **notifica a equipe**. (Os comentários já foram inseridos via `comentarComoClienteAction`.)

*Guardas:* ações checam o status atual antes de transicionar (não deixa aprovar 2x, não deixa comentar depois de aprovado).

### 3. Página pública do cliente
- `src/app/aprovacao-video/[token]/page.tsx` (server): `getReviewPorToken` → `notFound()` se inválido → renderiza `ApprovalVideoClient`.
- `ApprovalVideoClient` (client component):
  - **Player** do Bunny (HLS via `playlistUrl`).
  - Clicar/pausar num ponto e **escrever comentário naquele segundo**; lista os comentários **do próprio cliente**.
  - Botões **Aprovar** e **Pedir alteração**.
  - Estados: `revisao_cliente` = pode agir; `ajustes` = "enviado pra equipe, aguarde nova versão"; `aprovado` = "vídeo aprovado ✅"; `revisao_interna` = "ainda em ajuste interno".
  - **NÃO** mostra comentários internos (`autor_tipo='time'`).
  - Sem login. O comentário é assinado com o **nome do cliente do registro** (`cliente_id` → `clients.nome`), com fallback "Cliente" se `cliente_id` for nulo. Não pede nome ao usuário.

### 4. Painel logado do cliente
- Em `src/app/(cliente)/cliente`, seção/card "Vídeos pra aprovar": lista reviews do `cliente_id` com status `revisao_cliente`, cada um linkando pra `/aprovacao-video/{token}` (reaproveita a mesma página). Query via service-role (portal já usa esse padrão).

### 5. Equipe — disparar e acompanhar (na tarefa)
- Na seção de review da tarefa (`/tarefas/{id}`), quando status = `revisao_cliente`: botão **"Copiar link do cliente"** + indicador "aguardando cliente". Espelha `ApprovalLinkButtons` do design.
- O "Enviar pro cliente" reusa a transição interna → cliente (`aprovarInternoAction`, renomeando o rótulo na UI pra "Enviar pro cliente" onde fizer sentido). Quando o cliente responde, os comentários dele já aparecem no Frame interno (a equipe vê tudo, `review_comentario_read` é `using(true)`), e o status/tarefa refletem.

### 6. Notificações
- Cliente **aprovou** → notifica responsável/criador: "Cliente aprovou o vídeo: {título}", link `/tarefas/{task_id}`.
- Cliente **pediu alteração** → notifica: "Cliente pediu alteração no vídeo: {título}", link `/tarefas/{task_id}`.
- (Cliente recebe o link por WhatsApp manualmente — sem notificação pro cliente na v1.)

## Riscos / a confirmar na implementação
- **Playback público do Bunny:** confirmar que `playlistUrl` toca **sem auth da equipe** (biblioteca pública) ou se precisa **URL assinada** pro cliente. Se precisar assinar, gerar token de playback curto no server ao abrir a página. *(bloqueante da tela do cliente — validar cedo)*
- **Reinício do laço:** ao subir nova versão depois de `ajustes`, o status volta pra `revisao_interna` (assessor revê antes de reenviar). Confirmar que o fluxo de nova versão seta isso.
- O mesmo **token** é reutilizado em todas as rodadas (o link não muda); o cliente sempre vê a versão atual.

## Fora de escopo (v1)
- Notificação/e-mail automático pro cliente (envio é manual por WhatsApp).
- Cliente responder comentário da equipe / thread.
- Marcar comentário do cliente como "resolvido" pela equipe na tela do cliente (a equipe resolve no Frame interno).
- Aprovação por vídeo individual quando a tarefa tem vários (tratar 1 review = 1 fluxo; múltiplos vídeos seguem o comportamento atual do Frame).

## Testes
- Unit: transições de status (aprovar/pedir alteração só de `revisao_cliente`; bloquear ações fora de estado); `getReviewPorToken` filtra comentários internos; token inválido → null.
- Fluxo: enviar pro cliente → comentar com tempo → pedir alteração → nova versão → reenviar → aprovar.
