# Card do Jogador — Design (Fase 1)

**Data:** 2026-07-21
**Status:** aprovado pela Yasmin, pronto pra plano de implementação
**Escopo deste doc:** Fase 1 (o Card). Fases 2 (Conquistas) e 3 (Skills) ficam como roadmap no fim.

---

## 1. Visão

Cada pessoa do time ganha um **"Card do Jogador"** — um perfil com cara de game,
onde ela coloca sua identidade (username, capa, bio) e o sistema mostra
automaticamente sua "classe" (temperamento), com quem tem sinergia e os
resultados das pesquisas que respondeu. Todo o time vê o card de todos — é uma
forma de se conhecer, e de quem entra novo conhecer quem já está.

**Princípios de UI:**
- **Sem emojis. Sempre ícones** (lucide-react), consistente com o resto do sistema.
- Clima de game, mas sóbrio e alinhado ao design atual (Cards, Badges, cores do tema).

---

## 2. Onde vive (rotas e navegação)

| Rota | O que é | Quem acessa |
|---|---|---|
| `/time` | Grade com os mini-cards de todos os colaboradores ativos, clicáveis | Todo colaborador (`roles: "all"`) |
| `/perfil/[id]` | O card completo de uma pessoa | Todo colaborador; mostra "Editar" se for o próprio (ou adm/sócio) |
| `/perfil/[id]/editar` | Formulário de edição do próprio card | Só o dono ou adm/sócio |

- **Item de menu novo:** "Time" (ícone `Users` ou `Gamepad2`), no grupo "Interno", `roles: "all"`.
- **"Meu Perfil":** atalho pro próprio `/perfil/[meuId]` — pelo clique no avatar do header (ou item de menu). Decisão de UI fina fica pro plano.
- **Separado de `/colaboradores`** (que é RH/financeiro). O card é a camada social/pública; Colaboradores continua sendo a ficha administrativa.

### Clicar no nome/ícone abre o card
Requisito transversal: onde aparecer nome ou avatar de uma pessoa (tarefas,
comentários, chat, listas), o elemento vira link pra `/perfil/[id]`.
- Criar um componente reutilizável **`<PessoaLink>`** (recebe `id`, `nome`, opcional `avatarUrl`) que renderiza nome/avatar clicável apontando pro card.
- Aplicar nos pontos de maior uso primeiro (não precisa trocar tudo de uma vez na Fase 1; o componente fica pronto e vai sendo adotado).

---

## 3. Anatomia do card (`/perfil/[id]`)

Ordem das seções (ícones lucide indicados):

1. **Capa + cabeçalho**
   - Imagem de **capa/banner** (`capa_url`, editável).
   - **Avatar** (reusa `avatar_url` do profile).
   - **@username** + **Nome completo** + **Cargo** (`roleLabel`) + **tempo de casa** (calculado de `data_admissao`, ícone `Clock`).
   - **Frase/lema** (`frase`).
   - Botão **Editar** (ícone `Pencil`) — visível só pro dono ou adm/sócio.

2. **Classe (temperamento)** — ícone `Drama`/`Sparkles`
   - Mostra **só o rótulo da classe** (ex.: "Sanguíneo") + uma **descrição curta** fixa por classe. **NUNCA os números A·B·C·D** (esses ficam só na tela de resultados da pesquisa, pra liderança).
   - Some se a pessoa ainda não respondeu o teste DISC.

3. **Sobre mim** (`bio`) — ícone `BookOpen` · **Como gosto de trabalhar** (`como_trabalho`) — ícone `Briefcase`
   - Dois blocos de texto livre, lado a lado (empilha no mobile).

4. **Hobbies & interesses** (`hobbies`) — ícone `Gamepad2`
   - Lista de tags (chips). Ex.: música, jogos, etc.

5. **Sinergia** — ícone `Handshake`
   - **Trabalho:** pessoas cujo temperamento combina com o dela (regra de compatibilidade fixa, ver §5).
   - **Curte o mesmo:** pessoas com mais hobbies em comum.
   - Cada pessoa listada é um `<PessoaLink>` (clica e vai pro card dela).

6. **Conquistas** — ícone `Trophy` — **bloqueado** "em breve" (Fase 2). Placeholder visual.

7. **Skills** — ícone `Zap` — **bloqueado** "em breve" (Fase 3). Placeholder visual.

8. **Resultados de pesquisas** — ícone `ClipboardList`
   - Lista as pesquisas **identificadas** que a pessoa **respondeu**, com link.
   - **Extensível:** qualquer pesquisa nova que ela responder aparece aqui sozinha (sem código novo).

---

## 4. Modelo de dados

Tabela nova **`perfil_jogador`** — isolada dos dados de RH em `profiles` (mais
seguro e organizado; a camada social não se mistura com salário/comissão).

```
perfil_jogador
  user_id      uuid   PK, FK → profiles.id (on delete cascade)
  username     text   UNIQUE (case-insensitive), null até a pessoa definir
  capa_url     text   null
  bio          text   null
  como_trabalho text  null
  hobbies      text[] default '{}'   (tags normalizadas em lowercase)
  frase        text   null
  created_at   timestamptz default now()
  updated_at   timestamptz default now()
```

