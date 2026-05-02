# Painel Mensal — Redesign (Fase 1) — Design

**Data:** 2026-05-02
**Status:** Aprovado pela usuária, aguardando plano de implementação
**Spec mãe:** [2026-04-28-fase-11-painel-mensal-design.md](2026-04-28-fase-11-painel-mensal-design.md) — substitui a UI atual.

---

## 1. Objetivo

Redesenhar o painel mensal pra ficar mais visual, didático, e adaptar o conjunto de colunas ao **tipo de pacote** do cliente. Eliminar células irrelevantes (TPG pra cliente sem tráfego pago, postagem pra cliente sem postagem, etc.) e introduzir contagens manuais de Instagram + Google Meu Negócio.

A Fase 1 entrega o redesign visual completo + matriz de pacotes + estados ricos por coluna. **Sem integrações automáticas com calendário ou multi-unidade ainda — esses ficam pra Fase 2.**

**Princípios:**
- Cada cliente só vê células que fazem sentido pro pacote dele.
- Estados granulares (`não delegado` / `delegado` / `pronto`) tornam o ciclo de produção visível.
- Dados manuais (Instagram count, GMN) são lançados pelo assessor uma vez por mês — sem dependência de APIs externas.
- Pacotes que não têm ciclo mensal (Site, IA, CRM, CRM+IA) saem do painel mensal e vão pro futuro **Painel Dev** (spec separada).

**Fora do escopo da Fase 1 (entra na Fase 2):**
- Tabela `client_units` (multi-unidade) — Fase 1 só guarda `numero_unidades` como inteiro.
- Câmera/Mobile/Reunião puxando do calendário automaticamente.
- Lógica URGENTE (badge vermelho quando atrasado vs. cadência ou prazo).
- Modal GMN expandido por unidade.
- Painel Dev (Site/IA/CRM/CRM+IA).
- Integrações reais com Meta Graph API ou Google Business Profile API (manual segue manual).

---

## 2. Modelo de dados

### Novos enums

```sql
create type tipo_pacote as enum (
  -- Aparecem no Painel Mensal:
  'trafego_estrategia',
  'trafego',
  'estrategia',
  'audiovisual',
  'yide_360',
  -- Não aparecem no Painel Mensal (vão pro Painel Dev futuro):
  'site',
  'ia',
  'crm',
  'crm_ia'
);

create type cadencia_reuniao as enum (
  'semanal',
  'quinzenal',
  'mensal',
  'trimestral'
);
```

### Campos novos em `clients`

| Campo | Tipo | Restrição | Uso |
|---|---|---|---|
| `tipo_pacote` | `tipo_pacote` | NOT NULL após migração; default `'trafego_estrategia'` | Determina matriz de colunas. |
| `cadencia_reuniao` | `cadencia_reuniao` | NULLABLE | Guardado em Fase 1; usado em Fase 2 pra URGENTE. |
| `numero_unidades` | int | NOT NULL DEFAULT 1 | Mostra "X unidades" abaixo do nome. Em Fase 2 vira FK para `client_units`. |
| `valor_trafego_google` | numeric(12,2) | NULLABLE | R$ acordado pra Google Ads (mostrado no painel TPG). |
| `valor_trafego_meta` | numeric(12,2) | NULLABLE | R$ acordado pra Meta Ads (mostrado no painel TPM). |
| `drive_url` | text | NULLABLE | Link do Google Drive do cliente. |
| `tipo_pacote_revisado` | boolean | NOT NULL DEFAULT false | True após sócio/coord revisar o pacote inferido pela migration. False mostra alerta amarelo "⚠ Tipo de pacote inferido — revise". |

`servico_contratado` (text livre existente) **não é dropado** nessa migração. Vira read-only — fica como histórico até Fase 3.

### Atualização de `painel_step_status`

`alter type painel_step_status add value if not exists 'delegado'`.

Estados finais:
- `pendente` — não iniciado
- `delegado` — atribuído ao responsável (design e edição usam principalmente)
- `em_andamento` — sendo executado
- `pronto` — concluído
- `atrasada` — calculado (ainda valido, mas Fase 1 não exibe automaticamente)

Para **design** especificamente: a transição `pendente → delegado` é automática via trigger ao mudar `clients.designer_id`.

### Tabela nova `painel_mensal_extras`

```sql
create table public.painel_mensal_extras (
  client_id uuid not null references public.clients(id) on delete cascade,
  mes_referencia text not null,                    -- formato 'YYYY-MM'
  posts_pacote int not null default 0,             -- postagens contratadas no mês
  posts_postados int not null default 0,           -- postagens feitas no IG (manual)
  tpg_ativo boolean,                               -- null se pacote não tem TPG
  tpm_ativo boolean,                               -- null se pacote não tem TPM
  gmn_comentarios int not null default 0,
  gmn_avaliacoes int not null default 0,
  gmn_nota_media numeric(2,1),                     -- 0.0 a 5.0; null se não lançado
  gmn_observacoes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  primary key (client_id, mes_referencia)
);

create index idx_painel_extras_mes on public.painel_mensal_extras(mes_referencia);
```

