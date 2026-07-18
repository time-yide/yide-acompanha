# FreelaYide — Conquistas / Medalhas (Sub-projeto 2)

**Data:** 2026-07-18
**Status:** Aprovado

## Objetivo

Adicionar conquistas (medalhas) desbloqueáveis ao FreelaYide: marcos acumulados que,
ao serem batidos, gravam o momento e disparam uma notificação "Conquista desbloqueada:
X!". Cada pessoa vê sua coleção (ganhas coloridas, faltantes em cinza).

## Princípio

Conquistas são **marcos monotônicos** (só sobem, nunca regridem) detectados **na hora**
que a pessoa mexe numa freela. Isso evita rotina de fim de mês e garante que nada
desbloqueia errado. Por isso **não** há conquista de "1º do mês" (transitório).

## Lista de conquistas (10)

Ícones lucide imponentes (sem emoji). `key` = identificador estável no banco.

| key | Título | Critério | Ícone | Categoria |
|---|---|---|---|---|
| `estreia` | Estreia | Pegue sua 1ª freela | Rocket | pegar |
| `pegador` | Pegador | Pegue 10 freelas | Zap | pegar |
| `formiga` | Formiga | Pegue 30 freelas | Pickaxe | pegar |
| `primeiro_gol` | Primeiro gol | Feche sua 1ª freela | Target | fechar |
| `matador` | Matador | Feche 10 freelas | Swords | fechar |
| `closer` | Closer | Feche 25 freelas | Flame | fechar |
| `faxineiro` | Faxineiro | Feche 5 freelas de até R$100 | Sparkles | pequenas |
| `heroi_miudas` | Herói das miúdas | Feche 15 freelas de até R$100 | Shield | pequenas |
| `provedor` | Provedor | Some R$ 3.000 em freelas fechadas | Gem | valor |
| `milionario` | Milionário do freela | Some R$ 10.000 em freelas fechadas | Crown | valor |

Cada categoria mede um número acumulado do colaborador:
- **pegar** → total de freelas pegas (não deletadas).
- **fechar** → total de freelas fechadas.
- **pequenas** → total de fechadas com `valor_comissao <= 100`.
- **valor** → soma de `valor_comissao` das fechadas.

## Banco (3 migrations MANUAIS, em ordem)

1. **Tabela `freela_conquistas`**:
   ```sql
   create table if not exists public.freela_conquistas (
     id uuid primary key default gen_random_uuid(),
     organization_id uuid not null references public.organizations(id) on delete cascade,
     user_id uuid not null references public.profiles(id) on delete cascade,
     conquista_key text not null,
     unlocked_at timestamptz not null default now(),
     unique (user_id, conquista_key)
   );
   create index if not exists freela_conquistas_user_idx on public.freela_conquistas (user_id);
   alter table public.freela_conquistas enable row level security;
   create policy "freela_conquistas_select_own" on public.freela_conquistas
     for select using (user_id = auth.uid());
   ```
   Escrita só via service-role (verificador) — bypassa RLS.

2. **Novo evento de notificação** (arquivo separado, precisa commitar antes do seed):
   ```sql
   alter type public.notification_event add value if not exists 'conquista_desbloqueada';
   ```

3. **Seed da regra**:
   ```sql
   insert into public.notification_rules
     (evento_tipo, ativo, mandatory, email_default, permite_destinatarios_extras, default_roles, default_user_ids)
   values
     ('conquista_desbloqueada', true, false, false, true, array[]::text[], array[]::uuid[])
   on conflict (evento_tipo) do nothing;
   ```
   Entrega via `user_ids_extras` (a própria pessoa).

## Tipos gerados

`NotificationEvent = Database["public"]["Enums"]["notification_event"]`. Como os tipos
não são regerados no deploy, adicionar `"conquista_desbloqueada"` **à mão** em
`src/types/database.ts` nos dois lugares do enum (union ~2782 e array ~3033), senão o
`dispatchNotification` não compila.

## Código

