# Skills (Fase 3 do Card do Jogador) — Design

**Data:** 2026-07-21
**Status:** aprovado pela Yasmin
**Depende de:** Fase 1 (`perfil_jogador`, card) e Fase 2 (coletor `getStatsDoUsuario`).

Troca a área "Skills — em breve" do card por skills **derivadas automaticamente** (cargo + temperamento) que **sobem de nível** com a atividade. Só ícones (lucide), sem emoji. **Sem migration** (tudo derivado de dados que já existem).

---

## 1. Como funciona

1. **Skills base automáticas** vêm de dois mapas no código:
   - **Cargo → skills técnicas** (ex.: videomaker → Gravação, Edição, Enquadramento).
   - **Temperamento → skills comportamentais** (ex.: colérico → Liderança, Decisão).
2. **Cada skill sobe de nível (1 a 5)** conforme uma **fonte de atividade**:
   - Técnicas usam a atividade da área (entregas audiovisual, tarefas, ligações).
   - Comportamentais usam **experiência geral** (tempo de casa + tarefas), representando senioridade.
3. **Nível por degraus (thresholds).** Cada fonte tem uma escada de valores; o nível é quantos degraus a pessoa passou (cap 5). O card mostra **Nível N** + barra "faltam X pra subir".
4. Tudo **derivado** de `getStatsDoUsuario` (Fase 2) + o temperamento (Fase 1). Nenhuma tabela nova.

---

## 2. Mapas de skills (v1)

**Fonte de cada skill** (StatKey da Fase 2, ou `xpGeral` = experiência):
- `xpGeral = max(0, mesesDeCasa) + tarefasConcluidas`

**Por temperamento** (fonte `xpGeral`, ícone entre parênteses):
| Classe | Skills |
|---|---|
| Colérico | Liderança (Crown), Decisão (Zap) |
| Sanguíneo | Comunicação (MessageCircle), Networking (Users) |
| Melancólico | Qualidade (Gem), Análise (Search) |
| Fleumático | Diplomacia (Handshake), Consistência (Repeat) |

**Por cargo** (skills técnicas; fonte indicada):
| Cargo | Skills (fonte) |
|---|---|
| videomaker | Gravação (av), Edição (av), Enquadramento (av) |
| fast_midia | Stories (av), Captação (av), Agilidade (tarefas) |
| editor | Edição (tarefas), Montagem (tarefas), Ritmo (tarefas) |
| designer | Design (tarefas), Identidade Visual (tarefas), Composição (tarefas) |
| assessor | Relacionamento (tarefas), Estratégia (tarefas), Atendimento (tarefas) |
| comercial | Prospecção (ligações), Negociação (ligações), Fechamento (ligações) |
| coordenador / audiovisual_chefe | Gestão (tarefas), Coordenação (tarefas), Visão (xpGeral) |
| socio / adm | Gestão (tarefas), Liderança (xpGeral), Visão (xpGeral) |
| programacao | Código (tarefas), Automação (tarefas), Lógica (tarefas) |
| assessor_ecommerce / assistente_ecommerce | E-commerce (tarefas), Anúncios (tarefas), Operação (tarefas) |

> `av` = `entregasAudiovisual`. Cargos sem mapa caem só nas comportamentais. Skills repetidas (cargo + temperamento) são deduplicadas por nome (mantém a primeira).

---

## 3. Escadas de nível (thresholds por fonte)

Nível = quantos degraus o valor passou (mínimo 1, máximo 5).
| Fonte | Degraus |
|---|---|
| entregasAudiovisual | 0, 5, 20, 50, 120 |
| tarefasConcluidas | 0, 10, 40, 120, 300 |
| ligacoesSaida | 0, 30, 120, 300, 700 |
| xpGeral | 0, 15, 50, 120, 300 |

- `nivel(degraus, valor)` → nº de degraus `<= valor` (cap ao tamanho). Progresso = entre o degrau atual e o próximo; no nível 5, barra cheia.

---

## 4. Componentização

- `src/lib/skills/catalogo.ts` — `SKILLS_POR_CARGO`, `SKILLS_POR_TEMPERAMENTO`, `DEGRAUS`, tipos.
- `src/lib/skills/derivar.ts` (+ `.test.ts`) — pura: `derivarSkills(role, classe, stats)` → lista `{ nome, icone, nivel, atual, alvoProx | null, pctProx }`, deduplicada.
- `src/lib/skills/queries.ts` — `getSkillsDoUsuario(userId, role, classe, stats?)` (reusa `getStatsDoUsuario` se `stats` não vier).
- `src/components/perfil/SkillsSecao.tsx` — lista de skills com Nível + barra.
- **Integração:** `CardJogador` recebe `skills` e troca o placeholder de Skills; a página `/perfil/[id]` coleta **stats uma vez** e passa pra conquistas e skills.

### Otimização de stats (uma coleta por card)
Pra não coletar stats 3× no card, a página passa a coletar `getStatsDoUsuario` **uma vez** e injeta:
- `sincronizarConquistasAction(userId, stats?)` e `getConquistasDoUsuario(userId, role, stats?)` ganham um `stats` opcional (se vier, não recoletam).
- `getSkillsDoUsuario(userId, role, classe, stats?)` idem.

---

## 5. Permissões / privacidade
- Skills são públicas (parte do "conhecer o time"), como as conquistas. Nada sensível.
- Nenhuma escrita (derivado puro). Sem action, sem tabela.

---

## 6. Critérios de aceite
- [ ] Seção Skills no card mostra as skills da pessoa com Nível 1–5 e barra de progresso.
- [ ] Skills vêm de cargo + temperamento, deduplicadas, e sobem com a atividade real.
- [ ] `derivarSkills` puro e testado (níveis, thresholds, dedupe, sem temperamento).
- [ ] Stats coletados **uma vez** por card (conquistas + skills compartilham).
- [ ] Sem migration. Só ícones, sem emoji.
