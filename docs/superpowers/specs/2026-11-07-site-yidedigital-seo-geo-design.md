# Site yidedigital.com.br (SEO/GEO) — Design

**Data:** 2026-11-07
**Objetivo:** fazer de yidedigital.com.br o site principal da Yide, servido por este projeto (yide-acompanha), otimizado para Google e para respostas de IA (GEO), com foco nacional e prioridade em Cuiabá, Várzea Grande e Mato Grosso, e com um blog pensado para atrair cliente.

## Contexto (o que já existe)

- Este projeto já tem um site público: `/site` (home, `HomeYide`), `/servicos`, `/servicos/[servico]`, `/servicos/[servico]/[localidade]`, `/cases`, `/cases/[slug]`, `/blog`, `/blog/[slug]`, `sitemap.ts`, `robots.ts`, `llms.txt`, IndexNow.
- O conteúdo editável fica no banco: `seo_services`, `seo_localidades`, `seo_paginas` (serviço × localidade, geradas por IA e aprovadas), `seo_cases`, home config e `blog_posts` (`tipo` noticia/estrategico, `faq`).
- O middleware já serve `yidedigital.com.br` (apex → reescrita para `/site`, www → apex) e libera os prefixos públicos sem login.
- Hoje tudo é acessado em `blog.yidedigital.com.br`, porque o apex aponta para outro projeto na Vercel (o site antigo, sem repositório). `SITE_URL` padrão = `https://blog.yidedigital.com.br`.
- Lacunas: cases vazios; sem páginas de e-commerce, marketplaces/Mercado Livre, assessoria e SEO/Perfil da Empresa; páginas de cidade fora do sitemap por não estarem publicadas; páginas `force-dynamic`; WhatsApp do llms.txt com 8 dígitos; notícias fora do índice controladas por lista manual (`fora-do-indice.ts`); visual diferente da vitrine Lyide.

## Decisões

- O site fica **dentro do yide-acompanha** (escolha da usuária), isolado do sistema interno.
- **Alcance nacional, com prioridade em Cuiabá, VG e MT.**
- Visual na **linha da vitrine Lyide** (lyide.com.br/v/yide).
- Cases: **nome do cliente quando autorizado; senão, segmento + números**. Sempre com número real.
- Dados de contato (NAP) iguais ao Perfil da Empresa: YIDE DIGITAL, R. Martinica, 280, Jardim das Américas, Cuiabá-MT, 78060-644, (65) 99306-3452, atendimento 24h.

## Parte 1 · Domínio e estrutura técnica

- Mover o domínio `yidedigital.com.br` (e `www`) para o projeto yide-acompanha na Vercel. O projeto antigo é desativado só no fim da Fase 1.
- `NEXT_PUBLIC_SITE_URL=https://yidedigital.com.br` (canonical, sitemap, JSON-LD, llms.txt).
- Redirecionamentos 308 no middleware:
  - `blog.yidedigital.com.br/<path>` → `yidedigital.com.br/<path>` (`/` → `/blog`).
  - `sistemaacompanha.yidedigital.com.br/{blog,servicos,cases,site}/<path>` → `yidedigital.com.br/<path>` (`/site` → `/`).
  - O sistema continua em `sistemaacompanha.yidedigital.com.br`.
- Páginas públicas num route group `(site)` com layout próprio (cabeçalho e rodapé do site, tags de marketing). Leitura só com cliente anônimo e só de registros publicados.
- Trocar `force-dynamic` por geração estática com `revalidate = 3600` e revalidação sob demanda (`revalidatePath`/`revalidateTag`) nas server actions de publicar serviço, página de cidade, case, home e post.

## Parte 2 · Mapa de páginas

**Institucional**
- `/` home: "Agência de marketing, vendas e IA, de Cuiabá para todo o Brasil".
- `/sobre`: história, equipe com fotos, endereço, CNPJ, metodologia, números.
- `/diagnostico`: formulário que cria lead no CRM + WhatsApp.
- `/quanto-custa`: guia de investimento por serviço, com faixas de preço.
- `/perguntas-frequentes`.
- `/politica-de-privacidade` (migrar do repositório `politica-privacidade`).

