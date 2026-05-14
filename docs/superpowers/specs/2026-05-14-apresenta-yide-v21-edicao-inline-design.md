# Apresenta Yide v2.1 — Edição inline dos slides

**Data:** 2026-05-14
**Status:** Aprovado, pronto pra implementação

## Contexto

Apresenta Yide v1 (PRs #296/#297/#298) entrega geração via IA + PDF.
Mas IA erra: nome de cliente errado, dado factual, tom esquisito.
Usuária precisa de poder corrigir sem regenerar tudo do zero.

## Escopo v2.1

**Entrega:**
- Botão "Editar slide" no editor abre modal com formulário do template
- Formulário tem campos correspondentes ao template type do slide
- Arrays (bullets, tópicos) editáveis com add/remove dinâmico
- Botão "Excluir slide" dentro do mesmo modal
- Server actions: `atualizarSlideAction`, `excluirSlideAction`

**Fora de escopo (v2.2+):**
- Mudar template do slide (turn "conteudo" em "metrica")
- Reordenar slides (drag-and-drop)
- Adicionar novo slide do zero (regerar é a alternativa)
- Histórico / undo

## Arquitetura

### Server actions

```typescript
// src/lib/apresenta-yide/actions.ts

interface AtualizarSlideInput {
  apresentacao_id: string;
  slide_index: number;
  content: SlideContent;  // validado via isValidSlide({template, content})
}

async function atualizarSlideAction(input): Promise<{ error?: string; success?: true }>;
async function excluirSlideAction(input: { apresentacao_id: string; slide_index: number }): Promise<{ error?: string; success?: true }>;
```

Permissões: criador do slide ou adm/sócio. Mesma regra das outras
actions do módulo.

Implementação:
1. Auth check
2. Fetch da apresentação
3. Validate `slide_index` está no range
4. Pra atualizar: substitui `slides[slide_index]`, validate shape via
   `isValidSlide`, update DB
5. Pra excluir: remove `slides[slide_index]`, update DB
6. `revalidatePath`, `logAudit`

### UI: EditSlideDialog

Client component que recebe:
- `apresentacaoId: string`
- `slideIndex: number`
- `slide: Slide`
- `onClose: () => void`

Render: modal com `<Dialog>`. Conteúdo do form depende do `slide.content.template`:

| Template | Campos no form |
|---|---|
| capa | `titulo` (input) + `subtitulo` (input, opcional) |
| conteudo | `titulo` (input) + `texto` (textarea, opcional) + `bullets` (array dinâmico de inputs) |
| duas_colunas | `titulo` (input) + `coluna_esquerda.{titulo, texto}` + `coluna_direita.{titulo, texto}` |
| metrica | `numero` + `label` + `descricao` (opcional) |
| topicos_numerados | `titulo` + array dinâmico de `{titulo, texto?}` |
| encerramento | `mensagem` + `cta` (opcional) |

Componente helper `<ArrayInput>` pra bullets/tópicos: lista de inputs
com botão "+" pra adicionar, "×" pra remover. Mínimo de 1 item em
arrays obrigatórios (bullets já é opcional, topicos é obrigatório).

Botão "Excluir slide" no rodapé do modal (variante destructive) com
confirmação inline.

### Integração com Editor

Modificar `ApresentacaoEditor.tsx`:
- Adicionar botão "Editar" próximo aos prev/next (visível apenas se
  `editable={true}`)
- Estado local `editingIdx: number | null`
- Quando set, renderiza `<EditSlideDialog>`
- Editor recebe `editable` prop nova (true só na page do detail
  quando user é criador ou adm/sócio)

A `/[id]` page passa `editable={canEdit}` baseado em permissão.

Após save/delete, action revalidate o path. Page reabre com slides
atualizados.

### Edge cases

- **Slide_index fora do range** → action retorna erro "Slide não existe"
- **Content shape inválido** → action retorna erro de validação
- **Excluir único slide** → permite (apresentação fica vazia). UI mostra "Sem slides" e botão "Regerar"
- **Excluir slide que está sendo navegado** → editor ajusta `currentIdx` pra MAX(0, idx - 1)
- **Apresentação ainda gerando** → botões de edit aparecem desabilitados com tooltip "Aguarde geração terminar"

## Testes

Unit em `tests/unit/apresenta-yide-edit-actions.test.ts`:
- atualizarSlideAction: valida shape do content novo, persiste no DB
- atualizarSlideAction: rejeita slide_index fora do range
- atualizarSlideAction: rejeita user sem permissão
- excluirSlideAction: remove slide do array, persiste
- excluirSlideAction: ajusta array corretamente quando excluindo último
- excluirSlideAction: rejeita slide_index fora do range
