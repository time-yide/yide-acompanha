# Sistema de Acompanhamento — Yide Digital

**Empresa:** Yide Digital (agência de marketing)
**Data:** 2026-04-26
**Status:** Design aprovado, aguardando plano de implementação
**Tipo:** Aplicação web interna (single-tenant)
**Nome interno provisório do produto:** "Acompanha" (a confirmar)

---

## 1. Contexto e Objetivo

Plataforma interna para uma agência de marketing organizar clientes, equipe e financeiro em um único lugar — substituindo controles dispersos em planilhas e WhatsApp.

**Cenário hoje:**
- ~15 colaboradores ativos (sócios, ADM, comerciais, coordenadores, assessores)
- ~110 clientes ativos com contratos mensais
- Comissão variável por colaborador, calculada sobre carteira
- Acompanhamento de satisfação fragmentado, sem ranking sistematizado
- Onboarding de novo cliente acontece via mensagens informais

**O que o sistema precisa entregar:**
1. Cadastro estruturado de clientes com pasta digital por cliente
2. Pipeline visual (Kanban) do onboarding com responsáveis claros
3. Cálculo automático de comissão (fixo + % sobre carteira) com aprovação mensal
4. Ranking semanal de satisfação sintetizado por IA (top 10 mais e top 10 menos)
5. Calendário interno com dailys, reuniões internas, marcos zero, aniversários
6. Gestão de tarefas com prioridade entre coordenadores e assessores
7. Cadastro completo de colaboradores (RH leve: endereço, Pix, aniversário)
8. Dashboards de churn, entrada de clientes, evolução de carteira

**Princípio orientador:** ergonomia visual moderna (referências: Linear, Vercel, Resend). Sem emojis na UI — apenas ícones SVG estilo Lucide.

---

## 2. Stack Técnica

| Camada              | Escolha                                                       |
|---------------------|---------------------------------------------------------------|
| Frontend            | Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui   |
| Backend             | Next.js Server Actions + Route Handlers                       |
| Banco de dados      | Supabase Postgres com Row Level Security (RLS)                |
| Autenticação        | Supabase Auth (email + senha; magic link como fallback)       |
| Storage de arquivos | Supabase Storage (briefings, contratos, anexos)               |
| IA                  | Claude API (Anthropic) — modelo `claude-haiku-4-5` para síntese de satisfação; `claude-sonnet-4-6` para sumarizações maiores |
| Gráficos            | Recharts                                                      |
| E-mail              | Resend (notificações transacionais)                           |
| Jobs agendados      | Vercel Cron (notificações antecipadas, snapshot mensal)       |
| Hospedagem          | Vercel                                                        |
| Logs / observabilidade | Vercel Analytics + Supabase Logs                          |

**Custo mensal estimado:** US$ 25–60 (Vercel Pro opcional, Supabase Pro a partir de US$ 25, Claude pay-per-use ≈ US$ 5–15, Resend free tier inicial).

**Tema:** suporte a modo claro e escuro com toggle por usuário (preferência salva no perfil; respeita `prefers-color-scheme` no primeiro acesso).

**Iconografia:** biblioteca `lucide-react` em todo o produto. **Proibido emojis** na UI final.

---

## 3. Papéis e Permissões (RBAC)

Cinco papéis. Implementado via tabela `profiles.role` + políticas RLS no Postgres.

| Ação                                          | ADM | Sócio | Comercial | Coord       | Assessor    |
|-----------------------------------------------|-----|-------|-----------|-------------|-------------|
| Criar / desativar usuários                    | ✓   | ✓     | —         | —           | —           |
| Editar % de comissão                          | —   | ✓     | —         | —           | —           |
| Editar fixo de colaboradores                  | —   | ✓     | —         | —           | —           |
| Cadastrar prospect / agendar reunião prospecção| ✓   | ✓     | ✓         | —           | —           |
| Acessar área **Prospecção** (CRM comercial)    | ✓   | ✓     | ✓         | —           | —           |
| Mover card (Prospecção → Reunião Comercial)    | ✓   | ✓     | ✓         | —           | —           |
| Mover card (Reunião Comercial → Contrato)     | ✓   | ✓     | ✓         | —           | —           |
| Mover card (Contrato → Marco Zero)            | ✓   | ✓     | —         | —           | —           |
| Mover card (Marco Zero → Cliente Ativo)       | ✓   | ✓     | —         | ✓           | —           |
| Agendar reunião marco zero                    | ✓   | ✓     | ✓         | —           | —           |
| Conduzir reunião marco zero                   | —   | ✓     | —         | ✓           | —           |
| Ver TODOS os clientes (lista)                 | ✓   | ✓     | ✓         | ✓           | ✓           |
| Editar dados do cliente                       | ✓   | ✓     | —         | só dele     | só dele     |
| Ver R$ de TODOS os clientes                   | ✓   | ✓     | —         | só dele     | só dele     |
| Ver comissão própria                          | ✓   | ✓     | n/a       | ✓           | ✓           |
| Ver comissão de terceiros                     | ✓   | ✓     | —         | —           | —           |
| Ver financeiro consolidado da agência         | ✓   | ✓     | —         | —           | —           |
| Aprovar fechamento mensal                     | —   | ✓     | —         | —           | —           |
| Alimentar satisfação semanal                  | —   | opc.  | —         | ✓ (obrig.)  | ✓ (obrig.)  |
| Criar / atribuir tarefas                      | ✓   | ✓     | ✓         | ✓           | ✓           |
| Cadastrar evento no calendário interno        | ✓   | ✓     | ✓         | ✓           | ✓           |
| Customizar destinatários de notificações       | ✓   | ✓     | ✓         | ✓           | ✓           |
| Editar colaboradores (HR)                     | ✓   | ✓     | —         | —           | —           |
| Suporte técnico (configurações sistema)       | ✓   | —     | —         | —           | —           |

