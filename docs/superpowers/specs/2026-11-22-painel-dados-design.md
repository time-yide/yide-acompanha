# Painel Dados — desenho

**Data:** 2026-11-22
**Status:** aprovado no desenho visual. Falta revisar este documento.

## Objetivo

Ver num lugar só tudo o que está acontecendo com cada cliente no digital (site, Google, Google Meu Negócio, Instagram, Facebook, anúncios, e-commerce e CRM) e saber **onde o cliente está perdendo por não estar presente**.

A página "Programação" passa a se chamar **Dados**. O conteúdo atual dela (lançamentos, Blog, SEO Local, Presença & Autoridade) vira a aba **Programação** dentro de Dados. Nada se perde.

## Etapas

- **Etapa 1 (este documento):** painel com tudo que já existe no sistema + Google Analytics (GA4) + Search Console.
- **Etapa 2 (depois):** Google Ads. Vai ter um documento próprio.

## Quem vê

| Cargo | Aba Dados | Aba Programação |
|---|---|---|
| ADM, Sócio, Programação | todos os clientes | sim (como hoje) |
| Assessor | só clientes onde `clients.assessor_id` = ele | não |

A regra fica numa fonte única, `src/lib/dados/access.ts`: `canAccessDados(role)` e `dadosVeTodos(role)`. Ela é usada na página, no menu e nas ações.

## Telas

### 1. Visão geral (`/dados`)

- **Topo:** título "Dados", data da última atualização e seletor de período (padrão: últimos 30 dias, comparado com os 30 dias anteriores).
- **Abas:** Visão geral | Programação. A aba Programação leva para `/programacao` e só aparece para quem já tem acesso hoje.
- **4 cartões de resumo:**
  - Presença média (0–100), com a variação em relação ao período anterior
  - Clientes em risco (nota abaixo de 50)
  - Oportunidades abertas (total de canais "sem presença")
  - Cobertura de dados (% de canais com acesso ligado)
- **Filtros:** busca por nome, assessor (só para quem vê todos) e ordenação (mais em risco primeiro, que é o padrão, ou A–Z).
- **Tabela, uma linha por cliente ativo ou em onboarding:**
  - Cliente e assessor
  - Nota de presença, com barra colorida e variação
  - Ícones dos canais com a cor do status (mostra o motivo ao passar o mouse)
  - Principal perda: a perda mais grave, em uma frase
- **Legenda das cores:** indo bem / fraco ou parado / sem presença / sem acesso ligado.

### 2. Tela do cliente (`/dados/[clientId]`)

- Nome, site, período e nota de presença
- Cartões com os números principais de cada canal que tem dado, sempre com a variação do período
- **"Onde está perdendo":** lista em frases simples, classificada como Alto ou Médio, com a mais grave primeiro
- Botão **"Atualizar agora"**: recalcula só esse cliente
- Cartão "Conexões de dados" (GA4, Search Console, Lyide) nos canais com status "sem acesso ligado"

### Visual

Segue o padrão do app: fundo escuro com verde-água, igual ao cabeçalho atual da Programação. As cores de status são verde, amarelo, vermelho e cinza.

## Canais e regras de status

Cada canal tem um destes status: `ok` (indo bem), `fraco` (fraco ou parado), `ausente` (sem presença), `sem_acesso` (o cliente tem o canal, mas o sistema não consegue ler os dados) ou `nao_se_aplica`.

