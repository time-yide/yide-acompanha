# Ligações por Twilio (webphone no navegador) — Design

**Data:** 2026-06-30
**Status:** Aprovado para implementação (pendente revisão final da Yasmin)

## Contexto e problema

O módulo `/ligacoes` tem uma integração de voz com a **Zenvia** (ex-TotalVoice)
pronta no código (discar + gravar + ouvir via webhook). Porém o **cadastro da
conta Zenvia ficou travado** — suporte contatado por e-mail, sem resposta. O
código está pronto mas nunca ficou operacional.

Decisão: **trocar o provedor de voz para a Twilio**, mantendo a mesma
experiência (a comercial liga pelo computador, com gravação, e a Yasmin ouve
depois).

### Por que Twilio (e não Telnyx/Plivo)
- **Cadastro self-service na hora** — resolve o bloqueio central (onboarding),
  que foi o que travou na Zenvia. Telnyx tem verificação manual de conta (risco
  de repetir a espera); Plivo **não faz ligação para celular no Brasil** (só
  fixo) — descartada, já que os leads são majoritariamente celular.
- SDK de voz no navegador maduro (`@twilio/voice-sdk`), gravação nativa,
  webhooks de status.

### Custo (referência, volume ~100 ligações/dia, curtas, ~2.200/mês)
- Todas as CPaaS cobram **mínimo 60s** por ligação (não existe por-segundo).
- Ligação **não atendida ≈ grátis** (só a perna do navegador, centavos).
- Twilio: navegador→celular BR gravando ≈ **US$ 0,073/min ≈ R$ 0,40/min**;
  fixo ≈ R$ 0,21/min. Estimativa mensal: **~R$ 380**, sem mensalidade.
- Números Twilio: navegador US$ 0,0040/min · celular BR US$ 0,0663/min · fixo
  BR US$ 0,0310/min · gravação US$ 0,0025/min · número BR US$ 4,25/mês (opcional).

## Princípios do design

1. **Aditivo, não destrutivo.** A Zenvia continua funcionando como provedor
   selecionável. A Twilio é adicionada ao lado. Nada do fluxo Zenvia é removido.
2. **Reaproveitar o que já existe.** O banco (`ligacoes`, `ligacoes_instancias`)
   já é agnóstico de provedor e o valor `twilio` já está liberado nos CHECK
   constraints de `provedor` e `origem` → **sem migration**. A tela de detalhe,
   o player de áudio e o dashboard não mudam.
3. **Isolamento.** Todo código específico da Twilio fica isolado em um arquivo
   de cliente + rotas de webhook próprias, espelhando o padrão do `zenvia.ts`.

## Experiência (UX)

**Comercial (ligar):** abre `/ligacoes` no PC com fone → clica **Ligar** no lead
→ o navegador vira o telefone (toca, atende, conversa) → ao desligar, o sistema
registra número, duração, horário e o link da gravação. Tudo gravado
automaticamente.

**Yasmin (ouvir):** abre a ligação → player ▶️ da gravação (componente já
existe). Dashboard mostra volume/duração/atendidas-perdidas (já existe).

**O lead vê:** o número verificado configurado (ex.: o número da empresa) — um
número BR conhecido, não internacional.

**Aviso legal:** como tudo é gravado, avisar equipe + cliente. Opção de
incluir um aviso automático no início da chamada (TwiML `<Say>`) — configurável,
default ligado.

## Arquitetura técnica

### Fluxo de uma ligação (saída, pelo navegador)
1. Browser pede um **Access Token** ao servidor (`getTwilioTokenAction`) — JWT
   com `VoiceGrant` apontando para o TwiML App.
2. Browser (SDK `@twilio/voice-sdk`) faz `device.connect({ params: { To,
   instancia_id, contato_nome } })`.
3. Twilio chama nosso **webhook de voz** (`/api/ligacoes/twilio/voice`), que:
   - cria a linha em `ligacoes` (`origem='twilio'`, `external_id=CallSid`,
     `status='em_andamento'`, `iniciada_em=now()`);
   - retorna TwiML `<Dial callerId="{numero_verificado}" record="record-from-answer"
     recordingStatusCallback="/api/webhooks/ligacoes/twilio?secret=...">
     <Number>{To}</Number></Dial>` (com `<Say>` opcional de aviso antes).
4. **Webhook de status/gravação** (`/api/webhooks/ligacoes/twilio`) recebe o
   fim da chamada + a `RecordingUrl` → atualiza a linha por `CallSid`
   (`status` mapeado, `duracao_segundos`, `gravacao_url`, `finalizada_em`,
   `raw_data`). Idempotente por `external_id` (índice já existe).

