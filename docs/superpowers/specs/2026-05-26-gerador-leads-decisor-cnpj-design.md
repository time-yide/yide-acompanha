# Gerador de Leads — Identificação do decisor via CNPJ + Instagram-deep

**Data:** 2026-05-26
**Autor:** Yasmin (via brainstorming com Claude)
**Status:** Aprovado pela usuária, aguardando review final

## Motivação

Hoje, o módulo `/gerador-leads` consegue puxar empresas do Google Maps (Outscraper) e tentar inferir quem é o decisor a partir de site scraping, Hunter.io e Instagram. O gargalo relatado pela equipe é claro: **não conseguimos nem identificar quem é o dono/decisor** na maioria dos leads gerados — chegamos com nome da empresa e telefone genérico, sem nome pessoal.

A heurística atual (scraping do site procurando "CEO/sócio/diretor" + Hunter Domain Search) falha porque a maioria das PMEs brasileiras:

- Não tem página "Sobre/Equipe" no site listando o dono
- Não está no banco do Hunter (free tier de 25 buscas/mês esgota rápido + cobertura BR fraca em empresas pequenas)
- Tem Instagram apenas da empresa, não do dono pessoal

## Insight central

Pra Brasil, existe uma fonte de verdade que ninguém pode ignorar: **Receita Federal**. Toda empresa com CNPJ ativo tem sócios oficiais registrados, com qualificação ("Sócio-Administrador", "Administrador", "Sócio"). Esse dado:

- É público e auditável
- Cobre praticamente toda PME com CNPJ
- Quase sempre tem 1-3 sócios (PME), e o sócio-administrador costuma ser o dono real
- Pode ser obtido por busca via nome+cidade (sem precisar saber o CNPJ antes)

Com o nome do dono em mãos, os sinais existentes (site, Hunter, Instagram) passam de "tentando adivinhar quem é" pra "tentando encontrar o contato dessa pessoa específica" — problema muito mais tratável.

## Escopo

### Inclui

1. **Lookup de CNPJ + sócios via CNPJá** (API paga, R$99/mês plano Basic = 15k consultas)
2. **Instagram-deep** — extensão do que já existe via Apify pra tentar achar o perfil pessoal do dono
3. **Atualização do prompt da IA** pra tratar sócios da Receita como ground truth
4. **Schema novo** (CNPJ, sócios, qualificação, decisor_whatsapp, decisor_instagram)
5. **UI** — card "Identificação oficial (Receita Federal)" + melhorias no card "Decisor" + indicador na tabela

### Não inclui (deferido)

- ❌ Upgrade do Hunter pago (decidido: manter free tier 25/mês por enquanto, validar ganho dos sócios primeiro)
- ❌ Apollo.io / Cognism (estrangeiras, caras, fracas em BR)
- ❌ Google Search direcionado (Abordagem B do brainstorm) — fica como fallback futuro
- ❌ Tabela `leads_socios` normalizada — JSONB resolve, YAGNI
- ❌ Página agregada "donos identificados em várias empresas"
- ❌ Histórico de mudanças do decisor
- ❌ UI de configuração de API key (vai no env)

## Arquitetura

Pipeline atual → pipeline proposta:

```
ANTES:
Outscraper → Site Scraper → Hunter.io → Apify Instagram → IA Claude

DEPOIS:
Outscraper
  → [NOVO] CNPJá lookup (nome+cidade → CNPJ + sócios oficiais)
  → Site Scraper
  → Hunter.io (mantém free tier por enquanto)
  → Apify Instagram (perfil da empresa)
  → [NOVO] Instagram Deep (infere @ pessoal do sócio)
  → IA Claude (prompt atualizado: sócios da Receita = ground truth)
```

**Princípio de resiliência:** cada novo passo falha gracioso. Sem `CNPJA_API_KEY` configurada, lookup é skip e fluxo continua igual ao atual. CNPJá retorna múltiplos resultados ambíguos, marca como ambíguo e continua. Apify Instagram Deep não acha o perfil pessoal, segue com IG da empresa.

