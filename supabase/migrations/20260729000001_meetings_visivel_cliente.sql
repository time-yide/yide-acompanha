-- Reuniões visíveis no portal do cliente. Opt-in: a equipe marca quais
-- reuniões o cliente pode ver (default false — nada vaza sem escolha). O portal
-- do cliente só mostra reuniões com visivel_cliente = true E client_id do
-- próprio cliente.
alter table meetings
  add column if not exists visivel_cliente boolean not null default false;
