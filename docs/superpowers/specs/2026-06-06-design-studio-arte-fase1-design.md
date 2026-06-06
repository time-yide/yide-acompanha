# Design Studio de Arte — Fase 1

**Data:** 2026-06-06
**Módulo:** Design (`/design`)
**Status:** Spec aprovado, aguardando plano de implementação

---

## Resumo

Adicionar ao módulo Design um **Studio de criação de arte por cliente**: um editor de
composição (canvas com camadas — foto, texto, formas, logo) com um **chat IA** que monta
e edita o layout, sempre **respeitando o manual de marca do cliente por padrão** (fontes,
paleta, logo, tom de voz, regras), e só foge disso quando explicitamente pedido no chat.

A referência de UX é o protótipo `yide_studio_final.html` (editor + chat lado a lado),
porém: (1) **por cliente**, (2) com **manual de marca persistido**, (3) **multi-formato**,
e (4) com o **chat rodando no servidor** (não no navegador com a chave exposta).

Esta é a **Fase 1**. A geração de imagem por IA (Flux/GPT-Image) fica para a **Fase 2**
(esboçada no fim deste doc, spec próprio depois).

### O que o Studio NÃO é

Não é geração de pixels (Flux/GPT-Image/Ideogram). É um **editor de composição**: a IA não
"pinta" a imagem — ela emite **comandos** (`addTexto`, `addShape`, `setBg`, `addLogo`…) que
o editor executa montando camadas editáveis. Isso garante fonte/cor exatas da marca, texto
sempre legível, e edição manual posterior. A geração de pixels entra na Fase 2 como uma
**camada de foto** dentro do mesmo editor.

---

## Contexto: o que já existe (reaproveitar)

O módulo Design (Fase 1 original) já entrega:

- **`clients.design_style_guide`** (JSONB) — paleta, `fontes_titulos`/`fontes_corpo` (só
  nomes), `mood`, `tom_voz`, `evitar`, `marca`, `exemplos_aprovados`. É a base do manual de
  marca, mas hoje guarda só **texto** (nomes de fonte), não os arquivos.
- **`design_artes`** — biblioteca de artes por cliente: `titulo`, `formato`
  (`feed`/`story`/`carrossel`/`reels`/`outro`), `status` (workflow completo de aprovação),
  `midias` (array de URLs), `copy`, `hashtags`, campos `ai_*`, `aprovacao_token`, etc.
- **Workflow de aprovação** — `aprovacao_token`, página `/aprovacao-design/[token]`, status
  `aguardando_aprovacao` → `aprovado`/`ajustes_solicitados`.
- **Bucket `design-criativos`** (privado, signed URLs), path
  `{organization_id}/{client_id}/{arte_id}/{filename}`.
- **`FORMATOS`** em `src/lib/design/tipos.ts`.
- **`listClientesDesign`** em `src/lib/design/queries.ts` (filtra `status = "ativo"`).
- **Claude server-side** já usado no app (ex.: `yori/services/claude-cleanup.ts`).

O Studio **estende** essa base; não cria um módulo paralelo.

---

## Arquitetura

### Onde vive

- Rota nova: **`/design/[clientId]/studio`** — abre o Studio em branco (nova arte) para o
  cliente.
- Rota nova: **`/design/[clientId]/studio/[arteId]`** — reabre uma arte salva para editar.
- Botão **"Criar no Studio"** na página `/design/[clientId]` (junto do cadastro manual, que
  **continua existindo** — convivem, o Studio não substitui).

### Layout (3 painéis, igual o protótipo)

```
┌─────────────────────────────────────────────────────────────┐
│ Header: cliente · formato · [Editor | Chat IA] · [Salvar]    │
├──────────────┬──────────────────────────────┬───────────────┤
│ ESQUERDA     │ CENTRO                        │ DIREITA       │
│ - Foto fundo │ - Canvas (Editor)            │ Propriedades  │
│ - Fundo/cor  │   OU                          │ do elemento   │
│ - Elementos  │ - Chat IA                     │ selecionado   │
│ - Fontes     │                               │               │
│ - Logo marca │                               │               │
│ - Camadas    │                               │               │
└──────────────┴──────────────────────────────┴───────────────┘
```