Sem novos pontos de bloqueio. O pior caso possível pós-mudança é igual ao melhor caso pré-mudança.

## Schema

### Migration nova: `supabase/migrations/20260526000000_leads_gerados_cnpj_socios.sql`

```sql
alter table public.leads_gerados
  add column if not exists cnpj text,
  add column if not exists socios jsonb default '[]'::jsonb,
  add column if not exists socio_principal_qualificacao text,
  add column if not exists decisor_whatsapp text,
  add column if not exists decisor_instagram text;

create index if not exists leads_gerados_cnpj_idx
  on public.leads_gerados(cnpj)
  where cnpj is not null;
```

Estrutura do JSONB `socios`:

```json
[
  {
    "nome": "JOÃO DA SILVA",
    "qualificacao": "Sócio-Administrador",
    "data_entrada": "2020-03-15"
  }
]
```

Decisões:
- `cnpj` como `text` (não bigint) — preserva zeros à esquerda, formatação livre, padrão brasileiro
- `socios` JSONB ao invés de tabela normalizada — 1-3 sócios típico, sem queries cross-empresa previstas
- `socio_principal_qualificacao` separado pra facilitar filtro/badge na UI ("destaque sócios-administradores")
- `decisor_whatsapp` separado de `decisor_telefone` — telefone fixo ≠ WhatsApp, separação útil pra ação rápida na UI

### Zod schema (`src/lib/gerador-leads/schema.ts`)

Em `updateLeadSchema`, adicionar como opcionais editáveis manualmente:
- `cnpj: z.string().trim().max(20).optional().nullable()`
- `decisor_whatsapp: z.string().trim().max(40).optional().nullable()`
- `decisor_instagram: z.string().trim().max(80).optional().nullable()`

**NÃO** entram no zod editável:
- `socios` — vem da API, editar manualmente não faz sentido
- `socio_principal_qualificacao` — derivado de `socios`

## Componentes (services novos)

### `src/lib/gerador-leads/services/cnpja.ts`

Padrão idêntico aos services existentes (`hunter.ts`, `outscraper.ts`):

```ts
export interface CnpjLookupResult {
  ok: boolean;
  skipped: boolean;        // sem CNPJA_API_KEY
  error: string | null;
  cnpj: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  socios: Array<{
    nome: string;
    qualificacao: string;
    data_entrada: string | null;
  }>;
  multiplos_resultados: boolean;
}

export async function searchCnpjByName(
  empresa: string,
  cidade: string,
  estado?: string,
): Promise<CnpjLookupResult>;
```

Endpoint usado: `GET https://api.cnpja.com/office?query.search=<empresa>&query.city=<cidade>`. Retorna CNPJ + razão social + sócios + qualificações em 1 call (plano Basic). Timeout 15s, retry exponencial em 5xx/429.

Sem `CNPJA_API_KEY` → `{ ok: false, skipped: true }` (não bloqueia fluxo).

### `src/lib/gerador-leads/services/instagram-deep.ts`

Estende `apify-instagram.ts`. Função:

```ts
export interface OwnerInstagramResult {
  username: string | null;
  bio: string | null;
  telefone_no_bio: string | null;
  link_no_bio: string | null;
  confidence: "alta" | "media" | "baixa" | null;
}

export async function findOwnerInstagram(
  empresaUsername: string,
  decisorNomeFromSocios: string | null,
): Promise<OwnerInstagramResult>;
```

Heurística:
1. Roda Apify actor pra pegar últimos 10 posts do `@empresaUsername`
2. Conta `@` mencionados com frequência (storymentions, tagged-in-posts)
3. Pra cada candidato, compara nome no perfil/bio com `decisorNomeFromSocios` (similaridade de strings simples — Jaro-Winkler ou Levenshtein normalizado)
4. Retorna melhor match com `confidence` baseado na similaridade + frequência das menções

`confidence`:
- `alta` — nome bate >80% + mencionado em >3 posts
- `media` — uma das condições
- `baixa` — nenhuma (mas ainda retorna como pista)

Se sem `APIFY_API_KEY` ou empresa sem Instagram → retorna `null` em todos os campos.

