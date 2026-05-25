// Shim pro pacote "server-only" durante testes: no Next.js o pacote existe
// só pra throw se importado num bundle client. Em vitest, nem o pacote nem
// o bundle client existem, então import("server-only") quebra a resolução.
// Este arquivo é vazio de propósito — vitest.config.ts faz o alias.
export {};