**Premissa confirmada:** sócio não tem linha de comissão calculada pelo sistema. O ganho do sócio aparece como "lucro consolidado" no painel financeiro (faturamento – custo total de comissões – custos fixos opcionais).

---

## 4. Modelo de Dados

Entidades principais. Detalhes de PK/FK ficam para o plano de implementação.

### Núcleo

- **organization** — linha única (estruturada para futuro multi-tenant, mas não usada agora). Guarda nome da agência, CNPJ, logo.
- **profiles** — vinculado a `auth.users`. Campos: `role` (enum: adm, socio, comercial, coordenador, assessor), `nome`, `email`, `telefone`, `endereco`, `pix`, `data_nascimento`, `data_admissao`, `fixo_mensal` (R$), `comissao_percent` (decimal — usado para assessor/coordenador), `comissao_primeiro_mes_percent` (decimal — usado apenas para comercial; % aplicado sobre o valor do 1º mês de cada deal fechado), `tema_preferido` (light/dark/system), `ativo` (bool), `avatar_url`.
- **clients** — `nome`, `contato_principal`, `email`, `telefone`, `valor_mensal` (R$), `servico_contratado` (texto livre — ex.: "Social media + Tráfego pago"), `status` (ativo, churn, em_onboarding), `data_entrada`, `data_churn`, `motivo_churn`, `assessor_id`, `coordenador_id`, `data_aniversario_socio_cliente`.

### Pasta do cliente

- **client_briefing** — 1:1 com client. Texto rico (markdown) + metadados (objetivos, persona, KPIs).
- **client_notes** — many:1 com client. `autor_id`, `tipo` (reuniao, observacao, mudanca_status), `texto_rico`, `created_at`.
- **client_files** — many:1 com client. `categoria` (briefing, contrato, criativo, outro), `nome_arquivo`, `path` (Supabase Storage), `size`, `uploaded_by`, `created_at`.
- **client_important_dates** — many:1 com client. `tipo` (aniversario_socio, renovacao, kickoff, custom), `data`, `descricao`, `notify_days_before` (array; ex: [30, 7, 1]).

### Onboarding (kanban)

- **leads** — `nome_prospect`, `site`, `valor_proposto`, `duracao_meses`, `info_briefing` (texto), `comercial_id` (quem está conduzindo), `stage` (enum: **prospeccao**, comercial, contrato, marco_zero, ativo), `prioridade` (alta, media, baixa), `data_prospeccao_agendada` (quando o comercial agendou a 1ª reunião com o prospect), `data_reuniao_marco_zero`, `coord_alocado_id`, `assessor_alocado_id`, `client_id` (preenchido quando vira cliente ativo), `data_fechamento` (quando entrou no estágio "Cliente ativo" — usada pelo cálculo de comissão do Comercial).
- **lead_history** — log de cada movimento de stage com timestamp e ator.
- **lead_attempts** — registros de follow-up do Comercial: tentativa de contato, canal (whatsapp, email, ligação, presencial), resultado, próximo passo, autor, data.

### Satisfação

- **satisfaction_entries** — `client_id`, `autor_id`, `papel_autor` (coord ou assessor), `semana_iso` (ex: "2026-W17"), `cor` (verde, amarelo, vermelho), `comentario`, `created_at`. **Único por (client, autor, semana).**
- **satisfaction_synthesis** — `client_id`, `semana_iso`, `score_final` (0-10 calculado pela IA), `cor_final`, `resumo_ia` (texto), `divergencia_detectada` (bool), `acao_sugerida` (texto), `created_at`.

