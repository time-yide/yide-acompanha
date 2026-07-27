import { describe, it, expect } from "vitest";
import { tokenValido, soComentariosDoCliente } from "./aprovacao-cliente-utils";

describe("tokenValido", () => {
  it("aceita uuid", () => {
    expect(tokenValido("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(true);
  });
  it("rejeita lixo", () => {
    expect(tokenValido("../etc/passwd")).toBe(false);
    expect(tokenValido("")).toBe(false);
  });
});

describe("soComentariosDoCliente", () => {
  it("remove comentários internos (autor_tipo=time)", () => {
    const cs = [
      { id: "a", autor_tipo: "cliente", corpo: "x" },
      { id: "b", autor_tipo: "time", corpo: "interno" },
    ] as { id: string; autor_tipo: "time" | "cliente"; corpo: string }[];
    expect(soComentariosDoCliente(cs).map((c) => c.id)).toEqual(["a"]);
  });
});
