-- Índices de performance. Migration puramente aditiva: nenhum DROP, nenhum
-- ALTER TYPE, nenhuma coluna alterada. Pode ser aplicada com a aplicação no ar.

-- unreadCount() conta por (receiverId, isRead) a cada 12s por aba aberta.
-- O índice existente lidera por senderId e não atende esse predicado, então
-- cada contagem varria ChatMessage inteira.
CREATE INDEX IF NOT EXISTS "ChatMessage_receiverId_isRead_idx"
  ON "ChatMessage"("receiverId", "isRead");

-- Guideline não tinha índice algum; o mural do paciente varria a tabela.
CREATE INDEX IF NOT EXISTS "Guideline_patientId_createdAt_idx"
  ON "Guideline"("patientId", "createdAt");

-- ProfessionalPatient.patientId já é UNIQUE (indexado), mas a busca pelo
-- profissional — usada no dashboard e no AccessService — não tinha suporte.
CREATE INDEX IF NOT EXISTS "ProfessionalPatient_professionalId_idx"
  ON "ProfessionalPatient"("professionalId");
