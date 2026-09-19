/**
 * Aplica as migrations pendentes antes de a API subir.
 *
 * Nenhuma etapa do deploy aplicava migration: o banco de produção ficou defasado em
 * relação ao schema e o código passou a consultar colunas inexistentes — chat,
 * autoavaliação, orientações e o painel do paciente respondiam 500.
 *
 * O banco foi criado com `prisma db push`, então não existe a tabela de histórico
 * `_prisma_migrations` e `migrate deploy` aborta com P3005 sem aplicar nada. Nesse
 * caso marcamos apenas a migration inicial como aplicada: ela é a única não
 * idempotente (CREATE TYPE/TABLE sem IF NOT EXISTS) e, se a tabela User existe, já
 * está no banco por definição. As demais são aditivas e guardadas por IF NOT EXISTS,
 * então podem ser aplicadas mesmo que parte já esteja presente.
 */

const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const INITIAL_MIGRATION = '20260721220112_v1';
const API_ROOT = path.join(__dirname, '..');
const PRISMA_CLI = require.resolve('prisma/build/index.js');

function runPrisma(args) {
  execFileSync(process.execPath, [PRISMA_CLI, ...args], { stdio: 'inherit', cwd: API_ROOT });
}

async function needsBaseline() {
  const prisma = new PrismaClient();
  try {
    const [{ history, users }] = await prisma.$queryRaw`
      SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS history,
             to_regclass('public."User"') IS NOT NULL AS users`;
    if (!users) return false; // banco vazio: migrate deploy cria tudo do zero
    if (!history) return true;

    const [{ applied }] = await prisma.$queryRaw`
      SELECT count(*)::int AS applied FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`;
    return applied === 0;
  } finally {
    await prisma.$disconnect();
  }
}

needsBaseline()
  .then((baseline) => {
    if (baseline) {
      console.log(`[deploy] banco sem histórico de migrations: marcando ${INITIAL_MIGRATION} como aplicada.`);
      runPrisma(['migrate', 'resolve', '--applied', INITIAL_MIGRATION]);
    }
    runPrisma(['migrate', 'deploy']);
  })
  .catch((error) => {
    console.error('[deploy] falha ao aplicar migrations:', error.message);
    process.exit(1);
  });
