# Tarefas — Visão "Gráfico" (estilo Obsidian)

**Data:** 2026-06-29
**Módulo:** Tarefas (`/tarefas`)
**Status:** Aprovado para implementação

## Objetivo

Adicionar uma terceira visão às Tarefas (além de "Quadro" e "Lista"): um **gráfico de força**
estilo Obsidian, onde clientes e pessoas são "centros" e as tarefas orbitam ligadas a eles.
Pedido por colaborador pra ter uma visão de rede de "quem cuida do quê em qual cliente".

## Decisões de produto (brainstorm)

1. **Nós (nodes):** tarefas + **clientes** (hub) + **pessoas** (hub: responsável + participantes).
2. **Arestas (edges):** cada tarefa liga ao seu **cliente** e ao seu **responsável** (e participantes).
   Não há link tarefa↔tarefa (o modelo não tem isso hoje).
3. **Cor das tarefas:** por **status** (com botão pra alternar pra **prioridade**).
4. **Escopo:** desenha **tudo** por padrão, com **filtros embutidos no próprio gráfico** (busca + status/cliente/pessoa) pra ir limpando.

## Experiência do usuário

- No seletor de visão (hoje "Quadro" / "Lista"), entra **"Gráfico"** (ícone de rede).
- Canvas de força: nós se atraem/repelem e se acomodam sozinhos.
  - **Clientes:** bolinha maior, rótulo com nome.
  - **Pessoas:** bolinha média, rótulo com nome.
  - **Tarefas:** bolinha menor, colorida por status (toggle p/ prioridade).
- **Interações:**
  - Hover numa tarefa → mostra o título (tooltip/label).
  - **Clique numa tarefa → abre a tarefa** (navega pra `/tarefas/{id}`).
  - Clique num hub (cliente/pessoa) → realça/filtra os nós ligados a ele.
  - Zoom (scroll) e pan (arrastar o fundo); arrastar um nó reposiciona.
  - **Filtros embutidos:** busca por texto + filtro por status; toggle "mostrar pessoas" / "mostrar clientes" pra simplificar.
- **Legenda** de cores (status/prioridade) no canto.

## Arquitetura

### Wiring (reusa o que existe)

- `src/app/(authed)/tarefas/page.tsx`: o tipo `View` ganha `"grafico"`; o parse de `params.view`
  aceita `"grafico"`; render condicional adiciona `<TasksGraph .../>`. Os dados (`tasks`,
  `profiles`, `clientes`) **já são buscados** na página — passa pro componente. Sem nova query.
- `src/components/tarefas/ViewToggle.tsx`: tipo `current` vira `"board" | "list" | "grafico"`;
  adiciona o botão "Gráfico" (ícone `Network`/`Share2` do lucide). `?view=grafico`.

### Componente novo

- `src/components/tarefas/TasksGraph.tsx` (client component): recebe `tasks: TaskRow[]`,
  `profiles: {id,nome}[]`, `clientes: {id,nome}[]`. Monta nós/arestas e renderiza o gráfico.
  - **Carregamento dinâmico** (`next/dynamic`, `ssr: false`) — o gráfico precisa do browser/canvas.
  - **Montagem do grafo** (pura, testável — extrair pra `src/lib/tarefas/graph.ts`):
    - `buildTaskGraph(tasks, profiles, clientes, opts)` → `{ nodes, links }`.
    - Nós: `task:{id}`, `cliente:{id}`, `pessoa:{id}` (dedup de pessoas/clientes que se repetem).
    - Links: task→cliente (se `client_id`), task→responsável (`atribuido_a`), task→participantes.
    - Pessoa/cliente só vira nó se tiver ≥1 tarefa ligada (evita hubs órfãos).

### Biblioteca de gráfico

- **Primária:** `react-force-graph-2d` (canvas, física d3 embutida, zoom/pan/drag/hover/click prontos) — é o caminho mais "Obsidian" com menos código.
- **Verificação na implementação:** confirmar compatibilidade com React 19 / Next 16 (peerDeps). Se incompatível, **fallback:** `d3-force` (simulação) + render em `<canvas>` próprio.
- Decisão final registrada no plano após checar a compat.

### Cores / legenda

- Status → paleta já usada no Quadro (reusar as cores de `STATUS` das tarefas).
- Prioridade → alta/média/baixa (vermelho/amarelo/azul).
- Toggle de coloração no canto do canvas.

## Performance / escala

- Escopo "tudo" pode gerar muitos nós. Mitigação:
  - Canvas (não SVG) → aguenta centenas/milhares de nós.
  - Filtros embutidos reduzem o desenhado.
  - **Guarda:** se passar de um limite (ex: 600 tarefas), mostra aviso "muitas tarefas — use os filtros" e desenha mesmo assim (não trava).
- Simulação roda no client; sem custo de servidor.

## Tratamento de erros / borda

- Sem tarefas → estado vazio ("Nenhuma tarefa pra desenhar").
- Tarefa sem cliente/responsável → ainda aparece, ligada só ao que tiver (ou solta).
- A visão não altera dados — é só leitura. Clique só navega.

## Testes

- Unit test de `buildTaskGraph` (`src/lib/tarefas/graph.ts`): monta nós/arestas corretamente;
  dedup de pessoas/clientes; ignora hub sem tarefa; tarefa sem cliente não cria link de cliente.

## Fora de escopo (depois)

- Link tarefa↔tarefa de verdade (exigiria relação nova no banco).
- Exportar imagem do gráfico.
- Salvar layout/posições.

## Banco de dados

- **Nenhuma migration.** Usa `listTasks` + profiles + clientes já buscados na página.

## Dependência nova

- `react-force-graph-2d` (ou `d3-force` no fallback). É a única adição de pacote.
