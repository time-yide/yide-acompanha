# Setup operacional — Ligações por Twilio

Faça uma vez. ~20-30 min.

1. Criar conta em twilio.com e **adicionar crédito** (sai do trial → libera ligar
   pra qualquer número).
2. Console → **Voice → Settings → Geographic Permissions** → habilitar **Brasil**.
3. Console → **Phone Numbers → Verified Caller IDs** → verificar um número que
   vocês já têm (recebe um código por ligação). Esse vira o número que aparece
   pro lead. (Não precisa comprar número nem fazer o cadastro regulatório.)
4. Console → **Account → API keys & tokens** → criar uma **API Key (Standard)**:
   anote o **SID** e o **Secret**. Anote também o **Account SID** (dashboard).
5. Console → **Voice → TwiML Apps** → criar um app. Na **Voice Request URL**, cole
   `https://sistemaacompanha.yidedigital.com.br/api/ligacoes/twilio/voice` (POST).
   Anote o **TwiML App SID**.
6. No **Vercel** → Project → Settings → Environment Variables, adicionar:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_API_KEY_SID`
   - `TWILIO_API_KEY_SECRET`
   - `TWILIO_TWIML_APP_SID`
   Redeploy.
7. No sistema → **Ligações → Configurações** → nova instância de **telefone**:
   provedor **Twilio**, campo **Número** = o caller ID verificado, atribuir à
   comercial e salvar. Reabra a instância e confira a URL de webhook mostrada.
8. Avisar a equipe e os clientes que as ligações são **gravadas** (o sistema já
   toca um aviso no início, mas o combinado verbal é recomendado).

Pronto: a comercial abre /ligacoes no PC com fone, clica Ligar, e a chamada sai
gravada. Você ouve depois no detalhe da ligação.
