# Home Yide (Fase 3) — Design

**Data:** 2026-07-19
**Sub-projeto:** D — Presença/SEO (Fase 3: home institucional)
**Objetivo:** Home pública moderna e animada da Yide, reaproveitando os MOVIMENTOS de um template de referência (GSAP/ScrollTrigger), com identidade Yide (cores teal/ciano, logo), conteúdo dinâmico (serviços/cases) e textos-chave editáveis. Fica em `/site` (previewável); vira a home do domínio na Fase 4.

## Referência de movimentos (recriados, não copiados)
Template de terceiros (Carmed/Cimed) usado só como referência de MOTION. NÃO reproduzir HTML, imagens nem marca de terceiros. Recriar os movimentos com conteúdo/identidade Yide:
1. **Cursor spotlight**: glow radial seguindo o mouse (CSS var atualizada em mousemove) + rastro sutil. Desktop only.
2. **Hero**: revelação de título por palavras (stagger y+opacity), "color wipe" de fundo, marca/logo flutuando com leve parallax.
3. **Parallax** em elementos ao rolar (ScrollTrigger scrub).
4. **Bento de serviços**: cards entram animados no scroll (stagger).
5. **Números**: contagem (count-up) ao entrar na viewport.
6. **Cases/depoimentos**: reveal no scroll.
Tudo respeita `prefers-reduced-motion` (desliga animações).

## Identidade
- Cores: teal/ciano da Yide (base `#0d9488`/`#2ee6e6`/`#3DC4BC`) no lugar do vermelho do template; fundo claro `#faf9f7` com seções de contraste escuro (`neutral-950`) no hero/rodapé.
- Fonte: **Sora** (display) + **IBM Plex Sans** (corpo), como no resto do site público.
- Logo Yide (`public/brand/logo-yide.png`) no menu e no hero.
- Imagens: por enquanto logo/gradientes/ícones (sem fotos). Trocáveis depois.

## Seções (ordem)
1. **Nav** (sticky, escura): logo + Serviços / Cases / Blog / Contato + CTA WhatsApp.
2. **Hero**: título + subtítulo (editáveis), CTA, marca animada, color wipe.
3. **Números** (editáveis): grid de stats com count-up (ex.: clientes, anos, cidades, projetos).
4. **Serviços** (dinâmico `seo_services` ativos): bento animado, cards linkando `/servicos/[slug]`.
5. **Cases em destaque** (dinâmico `seo_cases` publicados, até 3): reveal; some se vazio.
6. **Depoimentos** (dinâmico: depoimentos dos cases publicados): carrossel/grid; some se vazio.
7. **Sobre** (editável): título + texto de posicionamento.
8. **Clientes** (editável: lista de nomes): faixa/grade de chips.
9. **CTA final / contato**: chamada editável + WhatsApp + NAP (telefone/e-mail/Cuiabá-MT).
10. **Rodapé**: logo, links (Serviços/Cases/Blog), Instagram/LinkedIn, © Yide.

## Conteúdo editável (`home_config`, 1 linha/org, JSON)
Campos: `hero_titulo`, `hero_sub`, `stats` (lista `{valor, rotulo}`), `sobre_titulo`, `sobre_texto`, `cta_titulo`, `clientes` (lista de strings). Defaults Yide sensatos (a home funciona antes de editar). Painel "Home" em `/programacao/seo/home` (form simples).

## Arquitetura
- Migration manual: `home_config` (id, organization_id unique, dados jsonb, updated_at). RLS: SELECT público liberado (conteúdo público) OU leitura via service-role — usaremos **service-role** (consistente com o resto) e sem policy.
- `src/lib/seo/home-queries.ts`: `getHomeConfig(orgId)` → merge com defaults (função pura `mergeHomeConfig` testada em `home-config.ts`).
- `src/lib/seo/home-actions.ts`: `salvarHomeAction(formData)` (gate `podeGerenciarBlog`, upsert).
- `src/app/site/layout.tsx`: shell da home (fontes, cursor client, `[color-scheme:light]`).
- `src/app/site/page.tsx` (`force-dynamic`): busca config + serviços (`listServicosComPaginas`) + cases (`listCasesPublicados`) e passa pro client.
- `src/components/home/HomeYide.tsx` (`"use client"`, GSAP) + subcomponentes (`Cursor`, `Hero`, `Numeros`, `ServicosBento`, `CasesDestaque`, `Depoimentos`, `Sobre`, `Clientes`, `CtaContato`, `FooterHome`).
- `src/app/(authed)/programacao/seo/home/page.tsx` + `src/components/seo/HomeConfigForm.tsx`.
- Dependência nova: `gsap`.

## Testes (puros)
- `mergeHomeConfig(row)` — aplica defaults, valida shapes de `stats`/`clientes`.

## Erros/resiliência
- Config ausente → defaults. Seções dinâmicas vazias → escondidas. Animações degradam com reduced-motion. Queries try/catch.

## Fora da Fase 3
Upload de logos de clientes, formulário de contato com envio de e-mail, home em múltiplos idiomas, blog em destaque na home.

## Migration manual
`home_config` — rodar no SQL Editor após o merge.
