-- Adiciona nível de acesso ao portal do cliente: `ver_valores` controla
-- se o usuário vê valores financeiros (valor mensal do contrato + valores
-- investidos em tráfego). Caso de uso: cliente quer dar acesso pra um
-- funcionário ver dados/relatórios sem ver o que ele paga pra Yide.
--
-- Default true (mantém comportamento anterior pros acessos existentes).
-- Sócio do cliente que cadastrou o portal continua com acesso pleno.

alter table public.client_portal_users
  add column ver_valores boolean not null default true;

comment on column public.client_portal_users.ver_valores is
  'Quando true (padrão), usuário vê valor mensal do contrato e valores '
  'de tráfego no portal. False = oculta esses valores (pra funcionários '
  'do cliente que não devem ter acesso financeiro).';
