-- Tokens OAuth do Canva (1 por organização)
CREATE TABLE IF NOT EXISTS public.canva_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) UNIQUE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.canva_tokens ENABLE ROW LEVEL SECURITY;

-- Estado temporário do OAuth (PKCE)
CREATE TABLE IF NOT EXISTS public.canva_oauth_state (
  state text PRIMARY KEY,
  code_verifier text NOT NULL,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.canva_oauth_state ENABLE ROW LEVEL SECURITY;

-- Pasta do Canva por cliente
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS canva_folder_id text;