### Tarefas

- **tasks** — `titulo`, `descricao`, `prioridade` (alta, media, baixa), `status` (aberta, em_andamento, concluida), `criado_por`, `atribuido_a`, `client_id` (opcional), `due_date`, `created_at`, `completed_at`.

### Calendário interno

- **calendar_events** — `titulo`, `descricao`, `inicio`, `fim`, `sub_calendar` (enum: agencia, onboarding, aniversarios), `criado_por`, `participantes_ids` (array), `client_id` (opcional, p/ marco zero), `lead_id` (opcional, p/ reunião comercial), `recorrencia` (texto cron-like ou null para evento único). Eventos do tipo `aniversarios` e `onboarding` são gerados automaticamente; do tipo `agencia` são manuais.

### Comissões

- **commission_snapshots** — registro mensal por usuário. `mes_referencia` (YYYY-MM), `user_id`, `papel_naquele_mes`, `fixo`, `percentual_aplicado`, `base_calculo` (R$), `valor_variavel`, `valor_total`, `status` (preview, pending_approval, aprovado), `aprovado_por`, `aprovado_em`, `created_at`. **Snapshot é gerado em 1º do mês seguinte; muda para `aprovado` quando o sócio aprova.**
- **commission_snapshot_items** — detalhamento por linha do snapshot (necessário para Comercial, que tem comissão por deal). Campos: `snapshot_id`, `tipo` (carteira_assessor, carteira_coord_agencia, deal_fechado_comercial), `lead_id` (se aplicável), `client_id` (se aplicável), `descricao`, `base` (R$), `percentual`, `valor`. Permite ver "essa linha de R$ X veio de qual deal/cliente".

### Notificações configuráveis

- **notification_rules** — `evento_tipo` (enum: lead_criado, prospeccao_agendada, kanban_movido, marco_zero_agendado, satisfacao_pendente, mes_aguardando_aprovacao, etc.), `default_destinatarios` (array de user_ids ou roles), `customizado_por_evento` (bool). Permite ao usuário sobrescrever destinatários por evento individual antes de salvar (ex: ao agendar prospecção, escolher quem além do default deve ser notificado).

### Auditoria e notificações

- **audit_log** — `entidade`, `entidade_id`, `acao`, `dados_antes`, `dados_depois`, `ator_id`, `created_at`. Captura mudanças de %, fixo, troca de assessor, aprovação de fechamento, edições críticas.
- **notifications** — `user_id`, `tipo`, `titulo`, `mensagem`, `link`, `lida` (bool), `created_at`. Feed in-app + opcional disparo por e-mail (Resend).

---

## 5. Features

### 5.1 Autenticação e gestão de usuários

- Login: email + senha. Magic link como fallback.
- Convite de novo usuário: ADM ou Sócio envia convite por email com papel pré-definido. Usuário define senha no primeiro acesso.
- Recuperação de senha: e-mail com link.
- Desativação: usuário fica `ativo = false`, perde acesso, mas histórico permanece (snapshots, notas, etc.).
- Trocar de senha: na página `/configuracoes`.

### 5.2 Gestão de clientes

- Lista paginada com filtros: status, assessor, coordenador, faixa de valor, tag de satisfação.
- Cadastro de cliente (manual ou automático, vindo do kanban quando atinge stage "Cliente ativo").
- **Import em lote** — Sócio/ADM podem colar dados do Excel/Sheets (TSV) ou CSV no formato `Nome | Valor mensal | Serviço contratado` para criar vários clientes de uma vez. Útil para a migração inicial do sistema.
- Cada cliente tem **pasta dedicada** com sidebar lateral de navegação (preferida pelo usuário em vez de tabs no topo) e suporte a tema claro/escuro:
  - **Visão geral** — próximas datas, última reunião, satisfação atual, tarefas em aberto, valor do contrato, tempo de casa
  - **Briefing** — markdown editor + arquivos do briefing inicial
  - **Reuniões** — timeline cronológica (lista reversa) de notas. Cada nota: autor, data, texto rico, anexos.
  - **Arquivos** — biblioteca por categoria (briefing, contrato, criativo, outro). Upload via drag & drop.
  - **Datas importantes** — lista com toggle "notificar X dias antes" (default: 30, 7, 1)
  - **Tarefas** — só relacionadas a esse cliente
  - **Satisfação** — histórico semanal: cor coord + cor assessor + síntese da IA + tendência (sparkline 12 semanas)
  - **Histórico** — audit log do cliente (visível só para Sócio/ADM): mudança de valor, troca de assessor, churn, etc.

### 5.3 Onboarding pipeline (Kanban)