### Update: `src/lib/gerador-leads/enrichment-actions.ts`

Em `enriquecerLeadAction`, adicionar 2 passos na ordem:

1. (existente) Outscraper / dados já estão no DB
2. **(novo)** `searchCnpjByName(lead.empresa, lead.cidade)` → grava `cnpj`, `socios`, `socio_principal_qualificacao`
3. (existente) Site Scraper
4. (existente) Hunter.io (free tier)
5. (existente) Apify Instagram da empresa
6. **(novo)** `findOwnerInstagram(lead.instagram, socio_principal.nome)` → grava `decisor_instagram`, pode preencher `decisor_whatsapp` se bio tiver telefone
7. (existente) IA Claude — prompt atualizado

Todos os novos passos são opcionais (skip se sem API key / sem dados).

### Update: `src/lib/gerador-leads/services/ia-enrichment.ts`

Adicionar ao input da IA:
- `socios_oficiais`: lista de sócios da Receita (do CNPJá)
- `owner_instagram`: resultado do `findOwnerInstagram` (se houver)

Atualizar prompt:

```
DADOS OFICIAIS DA RECEITA FEDERAL:
  Sócios da empresa:
    1. JOÃO DA SILVA — Sócio-Administrador (desde 2020)
    2. MARIA SANTOS — Sócia (desde 2022)

REGRA NOVA: Se houver sócios listados acima, `decisor_nome` DEVE ser o
sócio-administrador (ou o primeiro sócio se não houver administrador).
Use os outros sinais (site, Hunter, Instagram) APENAS pra encontrar o
CONTATO desse decisor (email, telefone, WhatsApp, Instagram pessoal),
não pra adivinhar quem é ele.

CRUZAMENTO INSTAGRAM PESSOAL:
  Possível Instagram pessoal: @joaosilva_oficial
  Bio: "CEO @empresa | João da Silva | (65) 99999-9999"
  Confidence: alta

Se bio do IG pessoal traz telefone, use como `decisor_whatsapp`.
Se confidence é alta, use como `decisor_instagram`.
```

## UI

### Página do lead (`src/app/(authed)/gerador-leads/[id]/page.tsx`)

Card novo **"Identificação oficial (Receita Federal)"**, posicionado acima do card "Decisor":

- CNPJ formatado `XX.XXX.XXX/0001-XX` com link externo pra `cnpj.biz/{cnpj}`
- Lista de sócios:
  - Nome em destaque
  - Qualificação (com cor: "Sócio-Administrador" verde, outros neutros)
  - Data de entrada formatada (dd/mm/yyyy)
- Badge "Fonte: Receita Federal"
- Quando `multiplos_resultados=true` no JSONB: aviso amarelo "Mais de uma empresa com nome parecido encontrada — confirme manualmente"
- Quando `cnpj === null`: card não aparece (não polui UI com "sem dados")

### Card "Decisor" — melhorias em `LeadEditCard.tsx`

Adicionar:
- Linha de cabeçalho: "✓ Vinculado ao sócio: **João Silva** (Sócio-Administrador)" — quando `decisor_nome` bate com algum item em `socios`
- 3 botões de ação rápida abaixo dos campos editáveis:
  - 📞 abre `tel:{decisor_telefone}` (desabilitado se vazio)
  - 💬 abre `https://wa.me/{decisor_whatsapp}` (desabilitado se vazio)
  - 📷 abre `https://instagram.com/{decisor_instagram}` (desabilitado se vazio)
- Indicador de confiança no topo do card. Calculado server-side em `LeadEditCard` comparando `decisor_nome` com `socios[].nome` (normalize uppercase, ignorar acentos):
  - Verde "Identificado via Receita Federal" — quando `decisor_nome` bate com algum item em `socios`
  - Amarelo "Inferido por IA" — quando `decisor_nome !== null` mas não bate com nenhum sócio
  - Cinza "Não identificado" — quando `decisor_nome === null`

### Tabela principal (`src/components/gerador-leads/LeadsTable.tsx`)

