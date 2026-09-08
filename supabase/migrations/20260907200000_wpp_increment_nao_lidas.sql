-- Incrementa nao_lidas atomicamente e atualiza preview da conversa.
-- Chamada pelo webhook de incoming do Twilio.
CREATE OR REPLACE FUNCTION increment_nao_lidas(
  conv_id uuid,
  novo_texto text DEFAULT NULL,
  nova_data  timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE wpp_conversations
  SET nao_lidas   = nao_lidas + 1,
      ultimo_texto = COALESCE(novo_texto, ultimo_texto),
      ultima_msg_em = nova_data,
      updated_at   = nova_data
  WHERE id = conv_id;
$$;