---

## Modelo de dados

### Migration (manual, aplicada via SQL Editor após merge)

**1) Composição editável na arte** — 1 coluna nova em `design_artes`:

```sql
alter table public.design_artes
  add column if not exists composicao jsonb;
```

- `composicao` guarda o estado **reabrível** da canvas: formato, fundo, e o array de camadas.
- `midias[0]` continua sendo a **URL da imagem exportada** (PNG) — é o que o cliente vê e
  aprova. Toda arte do Studio entra na biblioteca e no workflow existentes.

**2) Manual de marca** — o `design_style_guide` JSONB é **estendido** (sem migration, é
JSONB livre). Estrutura nova adicionada aos campos atuais:

```jsonc
{
  // ...campos atuais (paletas, mood, tom_voz, evitar, marca, exemplos_aprovados)...
  "fontes": [
    { "nome": "Marca Sans", "papel": "titulo", "url": "https://.../marca/fonte-x.otf", "format": "opentype" },
    { "nome": "Marca Text", "papel": "corpo",  "url": "https://.../marca/fonte-y.ttf", "format": "truetype" }
  ],
  "logo_url": "https://.../marca/logo.png",
  "fundo_padrao": "#062e10"
}
```

### Formato de `composicao` (canvas state)

```jsonc
{
  "formato": "feed",            // feed | story | reels | carrossel (FORMATOS existentes)
  "canvas": { "w": 1080, "h": 1080 },
  "fundo": {
    "cor": "#062e10",
    "foto": { "url": "...", "zoom": 100, "x": 0, "y": 0, "opacidade": 55 } | null,
    "listras": true
  },
  "camadas": [
    { "id": "e1", "tipo": "texto", "text": "BRASIL", "x": 80, "y": 180, "w": 250,
      "fontSize": 40, "fontWeight": 900, "color": "#ffdf00", "align": "center",
      "font": "Marca Sans", "spacing": 5, "opacity": 1, "z": 11 },
    { "id": "e2", "tipo": "shape", "subtype": "rect", "x": 20, "y": 260, "w": 365, "h": 3,
      "bg": "#ffdf00", "borderColor": "transparent", "borderW": 0, "radius": 2,
      "opacity": 1, "z": 12 },
    { "id": "e3", "tipo": "imagem", "src": "...", "x": 80, "y": 140, "w": 240, "h": 180,
      "opacity": 1, "z": 13 },
    { "id": "e4", "tipo": "logo", "src": "<logo_url do cliente>", "x": 900, "y": 960,
      "w": 120, "h": 80, "opacity": 1, "z": 99 }
  ]
}
```

Coordenadas/medidas são **relativas ao tamanho real do formato** (ex.: 1080×1080), não ao
preview escalado — o export precisa ser fiel ao formato real.

---

## Manual de marca (persistência de fonte/logo)

- **Fontes e logo são arquivos** → upload pro bucket `design-criativos`, path
  `{organization_id}/{client_id}/marca/{filename}`. O `design_style_guide` guarda só a URL
  (signed URL ou path + assinatura no carregamento).
- Server actions novas (em `src/lib/design/`):
  - `uploadFonteMarca(clientId, file, papel)` — sobe a fonte, registra em `fontes`.
  - `uploadLogoMarca(clientId, file)` — sobe a logo, grava `logo_url`.
  - `updateManualMarca(clientId, patch)` — paleta, `fundo_padrao`, tom, etc.
  - `removerFonteMarca` / `removerLogo`.
