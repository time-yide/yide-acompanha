# Páginas de Serviço × Localidade (SEO local) — Design

**Data:** 2026-07-19
**Sub-projeto:** D — Presença/SEO da Yide (Fase 1 de um roadmap maior)
**Objetivo:** Fazer a Yide aparecer mais em buscas e recomendações de IA (ChatGPT/Google) para termos locais ("gestor de tráfego em Cuiabá", "criação de sites em Salvador"), criando páginas públicas otimizadas por serviço e por localidade, gerenciadas dentro da Programação e geradas por IA com aprovação humana.

## Contexto

Auditoria do site atual (`yidedigital.com.br`, hospedado fora deste sistema):
- One-page, sem páginas por serviço, sem Schema.org. → maior lacuna de SEO.
- Bom SEO local (menciona Cuiabá/MT) e já tem depoimentos + lista de clientes.
- Blog já construído neste sistema (sub-projeto A/B), com keywords locais.

Decisão da Yide: **migrar todo o site pra este sistema** (norte de longo prazo) e começar pela **Fase 1: páginas de serviço × localidade**, porque é a maior lacuna, tem risco zero pro site atual (conteúdo novo) e reaproveita o motor do blog.

## Escopo da Fase 1

### Serviços (4)
1. Gestão de tráfego pago
2. Criação de sites / programação
3. Gestão de redes sociais
4. CRM / IA / dados

### Localidades (lista gerenciável, com seletor pra adicionar mais)
Cada localidade tem **tipo**: `cidade` ou `estado`.
- Cidades (seed): Cuiabá (MT), Várzea Grande (MT), Salvador (BA), Vila Velha (ES)
- Estados (seed): Mato Grosso (MT), Bahia (BA), Espírito Santo (ES)

As páginas públicas são **serviço × localidade**. Seed inicial = 4 serviços × 7 localidades = **28 páginas**, geradas automaticamente como rascunho pra aprovação.

## Arquitetura (espelha o blog)

### Modelo de dados (Supabase, migration manual)

`seo_services`
- `id uuid pk`, `organization_id uuid`, `nome text`, `slug text` (único por org), `descricao_base text` (briefing pra IA), `ordem int`, `ativo bool default true`, timestamps.

`seo_localidades`
- `id uuid pk`, `organization_id uuid`, `nome text`, `tipo text check (tipo in ('cidade','estado'))`, `uf text` (2 letras), `slug text` (único por org), `ativo bool default true`, timestamps.

`seo_paginas` (serviço × localidade)
- `id uuid pk`, `organization_id uuid`, `service_id uuid fk seo_services`, `localidade_id uuid fk seo_localidades`, `slug text`, `titulo text`, `meta_title text`, `meta_description text`, `conteudo_md text`, `faq jsonb` (lista {pergunta, resposta}), `status text check (rascunho|publicado|arquivado) default 'rascunho'`, timestamps.
- Único `(organization_id, service_id, localidade_id)`.
- RLS: leitura pública só `status='publicado'`; escrita via service-role.

`seo_services` e `seo_localidades`: RLS nega tudo (gestão só via service-role no servidor).

### Geração por IA (`src/lib/seo/pipeline/`)
- `gerarPaginaLocal(service, localidade)`: Claude escreve conteúdo **distinto por localidade** mirando "{serviço} em {localidade}", com: intro com gancho local, benefícios, "por que a Yide na {localidade}", **FAQ própria** (3-5 perguntas), CTA. Retorna `{titulo, meta_title, meta_description, conteudo_md, faq}`.
  - Prompt exige variação real por localidade (evitar conteúdo raso), tom da Yide, keywords locais, e **proíbe travessão** (reusa `semTravessao` do blog na saída).
  - Para `tipo='estado'`, o texto fala em nível estadual ("em todo o Mato Grosso"); para `cidade`, nível municipal.
- `gerarPaginasPendentes(orgId, quantos?)`: percorre combinações serviço×localidade ativas **sem página**, gera em lote (best-effort, item que falha não derruba o resto). Usado no seed automático e no botão "Gerar pendentes".
- Model: `claude-haiku-4-5` (mesmo do blog).

