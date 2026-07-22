# Setup — Frame Interno (Bunny Stream)

1. Crie conta em https://bunny.net → menu **Stream** → **Add Video Library** (ex.: "Yide Reviews").
2. Na library → aba **API** → copie a **API Key** e o **Library ID**.
3. Na aba **Encoding/Player**, copie o **CDN Hostname** (ex.: `vz-xxxx.b-cdn.net`).
4. Setar no `.env.local` e no Vercel:
   - `BUNNY_STREAM_API_KEY`
   - `BUNNY_STREAM_LIBRARY_ID`
   - `BUNNY_STREAM_CDN_HOSTNAME`  (só o host, sem https://)
