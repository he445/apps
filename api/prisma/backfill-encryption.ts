/**
 * Backfill de criptografia — passo 2 da transição.
 *
 * Cifra as linhas que ainda estão em texto claro (keyVersion nula) nos três
 * campos clínicos. Idempotente: rodar de novo não faz nada, porque só seleciona
 * linhas com versão de chave ausente.
 *
 * Rode DEPOIS de a Release A estar no ar (escrita dupla) e ANTES da Release B
 * (que remove as colunas em texto claro).
 *
 *   cd api && APP_ENCRYPTION_KEY="..." DATABASE_URL="..." npx ts-node prisma/backfill-encryption.ts
 *
 * Processa em lotes para não segurar uma transação longa contra o Neon.
 */

import { PrismaClient } from '@prisma/client';
import { EncryptionService } from '../src/common/encryption.service';

const BATCH = 200;
const prisma = new PrismaClient();
const crypto = new EncryptionService();

async function backfillChat() {
  let total = 0;
  for (;;) {
    const rows = await prisma.chatMessage.findMany({
      where: { textKeyVersion: null, messageText: { not: null } },
      select: { id: true, messageText: true },
      take: BATCH,
    });
    if (rows.length === 0) break;
    await prisma.$transaction(
      rows.map((row) =>
        prisma.chatMessage.update({
          where: { id: row.id },
          data: {
            encryptedText: crypto.encrypt(row.messageText as string),
            textKeyVersion: crypto.activeVersion,
          },
        }),
      ),
    );
    total += rows.length;
    console.log(`  ChatMessage: ${total} cifradas...`);
  }
  return total;
}

async function backfillAssessments() {
  let total = 0;
  for (;;) {
    const rows = await prisma.selfAssessment.findMany({
      where: { noteKeyVersion: null, quickNote: { not: null } },
      select: { id: true, quickNote: true },
      take: BATCH,
    });
    if (rows.length === 0) break;
    await prisma.$transaction(
      rows.map((row) =>
        prisma.selfAssessment.update({
          where: { id: row.id },
          data: {
            encryptedNote: crypto.encrypt(row.quickNote as string),
            noteKeyVersion: crypto.activeVersion,
          },
        }),
      ),
    );
    total += rows.length;
    console.log(`  SelfAssessment: ${total} cifradas...`);
  }
  return total;
}

async function backfillGuidelines() {
  let total = 0;
  for (;;) {
    const rows = await prisma.guideline.findMany({
      where: { textKeyVersion: null, text: { not: null } },
      select: { id: true, text: true },
      take: BATCH,
    });
    if (rows.length === 0) break;
    await prisma.$transaction(
      rows.map((row) =>
        prisma.guideline.update({
          where: { id: row.id },
          data: {
            encryptedText: crypto.encrypt(row.text as string),
            textKeyVersion: crypto.activeVersion,
          },
        }),
      ),
    );
    total += rows.length;
    console.log(`  Guideline: ${total} cifradas...`);
  }
  return total;
}

async function main() {
  console.log(`🔐 Backfill com a chave versão ${crypto.activeVersion}\n`);

  const chat = await backfillChat();
  const assessments = await backfillAssessments();
  const guidelines = await backfillGuidelines();

  console.log('\n── Resultado ──');
  console.log(`  Mensagens de chat : ${chat}`);
  console.log(`  Notas de diário   : ${assessments}`);
  console.log(`  Orientações       : ${guidelines}`);

  // Conferência: nada pode sobrar em texto claro sem versão de chave.
  const [chatLeft, assessLeft, guideLeft] = await Promise.all([
    prisma.chatMessage.count({ where: { textKeyVersion: null, messageText: { not: null } } }),
    prisma.selfAssessment.count({ where: { noteKeyVersion: null, quickNote: { not: null } } }),
    prisma.guideline.count({ where: { textKeyVersion: null, text: { not: null } } }),
  ]);
  const pendentes = chatLeft + assessLeft + guideLeft;
  console.log(`\n  Pendentes: ${pendentes}`);

  if (pendentes > 0) {
    throw new Error(`${pendentes} registro(s) ainda em texto claro — NÃO prossiga para a Release B.`);
  }
  console.log('  ✅ Tudo cifrado. Seguro prosseguir para a Release B.');
}

main()
  .catch((error) => {
    console.error('❌ Backfill falhou:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