### Arquivos novos
- `src/lib/ligacoes/twilio.ts` — gera Access Token (VoiceGrant), monta o TwiML
  de saída, faz o parse do payload do webhook e o mapeamento de status
  Twilio→interno. Espelha a forma do `zenvia.ts`.
- `src/app/api/ligacoes/twilio/voice/route.ts` — rota TwiML de voz (passo 3).
- `src/app/api/webhooks/ligacoes/twilio/route.ts` — status + gravação (passo 4).
- `src/components/ligacoes/DiscadorTwilio.tsx` — webphone WebRTC (pede permissão
  de microfone, mostra estado tocando/em-chamada/desligar). Renderizado quando a
  instância do colaborador é `provedor='twilio'`.

### Arquivos alterados
- `src/lib/ligacoes/actions.ts`
  - `getWebphoneUrlAction`: para `twilio`, retorna o token/identidade em vez da
    URL de iframe; mantém o caminho Zenvia para `totalvoice`.
  - novo `getTwilioTokenAction` (ou estende o existente).
  - `iniciarLigacaoAction`: para `twilio`, a chamada nasce no browser via Device;
    a linha do banco é criada no webhook de voz (passo 3). Branch por provedor.
- `src/components/ligacoes/Discador.tsx` — decide entre webphone Zenvia (iframe)
  e `DiscadorTwilio` conforme o provedor da instância.
- `src/components/ligacoes/InstanciaFormModal.tsx` — opção "Twilio (ligar pelo
  sistema)"; campo do **número verificado** (caller ID); bloco com as URLs de
  webhook pra colar no TwiML App da Twilio.
- `src/components/ligacoes/LigarButton.tsx` — mensagem/estado quando a instância
  é Twilio (atualmente o texto é "Sem instancia Zenvia").
- `src/lib/ligacoes/instancias.ts` — `PROVEDOR_DEFS`: Twilio passa a `status:
  "pronto"`, com `webhookHint` e `campos` (número verificado).
- `src/lib/env.ts` — novas envs (abaixo).
- `package.json` — dependências `twilio` (servidor) e `@twilio/voice-sdk`
  (navegador).

### Variáveis de ambiente (Vercel, server-side)
- `TWILIO_ACCOUNT_SID`
- `TWILIO_API_KEY_SID`
- `TWILIO_API_KEY_SECRET`
- `TWILIO_TWIML_APP_SID`
- (o número verificado / caller ID fica **por instância** no banco, não em env)

Sem qualquer env configurada, o caminho Twilio fica inerte (igual à Zenvia hoje):
o botão fica desabilitado com mensagem amigável, sem quebrar nada.

### Banco de dados
**Sem migration.** `provedor='twilio'` e `origem='twilio'` já estão nos CHECK
constraints. O caller ID por instância cabe em `numero` (ou `credenciais` jsonb)
— a definir na implementação, preferindo `numero` por simplicidade.

### Segurança
- Webhook autenticado por `?secret=` casando com `ligacoes_instancias.webhook_secret`
  (padrão já usado pela Zenvia). Idealmente validar também a assinatura
  `X-Twilio-Signature` (defense-in-depth) — incluir se não custar muito.
- Access Token de vida curta (ex.: 1h), gerado só para o colaborador logado com
  papel autorizado.

## Setup operacional (Yasmin faz uma vez — passo a passo no fim da implementação)
1. Criar conta Twilio e **adicionar crédito** (sai do trial; libera ligar pra
   qualquer número).
2. **Voice Geographic Permissions** → habilitar Brasil.
3. **Verified Caller ID**: verificar um número que vocês já têm (recebe um código
   por ligação) — sem comprar número nem fazer o cadastro regulatório da Anatel.
   (Alugar número BR é opcional e exige o regulatory bundle — pode ficar pra
   depois.)
4. Criar **API Key** (SID + Secret) e pegar o **Account SID**.
5. Criar um **TwiML App** e apontar a Voice URL para
   `https://<app>/api/ligacoes/twilio/voice`.
6. Colar as 4 chaves nas envs do Vercel.
7. No sistema: criar/editar uma instância de telefone → provedor **Twilio** →
   informar o número verificado → atribuir à comercial.
8. Combinar o aviso legal de gravação com a equipe.

## Fora de escopo (YAGNI)
- Receber ligações de entrada pela Twilio (só saída agora).
- Alugar número BR dedicado / regulatory bundle (opcional, depois).
- Transcrição/resumo por IA (colunas já existem, mas não nesta entrega).
- WhatsApp.

## Testes / verificação
- `tsc --noEmit` e `eslint` limpos.
- Teste manual com a conta real: ligar para um número verificado da própria
  Yasmin, confirmar que toca, grava, e que a `gravacao_url` aparece no player.
- Como depende de setup operacional + custo por minuto, o teste real fica para
  depois das chaves configuradas (igual foi com a Zenvia).