**Cinco estágios:**

1. **Prospecção (agendada)** — Comercial cadastra o prospect (nome, site, info inicial) e agenda a reunião. Card aparece com `data_prospeccao_agendada`. Sistema cria automaticamente um evento no Calendário Interno (sub-cal "Onboarding") e dispara notificação.
2. **Reunião Comercial** — após a reunião acontecer, Comercial move o card pra cá. Em negociação/proposta. Pode ter múltiplas reuniões adicionais antes de fechar.
3. **Contrato (ADM)** — Comercial fechou. ADM emite contrato, valida pagamento. Cards aparecem na fila do ADM.
4. **Marco Zero** — Coord conduz a reunião. **Comercial é quem agenda a reunião** (preenche data/hora antes de mover pra cá, ou enquanto está em "Contrato"). Sistema cria evento automaticamente no calendário interno (sub-cal "Onboarding"). Apenas Coord ou Sócio pode mover daqui pra "Cliente ativo" (após reunião realizada).
5. **Cliente ativo** — registro vira `clients` automaticamente. Card desaparece do kanban (mas fica acessível em "Lista" e "Calendário"). `data_fechamento` é registrada (usada pra calcular comissão do Comercial daquele mês). Carteira do assessor passa a contar esse cliente a partir desse mês.

**Três visões do mesmo dado:** Kanban / Calendário / Lista. Toggle no topo.

**Movimentação dispara automações:**
- Mover para próximo estágio cria tarefa para o próximo responsável
- Entrar em "Prospecção (agendada)" requer `data_prospeccao_agendada` (validação) e cria evento no calendário
- Mover para "Marco Zero" requer `data_reuniao_marco_zero` preenchida (validação) e cria evento no calendário
- Mover para "Cliente ativo" cria registro em `clients`, registra `data_fechamento`, e dispara cálculo da comissão do Comercial pro snapshot do mês corrente

### 5.4 Calendário Interno

Visualização de calendário (dia, semana, mês) com **três sub-calendários filtráveis**:

- **Agência** (roxo) — dailys recorrentes, reuniões de sócios, retrospectivas, eventos manuais criados pela equipe
- **Onboarding** (azul) — alimentado automaticamente pelo kanban: prospecções agendadas, reuniões comerciais e marcos zero
- **Aniversários** (rosa) — alimentado automaticamente: aniversários dos sócios dos clientes (em `client_important_dates`) + aniversários dos colaboradores (em `profiles.data_nascimento`)

Cada chip de filtro pode ser ligado/desligado no topo do calendário. Preferência do usuário é salva.

**Notificações:**
- 24h antes do evento: notificação in-app
- 1h antes: notificação in-app + email (configurável por usuário)
- Aniversários: notificação 7 dias antes para o coordenador responsável, mais 1 dia antes para o time todo

### 5.5 Tarefas

- Tipo Trello/Asana simplificado.
- Listas: "Atribuídas a mim", "Criadas por mim", "Por cliente", "Por prioridade".
- Filtros: status, prioridade, prazo, cliente.
- Notificação ao ser atribuído + 24h antes do prazo + ao virar overdue.
- Vincular tarefa a um cliente é opcional, mas recomendado (aparece dentro da pasta do cliente).

### 5.6 Satisfação semanal + síntese por IA

**Fluxo:**
1. Toda segunda-feira de manhã, o sistema cria pendências de satisfação para todos os clientes ativos. Coordenador e assessor responsáveis recebem uma notificação ("você tem 110 satisfações pendentes desta semana").
2. Cada um avalia: cor (verde/amarelo/vermelho) + comentário opcional. Interface em batch (lista vertical com cores clicáveis) ou por cliente individual.
3. Quando ambas as avaliações chegam (ou na quinta-feira, mesmo se faltar uma), Vercel Cron dispara **síntese pela Claude API**:
   - Input: cor + comentário do coord + cor + comentário do assessor + histórico das últimas 4 semanas + dados do cliente (valor, tempo de casa)
   - Output: `score_final` (0-10), `cor_final`, `resumo_ia` (1-2 parágrafos), `divergencia_detectada` (true se cores conflitantes), `acao_sugerida`
4. Resultado fica visível em `satisfaction_synthesis` e alimenta:
   - Ranking na tela "Satisfação"
   - Card "Ranking de satisfação" no dashboard
   - Aba "Satisfação" da pasta do cliente

**Tela "Satisfação" dedicada:**
- **Top 10 mais satisfeitos** em painel verde (com medalhas 1-2-3, sparkline de tendência por cliente, score final, responsáveis)
- **Top 10 menos satisfeitos** em painel vermelho com mesma estrutura. Subtítulo: "Atenção urgente — risco de churn"
- **Demais clientes** em lista rolável abaixo (90 ou mais), ordenação configurável (alfabética, score, data)

