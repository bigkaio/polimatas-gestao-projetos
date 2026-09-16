import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";
import type { Actor } from "@/core/events";
import { invalidatePermissionCache } from "@/core/permission-store";

/**
 * Usuários de teste com papel garantido.
 *
 * Os testes NÃO podem depender dos papéis dos usuários de demonstração: quem
 * usa o sistema promove, rebaixa e desativa pessoas, e a suíte passaria a
 * falhar por causa de dado, não de código. Cada papel ganha aqui uma conta
 * própria, criada sob demanda e sempre no estado esperado.
 */
export async function actorWithRole(role: Role): Promise<Actor> {
  const email = `teste.${role}@polimatas.test`;
  const user = await prisma.profile.upsert({
    where: { email },
    update: { role, deactivatedAt: null },
    create: {
      email,
      name: `Teste ${role}`,
      role,
      // hash fixo e inválido para login: estas contas não entram pela tela
      passwordHash: "$2a$10$testeteste.testeteste.testeteste.testeteste.testetes",
    },
  });
  await prisma.userPermission.deleteMany({ where: { userId: user.id } });
  invalidatePermissionCache(user.id);
  return { id: user.id, role };
}

/** Remove as contas de teste e tudo que dependa delas. */
export async function cleanupTestUsers(): Promise<void> {
  const users = await prisma.profile.findMany({
    where: { email: { endsWith: "@polimatas.test" } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.comment.deleteMany({ where: { authorId: { in: ids } } });
  await prisma.card.deleteMany({ where: { createdBy: { in: ids } } });
  await prisma.card.updateMany({ where: { assigneeId: { in: ids } }, data: { assigneeId: null } });
  await prisma.task.updateMany({ where: { assigneeId: { in: ids } }, data: { assigneeId: null } });
  await prisma.profile.deleteMany({ where: { id: { in: ids } } });
  invalidatePermissionCache();
}
