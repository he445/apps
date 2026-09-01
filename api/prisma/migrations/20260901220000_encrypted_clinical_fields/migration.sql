-- Criptografia de campos clínicos — Release A (expand).
--
-- Puramente aditiva: adiciona colunas nullable ao lado das existentes e afrouxa
-- NOT NULL nas colunas de texto claro. Nenhum dado é apagado aqui. As colunas em
-- texto claro só serão removidas na Release B, depois do backfill confirmado.
--
-- Aplicável com a aplicação no ar: código antigo continua lendo messageText/text,
-- código novo prefere encryptedText quando textKeyVersion estiver preenchida.

ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "encryptedText" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "textKeyVersion" INTEGER;
ALTER TABLE "ChatMessage" ALTER COLUMN "messageText" DROP NOT NULL;

ALTER TABLE "SelfAssessment" ADD COLUMN IF NOT EXISTS "encryptedNote" TEXT;
ALTER TABLE "SelfAssessment" ADD COLUMN IF NOT EXISTS "noteKeyVersion" INTEGER;

ALTER TABLE "Guideline" ADD COLUMN IF NOT EXISTS "encryptedText" TEXT;
ALTER TABLE "Guideline" ADD COLUMN IF NOT EXISTS "textKeyVersion" INTEGER;
ALTER TABLE "Guideline" ALTER COLUMN "text" DROP NOT NULL;