**Regras de IA:**
- Modelo: `claude-haiku-4-5` (rápido e barato, suficiente para esse uso)
- Prompt caching habilitado para os dados estáveis do cliente
- Custo estimado: ~110 clientes × 4 semanas × ~$0.001 = ~$0.50/mês

### 5.7 Cálculo de comissões

**Fórmulas por papel:**

```
Comissão Assessor    = fixo_dele + (carteira_dele × %_dele)
Comissão Coordenador = fixo_dele + (carteira_total_da_agência × %_dele)
Comissão Comercial   = fixo_dele + Σ(valor_mensal × %_primeiro_mês_dele)
                                    para cada lead que ele fechou nesse mês
```

Onde:
- "carteira_dele" (assessor) = soma do `valor_mensal` dos clientes com status `ativo` atribuídos ao assessor no momento do snapshot
- "carteira_total_da_agência" (coordenador) = soma do `valor_mensal` de todos os clientes com status `ativo`
- Para Comercial: a comissão é one-shot (paga só no mês em que o lead atinge `stage = ativo`). Snapshot do mês seguinte não carrega esses deals.

**Exemplo Comercial:** Roberta (fixo R$ 4.000, % primeiro mês = 25%). Em abril ela fechou 2 deals: Pizzaria Bella (R$ 4.500/mês) e Restaurante Sabor (R$ 6.200/mês). Comissão de abril = 4.000 + (4.500 × 25%) + (6.200 × 25%) = 4.000 + 1.125 + 1.550 = **R$ 6.675**.

**Timing:**
- **Durante o mês:** dashboard mostra "previsão" recalculada em tempo real conforme entra/sai cliente. Visível para todos (cada um vê a sua).
- **1º do mês seguinte (00:01):** Vercel Cron gera snapshot de `commission_snapshots` com `status = pending_approval`. Sócio recebe notificação "Mês X aguardando sua aprovação".
- **Sócio aprova:** sócio entra em `/comissoes/fechamento`, revisa cada linha, pode fazer ajuste manual com motivo (registra em audit_log), clica "Aprovar mês X". Status vira `aprovado`.
- **Coord/Assessor:** só veem `aprovado`. Antes da aprovação, veem ainda a "previsão" (não o snapshot).

**Mudança de %:**
- Apenas Sócio pode mudar.
- Mudança vale a partir do momento em que foi salva (afeta a previsão a partir daí).
- Snapshot do mês usa o "% atual no perfil do usuário no instante da geração do snapshot".
- Audit log registra: quem mudou, de quanto pra quanto, quando, justificativa (campo opcional).

**Aba "Comissões":**
- Sub-aba **Visão geral** (visível Sócio/ADM): tabela de todos os colaboradores com fixo + variável + total + status do mês
- Sub-aba **Minhas comissões** (visível para todos): minha previsão atual + meus snapshots aprovados dos últimos 12 meses + breakdown por cliente da minha carteira
- Sub-aba **Fechamento** (visível Sócio/ADM): tela de aprovação mensal

### 5.8 Notificações

**Canais:**
- In-app: feed em sininho no topo da UI, badge com contador de não lidas
- Email (Resend): opcional por tipo, configurável em `/configuracoes`

**Destinatários customizáveis:**
Cada tipo de notificação tem uma regra default (em `notification_rules`) que define quem recebe automaticamente. **No momento de gerar a notificação, o autor da ação pode adicionar destinatários extras** — escolhendo entre colaboradores ativos numa caixinha de seleção (search + multi-select). Casos típicos:
- Comercial agenda prospecção → default: o próprio + ADM. Pode incluir Sócio se for deal grande.
- Coord movimenta kanban → default: próximo responsável. Pode adicionar o assessor que vai herdar o cliente.
- Sócio aprova mês → default: todos os colaboradores que têm linha no snapshot.

Sócio/ADM podem editar as regras default em `/configuracoes/notificacoes`.

**Tipos:**
- Tarefa atribuída a mim
- Tarefa próxima do prazo (24h antes)
- Tarefa overdue
- **Prospecção agendada** (default: criador + ADM)
- **Reunião comercial em 1h** (default: comercial responsável)
- **Marco zero em 24h / 1h** (default: comercial + coord + assessor)
- **Deal fechado** (default: ADM, sócios)
- Aniversário do sócio do cliente (30, 7, 1 dia antes)
- Aniversário de colaborador (3 dias antes para o time)
- Renovação de contrato próxima (45, 15, 5 dias antes)
- Cliente perto do churn (score IA cair na zona vermelha por 2 semanas seguidas)
- Card kanban movido pra mim
- Mês aguardando aprovação (Sócio)
- Mês aprovado (Coord/Assessor/Comercial)
- Satisfação semanal pendente (toda segunda)