### `src/lib/freela-yide/conquistas.ts` (puro, testável)
```ts
export type ConquistaCategoria = "pegar" | "fechar" | "pequenas" | "valor";
export interface ConquistaDef { key: string; titulo: string; descricao: string; icone: string; categoria: ConquistaCategoria; cor: string; meta: number; }
export interface ConquistaStats { pegas: number; fechamentos: number; pequenasFechadas: number; valorFechado: number; }
export const CONQUISTAS: ConquistaDef[];
export function progressoDe(def: ConquistaDef, stats: ConquistaStats): number; // valor atual conforme categoria
export function conquistasAtingidas(stats: ConquistaStats): string[]; // keys com progresso >= meta
```

### `src/lib/freela-yide/queries.ts`
- `getConquistaStats(userId): Promise<ConquistaStats>` — service-role; agrega de
  `freela_oportunidades` onde `pego_por = userId`, `deleted_at is null`.
- `getConquistasDesbloqueadas(userId): Promise<Record<string,string>>` — mapa
  `conquista_key → unlocked_at`.

### `src/lib/freela-yide/verificar-conquistas.ts` (server)
`verificarConquistas(userId)`: best-effort (try/catch interno, nunca lança).
1. `stats = getConquistaStats(userId)`; `atingidas = conquistasAtingidas(stats)`.
2. Se vazio, retorna. Senão resolve `orgId = getOrganizationId(userId)`.
3. `upsert` das keys atingidas em `freela_conquistas` com
   `onConflict: "user_id,conquista_key", ignoreDuplicates: true` e `.select()` — só as
   **realmente inseridas** (robusto a corrida) geram notificação.
4. Pra cada nova: `dispatchNotification({ evento_tipo: "conquista_desbloqueada",
   titulo: "Conquista desbloqueada: {titulo}!", mensagem: "{descricao} — mandou bem!",
   link: "/freela-yide/conquistas", user_ids_extras: [userId] })`.

### Gatilhos em `src/lib/freela-yide/actions.ts`
- `pegarOportunidadeAction`: após o update bem-sucedido → `await verificarConquistas(actor.id)`.
- `moverStatusAction`: após o update bem-sucedido → `if (op.pego_por) await verificarConquistas(op.pego_por)`
  (crédito vai pra quem pegou, mesmo se a gestão que moveu). `op` já traz `pego_por`.

## Interface

### `src/components/freela-yide/ConquistasGrid.tsx` (presentacional)
Recebe `desbloqueadas: Record<string,string>` e `stats: ConquistaStats`. Grade de cards:
- Desbloqueada → ícone lucide colorido (cor da def) + título + "Desbloqueada em {data}".
- Bloqueada → ícone `Lock` cinza + título apagado + `descricao` + progresso "{atual}/{meta}".
Mapa string→ícone lucide interno (Rocket, Zap, Pickaxe, Target, Swords, Flame, Sparkles, Shield, Gem, Crown).

### `src/app/(authed)/freela-yide/conquistas/page.tsx`
`requireAuth`; `ROLES_ALLOWED` (qualquer usuário do FreelaYide). Carrega `stats` +
`desbloqueadas` do próprio usuário. Link "← Voltar" + título + `<ConquistasGrid/>`.

### Entrada na página principal
No cabeçalho do "Ranking" (visível a todos), adicionar link "Conquistas →" pra
`/freela-yide/conquistas`.

## Testes

`tests/unit/freelayide-conquistas.test.ts` cobre `conquistasAtingidas`/`progressoDe`:
- stats zerado → nenhuma.
- pegas=1 → só `estreia`.
- pegas=10, fechamentos=10 → estreia, pegador, primeiro_gol, matador.
- pequenasFechadas=5 → faxineiro; =15 → faxineiro + heroi_miudas.
- valorFechado=3000 → provedor; =10000 → provedor + milionario.
- bordas (meta-1 não conta, meta conta).

## Não-objetivos

- Sem conquista de ranking/mês (transitório).
- Sem animação de desbloqueio na tela (a notificação já avisa).
- Sem editar conquistas pela UI (lista fixa no código).
