import { describe, expect, it } from "vitest";
import { automationReadSchema, automationSchema } from "@/core/rules";

/**
 * Leitura x gravação de uma regra. A tela usa `automationReadSchema` para
 * descrever e abrir o que está no banco; `automationSchema` só entra no salvar.
 * Sem essa separação, uma exigência nova (ex.: o 9 do celular) transformaria
 * regras antigas em "formato inválido" e o Editar abriria em branco.
 */

const rule = (number: string) => ({
  name: "Aviso no WhatsApp",
  enabled: true,
  trigger: { type: "card.moved", board: "sales", to_list: "fechado" },
  conditions: { op: "AND", rules: [] },
  actions: [{ type: "send_whatsapp", to: "number", number, message: "oi" }],
});

describe("regra gravada com número incompleto", () => {
  it("abre para edição (leitura) mas não passa no salvar", () => {
    const antiga = rule("+55 61 9408-0173"); // celular sem o 9

    const leitura = automationReadSchema.safeParse(antiga);
    expect(leitura.success).toBe(true);
    expect(leitura.success && leitura.data.actions[0]).toMatchObject({ type: "send_whatsapp" });

    const gravacao = automationSchema.safeParse(antiga);
    expect(gravacao.success).toBe(false);
    expect(gravacao.success === false && gravacao.error.issues[0]?.message).toContain("Faltou o 9");
  });

  it("com o número corrigido, salva", () => {
    expect(automationSchema.safeParse(rule("61 99408-0173")).success).toBe(true);
  });

  it("estrutura realmente quebrada continua sendo recusada nas duas", () => {
    const quebrada = { ...rule("61999990000"), actions: [{ type: "acao_que_nao_existe" }] };
    expect(automationReadSchema.safeParse(quebrada).success).toBe(false);
    expect(automationSchema.safeParse(quebrada).success).toBe(false);
  });
});
