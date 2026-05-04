-- ============================================================================
-- Security fixes — RLS audit 2026-05-02
-- C-1: Block self role escalation via trigger
-- C-2: Restrict SELECT on sensitive PII columns + helper RPC
-- I-1: Tighten audit_log INSERT policy
-- ============================================================================

-- ============================================================================
-- C-1: Block self role escalation via trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.profiles_block_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role public.user_role;
BEGIN
  -- Allow service-role calls (auth.uid() returns null when service-role bypasses RLS)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  caller_role := public.current_user_role();

  -- Allow socio and adm to change anything
  IF caller_role IN ('socio', 'adm') THEN
    RETURN NEW;
  END IF;

  -- For everyone else: block changes to sensitive columns
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Apenas Sócio ou ADM podem alterar role'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.fixo_mensal IS DISTINCT FROM OLD.fixo_mensal THEN
    RAISE EXCEPTION 'Apenas Sócio ou ADM podem alterar fixo_mensal'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.comissao_percent IS DISTINCT FROM OLD.comissao_percent THEN
    RAISE EXCEPTION 'Apenas Sócio ou ADM podem alterar comissao_percent'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.comissao_primeiro_mes_percent IS DISTINCT FROM OLD.comissao_primeiro_mes_percent THEN
    RAISE EXCEPTION 'Apenas Sócio ou ADM podem alterar comissao_primeiro_mes_percent'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.ativo IS DISTINCT FROM OLD.ativo THEN
    RAISE EXCEPTION 'Apenas Sócio ou ADM podem alterar ativo'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Apenas Sócio ou ADM podem alterar organization_id'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.meta_prospects_mes IS DISTINCT FROM OLD.meta_prospects_mes THEN
    RAISE EXCEPTION 'Apenas Sócio ou ADM podem alterar meta_prospects_mes'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.meta_fechamentos_mes IS DISTINCT FROM OLD.meta_fechamentos_mes THEN
    RAISE EXCEPTION 'Apenas Sócio ou ADM podem alterar meta_fechamentos_mes'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.meta_receita_mes IS DISTINCT FROM OLD.meta_receita_mes THEN
    RAISE EXCEPTION 'Apenas Sócio ou ADM podem alterar meta_receita_mes'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.data_admissao IS DISTINCT FROM OLD.data_admissao THEN
    RAISE EXCEPTION 'Apenas Sócio ou ADM podem alterar data_admissao'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_block_privilege_escalation ON public.profiles;

CREATE TRIGGER trg_profiles_block_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_block_privilege_escalation();

-- ============================================================================
-- C-2: Restrict SELECT on sensitive PII columns from authenticated
-- ============================================================================

REVOKE SELECT (
  fixo_mensal, comissao_percent, comissao_primeiro_mes_percent,
  pix, endereco, data_nascimento, telefone,
  meta_prospects_mes, meta_fechamentos_mes, meta_receita_mes,
  data_admissao
) ON public.profiles FROM authenticated;

-- Helper function: users can read their OWN sensitive profile data
-- (e.g. for own dashboard commission preview)
CREATE OR REPLACE FUNCTION public.get_my_profile_sensitive()
RETURNS TABLE (
  fixo_mensal numeric,
  comissao_percent numeric,
  comissao_primeiro_mes_percent numeric,
  pix text,
  endereco text,
  data_nascimento date,
  telefone text,
  meta_prospects_mes integer,
  meta_fechamentos_mes integer,
  meta_receita_mes numeric,
  data_admissao date
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    fixo_mensal, comissao_percent, comissao_primeiro_mes_percent,
    pix, endereco, data_nascimento, telefone,
    meta_prospects_mes, meta_fechamentos_mes, meta_receita_mes,
    data_admissao
  FROM public.profiles
  WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_profile_sensitive() TO authenticated;

-- ============================================================================
-- I-1: Tighten audit_log INSERT — prevent fabricated ator_id
-- ============================================================================

DROP POLICY IF EXISTS "authenticated can insert audit log" ON public.audit_log;

CREATE POLICY "authenticated can insert own audit log"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (ator_id = auth.uid());
