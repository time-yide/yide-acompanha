# Yori — Setup AWS Lambda Remotion

Documento pra você (Yasmin) executar UMA VEZ antes de ativar o Yori em produção.

## 1. Criar conta AWS (se ainda não tem)

- https://aws.amazon.com → Create an AWS Account
- Validar cartão de crédito (a região mais barata é `us-east-1`)

## 2. Criar IAM user pra Remotion

1. AWS Console → IAM → Users → Add users
2. Username: `remotion-yori`
3. Access type: marca "Programmatic access"
4. Permissions: clica em "Attach policies directly"
5. Cria policy nova (JSON) com o conteúdo de:
   https://www.remotion.dev/docs/lambda/permissions
6. Anexa essa policy ao user
7. Clica "Create user" → salva o **Access Key ID** e **Secret Access Key** (vão pro Vercel env)

## 3. Deploy da função Lambda

No diretório raiz do projeto (no seu Mac):

```bash
export AWS_ACCESS_KEY_ID=<sua key>
export AWS_SECRET_ACCESS_KEY=<seu secret>
export AWS_REGION=us-east-1

npx remotion lambda functions deploy
```

Output esperado:
```
✅ Successfully deployed function "remotion-render-..." (~2 minutos)
```

Anota o **nome da função** (algo tipo `remotion-render-4-0-X-mem2048mb-disk2048mb-timeout120s`).

## 4. Deploy do site (composições)

```bash
npx remotion lambda sites create remotion/index.tsx --site-name=yori-v1
```

(Note: o arquivo é `index.tsx` por causa do JSX que ele contém.)

Output esperado:
```
Site uploaded to: https://remotionlambda-USEAST1-XXXXX.s3.us-east-1.amazonaws.com/sites/yori-v1/index.html
```

Anota a **URL completa do site** (essa URL vai pro env como `REMOTION_LAMBDA_SITE_NAME`).

## 5. Adicionar env vars no Vercel

No Vercel → Settings → Environment Variables, adicionar:

| Nome | Valor |
|---|---|
| `YORI_ENABLED` | `true` |
| `GROQ_API_KEY` | (cadastrar em https://console.groq.com → API Keys) |
| `AWS_ACCESS_KEY_ID` | (do passo 2) |
| `AWS_SECRET_ACCESS_KEY` | (do passo 2) |
| `AWS_REGION` | `us-east-1` |
| `REMOTION_LAMBDA_FUNCTION_NAME` | (do passo 3, sem prefixo `aws:`) |
| `REMOTION_LAMBDA_SITE_NAME` | (URL completa do passo 4) |

Marca todas como **Production** e **Preview**.

Depois: **Deployments → Redeploy** o último deploy.

## 6. Aplicar migration no Supabase

SQL Editor → New query → cola o conteúdo de `supabase/migrations/20260613000000_yori_templates_jobs.sql` → Run.

(Note: timestamp da migration foi ajustado pra `20260613` por causa de dependency com migration de `units`.)

## 7. Criar buckets no Supabase Storage

Dashboard Supabase → Storage:
1. Create new bucket → Name: `yori-videos` → Public: OFF → Create
2. Create new bucket → Name: `yori-outputs` → Public: OFF → Create

## 8. Validar

1. Abre `/audiovisual` no app → deve aparecer o botão "✨ Yori — Editor IA"
2. Clica → vai pra `/audiovisual/yori` (lista vazia + quota 0/100)
3. Clica "Novo" → arrasta um Reel de teste → escolhe template "Submagic" → Gerar
4. Aguarda 30-90s → MP4 + SRT + TXT prontos pra download

## Custo esperado

| Item | Custo mensal estimado |
|---|---|
| AWS Lambda (~100 renders) | R$ 60-100 |
| Groq Whisper | R$ 5 |
| Claude (limpeza) | R$ 1 |
| Total | **R$ 70-110** |

## Troubleshooting

- **Job stuck em "Renderizando":** AWS Lambda pode estar com cota Free Tier estourada → checar https://us-east-1.console.aws.amazon.com/billing
- **"AWS credentials invalid":** rotacionar o Access Key no IAM e atualizar no Vercel
- **"Site não encontrado":** redeployer com `npx remotion lambda sites create remotion/index.tsx --site-name=yori-v1`
