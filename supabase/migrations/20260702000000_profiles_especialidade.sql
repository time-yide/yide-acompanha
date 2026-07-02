-- Especialidade do assessor (rótulo, não muda regra de negócio).
-- Hoje só 'ecommerce'; NULL = assessor comum / não-assessor.
-- Texto livre (não enum de banco) pra permitir novas especialidades sem ALTER TYPE.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS especialidade text;

COMMENT ON COLUMN public.profiles.especialidade IS
  'Especialidade do assessor. Hoje: ''ecommerce'' ou NULL (comum). Só rótulo — não altera comissão/regras.';