### 5.9 Dashboard

Diferente por papel.

**Sócio / ADM (versão completa):**
- Topo: alerta de mês aguardando aprovação (se houver)
- KPIs: carteira ativa, clientes ativos, churn do mês, custo de comissão (% do faturamento)
- Gráfico: evolução da carteira (linha, 12 meses)
- Gráfico: entrada vs churn (barras agrupadas, 6 meses)
- Painel: carteira por assessor (barras horizontais ranqueadas)
- Painel: ranking resumo de satisfação (top 3 + bottom 2 com link "ver completo")
- Painel: próximos eventos (30 dias)

**Coordenador:**
- KPIs: carteira sob coordenação, clientes ativos sob coord, churn do mês (sob coord), **minha comissão prevista**
- Gráficos iguais aos do sócio mas filtrados pelos assessores que ele coordena
- Carteira por assessor: só os que ele coordena
- Ranking de satisfação só dos clientes sob sua coordenação

**Assessor:**
- KPIs: minha carteira, meus clientes ativos, meu churn, **minha comissão prevista**
- Gráfico evolução da minha carteira
- Ranking dos meus clientes (top + bottom)
- Próximos eventos meus

**Comercial:**
- KPIs: leads ativos, fechamentos do mês, ticket médio fechado, taxa de conversão, **minha comissão prevista**
- Gráfico: funil (5 estágios do kanban com volume)
- Lista: minhas próximas reuniões agendadas (prospecção e marco zero)

### 5.10 Prospecção (área exclusiva do setor Comercial)

Item dedicado na sidebar, visível apenas para Comercial, ADM e Sócio. Concentra todas as ferramentas que o setor comercial precisa, sem poluir o kanban (que é compartilhado).

**Sub-páginas:**

- **Prospects** — lista completa dos prospects em qualquer estágio (incluindo descartados/perdidos). Filtros: status (em prospecção, em negociação, fechado, perdido), comercial responsável, valor proposto, último contato. Cada prospect abre uma view detalhada com:
  - Dados do prospect (nome, site, contato)
  - Histórico de tentativas de contato (`lead_attempts`) — canal usado, resultado, próximo passo
  - Botão "Agendar reunião" (cria evento no calendário e move card pra "Prospecção agendada")
  - Botão "Marcar como perdido" (com motivo)

- **Minha agenda** — atalho do calendário interno filtrado para mostrar só as reuniões comerciais e marcos zero do comercial logado. Próximas 14 dias por padrão.

- **Histórico de fechamentos** — deals que o comercial fechou nos últimos 12 meses. Mostra: nome do cliente, valor mensal, data de fechamento, comissão recebida (do snapshot daquele mês). Total acumulado no topo.

- **Metas** (opcional, configurável por sócio) — meta mensal de prospects abordados, meta de fechamentos, meta de receita trazida (R$). Mostra progresso visual (barra) vs. realizado.

- **Funil** — visualização do funil de conversão: quantos prospects por estágio, taxa de conversão entre estágios, ticket médio. Filtros por período e por comercial.

**Permissões internas:**
- Comercial: vê só os próprios prospects e os próprios números
- Sócio/ADM: vê de todos os comerciais, com filtro

### 5.11 Colaboradores (RH leve)

Página acessível para Sócio e ADM (leitura para todos os outros, dados sensíveis ocultos).

- Lista com filtros: papel, status (ativo/inativo), data de admissão.
- Cadastro/edição:
  - Dados pessoais: nome, email, telefone, **endereço**, **data de nascimento**
  - Dados financeiros: **chave Pix de pagamento**, fixo mensal, % de comissão (read-only para todos exceto sócio)
  - Dados profissionais: papel, data de admissão, ativo
  - Avatar
- Aniversário gera evento no sub-calendário "Aniversários" automaticamente (cron diário).
- Notificação 3 dias antes do aniversário para o time todo.

---

## 6. Diretrizes de UI/UX

