-- Consentimento LGPD e persistência da telemetria de erros.
--
-- Consentimento: conteúdo clínico é dado pessoal sensível (LGPD art. 11) e exige base
-- legal específica. Registramos QUANDO o titular consentiu e a QUAL versão do texto,
-- para que uma mudança futura da política possa exigir novo aceite.
-- As colunas são nullable de propósito: contas criadas antes disto não consentiram, e
-- um aceite retroativo seria fabricado. Elas pedem o aceite no próximo acesso.
--
-- ErrorLog: a telemetria vivia só em memória e zerava a cada restart do Render —
-- justamente o que se quer ler durante o beta.
--
-- Puramente aditiva e idempotente: prisma/deploy.js pode reaplicá-la sobre um banco
-- parcialmente sincronizado.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "consentedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "consentVersion" VARCHAR(20);

CREATE TABLE IF NOT EXISTS "ErrorLog" (
  "id" TEXT NOT NULL,
  "method" VARCHAR(10) NOT NULL,
  "path" VARCHAR(300) NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "message" TEXT NOT NULL,
  "userId" TEXT,
  "userRole" VARCHAR(20),
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- O painel lê sempre os mais recentes e poda os antigos: ambos varrem por data.
CREATE INDEX IF NOT EXISTS "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt");
