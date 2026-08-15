-- Segurança e compatibilidade: alterações exclusivamente aditivas ou de ampliação.
-- Pode ser aplicada sem excluir dados nem invalidar sessões já emitidas.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ADMIN';

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "isTestUser" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "SelfAssessment"
  ADD COLUMN IF NOT EXISTS "energyScore" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "socialInteraction" BOOLEAN NOT NULL DEFAULT true;

-- Convites novos usam tokens URL-safe de 256 bits. Códigos existentes de seis
-- caracteres continuam armazenáveis e válidos até sua expiração atual.
ALTER TABLE "PatientInvitation"
  ALTER COLUMN "token" TYPE VARCHAR(64);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "targetId" TEXT,
  "action" VARCHAR(100) NOT NULL,
  "details" TEXT,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_actorId_createdAt_idx"
  ON "AuditLog"("actorId", "createdAt");
