// Shim pro pacote "web-push" durante testes. O pacote real é puro Node (usa
// crypto/http) e não está disponível no ambiente jsdom — vitest falha a
// resolução no import. Nos testes nada chama push real, então só exportamos
// um stub default com as APIs que `src/lib/push/server.ts` referencia.
const stub = {
  setVapidDetails: () => {},
  sendNotification: async () => ({ statusCode: 201 }),
  generateVAPIDKeys: () => ({ publicKey: "", privateKey: "" }),
};
export default stub;