- **Identidade visual — Yide Digital:**
  - Logo oficial em `public/brand/` na raiz do projeto. Estrutura esperada:
    - `public/brand/logo.svg` (preferencial — vetor, ideal)
    - `public/brand/logo.png` (fallback, fundo transparente)
    - `public/brand/logo-light.svg` (versão pra usar em fundo claro — pode ser a versão teal sólida)
    - `public/brand/logo-dark.svg` (versão pra usar em fundo escuro — pode ser branca ou teal mais claro)
    - `public/brand/favicon.ico` ou `favicon.svg`
  - **Logo já fornecida pela usuária:** wordmark "Yide" + "DIGITAL" abaixo, com elemento gráfico em forma de loop/laço formando o "X". Cor: teal `~#3DC4BC`.
  - Aplicação:
    - **Sidebar:** versão `mark` compacta (só o "X" do laço), ~32px de altura
    - **Tela de login:** logo completo (`wordmark`), centralizado, ~80-120px de altura
    - **Header de email** (Resend): logo completo
    - **Favicon:** versão `mark` (só o X) em 32x32 e 16x16
  - Se o usuário fornecer apenas a versão completa, durante a implementação extraímos só o símbolo do "X" como `mark.svg` (recortando o wordmark "ide DIGITAL").
- **Tipografia:** Inter (Google Fonts) com `letter-spacing: -0.02em` em títulos.
- **Iconografia:** `lucide-react` em todo lugar. Sem emoji na UI final, apenas em conteúdo digitado pelo usuário (notas, comentários).
- **Tema:** suporte completo a dark/light com toggle por usuário. Variáveis CSS via `next-themes`. Preferência salva em `profiles.tema_preferido`.
- **Cantos:** raio padrão 14px em cards, 10px em botões, 999px em pills/badges.
- **Sombras:** `0 1px 2px rgba(15,23,42,.04)` em cards normais; `0 12px 40px -8px rgba(15,23,42,.18)` em modais e shells de página.
- **Cores principais (paleta da marca Yide Digital):**
  - **Teal-ciano (cor da marca)** — extraída diretamente do logotipo:
    - Tom principal: `#3DC4BC` (teal médio do logo)
    - Tom claro: `#5DD3CB` (para hover/destaque sobre fundo escuro)
    - Tom escuro: `#2BA39C` (para hover sobre fundo claro)
  - **Preto** `#0a0a0f` — fundo do modo escuro, textos principais no claro, headers
  - **Branco** `#ffffff` — fundo do modo claro, contraste em superfícies escuras
  - **Cinzas neutros** (`#f5f6f8`, `#e2e8f0`, `#64748b`) — superfícies, bordas, textos secundários
- **Cores semânticas (uso restrito a estados — não devem aparecer em larga escala):**
  - Sucesso: `#10b981` (verde — entrada de cliente, satisfação alta)
  - Atenção: `#f59e0b` (amarelo — aviso, satisfação média)
  - Erro/Churn: `#ef4444` (vermelho — churn, satisfação baixa, urgente)
- **Aplicação do gradiente da marca:** botões primários, marca, KPIs em destaque e cards de ação usam `linear-gradient(135deg, #3DC4BC, #2BA39C)`. Em modo escuro, gradiente sobe para `linear-gradient(135deg, #5DD3CB, #3DC4BC)` para melhor contraste sobre o preto.
- **Hierarquia de uso:** preto e branco devem dominar a UI (>70% da tela). O teal-ciano é cor de **destaque** — usado pontualmente em CTAs, marca, gráficos primários e elementos ativos. As cores semânticas só aparecem em estados (badge de churn, dot de satisfação, alert).
- **Layout principal:** sidebar lateral fixa de 210px com 9 itens de navegação (Dashboard, Clientes, **Prospecção**, Onboarding, Tarefas, Comissões, Satisfação, Calendário Interno, Colaboradores) + Configurações no rodapé. **Prospecção** é visível apenas para Comercial / ADM / Sócio. Em mobile, sidebar vira menu hamburguer.
- **Acessibilidade:** WCAG AA mínimo (contraste, foco visível, ARIA em interações de drag & drop do kanban, leitor de tela em sparklines).
- **Responsividade:** desktop-first (a maioria dos colaboradores usa em monitor), mas todas as telas funcionam em tablet (≥768px). Em smartphone, foco em ações pontuais (registrar nota de reunião, alimentar satisfação, ver notificações).

---

## 7. Não-funcionais

### Segurança
- RLS no Postgres em todas as tabelas. Políticas por papel.
- Dados financeiros (Pix, fixo, comissão) só acessíveis a Sócio/ADM e ao próprio dono.
- Audit log imutável (sem update/delete; só insert).
- Backups diários do Supabase (incluso no plano Pro).
- HTTPS obrigatório. Cookies httpOnly. CSRF nativo do Next.js.
- Senhas: bcrypt via Supabase Auth. Mínimo 8 chars.
- Rate limiting: 100 req/min por IP em rotas autenticadas.

### Performance
- Server Components e streaming do Next.js 15.
- Cache de queries comuns via `unstable_cache`.
- Sparklines e gráficos pré-calculados em jobs noturnos quando possível.
- Lazy load de tabs da pasta do cliente.

