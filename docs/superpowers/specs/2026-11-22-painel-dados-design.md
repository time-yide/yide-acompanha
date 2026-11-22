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
- Link "Conectar" nos canais com status "sem acesso ligado" (leva para a edição do cliente)

### Visual

Segue o padrão do app: fundo escuro com verde-água, igual ao cabeçalho atual da Programação. As cores de status são verde, amarelo, vermelho e cinza.

## Canais e regras de status

Cada canal tem um destes status: `ok` (indo bem), `fraco` (fraco ou parado), `ausente` (sem presença), `sem_acesso` (o cliente tem o canal, mas o sistema não consegue ler os dados) ou `nao_se_aplica`.

| Canal | Fonte | ausente | sem_acesso | fraco | Perda gerada |
|---|---|---|---|---|---|
| Site | GA4 Data API (`clients.ga4_property_id`) | sem `website` | tem site, mas não tem GA4 ligado ou a API dá erro | sessões caíram ≥ 20% ou ficaram abaixo de 100 no período | "Site perdeu X% das visitas" / "Cliente não tem site" (Alto) |
| Google busca | Search Console API (`clients.gsc_site_url`) | sem `website` | sem GSC ligado ou erro | cliques caíram ≥ 20% ou posição média acima de 20 | "Cliques vindos do Google caíram X%" |
| Google Meu Negócio | `clients.gmb_*` + `client_gmb_snapshots` | sem `gmb_place_id` e sem `gmb_link` | — | nota abaixo de 4,3 ou nenhuma avaliação nova no período | "Não aparece no Google Maps" (Alto) |
| Instagram | `client_instagram_snapshots` (mais recente) | sem `instagram_url` | último scrape com erro | último post há mais de 3 dias | "Sem post no Instagram há N dias" |
| Facebook | `social_media_publicacoes` + `social_media_metricas` | sem `facebook_page_id` | — | último post há mais de 3 dias | "Sem post no Facebook há N dias" |
| Anúncios (Meta) | `trafego_campanhas` + `trafego_metricas_diarias` | nenhuma campanha ativa no período | `meta_last_sync_error` preenchido | campanha ativa, mas sem gasto nos últimos 7 dias | "Sem anúncios rodando" (Alto) |
| E-commerce | `anuncios_ecommerce` (Mercado Livre / Tray) | — | — | vendas caíram ≥ 20% | só vale para clientes com e-commerce; nos outros é `nao_se_aplica` |
| CRM | `clients.crm_tipo` | `nenhum` ou vazio | — | `planilha` | "Leads sem CRM organizado" |

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

### Google Analytics e Search Console

- Usa a mesma conta de serviço que já existe no ads-manager. A chave JSON vai na env var `GOOGLE_SERVICE_ACCOUNT_JSON` (Vercel). A autenticação é feita com `google-auth-library` (JWT) chamando a API REST por `fetch`. Não usa o pacote `googleapis` inteiro, porque ele é pesado.
- **Colunas novas em `clients`:** `ga4_property_id text`, `gsc_site_url text`.
- **Na edição do cliente**, seção "Conexões de dados": dois campos com lista suspensa preenchida pelas propriedades GA4 e sites do Search Console que a conta de serviço consegue ler. Também mostra o e-mail da conta de serviço, com botão de copiar, para a equipe mandar ao cliente.
- Enquanto a env var não estiver configurada, os canais Site e Google busca aparecem como `sem_acesso` e nada quebra.

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
- Instagram com erro do Apify (limite mensal): fica `sem_acesso`, não `ausente`.

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
