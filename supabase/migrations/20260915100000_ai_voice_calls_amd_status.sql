-- Adiciona 'concluido' e 'caixa_postal' como status válidos em ai_voice_calls
-- para detecção de caixa postal (AMD) e finalização de chamadas completadas.

alter table ai_voice_calls
  drop constraint if exists ai_voice_calls_status_check;

alter table ai_voice_calls
  add constraint ai_voice_calls_status_check
  check (status in (
    'iniciando','chamando','em_andamento',
    'concluido','caixa_postal',
    'reuniao_agendada','sem_interesse','nao_atendeu','erro'
  ));
