-- Permissões deixam de ser por papel e passam a ser por pessoa.
-- A ordem importa: cria a tabela nova, transporta o que já existia e só então
-- descarta a antiga — assim nenhum ajuste feito pelo admin se perde.

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_user_id_capability_key" ON "user_permissions"("user_id", "capability");

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Transporta cada ajuste de papel para todas as pessoas daquele papel, para
-- que o efeito prático continue idêntico ao do dia anterior à mudança.
INSERT INTO "user_permissions" ("id", "user_id", "capability", "allowed", "updated_at", "updated_by")
SELECT gen_random_uuid(), p."id", rp."capability", rp."allowed", now(), rp."updated_by"
FROM "role_permissions" rp
JOIN "profiles" p ON p."role" = rp."role"
ON CONFLICT ("user_id", "capability") DO NOTHING;

-- DropTable
DROP TABLE "role_permissions";
