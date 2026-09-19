-- Título da orientação terapêutica.
--
-- O formulário do psicólogo já exigia um título, mas ele nunca era enviado nem
-- armazenado: o mural do paciente exibia o literal "Orientação recebida" em toda
-- orientação. Coluna nova e cifrada — não existe dado legado em texto claro aqui,
-- então não há fase de convivência como em `text`/`encryptedText`.
--
-- Puramente aditiva: colunas nullable, aplicável com a aplicação no ar.

ALTER TABLE "Guideline" ADD COLUMN IF NOT EXISTS "encryptedTitle" TEXT;
ALTER TABLE "Guideline" ADD COLUMN IF NOT EXISTS "titleKeyVersion" INTEGER;