- Ao abrir o Studio de um cliente, o server carrega o manual de marca e o front:
  1. injeta `@font-face` para cada fonte do cliente,
  2. pré-seleciona fontes de título/corpo,
  3. deixa paleta e `fundo_padrao` prontos,
  4. deixa a logo disponível pra inserir com 1 clique.
- **Acúmulo:** tudo que é enviado (fonte, logo) fica salvo e reaparece nas próximas artes
  daquele cliente. Artes aprovadas podem ser adicionadas a `exemplos_aprovados` como
  referência.

---

## O editor

Reproduz o protótipo, com diferenças:

- **Multi-formato:** seletor no header usando os `FORMATOS` que já existem no código —
  feed (1:1 = 1080×1080) e story/reels (9:16 = 1080×1920). O protótipo usava 4:5 (1080×1350);
  adicionar um formato `feed_4_5` ao `FORMATOS` é opcional/baixo risco, mas **o default da
  Fase 1 são os formatos existentes** (feed/story). A canvas exibe um preview escalado; o
  estado guarda medidas no tamanho real.
- **Camadas:** foto de fundo (zoom/mover/opacidade), texto, formas (`rect`/`circle`/`line`),
  imagem (upload), **logo do cliente (1 clique, vem do manual)**, badge.
- **Fontes:** select com as fontes da marca no topo + fontes web padrão; botão "carregar
  fonte" que **sobe pro manual de marca do cliente** (não só sessão local).
- **Propriedades** (painel direito) do elemento selecionado: texto (conteúdo, cor, tamanho,
  peso, alinhamento, espaçamento), forma (cor, borda, radius), opacidade, ordem de camada
  (subir/descer), deletar.
- **Interações:** arrastar e redimensionar elementos na canvas; lista de camadas clicável.
- Abre já com **fontes e cores da marca** selecionadas.

---

## O chat IA

### Roda no servidor (diferença crítica vs. protótipo)

O protótipo chamava `api.anthropic.com` direto do navegador (chave exposta, não funciona em
produção). No Studio, o chat passa por uma **server action** (`src/lib/design/`), com
`requireAuth`, usando o Claude server-side já configurado no app.

### Segue a marca por padrão

O system prompt **sempre** recebe:

1. **Manual de marca do cliente** — fontes (nomes disponíveis + papéis), paleta com hex,
   `fundo_padrao`, `logo_url`, `tom_voz`, regras de `evitar`, `mood`.
2. **Estado atual da canvas** (formato + camadas existentes resumidas).
3. Instrução: *usar as fontes/cores da marca por padrão; só desviar se o usuário pedir
   explicitamente nesta conversa.*

Assim a IA monta/edita **já na marca**, e o usuário pode mandar "dessa vez usa vermelho" que
ela obedece o chat por cima da marca.

### Contrato de resposta

A IA responde **mensagem amigável** + um **bloco JSON de comandos** (separados por marcador,
igual o protótipo). O editor parseia e executa. Comandos suportados na Fase 1:

- `setBg { color }`
- `setFormato { formato }`
- `toggleStripes { show }`
- `addTexto { text, x, y, w, fontSize, fontWeight, color, align, font, spacing }`
- `addShape { subtype, x, y, w, h, bg, borderColor, borderW, radius }`
- `addLogo { x, y, w, h }` — insere a logo do cliente (URL vem do manual, server-side)
- `updateLayer { id, ...props }` — editar camada existente (pra "muda o título pra azul")
- `removeLayer { id }`
- `clearAll`

O parser **valida** cada comando (whitelist de ações + campos) e ignora comando inválido sem
quebrar a canvas. Fontes referenciadas pela IA são restritas às disponíveis (marca + padrão).

---

## Salvar / exportar / aprovar

- **Salvar:** server action grava `composicao` (reabrível) e:
  1. o front renderiza a canvas no **tamanho real do formato** e gera um **PNG**,
  2. sobe o PNG pro bucket `design-criativos` (`.../{arte_id}/export.png`),
  3. grava a URL em `midias[0]`.
  - Resultado: a arte aparece na biblioteca `/design/[clientId]` como qualquer outra.