- Pequeno badge na linha (ao lado do nome da empresa): "👤 João S." quando `decisor_nome` está preenchido
- Filtro novo na toolbar (`LeadsToolbar.tsx`): checkbox "Só com decisor identificado"
  - Query param: `comDecisor=1`
  - Aplica `where decisor_nome is not null`

### Botão "Buscar dono" (`BuscarDonoButton.tsx`)

**Sem mudança na UI.** O botão já existe e chama `enriquecerLeadAction`. A action vai automaticamente incluir os 2 novos passos (CNPJá + Instagram-deep) por causa do update no service.

Label "Buscar dono" continua adequado — agora o sistema busca melhor.

## Variáveis de ambiente

Adicionar em `src/lib/env.ts`:

```ts
CNPJA_API_KEY: process.env.CNPJA_API_KEY ?? undefined,
```

Sem essa variável definida → CNPJá service retorna `{ skipped: true }` e fluxo continua sem dados oficiais (volta ao comportamento atual). Não é erro.

## Tratamento de erros

| Cenário | Comportamento |
|---|---|
| `CNPJA_API_KEY` ausente | Skip lookup, log warn, continua |
| CNPJá retorna 429 (rate limit) | Retry exponencial 3x, depois skip |
| CNPJá retorna 0 resultados | `cnpj = null`, sem aviso (lead segue normal) |
| CNPJá retorna múltiplos resultados | Pega o primeiro item do array retornado (CNPJá ordena por relevância internamente), marca `multiplos_resultados = true`, UI mostra aviso pra humano confirmar |
| Apify Instagram Deep falha | `decisor_instagram = null`, continua |
| IA Claude indisponível | Mantém fluxo atual de fallback (já existe) |

## Custos novos

| Serviço | Plano | Custo |
|---|---|---|
| CNPJá | Inicial (1k consultas/mês) | R$ 24,90 |
| Hunter | Free (mantém 25/mês) | R$0 |
| Apify Instagram | Já assinado | R$0 marginal |

**Total adicional:** R$ 24,90/mês

**Capacidade:** 1.000 consultas/mês cobre **~2 pesquisas grandes (500 leads cada)** ou **~33 leads/dia** se distribuir uniformemente. Se virar gargalo, upgrade pro Basic é R$99/mês = 15k consultas (15× mais). Conservar consultas: o lookup só roda no enriquecimento de cada lead — não rodar enrich em leads já marcados como "descartado" ou "cliente" ajuda economizar.

## Métricas de sucesso

A medir 30 dias após deploy:

1. **% de leads com `decisor_nome` preenchido** — meta: dobrar de ~30% pra ~70%
2. **% de leads com `decisor_whatsapp` OU `decisor_telefone`** — meta: ir de ~20% pra ~50%
3. **Quantos leads viraram "em_contato" / "cliente"** (proxy de conversão da equipe comercial)

## Riscos & mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Match nome+cidade no CNPJá retorna empresa errada | Média | Salvar CNPJ no DB com flag `multiplos_resultados`, UI sinaliza pro humano confirmar |
| Sócio formal ≠ decisor real (filho gerenciando empresa do pai) | Média | Manter `outros_decisores` (IA já lista isso) como alternativa; equipe comercial decide |
| CNPJá free tier estourar (15k/mês) | Baixa | Monitorar consumo, plano Pro R$299 dobra pra 50k |
| Instagram Deep traz funcionário ao invés de dono | Média | `confidence` claro na resposta; só usa como `decisor_instagram` se confidence=alta |
| LGPD — sócios é dado público mas armazenamos | Baixa | Sócios são dado público da Receita Federal; mesmo critério de "interesse legítimo" que já justifica armazenar email/telefone de empresa |

## Plano de rollout

1. **PR 1 (este)** — schema + service CNPJá + Instagram Deep + integração no enrichment + prompt IA + UI mínima (card Receita + botões ação)
2. **PR 2 (após validar 1 semana)** — indicador na tabela + filtro "só com decisor identificado" + métricas
3. **Avaliar 30 dias depois** — se métrica subiu mas ainda não satisfatória, considerar Hunter pago ou Google Search direcionado