**RLS:**
- `SELECT` — qualquer authenticated.
- `INSERT/UPDATE` — assessor/coord do cliente, sócio, adm.
- `DELETE` — apenas sócio/adm (pouco provável de ser usado).

### Permissões consolidadas

| Operação | Quem |
|---|---|
| `clients.tipo_pacote` UPDATE | sócio/adm |
| `clients.cadencia_reuniao`/`numero_unidades`/`drive_url` UPDATE | sócio/adm/coord do cliente |
| `clients.valor_trafego_google`/`valor_trafego_meta` UPDATE | sócio/adm |
| `painel_mensal_extras` | conforme tabela acima |
| `painel_step.status` (design) | designer atribuído marca pronto; assessor/coord pode forçar reset |
| `painel_step.status` (edição) | editor atribuído controla "em andamento" e "editado"; assessor/coord pode forçar |
| `painel_step.status` (câmera/mobile) | videomaker atribuído ou assessor/coord |
| `painel_step.status` (cronograma/reunião) | assessor/coord |

---

## 3. Matriz de aplicabilidade por pacote

```ts
export const PACOTE_COLUMNS: Record<TipoPacote, ColumnFlags> = {
  trafego_estrategia: { crono:1, design:1, tpg:1, tpm:1, gmn:1, camera:1, mobile:1, edicao:1, reuniao:1, pacote_postados:1 },
  trafego:            { crono:0, design:1, tpg:1, tpm:1, gmn:0, camera:0, mobile:0, edicao:0, reuniao:1, pacote_postados:0 },
  estrategia:         { crono:1, design:1, tpg:0, tpm:0, gmn:1, camera:1, mobile:1, edicao:1, reuniao:1, pacote_postados:1 },
  audiovisual:        { crono:1, design:0, tpg:0, tpm:0, gmn:0, camera:1, mobile:1, edicao:1, reuniao:1, pacote_postados:0 },
  yide_360:           { crono:1, design:1, tpg:1, tpm:1, gmn:1, camera:1, mobile:1, edicao:1, reuniao:1, pacote_postados:1 },
  // Pacotes Painel Dev: não filtram aqui — o filtro de exibição é "tipo_pacote in (5 do painel mensal)"
  site:               { crono:0, design:0, tpg:0, tpm:0, gmn:0, camera:0, mobile:0, edicao:0, reuniao:0, pacote_postados:0 },
  ia:                 { crono:0, design:0, tpg:0, tpm:0, gmn:0, camera:0, mobile:0, edicao:0, reuniao:0, pacote_postados:0 },
  crm:                { crono:0, design:0, tpg:0, tpm:0, gmn:0, camera:0, mobile:0, edicao:0, reuniao:0, pacote_postados:0 },
  crm_ia:             { crono:0, design:0, tpg:0, tpm:0, gmn:0, camera:0, mobile:0, edicao:0, reuniao:0, pacote_postados:0 },
};

export const PACOTES_NO_PAINEL_MENSAL: TipoPacote[] = [
  'trafego_estrategia', 'trafego', 'estrategia', 'audiovisual', 'yide_360',
];
```

A query principal do painel filtra `WHERE clients.tipo_pacote = ANY(PACOTES_NO_PAINEL_MENSAL)`.

Quando uma coluna é 0 (não se aplica), a célula renderiza `—` em cinza claro, sem botão, sem clique.

---

## 4. UI

### Layout da tabela

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Painel Mensal              [Mês: Mai/2026 ▼]  [Filtro tipo: Todos ▼]         │
├──────────────────────────────────────────────────────────────────────────────┤
│ Cliente            │Pac/Post│Cron│Des │TPG │TPM │GMN │Câm │Mob │Ed │Reu │Drv│
├──────────────────────────────────────────────────────────────────────────────┤
│ Andre Mansor       │ 5/8    │ ✓  │🟡  │🟢  │🟢  │⭐4.7│ ✓  │ —  │🟡 │ —  │📂 │
│ ↓ Tráfego+Estr.    │        │    │    │    │    │    │    │    │   │    │   │
├──────────────────────────────────────────────────────────────────────────────┤
│ Annelise           │ —      │ ✓  │ —  │ —  │ —  │ —  │ ✓  │ ✓  │✓  │ —  │📂 │
│ ↓ Audiovisual      │        │    │    │    │    │    │    │    │   │    │   │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Primeira coluna (Cliente)** sticky à esquerda; **header** sticky no topo. Zebra entre rows.
- Logo abaixo do nome: badge pequena com cor do tipo de pacote + (se >1) "X unidades".
- Filtro de tipo no topo.