- **Render/export:** feito **no navegador** a partir da própria canvas (lib tipo
  `html-to-image`/`html2canvas`), porque o resultado precisa ser pixel-fiel ao que o usuário
  vê — incluindo as fontes custom já carregadas via `@font-face`. PNG (não JPEG) por
  qualidade e suporte a transparência.
  - *Risco conhecido:* captura client-side de fontes custom pode ter quirks; mitigar
    garantindo `document.fonts.ready` antes do capture. Render server-side fica como
    endurecimento futuro (Fase 2+), não bloqueia a Fase 1.
- **Aprovação:** **sem mudança** — reusa `aprovacao_token`, `/aprovacao-design/[token]` e os
  status existentes. O Studio só produz a arte; o fluxo de enviar pro cliente é o que já tem.

---

## Segurança & papéis

- Acesso: mesmos papéis do Design — `adm`, `socio`, `coordenador`, `assessor`, `designer`,
  `videomaker`, `editor`, `audiovisual_chefe`. Filtro multi-tenant por unidade igual a
  listagem atual.
- Chat, upload e export passam por **server actions com `requireAuth`** (chave da IA nunca
  no cliente).
- Bucket privado, signed URLs (como já é).

---

## Componentes & arquivos (esboço)

```
src/app/(authed)/design/[clientId]/studio/page.tsx          # nova arte
src/app/(authed)/design/[clientId]/studio/[arteId]/page.tsx # reabrir
src/components/design/studio/
  StudioShell.tsx        # layout 3 painéis + tabs Editor/Chat
  StudioCanvas.tsx       # canvas, camadas, drag/resize
  StudioLeftPanel.tsx    # foto, fundo, elementos, fontes, logo, camadas
  StudioProperties.tsx   # painel direito (propriedades do elemento)
  StudioChat.tsx         # chat IA (chama server action)
  useComposicao.ts       # estado da composição (camadas, seleção)
  exportCanvas.ts        # render → PNG (client-side)
  comandos.ts            # parser/validador de comandos da IA
src/lib/design/
  studio-actions.ts      # salvar/abrir composição, upload export
  marca-actions.ts       # upload fonte/logo, update manual de marca
  chat-actions.ts        # server action do chat IA (Claude)
  studio-prompt.ts       # monta system prompt c/ manual de marca + canvas state
  tipos.ts (estender)    # Composicao, Camada, ManualMarca, ComandoIA
```

---

## Fora de escopo (Fase 1)

- **Geração de imagem por IA** (Flux/GPT-Image/Ideogram) — Fase 2.
- Render server-side do export.
- Publicação direta em redes (já é responsabilidade do módulo Social Media).
- Cliente sair do Design ao dar churn/excluir — **fix separado** (ver abaixo), não faz parte
  deste spec.

## Esboço da Fase 2 (spec próprio depois)

- Botão "Gerar fundo/imagem com IA" usando os `IA_PROVIDERS` já no código.
- Resultado entra como **camada de foto** dentro do editor (continua editável por cima).
- Prompt da geração recebe o manual de marca (mood/paleta) como contexto.
- Registrar `fonte_origem` (`ia_flux`/`ia_openai`…), `ai_prompt`, `ai_metadata` (custo) na
  arte — campos que já existem em `design_artes`.

---

## Trabalho relacionado (fora deste spec)

**Cliente em churn/excluído deve sumir do Design.** Hoje `listClientesDesign` filtra só
`status = "ativo"`; churn já some (vira `status = "churn"`), mas **exclusão** é soft-delete
(`deleted_at`) mantendo `status = "ativo"`, e a query não filtra `deleted_at`. Fix de 1
linha: adicionar `.is("deleted_at", null)` em `src/lib/design/queries.ts` (e checar os
módulos irmãos — Social Media / Agendamento — pelo mesmo gap). **PR separado e rápido.**
