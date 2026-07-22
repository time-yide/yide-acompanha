-- Seed manual: pesquisa "Conecta Yide". Rodar no SQL Editor do Supabase DEPOIS de
-- aplicar 20260724000000_pesquisas_bloqueante.sql e do deploy do código.
-- Idempotência: rode UMA vez. Rodar de novo cria uma segunda pesquisa.
with nova as (
  insert into public.pesquisas
    (organization_id, titulo, descricao, anonima, bloqueante, status, criado_por, disparada_em)
  select
    p.organization_id,
    'Conecta Yide — sua opinião conta 💛',
    'Queremos muito saber como foi o nosso Conecta Yide pra você! São só 2 minutinhos e sua resposta ajuda a gente a fazer os próximos ainda melhores.',
    false, true, 'aberta', p.id, now()
  from public.profiles p
  where p.role in ('socio', 'adm') and p.ativo = true
  order by (p.role = 'socio') desc
  limit 1
  returning id
),
perguntas as (
  insert into public.pesquisa_perguntas
    (pesquisa_id, ordem, tipo, enunciado, escala_min, escala_max, obrigatoria)
  select
    nova.id, v.ordem, v.tipo::public.pesquisa_pergunta_tipo, v.enunciado, v.escala_min, v.escala_max, true
  from nova, (values
    (1, 'escala',  'De 0 a 10, o quanto você gostou do Conecta Yide?', 0::int, 10::int),
    (2, 'sim_nao', 'Você gostaria que a gente fizesse o Conecta Yide com mais frequência?', null::int, null::int),
    (3, 'texto',   'O que você mais gostou?', null::int, null::int),
    (4, 'texto',   'O que você acha que a gente pode melhorar pra próxima?', null::int, null::int),
    (5, 'texto',   'Tem alguma ideia do que podemos fazer no próximo Conecta Yide?', null::int, null::int),
    (6, 'texto',   'Deixe algum feedback ou recado livre sobre esse momento.', null::int, null::int)
  ) as v(ordem, tipo, enunciado, escala_min, escala_max)
  returning 1
)
insert into public.pesquisa_destinatarios (pesquisa_id, user_id)
select nova.id, p.id
from nova, public.profiles p
where p.ativo = true;
