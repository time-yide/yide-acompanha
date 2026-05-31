# Ligações: integração de voz real via Zenvia (ex-TotalVoice)

**Data:** 2026-05-31
**Branch:** `feat/ligacoes-zenvia` (worktree `.claude/worktrees/ligacoes-zenvia`, base `origin/main`)

## Objetivo

Tornar o módulo `/ligacoes` capaz de **fazer e registrar ligações de voz de verdade** (não só registro manual), via a API de voz da **Zenvia (ex-TotalVoice)**, usando o **webphone hospedado** da Zenvia embutido no sistema. O colaborador liga pelo navegador (com fone), e cada ligação é registrada automaticamente (status, duração, gravação) sem ninguém anotar à mão.

WhatsApp continua como está (placeholder "em construção"); este projeto é só o canal **telefone/VoIP**.

## Decisões de produto (alinhadas com a usuária)

- **Provedor:** Zenvia Voz (ex-TotalVoice). Provedor `totalvoice` já existe no enum do banco.
- **Modelo de chamada:** webphone hospedado da Zenvia (`GET /webphone`) embutido no sistema. Não construímos WebRTC do zero.
- **Construir agora, credenciais depois:** o código fica pronto; a Zenvia (conta + token + ramal + webhook no painel) é responsabilidade da usuária e pode entrar depois. Sem credenciais, o recurso fica visível mas inativo (sem quebrar o resto do módulo).
- **Gravação de áudio: desligada por padrão** (custo extra), com toggle por instância.
- **Ligações recebidas (entrada) também são registradas** pelo mesmo webhook (sem custo adicional).
- **Um ramal por colaborador** (encaixa no modelo `ligacoes_instancias`, que já é 1 colaborador por instância).
- **Token da Zenvia em variável de ambiente** (`ZENVIA_VOICE_TOKEN`), igual ao padrão de outros segredos do projeto (VAPID). Não fica no banco.

## Arquitetura / componentes

Reaproveita o módulo existente (`src/lib/ligacoes/`, `src/components/ligacoes/`, `src/app/(authed)/ligacoes/`). Novos arquivos/mudanças:

1. **Cliente Zenvia** — `src/lib/ligacoes/zenvia.ts` (SERVER ONLY)
   - `iniciarChamada({ numeroOrigem, numeroDestino, gravar, tags })` → `POST https://voice-api.zenvia.com/chamada` com header `Access-Token: $ZENVIA_VOICE_TOKEN`. Retorna o id da chamada da Zenvia.
   - `getWebphoneUrl(ramal)` → `GET https://voice-api.zenvia.com/webphone` (monta a URL do webphone pré-configurada pro ramal).
   - `mapStatusZenvia(statusZenvia)` → mapeia status da Zenvia (`atendida`, `nao_atendida`/`sem_resposta`, `ocupado`, `falha`, etc.) para o enum interno (`atendida`/`perdida`/`ocupada`/`caixa_postal`/`rejeitada`/`cancelada`).
   - No-op seguro quando `ZENVIA_VOICE_TOKEN` ausente (loga warning, retorna erro tratável).

2. **Ação de discagem** — `iniciarLigacaoAction` em `src/lib/ligacoes/actions.ts`
   - Recebe `{ numero, instancia_id, contato_nome?, lead_id?/lead_gerado_id?/client_id? }`.
   - Permissão: mesmos `ROLES_QUE_GERENCIAM` do módulo (adm/socio/comercial/coordenador/assessor).
   - Cria a `ligacoes` (status `em_andamento`, `origem='totalvoice'`, `direcao='saida'`, `instancia_id`, `colaborador_id=actor.id`, `iniciada_em=now`).
   - Chama `iniciarChamada(origem=ramal da instância, destino=numero, gravar=toggle, tags=<id da ligacao>)`.
   - Grava o id retornado em `ligacoes.external_id`. O webhook depois fecha a ligação por esse id.
   - Em falha da Zenvia, marca a ligação como `cancelada` com `status_mensagem` e retorna erro.

3. **Webhook** — `src/app/api/webhooks/ligacoes/zenvia/route.ts` (POST)
   - URL pública: `/api/webhooks/ligacoes/zenvia?secret=<webhook_secret>` (o `webhook_secret` é por instância, já existe na tabela).
   - Valida o `secret` contra `ligacoes_instancias.webhook_secret`; rejeita (401) se inválido.
   - Lê o payload (id da chamada, status, `duracao_segundos`, `duracao_falada_segundos`, `preco`, `url_gravacao`, `motivo_desconexao`).
   - **Idempotente:** localiza a `ligacoes` por `external_id` (= id da chamada). Se existir (ligação de saída iniciada por nós), atualiza status/duração/finalizada_em/gravacao_url/raw_data. Se não existir (ligação de entrada), cria uma nova (`direcao='entrada'`, origem `totalvoice`, vincula à instância pelo ramal/numero do destino).
   - Usa `createServiceRoleClient()` (sem sessão de usuário).
   - Sempre responde 200 rápido (best-effort; erros internos logados, não reprocessa em loop).

4. **Discador embutido (webphone)** — `src/components/ligacoes/Discador.tsx` (client)
   - Renderizado em `/ligacoes` quando o colaborador logado tem uma instância telefone/Zenvia com ramal.
   - Busca a URL do webphone (via uma server action `getWebphoneUrlAction` que chama o cliente Zenvia) e embute em `<iframe>` (sandbox + allow="microphone").
   - Mostra estado "Discador desconectado" quando sem ramal/credenciais.

