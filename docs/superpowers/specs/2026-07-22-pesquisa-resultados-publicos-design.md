# Visibilidade de resultados por pesquisa (público ao time)

**Data:** 2026-07-22
**Branch:** `feat/pesquisa-resultados-publicos` (a partir de `origin/main`)

## Objetivo

Hoje **toda** pesquisa mostra os resultados só pra gestão (`manage:pesquisas` =
`coordenador`/`socio`/`adm`). Queremos um controle **por pesquisa**: algumas ficam
abertas pro time inteiro ver os resultados; outras (como "Conecta Yide") continuam
só-gestão.

Decisões da Yasmin:
- **Quem vê (numa pesquisa pública):** o time todo (qualquer usuário logado).
- **O que vê:** só o **agregado, sem nomes** — nada de respostas individuais nem
  lista de quem falta.
- **Como marcar:** **toggle na tela de criação** (reutilizável), editável enquanto
  rascunho — espelha o campo `anonima`.
- Conecta Yide fica com o default (`resultados_publicos = false`) → sem mudança.

## Contexto (código existente)

- `pesquisas` (migration `20260721000001_pesquisas.sql`). `anonima` é setado só na
  criação (`NovaPesquisaForm` → `createPesquisaAction`); as demais telas só exibem.
- Acesso a resultados hoje: `src/app/(authed)/pesquisas/[id]/page.tsx` faz
  `if (!canManage) redirect("/pesquisas")`.
- `getResultados` (`src/lib/pesquisas/queries.ts`) já separa **agregado sem nome**
  (`perguntas: ResultadoPergunta[]`, `total_respondidos/total_destinatarios`) do que
  tem nome (`porPessoa`, `faltamResponder`).
- `ResultadosView` renderiza o agregado por pergunta num bloco final auto-contido
  (componente `Barra` + `.map`), sem nomes — reaproveitável.
- **Selects explícitos:** todas as queries listam colunas (`getPesquisaComPerguntas`
  linha 105 etc.) e NÃO usam `*`. Adicionar `resultados_publicos` ao select exige a
  coluna existir. Ver memória `feedback_calendar_fullselect_fallback`.

## Arquitetura

### 1. Coluna nova (migration manual)
`resultados_publicos boolean not null default false` em `pesquisas`.

### 2. Toggle na criação (espelha `anonima`)
- `createPesquisaSchema`: `resultados_publicos: z.coerce.boolean().default(false)`.
- `PesquisaRow` (schema.ts): novo campo `resultados_publicos: boolean`.
- `NovaPesquisaForm`: `Switch` "Liberar resultados pro time".
- `createPesquisaAction` + `updatePesquisaAction`: gravam o campo.
- `getPesquisaComPerguntas`: adiciona `resultados_publicos` ao select (base do
  `getResultados`, usada pela tela de resultados).

### 3. Extrair o agregado num componente compartilhado
- Novo `src/components/pesquisas/PerguntasAgregadas.tsx` (SEM `"use client"` — é
  presentational puro): exporta `Barra` e `PerguntasAgregadas({ perguntas })`,
  movendo o bloco de agregado por pergunta de `ResultadosView`.
- `ResultadosView` passa a importar `Barra`/`PerguntasAgregadas` desse arquivo (sem
  mudança visual pra gestão).

### 4. Visão do time (só-agregado, read-only)
- Novo `src/components/pesquisas/ResultadosPublicosView.tsx` (server component):
  cabeçalho (título, descrição, contagem X/Y responderam, aberta/encerrada) +
  aviso "visão agregada, sem identificar quem respondeu" + `<PerguntasAgregadas>`.
  **Não recebe** `porPessoa`/`faltamResponder` — nomes nunca vão ao cliente.

### 5. Acesso na tela de resultados
`[id]/page.tsx`:
- `rascunho` → gestão vai pro editar; time → `/pesquisas`.
- Time (não-gestão): se `resultados_publicos` → renderiza `ResultadosPublicosView`
  com recorte só-agregado; senão → `redirect("/pesquisas")` (como hoje).
- Gestão → `ResultadosView` completo (como hoje).

### 6. Descoberta pro time
- Nova query `listPesquisasPublicas()`: pesquisas com `resultados_publicos = true`
  e `status != 'rascunho'`, não deletadas.
- `/pesquisas` (listagem): seção "Resultados abertos ao time" (visível a todos)
  com links pra `/pesquisas/[id]`. Sem ela, o modo time seria inacessível.

## Privacidade
Pro time, a página monta um objeto só com o agregado (sem `porPessoa`/`faltamResponder`)
— os nomes não são serializados ao navegador. Não é esconder com CSS. Textos livres
aparecem **sem** nome (é o agregado). RLS de leitura segue permissiva; toda leitura é
via service-role atrás da checagem da página, padrão do módulo.

## Ordem de deploy (CRÍTICO)
1. **PRIMEIRO** aplicar a migration `resultados_publicos` no SQL Editor.
2. Só então mergear/deployar o código (o select de `getPesquisaComPerguntas` passa a
   referenciar a coluna; se subir antes, a tela de resultados quebra na janela até a
   migration). Ver `feedback_calendar_fullselect_fallback`.

## Fora de escopo (YAGNI)
- Editar `resultados_publicos` fora do rascunho pela UI (sem form usa
  `updatePesquisaAction` hoje; mantemos paridade com `anonima`).
- Mostrar textos ao time de forma diferente do agregado atual.
- Restringir a visão do time só a pesquisas encerradas.

## Verificação
- `tsc`, `eslint`, `vitest run src/lib/pesquisas` (--exclude '**/.claude/**').
- Manual pós-deploy: gestão vê tudo; cargo comum vê só-agregado numa pesquisa
  pública e é redirecionado numa não-pública; Conecta Yide segue só-gestão.
