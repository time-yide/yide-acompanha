CREATE TABLE IF NOT EXISTS public.client_group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  group_jid text NOT NULL,
  sender_name text,
  sender_phone text,
  message_text text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_group_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_client_group_messages_client
  ON public.client_group_messages (client_id, received_at DESC);

CREATE INDEX idx_client_group_messages_jid
  ON public.client_group_messages (group_jid);