- **Avatar:** reusa `profiles.avatar_url` (já existe + `AvatarUpload`).
- **Capa:** novo upload; mesmo bucket/estratégia do avatar (imagem leve — Supabase Storage tranquilo pra isso).
- **username:** único, validado (slug: letras/números/`_`/`.`, 3–20 chars), editável.
- **RLS:** SELECT liberado pra qualquer colaborador autenticado ativo; INSERT/UPDATE só do próprio `user_id` OU quem tem `manage:users` (adm/sócio). Lembrar: precisa de policy de INSERT explícita pro upsert do dono funcionar.

**Migration manual** (Vercel não roda migration no deploy) — aplicar via SQL Editor após o merge.

---

## 5. Lógica de Sinergia (automática, server-side)

Calculada a partir dos colaboradores ativos + `perfil_jogador` + temperamento.

### Trabalho (compatibilidade de temperamento)
Matriz fixa de "combina bem" entre as 4 classes (baseada na leitura clássica —
complementares se equilibram):

| | Colérico | Sanguíneo | Melancólico | Fleumático |
|---|---|---|---|---|
| **Colérico** | ok | bom | **ótimo** | bom |
| **Sanguíneo** | bom | ok | bom | **ótimo** |
| **Melancólico** | **ótimo** | bom | ok | bom |
| **Fleumático** | bom | **ótimo** | bom | ok |

- Para a pessoa, listar até **N (ex.: 3)** colegas com maior compatibilidade
  (prioriza "ótimo"), desempate por setor/aleatório estável por índice.
- Se a pessoa não tem temperamento (não respondeu), a seção some.

### Hobbies (interesses em comum)
- Interseção de tags de `hobbies` com cada colega; ranquear por nº de tags em comum (> 0).
- Listar até **N** com mais tags em comum, mostrando qual(is) tag(s).

> Detalhe fino do algoritmo (pesos, N exato, desempate) fica pro plano — o design
> fixa o *conceito* e as fontes de dado.

---

## 6. Permissões e privacidade

| Ação | Quem |
|---|---|
| Ver `/time` e qualquer `/perfil/[id]` | Qualquer colaborador ativo autenticado |
| Ver a **classe** (temperamento) | Todos (é público como "classe", sem números) |
| Editar o próprio card | O dono |
| Editar card de outra pessoa | adm/sócio (`manage:users`) |
| Ver os números A·B·C·D | Ninguém no card — só na tela de resultados da pesquisa (liderança) |

- Portal do cliente **não** acessa (é área interna `(authed)`).
- Programação e cargos com `roles:"all"` restrito: item "Time" segue a mesma regra dos outros itens `all` (revisar `isLinkVisible`/whitelist se necessário).

---

## 7. Componentização (unidades com fronteira clara)

- **`<PessoaLink>`** — nome/avatar clicável → `/perfil/[id]`. Sem dependência de negócio.
- **`<CardJogador>`** — renderiza o card completo a partir de um objeto `DadosCard`. Puro de apresentação.
- **`<MiniCard>`** — usado na grade `/time`.
- **`<EditarCardForm>`** — formulário do dono (client), chama server actions.
- **lib `perfil-jogador/`**
  - `queries.ts` — `getCard(id)`, `listTime()`, `getSinergia(id)`.
  - `actions.ts` — `salvarCardAction`, `definirUsernameAction`, uploads de capa.
  - `temperamento-classe.ts` — mapa classe→descrição + `getTemperamentoDaPessoa(userId)` (reusa `calcularTemperamento`).
  - `sinergia.ts` — matriz de compatibilidade + cálculo (testável isolado).
- **Reuso:** `calcularTemperamento`, `LETRA_TEMPERAMENTO` (pesquisas); `AvatarUpload`; `Card`/`Badge`/`Button` da UI.

---

## 8. Fora de escopo da Fase 1 (roadmap)

- **Fase 2 — Conquistas (automáticas):** motor que observa atividade (tarefas
  concluídas, tempo de casa, pesquisas respondidas, metas batidas…) e desbloqueia
  conquistas sozinho. Catálogo + rastreio + exibição no card. Seção já reservada.
- **Fase 3 — Skills:** habilidades da pessoa e como "sobem de nível". Seção já reservada.
- **Frame interno (projeto à parte):** review de vídeo estilo Frame.io — vídeo em
  serviço de streaming (Bunny/Cloudflare Stream), Supabase só com metadados. Spec própria.

---

## 9. Critérios de aceite (Fase 1)

- [ ] `/time` lista todos os ativos em mini-cards clicáveis.
- [ ] `/perfil/[id]` mostra o card completo, com ícones (sem emoji).
- [ ] O dono edita username (único), capa, bio, como_trabalho, hobbies, frase.
- [ ] Classe aparece só como rótulo + descrição (sem números); some se não respondeu DISC.
- [ ] Sinergia (trabalho + hobbies) calculada automaticamente.
- [ ] Resultados de pesquisas listam o que a pessoa respondeu e crescem sozinhos.
- [ ] Conquistas e Skills aparecem como "em breve" (bloqueado).
- [ ] `<PessoaLink>` pronto e aplicado em ao menos os pontos principais.
- [ ] Migration `perfil_jogador` documentada pra aplicação manual.