### Cores das badges de pacote

| Pacote | Cor |
|---|---|
| Tráfego+Estratégia | turquesa (`bg-primary/15 text-primary`) |
| Tráfego | azul (`bg-blue-500/15 text-blue-700 dark:text-blue-300`) |
| Estratégia | roxo (`bg-violet-500/15 text-violet-700 dark:text-violet-300`) |
| Audiovisual | rosa (`bg-pink-500/15 text-pink-700 dark:text-pink-300`) |
| Yide 360° | gradiente `bg-gradient-to-r from-amber-500 to-yellow-600 text-white` |

### Anatomia das células (Fase 1)

| Célula | Estados visuais | Click |
|---|---|---|
| **Pacote / Postados** | `5/8` com mini progress bar; `—` cinza se sem postagem | Modal lança postagens contratadas + postagens feitas |
| **Crono** | `Pendente` cinza outline / `✓` verde | Marcar pronto + abrir `drive_url` em nova aba |
| **Design** | `—` cinza (não delegado) / `🟡 Delegado` com avatar 16px (delegado) / `🟢 ✓` (pronto) | Designer atribuído fecha; assessor pode resetar |
| **TPG / TPM** | `—` cinza (N/A) / `🟢 ATIVO` / `⚫ INATIVO` | Popover com toggle ativo + valor acordado R$ |
| **GMN** | `—` cinza / `⭐ 4.7` colorido por nota (verde ≥4.5, amarelo 3.5–4.4, vermelho <3.5) | Modal mensal: comentários, avaliações, nota, observações |
| **Câmera / Mobile** | `Pendente` cinza / `🟢 ✓` | Videomaker atribuído ou assessor marca pronto (em Fase 2 puxa do calendário) |
| **Edição** | `—` (ninguém pegou) / `🟡 Em andamento` com avatar / `🟢 Editado` | Editor "peguei" → "feito"; assessor pode forçar |
| **Reunião** | `Pendente` cinza / `🟢 ✓` | Marca pronto (em Fase 2 puxa do calendário) |
| **Drive** | `📂` se `drive_url` setado / `—` cinza se vazio | Abre URL em nova aba |

### Modais

#### GMN — modal mensal por cliente

```
┌─ GMN — Andre Mansor — Mai/2026 ────────────────┐
│ Comentários do mês:    [    47    ]              │
│ Avaliações do mês:     [    12    ]              │
│ Nota média (1.0–5.0):  ⭐ 4.7                    │
│                         ●────────  (slider)      │
│ Observações:                                     │
│ ┌────────────────────────────────────────────┐   │
│ │ Cliente subiu 3 posições no Maps...        │   │
│ └────────────────────────────────────────────┘   │
│                                                  │
│              [Cancelar]    [Salvar]              │
└──────────────────────────────────────────────────┘
```

#### TPG / TPM — popover

```
┌─ Tráfego Pago Google ──────┐
│ Status do mês:             │
│  ◉ Ativo   ○ Inativo       │
│                            │
│ Valor acordado:            │
│  R$ [    2.500,00     ]    │
│  (só sócio/coord edita)    │
│                            │
│            [Salvar]        │
└────────────────────────────┘
```

#### Pacote/Postados — modal pequeno

```
┌─ Postagens — Andre Mansor — Mai/2026 ─┐
│ Pacote contratado:    [    8    ]      │
│ Postados até agora:   [    5    ]      │
│                                        │
│         [Cancelar]    [Salvar]         │
└────────────────────────────────────────┘
```

### Comportamentos

- **Trigger automático**: ao salvar `clients.designer_id` mudando de null/outro pra um designer, o `painel_step` de `design` do mês corrente fica `status='delegado'` se estava `pendente`.
- **Render condicional por pacote**: cada célula consulta `PACOTE_COLUMNS[cliente.tipo_pacote][nome_celula]` antes de renderizar.
- **Auto-save** nas células com toggle simples (TPG/TPM ativo/inativo, marcação pronto/pendente). Modais (GMN, postagens) usam botão Salvar explícito.

---

## 5. Migração de dados

### Conversão `servico_contratado` → `tipo_pacote`

Migration roda este UPDATE com matching case-insensitive:

```sql
update public.clients set tipo_pacote = case
  when servico_contratado ilike '%trafego%estrat%' or servico_contratado ilike '%tráfego%estrat%' or servico_contratado ilike '%estrat%trafego%' or servico_contratado ilike '%estrat%tráfego%' then 'trafego_estrategia'
  when servico_contratado ilike '%yide%360%' or servico_contratado ilike '%full%' or servico_contratado ilike '%premium%' then 'yide_360'
  when servico_contratado ilike '%trafego%' or servico_contratado ilike '%tráfego%' then 'trafego'
  when servico_contratado ilike '%estrat%' then 'estrategia'
  when servico_contratado ilike '%audiovisual%' or servico_contratado ilike '%video%' or servico_contratado ilike '%vídeo%' then 'audiovisual'
  when servico_contratado ilike '%site%' then 'site'
  when servico_contratado ilike '%crm%ia%' or servico_contratado ilike '%ia%crm%' then 'crm_ia'
  when servico_contratado ilike '%crm%' then 'crm'
  when servico_contratado ilike '%ia%' then 'ia'
  else 'trafego_estrategia'                         -- fallback default
end
where tipo_pacote is null;
```

Após a migration, a página de detalhe do cliente exibe um **alerta amarelo** "⚠ Tipo de pacote inferido — revise" se a row foi convertida automaticamente (flag `tipo_pacote_revisado boolean default false` no clients). Sócio/coord revisa e clica "Confirmar" → flag vira true.

### Compatibilidade da UI antiga

- Painel atual continua acessível em `/painel/legacy` por 1 semana após o deploy.
- Após 1 semana sem reclamação, route `/painel/legacy` é removida.

---

## 6. Estrutura de arquivos esperada

```
supabase/migrations/
  YYYYMMDDNNNNNN_painel_redesign_fase1.sql      # enums, fields em clients, painel_step status, tabela extras

src/lib/painel/
  pacote-matrix.ts                               # PACOTE_COLUMNS + helper isApplicable(pacote, coluna)
  schema.ts                                      # zod schemas (atualizar)
  queries.ts                                     # listClientesPainel(monthRef, tipoFilter?) + getExtras
  actions.ts                                     # updateExtras, toggleTpgAtivo, marcarPronto, delegarDesign...

src/components/painel/
  PainelTable.tsx                                # tabela completa (server)
  ClientRow.tsx                                  # row de 1 cliente
  TipoPacoteBadge.tsx
  cells/
    PacotePostadosCell.tsx
    CronoCell.tsx
    DesignCell.tsx
    TpgTpmCell.tsx
    GmnCell.tsx
    CameraMobileCell.tsx
    EdicaoCell.tsx
    ReuniaoCell.tsx
    DriveCell.tsx
    NaoSeAplicaCell.tsx                          # dash cinza com tooltip
  modals/
    GmnModal.tsx
    PacotePostadosModal.tsx
    TpgTpmPopover.tsx

src/app/(authed)/painel/
  page.tsx                                       # nova
  legacy/page.tsx                                # painel antigo (transição de 1 semana)
```

---

## 7. Critérios de aceitação

- [ ] Migration aplica sem erros: enums, fields novos em clients, status `delegado` adicionado, tabela `painel_mensal_extras` criada.
- [ ] Best-effort matching converte `servico_contratado` → `tipo_pacote`; clientes inferidos têm flag de revisão.
- [ ] Painel mensal lista apenas clientes com `tipo_pacote in (5 do painel mensal)`.
- [ ] Cada coluna obedece a matriz: célula renderiza `—` cinza quando não aplicável.
- [ ] Trigger `delegar_design`: mudar `designer_id` de cliente faz `painel_step.status='delegado'` no mês corrente.
- [ ] GMN modal salva os 4 campos em `painel_mensal_extras`.
- [ ] TPG/TPM popover salva ativo/inativo + valor acordado.
- [ ] Pacote/Postados modal salva contratadas e postadas.
- [ ] Drive button só aparece se `drive_url` setado, abre em nova aba.
- [ ] Filtro por tipo de pacote funciona.
- [ ] Sticky header e first column, zebra rows, badges coloridas por pacote.
- [ ] Painel antigo acessível em `/painel/legacy` por 1 semana.
- [ ] Permissões respeitadas (RLS testada com user não-autorizado).
- [ ] `npm run typecheck`, `npm run lint`, `npx vitest run` passam.

---

## 8. Decisões revisadas durante o brainstorm

- **Multi-unidade modelado em Fase 2**, não Fase 1 — Gallo Man (60 unidades) aparece como 1 linha com `numero_unidades=60` na badge.
- **Cadência de reunião guardada em Fase 1, lógica URGENTE em Fase 2** — assessor já pode cadastrar `cadencia_reuniao='mensal'` agora; a coluna Reunião continua manual nesta fase.
- **Câmera/Mobile manuais em Fase 1** — Fase 2 vai puxar do calendário (sub_calendar=videomakers já existente).
- **Site/IA/CRM/CRM+IA saem do painel mensal** — vão pro **Painel Dev** (spec separada futura).
- **Combo total = "Yide 360°"** (nome escolhido).
- **Sem APIs externas** (Meta Graph, Google Business Profile) — Fase 1 e Fase 2 são 100% manuais.
- **`servico_contratado` não é dropado** — fica como histórico read-only.
