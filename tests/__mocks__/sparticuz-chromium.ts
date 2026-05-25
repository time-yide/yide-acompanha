// Shim de @sparticuz/chromium durante testes. O pacote real é Linux-only
// (não instala no macOS dev) e testes não chamam Puppeteer.
const stub = {
  args: [],
  defaultViewport: { width: 1280, height: 720 },
  executablePath: async () => "/tmp/chromium",
  headless: true,
};
export default stub;
