# Setup do Sync com Meta Ads (Tráfego Fase 2)

> Guia passo a passo pra Yasmin gerar o **System User token** que o sistema usa pra puxar métricas do Meta automaticamente.

## Visão geral

O sistema usa **System User da BM da Yide** (não OAuth do cliente) pra acessar ad accounts. Vantagens:

- Token **não expira** (long-lived)
- Cliente faz config 1x (adiciona ad account dele como Partner na BM da Yide) e pronto
- Sem complexidade de OAuth

## Pré-requisitos

- Você precisa ser **admin da Business Manager** da Yide
- Cliente precisa ter **Business Manager próprio** OU ad account próprio
- (Se cliente não tem BM) ele cria uma grátis em https://business.facebook.com

## Passo 1 — Criar App no Meta for Developers

1. Acessa https://developers.facebook.com → Login com seu Facebook
2. **My Apps** → **Create App**
3. Tipo: **Business**
4. Nome do app: `Yide Acompanha` (ou o que preferir)
5. Email de contato: seu email
6. Anota o **App ID** que aparece (vamos precisar)

## Passo 2 — Adicionar produto Marketing API

1. Dentro do app, vai em **Add Product**
2. Adiciona **Marketing API**

## Passo 3 — Criar System User na BM

1. Acessa https://business.facebook.com/settings → Business Manager Settings
2. **Users** → **System Users** → **Add**
3. Nome: `Yide Sistema Sync`
4. Role: **Admin** (ou Employee)
5. Salva

## Passo 4 — Gerar token do System User

1. Clica no System User criado
2. **Generate New Token**
3. Seleciona o app que criou no passo 1
4. **Permissions** marcadas (importante):
   - `ads_read` — ler dados de ad accounts
   - `ads_management` — pra Fase 4 (criar/pausar campanhas no futuro)
   - `business_management` — gerenciar BM
5. **Token Expiration**: `Never` (long-lived)
6. Gera → **copia o token** (não é mostrado de novo)

## Passo 5 — Atribuir ad accounts ao System User

1. Pra cada cliente cuja conta de anúncios você precisa acessar:
   - Ainda em Business Settings → **Accounts** → **Ad Accounts**
   - Se a ad account já tá na sua BM: clica nela → **Assign Partners** ou **Assign People** → adiciona o System User com **Manage Ad Account**
   - Se a ad account é do cliente (BM dele): você precisa **pedir Partner Access** dele pra essa account (ele aprova na BM dele)
2. Sem esse passo, o System User não consegue ler a ad account específica

## Passo 6 — Configurar variáveis no Vercel

1. Acessa https://vercel.com → projeto `yide-acompanha` → **Settings** → **Environment Variables**
2. Adiciona:

| Variable | Value |
|---|---|
| `META_SYSTEM_USER_TOKEN` | (cola o token do passo 4) |
| `META_GRAPH_API_VERSION` | `v21.0` (deixa fixo por enquanto) |

3. Salva em **Production**, **Preview** e **Development**
4. Clica **Redeploy** no último deployment pra aplicar

## Passo 7 — Cadastrar `meta_ad_account_id` em cada cliente

1. No sistema: `/trafego/[cliente]` → botão **Configurar contas**
2. Cola o **Ad Account ID** (formato: `act_123456789` ou só `123456789`)
3. Encontra o ID no Business Settings → Accounts → Ad Accounts → clica numa account → ID aparece

## Como o sync funciona

- **Cron diário**: Vercel roda `/api/cron/trafego-meta-sync` às **04:00 UTC** (01:00 BRT). Pega TODOS os clientes com `meta_ad_account_id` e sincroniza últimos 7 dias de métricas.
- **Manual**: dentro de `/trafego/[cliente]`, botão **Sincronizar agora** chama o mesmo endpoint pra um cliente só. Resultado em ~5s.

## Métricas sincronizadas (Fase 2)

| Métrica | Key (no banco) |
|---|---|
| Gasto | `spend` |
| Impressões | `impressions` |
| Alcance | `reach` |
| Cliques | `clicks` |
| CTR | `ctr` |
| CPC | `cpc` |
| Frequência | `frequency` |

Mais métricas (conversões, ROAS, custo por resultado) vêm em fases seguintes.

## Troubleshooting

**"Could not find ad account"**
- Confirma que o `meta_ad_account_id` no cliente está correto (sem o `act_` se for só o número)
- Confirma que o System User tem acesso à ad account (Passo 5)

**"Invalid OAuth access token"**
- Token foi revogado ou regenerado. Volta no Passo 4 e gera novo.

**"User request limit reached"**
- Rate limit do Meta. Espera 1h e tenta de novo. Cron diário não bate nesse limite normalmente.

## Por que NÃO usei OAuth do cliente

OAuth do cliente seria mais "self-service" mas tem 3 problemas:

1. Token expira a cada 60 dias → precisa de fluxo de refresh token
2. App precisa passar **App Review** do Meta pra ter scopes como `ads_read` (1-3 semanas, pode ser rejeitado)
3. Cliente precisa fazer flow de login → fricção alta

System User da BM da Yide é mais simples pro cliente (faz 1 vez via Partner Access) e mais robusto pra você.
