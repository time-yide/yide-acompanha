# Design Studio de Arte — Fase 2: Geração de imagem por IA

**Data:** 2026-06-06
**Módulo:** Design / Studio (`/design/[clientId]/studio`)
**Depende de:** Fase 1 (mergeada, PR #497)
**Status:** Spec aprovado, aguardando plano de implementação

---

## Resumo

Adicionar ao Studio a capacidade de **gerar uma imagem por IA** quando o usuário pedir,
entregando o resultado como **camada de fundo** do editor (que ele edita por cima com
texto/logo/formas). A geração é **sob demanda** e usa um fluxo de dois cérebros:

- **Claude** (que já é o chat do Studio) entende o pedido em português + o **manual de
  marca** do cliente e escreve um **prompt de imagem detalhado em inglês**, fiel ao
  mood/paleta/regras da marca.
- **GPT-Image-1** (OpenAI) renderiza a imagem a partir desse prompt.

A imagem volta como `fundo.foto` da composição (ou, se pedido, uma camada movível).

### Princípio central: geração é só MAIS uma opção, não o padrão

O comportamento normal do Studio continua sendo **montar arte com fotos reais** que a
usuária sobe (Fase 1). A geração por IA **não substitui** isso — ela só acontece **quando
a usuária pede** ("gera um fundo de churrasco"). O Claude:

- **Prefere fotos reais** já enviadas quando existirem.
- **Só emite o comando de gerar** quando a usuária pede explicitamente, ou confirma uma
  sugestão.
- **Pode sugerir** gerar (em texto, ex.: "quer que eu gere um fundo de X?") quando faltar
  uma imagem — mas **nunca gera sem o "ok"** dela (a sugestão é só mensagem, sem comando).

---

## Contexto: o que já existe (reaproveitar)

Da Fase 1 (no `origin/main`):

- **Chat IA server-side** (`src/lib/design/chat-actions.ts` → `chatStudioAction`): manda
  manual de marca + estado da canvas pro Claude e devolve `{mensagem, comandos}`.
- **Protocolo de comandos** (`src/lib/design/studio-comandos.ts` → `parseRespostaIA`,
  `ACOES_VALIDAS`) e o aplicador (`useComposicao.ts` → `aplicarComandos`).
- **System prompt** (`src/lib/design/studio-prompt.ts` → `buildStudioSystemPrompt`) que já
  injeta o manual de marca.
- **Composição** com `fundo.foto` (`{url, zoom, x, y, opacidade}`) e camadas de imagem.
- **Upload pra Storage** (`uploadStudioAssetAction` em `studio-actions.ts`) → bucket
  `design-criativos`, path `…/studio-assets/…`, signed URL.
- **`design_artes`** já tem `fonte_origem` (`ia_openai`/`ia_gemini`/`ia_flux`/`ia_ideogram`),
  `ai_modelo`, `ai_prompt`, `ai_metadata`.
- **`IA_PROVIDERS`** em `src/lib/design/tipos.ts` (lista; todos `comingSoon`).
- Vercel roda funções com `maxDuration` até 300s (ex.: `apresenta-yide/[id]/gerar` usa 60s
  síncrono) → **geração síncrona é viável**, sem precisar do padrão job/cron do
  editor-ia/yori.

**Nenhuma chave de geração de imagem existe ainda** (`env.ts` não tem OPENAI/BFL/etc.) e
não há código de geração — a Fase 2 cria isso.

---

## Arquitetura

### Fluxo end-to-end

```
Usuária (chat): "gera um fundo de churrasco premium pra esse cliente"
        │
        ▼
chatStudioAction (Claude)  ── system prompt c/ manual de marca + regra de geração
        │   devolve: mensagem + comando {action:"gerarImagem", prompt:"<EN>", alvo:"fundo"}
        ▼
Cliente (StudioChat): vê a mensagem; encontra gerarImagem → mostra "gerando imagem…"
        │   POST /api/design/studio/gerar-imagem {clientId, prompt, formato}
        ▼
Rota (maxDuration=60): requireAuth + papel → serviço OpenAI gpt-image-1
        │   sobe PNG no bucket (studio-assets/ia-{ts}.png) → signed URL
        ▼
Cliente: setFoto(url) (vira fundo) → aplica os demais comandos de layout por cima
```

### Por que rota dedicada (e não server action no chat)

A geração leva ~10–30s. Uma **rota** `POST /api/design/studio/gerar-imagem` com
`export const maxDuration = 60` garante o tempo (igual `apresenta-yide/[id]/gerar`). O chat
(`chatStudioAction`) permanece rápido — ele só decide *se* gera e com *qual* prompt; a
renderização cara é a rota separada. Assim um comando `gerarImagem` na mesma resposta do
Claude é processado pelo cliente chamando essa rota.

---

## Componentes / arquivos

**Novos:**
- `src/lib/design/image-gen/tipos.ts` — interface provider-agnostic:
  `GerarImagemParams { prompt, width, height }`, `GerarImagemResult { ok, base64?|url?, error? }`,
  e o tipo `ImageProvider`.
- `src/lib/design/image-gen/openai.ts` — implementação `gpt-image-1` (chama a API de imagens
  da OpenAI). SERVER ONLY.
- `src/app/api/design/studio/gerar-imagem/route.ts` — `POST`, `maxDuration = 60`,
  `requireAuth` + `isDesignRole`; valida payload (zod), chama o provider, sobe o PNG via o
  mesmo padrão de `uploadStudioAssetAction`, devolve `{ url }` ou `{ error }`.

**Modificados:**
- `src/lib/design/studio-comandos.ts` — adicionar `"gerarImagem"` à `ACOES_VALIDAS` e validar
  `{ prompt:string(>0), alvo:"fundo"|"camada" (default "fundo") }`.
- `src/lib/design/studio-prompt.ts` — instruir o Claude sobre a regra de geração (abaixo).
- `src/components/design/studio/StudioChat.tsx` — ao processar comandos, separar
  `gerarImagem`: chamar a rota, mostrar estado "gerando…", e em sucesso aplicar via
  `setFoto`/camada; tratar erro no chat. Os demais comandos da mesma resposta aplicam depois.
- `src/components/design/studio/useComposicao.ts` — helper pra aplicar o resultado da geração
  (set background a partir de uma URL) e ordenar: `gerarImagem` antes dos comandos de layout.
- `src/lib/env.ts` — adicionar `OPENAI_API_KEY: z.string().optional()`.
- `src/lib/design/studio-actions.ts` — no `salvarComposicaoAction`, quando a composição tem
  origem de IA, gravar `fonte_origem='ia_openai'`, `ai_modelo='gpt-image-1'`, `ai_prompt`
  (o prompt do Claude) e `ai_metadata` (tamanho/custo se disponível). Requer carregar esses
  campos no input do save (ver Persistência).
- `src/lib/design/tipos.ts` — marcar `ia_openai` como **não** `comingSoon`.

---

## Regra de geração no system prompt (Claude)

Adicionar ao `buildStudioSystemPrompt`:

> Você também pode GERAR uma imagem por IA quando fizer sentido, com o comando
> `{"action":"gerarImagem","prompt":"<prompt em inglês>","alvo":"fundo"}`.
> REGRAS:
> 1. **Prefira fotos reais** que a usuária já enviou. Só gere imagem quando ela **pedir
>    explicitamente** ("gera/cria um fundo/imagem de…") ou **confirmar** uma sugestão sua.
> 2. Se faltar uma imagem e ela NÃO pediu pra gerar, você **pode sugerir** em texto
>    ("quer que eu gere um fundo de X?") — mas **NÃO emita `gerarImagem` nessa resposta**;
>    espere ela confirmar.
> 3. Ao gerar, escreva o `prompt` em **inglês**, detalhado e fiel à marca: incorpore o
>    mood, a paleta (descreva as cores), e respeite o "evitar". Descreva uma imagem de
>    **fundo** (sem texto embutido — o texto é camada no editor).
> 4. `alvo` é "fundo" por padrão; use "camada" só se ela pedir um elemento solto.

Whitelist de fonte/cor já existente continua valendo pros outros comandos.

---

## Serviço OpenAI (gpt-image-1)

`src/lib/design/image-gen/openai.ts`:

- Usa a API de imagens da OpenAI (`images.generate`) com `model: "gpt-image-1"`.
- **Tamanhos** mapeados do formato da canvas:
  - `feed` → `1024x1024`
  - `story` / `reels` → `1024x1536` (retrato)
  - (a canvas faz cover/escala; não precisa bater pixel-exato com 1080.)
- **Qualidade**: `medium` por padrão (equilíbrio custo/qualidade).
- Retorna o `b64_json` da imagem → a rota converte em Buffer e sobe pro bucket.
- Sem `OPENAI_API_KEY` → retorna `{ ok:false, error:"Geração de imagem não configurada" }`
  (a rota propaga; o chat mostra mensagem amigável). Mesmo padrão de degradação do
  `chatStudioAction` quando falta `ANTHROPIC_API_KEY`.

---

## Persistência / metadados

- A imagem gerada vai pro Storage (nunca base64 no banco) e sua URL entra em `fundo.foto.url`
  da composição — igual foto real.
- O cliente marca a composição como tendo **origem IA** quando uma geração ocorre, guardando
  o `ai_prompt` usado. No `salvarComposicaoAction`, esses campos extras (`fonte_origem`,
  `ai_modelo`, `ai_prompt`) são gravados em `design_artes`. O input do save ganha um campo
  opcional `iaInfo?: { modelo, prompt }`; quando presente, sobrescreve `fonte_origem` de
  `'manual'` para `'ia_openai'`.
- **Sem migration** — todos esses campos já existem em `design_artes`.

---

## Tamanho / custo / limites

- **Sem limite de uso** (decisão da usuária). O custo é por imagem na conta OpenAI dela.
- O ponto de "checar limite" fica **isolado numa função** (ex.: `podeGerar(actor)` que hoje
  retorna sempre `true`), pra ligar um cap por usuário/unidade depois sem refatorar o fluxo.
- `ai_metadata` guarda tamanho e (se a API retornar) custo/uso, pra auditoria futura.

---

## Erros & segurança

- Rota: `requireAuth` + `isDesignRole`; valida payload com zod; nunca expõe a chave ao
  cliente (geração é 100% server-side, como o chat).
- Sem `OPENAI_API_KEY`: erro amigável; nada quebra (o resto do Studio segue).
- Falha na geração (timeout, erro da OpenAI, política de conteúdo): a rota devolve `{error}`,
  o chat mostra a mensagem e **não troca o fundo**.
- Bucket privado, signed URL (1 ano, como os outros assets do Studio).

---

## Segurança multi-tenant

A rota recebe `clientId`; o upload é escopado em `{organization_id}/{clientId}/studio-assets/`
(resolvendo `organization_id` a partir do cliente, como as outras actions). `requireAuth` +
papel do Design. Sem caminho pra gerar/gravar no escopo de outro cliente.

---

## Fora de escopo (Fase 2)

- Outros provedores (Flux/Imagen/Ideogram) — a interface fica provider-agnostic, mas só o
  GPT-Image é ligado agora.
- Edição/inpainting/variações da imagem gerada (regerar é só pedir de novo no chat).
- Geração de carrossel (múltiplas imagens de uma vez).
- Limite/cota de uso (ponto isolado, não implementado).
- Campo de "gerar imagem" fora do chat (o fluxo é todo pelo chat; um botão dedicado pode vir
  depois se ela quiser).

---

## Ação de ops (pós-merge)

Adicionar **`OPENAI_API_KEY`** nas env vars da Vercel (produção + preview). Sem ela, o fluxo
de geração mostra "geração de imagem não configurada" e o resto do Studio funciona normal.
Nenhuma migration nesta fase.
