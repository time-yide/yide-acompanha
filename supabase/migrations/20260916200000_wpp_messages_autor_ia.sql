-- 1. Adicionar 'ia' ao CHECK constraint de wpp_messages.autor
-- Sem isso, toda resposta automática da IA conversacional falha no insert.
ALTER TABLE public.wpp_messages
  DROP CONSTRAINT IF EXISTS wpp_messages_autor_check;

ALTER TABLE public.wpp_messages
  ADD CONSTRAINT wpp_messages_autor_check
  CHECK (autor IN ('lead', 'comercial', 'sistema', 'ia'));

-- 2. Adicionar 'ligacao_erro' ao CHECK de motor_prospeccao_log.acao
-- O worker usa esse valor quando uma ligação IA falha.
ALTER TABLE public.motor_prospeccao_log
  DROP CONSTRAINT IF EXISTS motor_prospeccao_log_acao_check;

ALTER TABLE public.motor_prospeccao_log
  ADD CONSTRAINT motor_prospeccao_log_acao_check
  CHECK (acao IN (
    'wpp_primeiro_contato', 'wpp_resposta_ia',
    'ligacao_ia', 'ligacao_erro',
    'reuniao_agendada', 'sem_interesse',
    'escalado_humano', 'esgotado', 'erro'
  ));