| Canal | Fonte | ausente | sem_acesso | fraco | Perda gerada |
|---|---|---|---|---|---|
| Site | GA4 Data API (`clients.ga4_property_id`) | sem `website` | tem site, mas não tem GA4 ligado ou a API dá erro | sessões caíram ≥ 20% ou ficaram abaixo de 100 no período | "Site perdeu X% das visitas" / "Cliente não tem site" (Alto) |
| Google busca | Search Console API (`clients.gsc_site_url`) | sem `website` | sem GSC ligado ou erro | cliques caíram ≥ 20% ou posição média acima de 20 | "Cliques vindos do Google caíram X%" |
| Google Meu Negócio | `clients.gmb_*` + `client_gmb_snapshots` | sem `gmb_place_id` e sem `gmb_link` | — | nota abaixo de 4,3 ou nenhuma avaliação nova no período | "Não aparece no Google Maps" (Alto) |
| Instagram | Meta Graph API: `/{instagram_business_id}/media` | sem `instagram_url` e sem `instagram_business_id` | tem Instagram, mas sem `instagram_business_id` ou a API dá erro | último post há mais de 3 dias | "Sem post no Instagram há N dias" |
| Facebook | Meta Graph API: `/{facebook_page_id}/published_posts` | sem `facebook_page_id` | API com erro | último post há mais de 3 dias | "Sem post no Facebook há N dias" |
| Anúncios (Meta) | Meta Graph API: `/act_{meta_ad_account_id}/insights` (gasto, cliques, impressões) | sem `meta_ad_account_id` ou gasto zero no período | API com erro | gasto zero nos últimos 7 dias | "Sem anúncios rodando" (Alto) |
| E-commerce | anúncios publicados: `anuncios_ecommerce` + Yide Ecom (`listPublicadosYideEcom`) | — | — | nenhum anúncio novo no período ou queda ≥ 20% | só vale para clientes com `tipo_pacote = 'ecommerce'`; nos outros é `nao_se_aplica` |
| CRM | **Lyide (crm-yide)** via API externa, ver seção abaixo | `crm_tipo` = `nenhum` ou vazio | não usa o Lyide (outro CRM ou planilha), sem código do Lyide no cadastro, ou API com erro | leads novos caíram ≥ 20%, nenhum lead novo no período, 5 ou mais leads sem resposta há mais de 24h, ou nenhuma venda no período | "N leads sem resposta há mais de 24h" / "Leads novos caíram X%" / "Nenhuma venda registrada no mês" |

Os limites (20%, 3 dias, 7 dias, 4,3 etc.) ficam como constantes num único arquivo (`src/lib/dados/regras.ts`), assim dá pra ajustar fácil depois.

**Gravidade das perdas:** status `ausente` gera perda **Alta**. Status `fraco` gera perda **Média**. `sem_acesso` não conta como perda, só entra na cobertura de dados.

## Nota de presença (0–100)

- Peso por canal: Site 15, Google busca 15, Google Meu Negócio 15, Instagram 20, Facebook 10, Anúncios 15, CRM 10, E-commerce 10 (só quando se aplica).
- Pontos por status: `ok` = 100%, `fraco` = 50%, `ausente` = 0%.
- Canais `sem_acesso` e `nao_se_aplica` **saem da conta**. Assim o cliente não é punido por falta de conexão nossa.
- Nota = soma dos pontos ÷ soma dos pesos considerados, arredondada.
- Faixas: abaixo de 50 é vermelho (em risco), de 50 a 74 é amarelo, 75 ou mais é verde.

O cálculo é uma função pura (`calcularNota`) com testes.

## Como os dados chegam (arquitetura)

Calcular tudo na hora deixaria a página lenta (o gargalo do app já é o tempo de resposta do servidor). Por isso:

1. **Tabela nova `client_dados_snapshots`**: `id`, `organization_id`, `client_id`, `periodo_inicio`, `periodo_fim`, `nota`, `nota_anterior`, `canais jsonb` (status, motivo e números de cada canal), `perdas jsonb`, `calculado_em`. Fica 1 linha por cliente por dia. A página lê só a mais recente de cada cliente.
2. **Cron diário** (`/api/cron/dados-snapshot`, de madrugada): percorre os clientes ativos e em onboarding, chama os coletores e grava o snapshot. Usa a service-role.
3. **Coletores**: um arquivo por canal em `src/lib/dados/coletores/`. Cada um recebe o cliente e o período e devolve `{ status, motivo, metricas }`. Se um coletor falhar, ele devolve `sem_acesso` com o erro, e os outros continuam.
4. **"Atualizar agora"**: server action que roda os coletores de um cliente e grava um snapshot novo.
5. **Período diferente de 30 dias:** a visão geral usa sempre o snapshot mais recente (30 dias). O seletor de período vale só na tela do cliente, que recalcula na hora para aquele cliente.

