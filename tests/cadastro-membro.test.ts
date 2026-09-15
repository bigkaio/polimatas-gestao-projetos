import { afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createMemberAccount, generateTemporaryPassword } from "@/lib/auth";

/**
 * Cadastro de membro pelo admin: senha temporária gerada, guardada só como
 * hash, e troca obrigatória no primeiro acesso.
 */

const EMAIL = "novo.membro.teste@polimatas.dev";

afterAll(async () => {
  await prisma.profile.deleteMany({ where: { email: EMAIL } });
});

describe("cadastro de membro pelo admin", () => {
  it("gera senha temporária legível, sem caracteres ambíguos", () => {
    const passwords = Array.from({ length: 50 }, () => generateTemporaryPassword());
    for (const p of passwords) {
      expect(p).toHaveLength(12);
      expect(p).not.toMatch(/[0O1lI]/);
    }
    expect(new Set(passwords).size).toBe(50);
  });

  it("cria a conta com o papel escolhido e trava de troca de senha", async () => {
    const result = await createMemberAccount("Novo Membro", ` ${EMAIL.toUpperCase()} `, "manager");
    if ("error" in result) throw new Error(result.error);

    expect(result.user.email).toBe(EMAIL);
    expect(result.user.role).toBe("manager");
    expect(result.user.mustChangePassword).toBe(true);

    // a senha nunca é guardada em texto — só o hash, que confere com a temporária
    expect(result.user.passwordHash).not.toContain(result.temporaryPassword);
    expect(await bcrypt.compare(result.temporaryPassword, result.user.passwordHash)).toBe(true);
  });

  it("recusa e-mail já cadastrado", async () => {
    const again = await createMemberAccount("Outro", EMAIL, "member");
    expect(again).toEqual({ error: "Já existe uma conta com este e-mail." });
  });

  it("contas antigas e de auto-cadastro não ficam presas na troca de senha", async () => {
    const admin = await prisma.profile.findUniqueOrThrow({ where: { email: "admin@polimatas.dev" } });
    expect(admin.mustChangePassword).toBe(false);
  });
});
