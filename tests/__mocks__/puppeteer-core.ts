// Shim de puppeteer-core durante testes — não é instalado no ambiente de
// desenvolvimento local (só no Vercel runtime). Testes não chamam Puppeteer.
const stub = {
  launch: async () => ({
    newPage: async () => ({}),
    close: async () => {},
  }),
};
export default stub;
