# Presença da Yide (GMN + LinkedIn) — Design

**Data:** 2026-07-19
**Sub-projeto:** D — Presença/SEO (painel de autoridade da Yide)
**Objetivo:** Painel na Programação pra otimizar a presença da Yide no Google Meu Negócio (GMN) e no LinkedIn, melhorando o rankeamento em Google/ChatGPT: gera posts com IA (SEO local) e mostra um checklist de otimização por perfil.

## Restrição conhecida (honestidade)
- **LinkedIn**: publicação automática é possível (via PostForMe, já usado no módulo Social Media), mas fica pra 2ª fase. No v1, o post é gerado e copiado.
- **GMN**: sem publicação automática (PostForMe não suporta; a API do Google Business Profile exige aprovação/allowlisting). No v1, semi-automático: IA gera o post e a Yide cola no GMN. Publicação automática entra se/quando a API for aprovada.

## Escopo do v1
Rota `/programacao/presenca`, duas abas: **Google Meu Negócio** e **LinkedIn**. Cada aba tem:
1. **Checklist de otimização** (itens curados, com % de progresso; a Yide marca o que está feito).
2. **Gerador de posts com IA** (SEO local) + lista de rascunhos com botão Copiar.

## Modelo de dados (migration manual)
`presenca_posts`
- `id uuid pk`, `organization_id uuid`, `canal text check (canal in ('gmn','linkedin'))`,
  `tema text default ''`, `conteudo text not null`, `hashtags text[] not null default '{}'`,
  `status text check (rascunho|usado|arquivado) default 'rascunho'`, `created_at`, `updated_at`.
- Índice (organization_id, canal, created_at desc). RLS on, sem policy (service-role).

`presenca_checklist`
- `id uuid pk`, `organization_id uuid`, `canal text check (gmn|linkedin)`, `feitos jsonb not null default '[]'` (lista de keys marcadas), `updated_at`.
- Único (organization_id, canal). RLS on, sem policy (service-role).

## Constantes (código)
`src/lib/presenca/config.ts`:
- `CHECKLIST_GMN` e `CHECKLIST_LINKEDIN`: listas de `{ key, titulo, dica }`.
  - GMN: categoria principal, categorias secundárias, descrição com keywords, horário, fotos, produtos/serviços, área de atendimento, responder avaliações, Q&A, post semanal, NAP consistente, link do site.
  - LinkedIn: headline com keywords, "Sobre" otimizado, logo/capa, link do site, publicar regular, funcionários vinculados, especialidades, CTA, localização/setor.
- Reusa `YIDE_NAP` (de `@/lib/seo/config`) como referência de NAP no checklist do GMN.

## Geração por IA (`src/lib/presenca/pipeline.ts`)
- `gerarPostPresenca(orgId, canal, tema?)`: Claude gera o post otimizado pro canal e SEO local (keywords via `selecionarKeywordsAlvo`), sem travessão (reusa `semTravessao`).
  - GMN: curto (até ~1200 caracteres), com CTA e gancho local.
  - LinkedIn: mais longo/profissional, com 3-5 hashtags.
  - Retorna `{ conteudo, hashtags }`; grava como rascunho.
- Model `claude-haiku-4-5`.

## Funções puras (testadas)
- `montarPromptPresenca(canal, tema, keywords)`.
- `parsePostPresenca(raw)` → valida/sanitiza `{conteudo, hashtags}` (semTravessao).
- `progressoChecklist(itens, feitos)` → `{ feitos, total, pct }`.

## UI
- `src/app/(authed)/programacao/presenca/page.tsx` (`force-dynamic`, gate `podeGerenciarBlog`): busca posts + checklist dos dois canais e passa pro client.
- `src/components/presenca/PresencaWorkspace.tsx` (client): abas GMN/LinkedIn; em cada uma, barra de progresso + itens do checklist (toggle) + botão "Gerar post com IA" (com campo de tema opcional) + lista de rascunhos com **Copiar**.
- Componentes: `ChecklistItem` (toggle), `GerarPostButton`, `CopyButton`, `ArquivarPostButton`.
- Link "Presença & Autoridade" no menu da Programação.

## Server actions (`src/lib/presenca/actions.ts`)
- `gerarPostPresencaAction(formData: canal, tema)`.
- `marcarChecklistAction(formData: canal, key, feito)` (upsert no `feitos`).
- `arquivarPostPresencaAction(formData: id)`.
- Gate `podeGerenciarBlog`.

## Erros/resiliência
IA best-effort; queries try/catch; RLS nega por padrão (service-role). Checklist funciona vazio (0%).

## Fora do v1
Publicação automática do LinkedIn (PostForMe), API do GMN, inbox de avaliações, diretórios, agendamento.

## Migration manual
`presenca_posts` + `presenca_checklist` — rodar no SQL Editor após o merge.