### Páginas públicas (`src/app/servicos/`)
- `/servicos` — índice dos serviços (cards).
- `/servicos/[servico]` — âncora do serviço: visão geral + lista das localidades com página publicada (links internos).
- `/servicos/[servico]/[localidade]` — a página local:
  - Meta tags + OpenGraph + canonical próprio.
  - **JSON-LD**: `Service` (nome, provider = Yide, `areaServed` = cidade [`City`] ou estado [`AdministrativeArea`]) + `LocalBusiness`/`ProfessionalService` (NAP da Yide) + `BreadcrumbList` + `FAQPage` (da FAQ).
  - Corpo em markdown (reusa `Markdown light`), FAQ renderizada, CTA "Falar com a Yide".
- `force-dynamic` (service-role só existe em runtime, igual ao blog).

### Direção visual (REQUISITO: design bem moderno)
- Padrão de qualidade alto, sem cara genérica de "template de IA". Consistente com o visual novo do blog: masthead/rodapé pretos com o logo ciano, tipografia **Sora** (títulos) + **IBM Plex Sans** (corpo), acentos teal/cyan, fundo claro quente (`#faf9f7`).
- Cada página-serviço com **hero** forte (headline grande, subtítulo, CTA, e a localidade em destaque), seções com **cards de profundidade** (sombra + hover), blocos de benefícios com ícones, prova social (depoimentos/clientes), FAQ em acordeão elegante e CTA final marcante.
- Espaçamento generoso, ritmo visual claro, microinterações sutis (hover/transições). Responsivo. Acessível (contraste, headings semânticos).
- Índice `/servicos` e âncora `/servicos/[servico]` também modernos (grade de cards, hero).

### Anti-conteúdo-raso (mitigações)
- Texto + FAQ distintos por localidade (IA varia gancho, exemplos, perguntas).
- `canonical` self-referencing por página.
- Links internos: âncora do serviço ↔ páginas-localidade, e entre localidades do mesmo serviço.
- Honestidade: páginas programáticas têm risco residual; monitorar indexação/visitas depois (reaproveitar tracking de visitas do blog numa fase futura).

### Gestão (Programação → "Serviços/SEO")
- Rota `/programacao/seo`:
  - Aba/lista de **Serviços** (criar/editar/ativar, `descricao_base`).
  - **Localidades**: lista + **seletor pra adicionar** cidade/estado (nome, tipo, UF).
  - **Páginas**: matriz serviço×localidade com status; botões **Gerar pendentes**, **gerar** (por página), **revisar/editar**, **publicar/despublicar**.
  - Editor por página (markdown + FAQ), igual ao editor do blog.
- Gate de acesso: `podeGerenciarBlog` (adm/sócio/programação) — mesma regra do blog (renomear conceito depois se necessário).

### Onde publica agora
- Vivem neste sistema, previewáveis (app/subdomínio). Entram no ar no domínio real quando a Yide **virar o domínio** (Fase 4 do roadmap). Sem tocar no site atual.

## Erros e resiliência
- Geração best-effort (item que falha não derruba lote), igual ao pipeline do blog.
- Queries com try/catch retornando vazio (não quebra build; rotas dinâmicas evitam env em build-time).
- RLS nega por padrão; escrita só via service-role.

## Testes
Funções PURAS testadas com vitest:
- `slugServicoLocalidade` / builders de slug.
- `jsonLdServicoLocal` (monta o JSON-LD correto pra cidade vs. estado).
- `parsePaginaGerada` (valida/normaliza a saída da IA, incl. FAQ) + `semTravessao` já testado.

## Fora da Fase 1 (roadmap)
- Fase 2: Cases/portfólio (mesmo motor, Schema de review/artigo).
- Fase 3: Home nova (reconstrução da homepage).
- Fase 4: Virar `yidedigital.com.br` inteiro pra cá, aposentar a one-page.
- Depois: NAP & Diretórios, Google Meu Negócio (checklist → API), Painel de Presença (checklist dos 6 pilares + nota).

## Migrations manuais
- `seo_services`, `seo_localidades`, `seo_paginas` (+ índices + RLS). SQL entregue pra rodar no SQL Editor após o merge.