**Serviços (9, nacionais)** — `seo_services`, com slugs estáveis (manter os 5 atuais e criar os novos):
1. `gestao-de-trafego` — Tráfego pago (Google Ads e Meta Ads)
2. `crm-ia-dados` — CRM com IA (Lyide): página de venda do CRM
3. `audiovisual` — Gravação e audiovisual
4. `redes-sociais` — Redes sociais
5. `criacao-de-sites` — Sites e landing pages
6. `ecommerce` — Loja virtual (novo)
7. `marketplaces` — Mercado Livre, Shopee e Amazon, com ênfase em Mercado Livre (novo)
8. `assessoria-de-marketing` — Assessoria de marketing e vendas (novo)
9. `seo-google` — SEO e Perfil da Empresa no Google (novo)

**Páginas por cidade** — `seo_paginas`, em 3 níveis:
- Nível 1, os 9 serviços: Cuiabá, Várzea Grande, Mato Grosso (estado).
- Nível 2, só tráfego, CRM e redes sociais: Rondonópolis, Sinop, Sorriso, Tangará da Serra, Lucas do Rio Verde, Primavera do Leste.
- Nível 3: Salvador, Vila Velha e outras capitais, só onde houver cliente ou case real.
- **Regra de qualidade:** a página só é publicada (e entra no sitemap) se tiver conteúdo próprio da cidade: bairros ou regiões, segmentos locais, pelo menos um exemplo ou case local, e FAQ local. O gerador recebe esses dados por localidade (campo novo `contexto_local` em `seo_localidades`). Sem isso, fica rascunho.

**Prova**
- `/cases` e `/cases/[slug]` (`seo_cases`): desafio, o que foi feito, números, depoimento e vídeo do YouTube (campo novo `video_url`).

**Blog**
- `/blog`: posts de negócio (indexáveis).
- `/blog/radar`: notícias de tecnologia (`noindex`, fora do sitemap).

## Parte 3 · SEO e GEO

- JSON-LD:
  - Global: `Organization` + `ProfessionalService` (NAP acima, `areaServed` Cuiabá/VG/MT/BR, `openingHoursSpecification` 24h, `sameAs` Instagram, YouTube, LinkedIn e Perfil da Empresa, `logo`).
  - Serviço: `Service` (`provider`, `areaServed`). Cidade: `Service` com `areaServed` da cidade.
  - `FAQPage` onde houver FAQ, `BreadcrumbList` em todas, `Article` + `author` (`Person`) no blog, `VideoObject` em cases com vídeo, `Review` só com depoimento real.
- Conteúdo em formato que a IA cita: abertura com resposta direta (2–3 frases), números, data de atualização visível, autor com perfil, FAQ com perguntas reais (Planejador do Google + WhatsApp).
- Sitemap: home, institucionais, serviços, páginas de cidade publicadas, cases, posts indexáveis (com `lastmod`).
- `llms.txt` e `llms-full.txt` gerados do banco, com o WhatsApp correto (+55 65 99306-3452).
- IndexNow ao publicar. Search Console com o domínio novo.
- Links internos: serviço ↔ cidades ↔ cases ↔ posts do mesmo serviço.
- Core Web Vitals verdes no celular: imagens `next/image`, fontes com `display: swap`, JS mínimo nas páginas públicas.

## Parte 4 · Conversão e medição

