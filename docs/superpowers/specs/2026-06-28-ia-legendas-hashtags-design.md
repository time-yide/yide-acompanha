# IA de Legendas e Hashtags — Compositor de Post (Social Media)

**Data:** 2026-06-28
**Módulo:** Social Media (`/social-media`)
**Status:** Aprovado para implementação

## Objetivo

Acelerar a criação de posts permitindo que a equipe gere (ou melhore) a **legenda** e as
**hashtags** com IA, na voz da marca de cada cliente. É um recurso **opt-in**: a IA só roda
quando o usuário clica no botão — nunca automaticamente — pra manter o custo baixo.

## Decisões de produto (brainstorm)

1. **Dois modos** (gerar do zero a partir de uma ideia **e** melhorar um rascunho existente).
2. **Um resultado** por clique (não gera variações) — prioriza simplicidade e custo.
3. **Tom automático**: usa o tom de voz cadastrado no style guide do cliente. Sem seletor de tom.
4. **Uma legenda** serve pra todas as redes selecionadas (não adapta por rede).

## Experiência do usuário

No `PostFormModal`, acima do campo **Legenda**, um bloco "✨ IA":

- Campo de texto curto **"Conte a ideia do post"** (brief). Placeholder de exemplo.
- Botão **"✨ Gerar com IA"**:
  - Habilitado quando há texto no brief.
  - Ao clicar: estado "Gerando..." → preenche os campos `legenda` e `hashtags` com o resultado.
- Botão secundário **"Melhorar rascunho"**:
  - Visível/habilitado apenas quando o campo `legenda` já tem conteúdo.
  - Reescreve o rascunho atual (mais envolvente, mantendo a intenção) e atualiza `legenda` + `hashtags`.
- O resultado é **editável** — cai nos campos normais, o usuário ajusta como quiser.
- Se `legenda`/`hashtags` já tiverem conteúdo, o resultado **substitui** (o usuário pediu explicitamente clicando).

## Arquitetura

### Componentes / arquivos

| Arquivo | Papel |
|---|---|
| `src/lib/social-media/caption-generator.ts` (novo) | Server-only. Monta prompt + chama Anthropic + valida resposta. |
| `src/lib/social-media/actions.ts` (existente) | Nova server action `gerarLegendaIaAction`. |
| `src/components/social-media/PostFormModal.tsx` (existente) | Bloco de IA: input do brief, botões, estado de loading, preenchimento dos campos. |
| `src/lib/ai/client.ts` (existente) | Reusa `getAnthropicClient()`. Adiciona constante de modelo se necessário. |

### Fluxo de dados

1. Usuário digita brief (ou tem rascunho) → clica Gerar/Melhorar.
2. Client component chama `gerarLegendaIaAction({ clientId, brief?, rascunho?, formato, redes })`.
3. Action valida permissão (`canManage`) + input (zod) → chama `gerarLegenda()` do `caption-generator`.
4. `caption-generator`:
   - Busca `clients.nome` + `clients.design_style_guide` (tom_voz, mood, evitar, marca) + `servico_contratado`/segmento disponível.
   - Monta **system prompt** com a voz da marca; **user prompt** com o brief OU "melhore este rascunho".
   - Chama `getAnthropicClient().messages.create()` com modelo Haiku, `max_tokens` ~800.
   - Faz parse do JSON `{ legenda, hashtags }`, valida com zod.
5. Action retorna `{ legenda, hashtags }` ou `{ error }`.
6. Component preenche os campos.

### Desenho do prompt

- **System:** papel de redator de social media; instruções de tom da marca; regras (sem inventar
  dados/preços que não vieram no brief; hashtags relevantes ao segmento; respeitar "evitar" do
  style guide; ajustar tamanho ao formato — story/reels curto, feed pode ser mais longo).
- **User:** o brief, ou o rascunho a melhorar; mais formato e redes como contexto leve.
- **Saída:** JSON estrito `{ "legenda": string, "hashtags": string }` (hashtags como uma string,
  ex: `"#marketing #cuiaba #promoção"`), pra encaixar direto nos campos existentes.

## Custo

- Modelo Haiku (mais barato), 1 resultado, `max_tokens` limitado (~800), **só on-demand**.
- Estimativa: fração de centavo por clique. Sem custo quando ninguém usa.

## Tratamento de erros / casos de borda

- **Sem `ANTHROPIC_API_KEY`** → action retorna erro amigável ("IA não configurada"); UI mostra aviso, não quebra o formulário.
- **Cliente sem style guide** → usa nome + segmento; tom genérico mas decente (sem falhar).
- **Resposta da IA fora do formato** → parse falha → erro amigável ("Não consegui gerar, tente de novo"); o usuário segue escrevendo na mão.
- **Brief vazio no modo gerar** → botão desabilitado (validação no client) + guarda na action.
- **Formato story** → caption não aparece no story; geração é permitida (não atrapalha) mas não é o foco.
- **Limite de tamanho** do brief/rascunho (ex: brief ≤ 500 chars, rascunho ≤ 4000) pra controlar tokens.

## Permissões

- Mesmos papéis que já gerenciam social media (`canManage`): adm, socio, comercial, coordenador,
  assessor, designer, videomaker, editor, audiovisual_chefe.

## Testes

- Teste unitário do `caption-generator` mockando o cliente Anthropic:
  - Monta prompt corretamente com/sem style guide.
  - Faz parse de JSON válido → retorna `{ legenda, hashtags }`.
  - JSON inválido → retorna erro (não lança).
  - Sem API key → retorna erro amigável.
- Segue o padrão existente em `src/lib/satisfacao/` (se houver teste lá) ou o padrão vitest do repo.

## Fora de escopo (nesta entrega)

- Variações múltiplas pra escolher.
- Adaptação de legenda por rede.
- Seletor manual de tom.
- Geração de imagem (é do módulo Design).
- Sugestão de melhor horário (projeto separado).

## Banco de dados

- **Nenhuma migration.** Usa os campos existentes (`legenda`, `hashtags`) e `clients.design_style_guide`.