5. **Botão "Ligar"** — `src/components/ligacoes/LigarButton.tsx` (client)
   - Aparece nas linhas da `LigacoesTable` e pode ser reusado em leads. Recebe `numero` + vínculos.
   - Chama `iniciarLigacaoAction`; o webphone (já aberto na página) toca; em seguida o webhook fecha o registro.
   - Desabilitado com tooltip quando o colaborador não tem ramal/instância Zenvia.

6. **Config** — `src/app/(authed)/ligacoes/configuracoes` + `InstanciaFormModal.tsx`
   - Quando `tipo=telefone`, permitir escolher provedor **Zenvia (totalvoice)** e informar o **ramal**.
   - Mostrar a **URL do webhook pronta** (com o `webhook_secret` da instância) pra colar no painel da Zenvia.
   - Marca o provedor `totalvoice` como `status: "pronto"` em `PROVEDOR_DEFS` (sai de "em construção").

## Fluxo de dados

**Saída:** colaborador na `/ligacoes` (webphone aberto no ramal dele) clica **Ligar** num número → `iniciarLigacaoAction` cria `ligacoes(em_andamento)` + `POST /chamada` → webphone toca → conversa → no fim a Zenvia chama o **webhook** → atualiza a `ligacoes` (status/duração/gravação) → dashboard/tabela/ranking/heatmap refletem automaticamente.

**Entrada:** Zenvia manda webhook de chamada recebida → handler cria `ligacoes(direcao=entrada)` vinculada à instância do ramal de destino.

## Modelo de dados (1 migration pequena)

A maior parte já existe (`external_id`, `raw_data`, `gravacao_url`, `duracao_segundos`, `finalizada_em`, `instancia_id`, `webhook_secret`). Só falta:

- **Migration `20260619000000_ligacoes_origem_totalvoice.sql`:** adicionar `'totalvoice'` (e por simetria `'zenvia'`) ao `check` da coluna `origem` em `public.ligacoes` (hoje aceita `manual,twilio,evolution,zapi,ifix,voip_generic,mock,outro`). Drop + recreate do constraint (`ligacoes_origem_check`).
- `preco`, `duracao_falada_segundos`, `motivo_desconexao` da Zenvia ficam dentro de `raw_data` (jsonb) — sem novas colunas, pra não inflar o schema. `gravacao_url` já tem coluna.

## Configuração & segredos

- **Env var** `ZENVIA_VOICE_TOKEN` (server-only) — adicionar ao schema de env (`src/lib/env.ts`) como opcional, e no `.env.example`. Sem ele, o cliente Zenvia é no-op (igual VAPID ausente).
- **Webhook URL** mostrada na config: `${NEXT_PUBLIC_APP_URL}/api/webhooks/ligacoes/zenvia?secret=<webhook_secret>`.
- **Ramal** por instância (campo `ramal` já existe). `numero` opcional (bina/identificação).

## Segurança / robustez

- Webhook autenticado pelo `webhook_secret` (por instância) na query string; 401 se não bater.
- **Idempotência** por `external_id` — webhook repetido não duplica ligação.
- Rota de webhook é pública (sem auth de sessão) — por isso o secret é obrigatório e o handler nunca confia em dados do payload pra além de localizar/atualizar a própria ligação.
- RLS das tabelas `ligacoes`/`ligacoes_instancias` já é `authenticated` (select/insert/update true); o webhook usa service-role.
- Token nunca exposto ao client (só no cliente server-side e na env var).

## Mapeamento de status (Zenvia → interno)

`atendida → atendida`; `nao_atendida`/`sem_resposta` → `perdida`; `ocupado` → `ocupada`; `caixa_postal` → `caixa_postal`; `cancelada`/`falha`/`erro` → `cancelada`; chamada com `duracao_falada_segundos` < 5 e atendida → `rejeitada` (curta). Default desconhecido → guarda em `raw_data` e marca `perdida`.

## Testes

- Unit (Vitest): `mapStatusZenvia` (todos os casos), montagem da URL do webhook (com secret), e a validação do schema da `iniciarLigacaoAction`.
- Unit: parser do payload do webhook (extrai status/duração/gravação corretamente; idempotência: mesma chamada 2x não duplica — testar a lógica de "achou external_id → update; senão insert").
- Sem teste E2E de ligação real (depende de crédito/credenciais Zenvia — validação manual pela usuária).

## Fora de escopo (YAGNI)

- Transcrição/resumo por IA (`transcricao`/`resumo_ia` ficam pra depois).
- Discagem em massa / campanhas / URA (IVR).
- Criptografia das credenciais no banco (token vai por env var; segue a nota "Fase futura" da migration original).
- Integração WhatsApp real (projeto separado).

## Pendências da usuária (lado Zenvia) — necessárias pra ir ao ar

1. Criar conta na Zenvia Voz e pegar o **Access-Token**.
2. Configurar pelo menos **1 ramal** (e número/bina opcional).
3. Definir `ZENVIA_VOICE_TOKEN` na Vercel (produção).
4. Cadastrar a instância telefone/Zenvia no sistema com o ramal e colar a **URL do webhook** no painel da Zenvia (Desenvolvedores → Webhooks).
5. Testar com crédito real.

## Riscos / atenção

- **Formato exato do payload do webhook e dos campos do `GET /webphone` precisam ser confirmados na conta real da Zenvia.** O código será defensivo (lê campos com fallback, guarda `raw_data` cru) pra absorver pequenas diferenças, mas pode precisar de 1 ajuste fino quando a usuária plugar a conta.
- Webphone em `<iframe>` exige permissão de microfone e contexto HTTPS (produção ok; em dev local pode pedir permissão).
- `iframe` de terceiro: garantir CSP/headers não bloqueiam o domínio do webphone da Zenvia.
- Migration manual no Supabase após o merge (padrão do projeto).