- WhatsApp por links do CRM, criados no Lyide: um por página institucional, de serviço e de cidade, no padrão `yide-site-<pagina>` (ex.: `yide-site-trafego-cuiaba`). No blog, um link único `yide-blog`; o post de origem é identificado pelo pixel do CRM (`track.js` registra a página visitada no visitor `lyide_vid`).
- `/diagnostico`: envia para o formulário da vitrine no CRM (`/api/v/[slug]/form`) ou endpoint equivalente, com UTMs e página de origem.
- Tags nas páginas públicas: pixel do CRM (`track.js`), Google Ads (AW-18562196515, conversão de clique no WhatsApp `AW-18562196515/pEfDCJ7KkLQdEKPIkpNF`), GA4, pixel da Meta. IDs por variável de ambiente.
- Botão fixo de WhatsApp no celular.

## Parte 5 · Visual

- Linha da vitrine Lyide: fundo escuro, verde-água, tipografia moderna, prints do painel do CRM e mockups de WhatsApp.
- Fotos reais da equipe e de bastidores de gravação; vídeos de case em destaque.
- Mobile first.

## Parte 6 · Conteúdo

- Textos escritos pelo Claude e revisados pela Yide: home, 9 serviços, páginas de cidade, sobre, quanto custa, FAQ.
- A Yide fornece: 3 a 5 cases com números e autorização, fotos, faixas de preço, links de YouTube e LinkedIn.
- Serviços, cidades e cases continuam editáveis no sistema.

## Parte 7 · Blog para atrair cliente

- **Categoria por campo, não por lista:** posts `tipo='noticia'` viram Radar automaticamente (`noindex`, fora do sitemap, em `/blog/radar`). `fora-do-indice.ts` passa a ser só exceção.
- **Mix novo do pipeline:** notícias de diária para ~3 por semana; estratégicos de 1 por dia sem revisão para **3 por semana, sempre como rascunho e publicados só após revisão humana**.
- **Campos novos em `blog_posts`:** `servico_slug` (serviço relacionado), `localidade_slug` (opcional), `revisado_por` (profile), `atualizado_em` visível.
- **Banco de temas por grupo de serviço** (`temas-estrategicos.ts`): 8–12 temas por serviço, priorizando fundo de funil: preço, comparação, como escolher, guias por segmento local (restaurantes, clínicas, lojas, imobiliárias em Cuiabá/VG) e Mercado Livre/marketplaces.
- **Bloco de venda automático no post:** card do serviço relacionado, case relacionado, WhatsApp com link do post, links para as páginas de cidade do serviço.
- **Experiência real (E-E-A-T):** autor real com página `/autores/[slug]`, campo "Nota da Yide" no post, prints e números só reais.
- **Manutenção:** revisar os 20 posts mais acessados a cada 6 meses; consolidar duplicados com 301.

## Fases (um PR cada, com testes e prévia na Vercel)

1. **Base e domínio:** route group `(site)`, visual novo, home, 9 serviços, `/sobre`, `/diagnostico`, `/politica-de-privacidade`, JSON-LD global, estático + revalidação, tags, `SITE_URL`, redirecionamentos, troca do domínio na Vercel e desligamento do site antigo.
2. **Cidades:** `contexto_local`, regra de qualidade, nível 1 completo, depois nível 2.
3. **Prova e GEO:** cases (`video_url`), `/quanto-custa`, `/perguntas-frequentes`, `llms-full.txt`, `Review`/`VideoObject`.
4. **Blog:** `/blog/radar`, campos novos, bloco de venda, autores, novo mix do pipeline, banco de temas por serviço.

## Testes

- Unitários (vitest) para funções puras: montagem de JSON-LD, regra de qualidade da página de cidade, redirecionamentos do middleware (host + path → destino), seleção de posts indexáveis, geração do sitemap e do llms.txt.
- E2E (playwright) por fase: home, um serviço, uma cidade, um post e o Radar respondem 200, com canonical em yidedigital.com.br; `blog.` e `sistemaacompanha…/blog` redirecionam 308; páginas do sistema continuam exigindo login.
- Validação manual: Rich Results Test em uma página de cada tipo; PageSpeed mobile.

## Fora do escopo

- Anúncios de LinkedIn/YouTube; produção dos vídeos; troca de CNAE; ações no Perfil da Empresa (feitas fora do código).