### Instagram, Facebook e anúncios (Meta)

A coleta antiga (Apify, `social_media_*`, `trafego_*`) foi removida no PR #988, e essas tabelas estão paradas. O painel **não lê** essas tabelas. Ele chama a Meta Graph API direto, com um **token de System User** da BM da Yide (env `META_SYSTEM_USER_TOKEN`, só leitura). Os ids que ela precisa já estão no cadastro do cliente: `instagram_business_id`, `facebook_page_id` e `meta_ad_account_id`, preenchidos pelo PR #954.

- Instagram: `GET /{ig_id}/media?fields=timestamp&limit=50` → data do último post e posts no período.
- Facebook: pega o token da página com `GET /{page_id}?fields=access_token` e depois `GET /{page_id}/published_posts?fields=created_time&limit=50`.
- Anúncios: `GET /act_{id}/insights?time_range=...&fields=spend,clicks,impressions` para o período e para os últimos 7 dias.
- Sem a env var, os três canais ficam `sem_acesso` e nada quebra.

### Google Analytics e Search Console

- Usa a mesma conta de serviço que já existe no ads-manager. A chave JSON vai na env var `GOOGLE_SERVICE_ACCOUNT_JSON` (Vercel). A autenticação assina o JWT com o `node:crypto` e troca por token em `oauth2.googleapis.com`. Não entra nenhuma biblioteca nova.
- **Colunas novas em `clients`:** `ga4_property_id text`, `gsc_site_url text`.
- **Na tela do cliente em Dados** (não no formulário de edição do cliente), cartão "Conexões de dados" com listas suspensas: propriedade GA4, site do Search Console e empresa do Lyide. As opções vêm das próprias APIs. O cartão também mostra o e-mail da conta de serviço, com botão de copiar, para a equipe mandar ao cliente. Só ADM, Sócio e Programação podem editar.
- Enquanto a env var não estiver configurada, os canais Site e Google busca aparecem como `sem_acesso` e nada quebra.

### CRM pelo Lyide (crm-yide)

Usa o mesmo padrão que o `/conversas` já usa: API externa do Lyide, protegida pelo segredo que já existe (`LYIDE_API_URL` + `LYIDE_API_SECRET` aqui, `ACOMPANHA_API_SECRET` lá). Não precisa de chave nova.

- **Ligação cliente ↔ Lyide:** o cadastro do cliente já tem `crm_tipo` e `crm_identifier`. Quando `crm_tipo = 'yide'`, o `crm_identifier` guarda o **slug da empresa no Lyide**. No cartão "Conexões de dados" da tela do cliente em Dados, um campo com a lista de empresas clientes da agência no Lyide (vinda da API) preenche isso sem digitar.
- **Endpoints novos no Lyide** (PR no repo crm-yide, em `apps/web/app/api/external/`):
  - `GET /api/external/empresas`: lista `{ slug, name }` das empresas clientes da agência Yide (`agencyId` = agência Yide). Serve pra preencher a lista suspensa.
  - `GET /api/external/empresas/[slug]/resumo?de=YYYY-MM-DD&ate=YYYY-MM-DD`: só responde para empresas da agência Yide. Devolve, no período e no período anterior de mesmo tamanho:
    - `leadsNovos`: leads criados (sem os apagados)
    - `vendas` e `valorVendas`: leads `WON` com `convertedAt`/`closedAt` no período
    - `conversao`: vendas ÷ leads novos
    - `semResposta24h`: leads abertos cuja última mensagem é do cliente e tem mais de 24h
    - `origens`: leads novos por canal (`sourceChannel` / UTM: Google, Meta anúncios, Instagram, orgânico, outros)
- **Na tela do cliente**, o cartão CRM mostra leads novos, vendas (quantidade e R$), conversão, leads sem resposta e **de onde vêm os leads**. Isso cruza com os outros canais: por exemplo, se nenhum lead vem do Google e o site está vermelho, fica claro onde o cliente está perdendo.
- **Deploy do Lyide:** seguir o jeito que já funciona (`vercel deploy --prod` de um worktree limpo), porque o redeploy normal é cancelado.

## Menu e rotas

