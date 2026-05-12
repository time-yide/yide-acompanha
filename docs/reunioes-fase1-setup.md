# Reuniões — Fase 1: setup do Google OAuth

Esta fase entrega **conexão Google + sync incremental do Calendar**. O código tá pronto e mergeado, mas pra funcionar em produção precisa de **3 passos manuais** que só você pode fazer.

> Tempo estimado: **20-30 minutos**.

## Passo 1 — Configurar projeto no Google Cloud Console (10 min)

1. Acesse https://console.cloud.google.com/projectcreate (faça login com a conta Google da Yide).
2. Crie um projeto novo: **"Yide Sistema"** (ou use um existente).
3. No menu lateral, vá em **"APIs & Services" → "Library"**, busque **"Google Calendar API"**, clique e aperte **"Enable"**.
4. Vá em **"APIs & Services" → "OAuth consent screen"**:
   - **User Type**: External (porque colaboradores logam com a conta deles, não com conta do projeto)
   - Clique "Create"
   - Em **App name**: `Yide Sistema`
   - Em **User support email**: seu email
   - Em **Developer contact**: seu email
   - Save and Continue
   - **Scopes**: adicione manualmente:
     - `.../auth/calendar.readonly`
     - `.../auth/calendar.events.readonly`
   - Save and Continue
   - **Test users**: adicione os emails dos colaboradores que vão conectar (até publicar a app, só estes podem autorizar)
   - Save and Continue → Back to Dashboard
5. Vá em **"APIs & Services" → "Credentials"** → **"Create Credentials" → "OAuth client ID"**:
   - **Application type**: Web application
   - **Name**: `Yide Sistema — Web`
   - **Authorized JavaScript origins**: adicione `https://sistemaacompanha.yidedigital.com.br` (e `http://localhost:3000` se for testar local)
   - **Authorized redirect URIs**: adicione:
     - `https://sistemaacompanha.yidedigital.com.br/api/auth/google-callback`
     - `http://localhost:3000/api/auth/google-callback` (pra dev)
   - **Create**
6. Copie o **Client ID** e **Client Secret** que aparecerem no popup.

## Passo 2 — Adicionar variáveis no Vercel (5 min)

Em https://vercel.com/[seu-time]/yide-acompanha/settings/environment-variables, adicione:

| Variável | Valor | Environments |
|---|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | (do passo 1.6) | Production + Preview + Development |
| `GOOGLE_OAUTH_CLIENT_SECRET` | (do passo 1.6) | Production + Preview + Development |

Garanta que `CRON_SECRET` também tá setado (já é usado por outros crons). Se não:

```bash
openssl rand -hex 32
```

Cola no Vercel como `CRON_SECRET`.

Faça **Redeploy** depois de adicionar as vars (Vercel não rebuilda automático nessa mudança).

## Passo 3 — Aplicar a migration SQL (3 min)

A migration `supabase/migrations/20260513000000_reunioes_fase1.sql` ainda não foi aplicada. Pra rodar:

**Opção A — Via Supabase MCP (mais fácil)**: você usa o tool `mcp__supabase__apply_migration` direto comigo numa próxima mensagem. Eu rodo, você confirma.

**Opção B — Via Supabase CLI local**:
```bash
npm run db:push
```

Ambos criam as 8 tabelas com RLS já configurada.

Depois de aplicar, **regenera os tipos**:
```bash
npm run db:types
```

## Passo 4 — Validar end-to-end (5 min)

1. Acesse `https://sistemaacompanha.yidedigital.com.br/reunioes/conectar`
2. Aviso "Credenciais não configuradas" sumiu? ✅
3. Clique **"Conectar com Google"** → vai pra Google → autoriza → volta pra `/reunioes/conectar?status=connected`
4. Você verá o card "Conta conectada" com seu email + "ainda não sincronizou"
5. Espere **~5 minutos** (próximo tick do cron) ou force manualmente:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
     https://sistemaacompanha.yidedigital.com.br/api/cron/sync-google-calendar
   ```
6. Acesse `/reunioes` — suas reuniões dos últimos 30 dias + próximos 30 dias com link de Meet devem aparecer.

## O que NÃO foi feito ainda

- **Gravação automática** — Fase 2 (upload manual) ou Fase 4 (bot Recall.ai)
- **Transcrição** — Fase 2 (Whisper)
- **Resumo IA** — Fase 3 (Claude)
- **Tarefas extraídas** — Fase 3

Por enquanto, na Fase 1 você verá as reuniões listadas com status "Agendada" / "Concluída" (baseado em starts_at), mas sem gravação/transcrição/resumo. A UI já tá pronta pra mostrar tudo isso quando entrar.

## Troubleshooting

### "no_refresh_token" no callback
Você já tinha autorizado antes. Vá em https://myaccount.google.com/permissions, revogue "Yide Sistema" e tente conectar de novo.

### "migration_pending"
Você não rodou o passo 3. Aplique a migration.

### Cron não roda
Confira que `CRON_SECRET` está setado no Vercel. Vercel Cron envia o secret no header `Authorization: Bearer ...` automaticamente.

### Reuniões só presenciais não aparecem
**Por design**. Esse módulo é específico pra Google Meet — eventos sem link de Meet são filtrados (ver `isProcessableEvent` em `src/lib/reunioes/google/calendar.ts`).

### Reuniões antigas (>30 dias) não vieram
Por design — full sync busca janela de 30 dias. Pra histórico maior, ajustar `HISTORICO_DIAS` em `src/lib/reunioes/sync.ts` ou implementar "re-sync histórico" sob demanda.

## Sobre LGPD

O módulo está em modo "leitura passiva" — só lê eventos do Calendar, ainda não grava nada. A gravação real entra na Fase 2 com:
- Aviso no início de cada call
- Botão pra participantes externos pedirem deletar gravação
- Política de retenção de 90 dias (auto-delete via cron mensal)

Já recomendo atualizar o template de convite de reunião comercial com a cláusula:

> _Esta reunião pode ser gravada para fins de qualidade de atendimento, registro de acordos e geração de tarefas internas. A gravação fica restrita à equipe da Yide e é apagada após 90 dias._