### Observabilidade
- Logs estruturados (Vercel Logs).
- Erros de servidor capturados (Sentry opcional, fora do MVP).
- Métricas de uso de IA (tokens, custos) em painel admin.

---

## 8. Fora do escopo (MVP v1)

Itens deliberadamente **deixados de fora** desta primeira versão. Podem ser adicionados depois sem reestruturação.

- Multi-tenant (vender para outras agências)
- App mobile nativo (apenas web responsiva)
- Integração com WhatsApp Business API
- Integração com Google Calendar / Outlook (calendário é só interno por enquanto)
- Cobrança/financeiro do cliente (boletos, gateway, etc.)
- Pesquisa de satisfação enviada diretamente ao cliente
- Progressão automática de % de comissão (atualmente 100% manual pelo sócio)
- Comissão pro-rata em mudanças de meio de mês (atualmente: snapshot pega o estado em 1º do mês seguinte)
- Sentry / monitoramento avançado de erros
- Internacionalização (apenas pt-BR)

---

## 9. Premissas e decisões registradas

1. **Sócio sem linha de comissão** — sócio configura e enxerga financeiro consolidado; "ganho do sócio" é o lucro da empresa, fora do sistema de comissões.
2. **Snapshot mensal pega o "% atual no momento da geração"** — sem retroatividade. Mudanças de % no meio do mês afetam o fechamento daquele mesmo mês.
3. **Comercial agenda o marco zero, Coord conduz** — fluxo confirmado.
4. **Comercial é remunerado com fixo + % sobre o valor do 1º mês** de cada deal fechado. Pago apenas no mês em que o lead atinge "Cliente ativo" (one-shot, não recorrente).
5. **Kanban tem 5 estágios** (Prospecção agendada → Reunião Comercial → Contrato → Marco Zero → Cliente ativo).
6. **"Onboarding" e "Prospecção" são itens distintos da sidebar** — Onboarding é o kanban compartilhado entre setores; Prospecção é a área exclusiva do Comercial (CRM-light).
7. **Satisfação é semanal** — janela ISO (segunda a domingo). Síntese roda quinta-feira ou quando ambos avaliaram (o que vier primeiro).
8. **Assessor pode VER todos os clientes** mas só edita os dele. Vê valor R$ apenas dos seus.
9. **Coordenador recebe % sobre carteira da agência inteira** (não apenas sob sua coordenação).
10. **Tema dark/light é escolha do usuário**, salva no perfil.
11. **Sem emojis na UI** — apenas ícones SVG (Lucide).

---

## 10. Métricas de sucesso

Após 60 dias de uso:

- 100% dos clientes ativos com pasta digital atualizada (briefing + última reunião nos últimos 30 dias)
- 100% dos colaboradores com cadastro completo
- 100% dos novos clientes passando pelo kanban de onboarding (não criados manualmente)
- Satisfação semanal preenchida em ≥90% dos casos (medido por entries / clientes ativos × 2 papéis)
- Fechamento mensal aprovado pelo sócio em ≤3 dias após geração
- Zero perda de informação ao trocar de assessor (validado por audit log + feedback qualitativo)

---

## 11. Questões em aberto antes da implementação

Pontos abertos restantes (defaults razoáveis propostos — confirmar antes do plano):

### 11.1 Aniversário de cliente sem sócio identificado
Para clientes B2B sem "sócio do cliente" cadastrado, o sub-calendário "Aniversários" simplesmente não terá entrada. Sem ação necessária — só formalizar.

### 11.2 Retenção do audit log
Default proposto: registros nunca apagados. Se houver requisito legal de retenção limitada (LGPD), revisar.

### 11.3 Limite de tamanho de upload na pasta do cliente
Default proposto: 50MB por arquivo (limite padrão do Supabase Storage no plano Pro). Suficiente para PDFs e imagens, insuficiente para vídeos longos.

### 11.4 Metas comerciais (seção 5.10)
Sub-página "Metas" da Prospecção é opcional. Confirmar se faz parte do MVP ou fica para v2.

---

## 12. Próximos passos

1. ✓ Brainstorming concluído
2. ✓ Spec aprovado e refinado
3. ✓ Remuneração do Comercial definida (fixo + % do 1º mês)
4. **Próximo:** plano de implementação detalhado (skill `writing-plans`) — vai quebrar este spec em fases entregáveis incrementalmente, começando por "fundação" (auth + RBAC + clientes básicos) e terminando pela camada de IA.
5. Execução das fases (skill `executing-plans` ou `subagent-driven-development`)

---

**Aprovação visual e funcional:** confirmada pela usuária em 2026-04-26.