- O item do menu "Programação" vira **"Dados"** e aponta para `/dados` (`nav-config.ts`), com os cargos da tabela "Quem vê".
- `/programacao` e as subpáginas continuam existindo, acessadas pela aba.
- O dashboard da Programação (`DashboardProgramacao.tsx`) não muda nesta etapa.

## Migrations (aplicar manualmente no SQL Editor após o merge)

1. `clients`: adicionar `ga4_property_id`, `gsc_site_url`.
2. Criar `client_dados_snapshots` com índice `(client_id, calculado_em desc)` e RLS: SELECT para ADM/Sócio/Programação de toda a organização e para o assessor nos próprios clientes. Escrita só pela service-role.

A página precisa funcionar entre o deploy e a migration: se a tabela não existir, mostra o aviso "Painel em preparação" e não quebra.

## Erros e casos de borda

- Cliente sem nenhum snapshot ainda: aparece com "Calculando…" e botão "Atualizar agora".
- API do Google com limite ou erro: o canal fica `sem_acesso` com o motivo e o resto do painel segue normal.
- Meta API com token vencido ou sem permissão: o canal fica `sem_acesso` com o motivo, nunca `ausente`.

## Testes

- `calcularNota`: pesos, exclusão de `sem_acesso`/`nao_se_aplica` e faixas.
- Regras de status de cada coletor (funções puras sobre os dados já buscados).
- `canAccessDados` / `dadosVeTodos`.
- Type-check e lint. Não vamos subir servidor local para testar a interface.

## Fora desta etapa

- Google Ads (etapa 2)
- TikTok, LinkedIn, YouTube
- Mostrar o painel no portal do cliente
- Alertas automáticos por WhatsApp quando a nota cai

## Site do cliente, criação de GA4 e verificação do Search Console (etapa 1.1)

- **Campo de site.** O cartão "Conexões de dados" ganha "Site do cliente" (endereço, salvo como origem, ex. `https://exemplo.com.br`) e a caixa "Cliente não tem site" (marcar limpa o endereço). Colunas novas em `clients`: `site_url`, `sem_site`, `ga4_measurement_id`.
- **Regras.** "Cliente não tem site" marcado = perda real (Site e Google em vermelho, gravidade alta). Site não cadastrado = cinza "Site não cadastrado". Site cadastrado sem GA4/GSC = cinza "Google Analytics não conectado" / "Search Console não conectado". Com dados, os limites de sempre.
- **Criar Google Analytics.** Botão no cartão "Google do site" (só ADM/Sócio/Programação, só com site cadastrado). A conta de serviço cria a propriedade na conta GA4 da Yide (`GA4_ACCOUNT_ID`, padrão `415402377`, fuso America/Cuiaba, BRL) e um fluxo web com o endereço do site. Grava `ga4_property_id` + `ga4_measurement_id` e mostra o código gtag.js pra colar no `<head>` do site (fica disponível pra copiar depois).
- **Search Console.** Como o domínio é do cliente, a verificação é por TXT no DNS: "Gerar verificação do Search Console" pede o token à Site Verification API e mostra uma mensagem pronta pra enviar ao cliente. Depois que ele adiciona, "Já adicionaram — verificar agora" verifica o domínio e adiciona a propriedade `sc-domain:<domínio>` no Search Console da conta de serviço, gravando `gsc_site_url`. Se o TXT ainda não propagou, avisa e pode tentar de novo depois.
- **Permissões no Google (manual, uma vez).**
  - A conta de serviço `yide-dados` precisa ser **Editor** na conta do Google Analytics da Yide (Administrador > Gerenciamento de acesso da conta).
  - No projeto do Google Cloud da conta de serviço, ativar **Site Verification API**, **Google Analytics Admin API** e **Google Search Console API**.
  - Escopos usados na escrita: `analytics.edit`, `siteverification`, `webmasters` (o token de leitura continua só com os escopos read-only).
- **Migration manual:** `20261123000000_dados_site_cliente.sql` no SQL Editor após o merge. Até lá a tela, o cron e o "Salvar conexões" seguem funcionando sem as colunas novas (o site só passa a ser salvo depois da migration).
