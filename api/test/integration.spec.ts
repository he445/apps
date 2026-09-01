import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe, HttpStatus } from '@nestjs/common';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const PORT = 3000;
const API_BASE = `http://127.0.0.1:${PORT}/api/v1`;

// A suíte exercita os endpoints de sandbox, que agora exigem liberação explícita
// (antes bastava NODE_ENV não ser "production"). Precisa ser definido antes de
// importar/instanciar o AppModule, cuja validação de ambiente roda no arranque.
process.env.ENABLE_SANDBOX_ADMIN = 'true';

async function runIntegrationSuite() {
  console.log('🚀 Executando Suíte de Testes de Integração End-to-End Ojanuan...\n');

  const app = await NestFactory.create(AppModule, { logger: false });
  const prisma = new PrismaClient();
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      stopAtFirstError: true,
      errorHttpStatusCode: HttpStatus.BAD_REQUEST,
    })
  );

  await app.listen(PORT);
  console.log(`✅ Servidor NestJS de testes iniciado em ${API_BASE}\n`);

  let passCount = 0;
  let failCount = 0;

  async function testStep(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`✅ [OK] ${name}`);
      passCount++;
    } catch (err: any) {
      console.error(`❌ [ERRO] ${name}:`, err.message);
      failCount++;
    }
  }

  try {
    // 1. Healthcheck
    await testStep('GET /health (Health Check)', async () => {
      const res = await fetch(`${API_BASE}/health`);
      const data: any = await res.json();
      if (res.status !== 200 || data.status !== 'ok') throw new Error(`Status ${res.status}`);
    });

    const timestamp = Date.now();
    const proEmail = `pro-suite-${timestamp}@ojanuan.app`;
    const patEmail = `pat-suite-${timestamp}@ojanuan.app`;
    const password = 'Password123!';

    let proAuthToken = '';
    let proId = '';
    let patAuthToken = '';
    let patId = '';
    let inviteCode = '';
    let consultationId = '';

    // 2. Register Psicólogo
    await testStep('POST /auth/register (Profissional)', async () => {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Dra. Helena Teste',
          email: proEmail,
          password,
          role: 'PROFESSIONAL',
          crp: '06/123456',
        }),
      });
      const data: any = await res.json();
      if (res.status !== 201 || !data.token) throw new Error(`Status ${res.status}`);
      proAuthToken = data.token;
      proId = data.user.id;
    });

    // 3. Login Psicólogo
    await testStep('POST /auth/login (Profissional HTTP 200)', async () => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: proEmail, password }),
      });
      const data: any = await res.json();
      if (res.status !== 200 || !data.accessToken) throw new Error(`Status ${res.status}`);
    });

    // 4. Perfil Psicólogo
    await testStep('PUT /users/profile (Atualizar Chave PIX)', async () => {
      const res = await fetch(`${API_BASE}/users/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${proAuthToken}` },
        body: JSON.stringify({
          fullName: 'Dra. Helena Teste',
          pixKey: 'helena@pix.me',
          sessionPrice: 200,
          cancelLimitHours: 24,
        }),
      });
      const data: any = await res.json();
      if (res.status !== 200 || data.user.pixKey !== 'helena@pix.me') throw new Error(`Status ${res.status}`);
    });

    // 5. Convites
    await testStep('POST /care/professional/invitations (Gerar Convite)', async () => {
      const res = await fetch(`${API_BASE}/care/professional/invitations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${proAuthToken}` },
      });
      const data: any = await res.json();
      if (res.status !== 201 || !data.inviteCode) throw new Error(`Status ${res.status}`);
      inviteCode = data.inviteCode;
    });

    // 6. Preview Convite
    await testStep('GET /auth/invitations/:token (Pré-visualização)', async () => {
      const res = await fetch(`${API_BASE}/auth/invitations/${inviteCode}`);
      const data: any = await res.json();
      if (res.status !== 200 || data.professionalName !== 'Dra. Helena Teste') throw new Error(`Status ${res.status}`);
    });

    // 7. Register Paciente com Convite
    await testStep('POST /auth/register (Paciente Vinculado)', async () => {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Paciente Teste',
          email: patEmail,
          password,
          role: 'PATIENT',
          cpf: '123.456.789-00',
          inviteToken: inviteCode,
        }),
      });
      const data: any = await res.json();
      if (res.status !== 201 || !data.token) throw new Error(`Status ${res.status}`);
      patAuthToken = data.token;
      patId = data.user.id;
    });

    // 8. Painel Paciente
    await testStep('GET /care/patient/dashboard (Carregar Dados)', async () => {
      const res = await fetch(`${API_BASE}/care/patient/dashboard`, {
        headers: { Authorization: `Bearer ${patAuthToken}` },
      });
      const data: any = await res.json();
      if (res.status !== 200 || data.psychologistName !== 'Dra. Helena Teste') throw new Error(`Status ${res.status}`);
    });

    // 9. Autoavaliação de Humor
    await testStep('POST /assessments (Registrar Humor)', async () => {
      const res = await fetch(`${API_BASE}/assessments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${patAuthToken}` },
        body: JSON.stringify({
          humor_geral: 4,
          qualidade_sono: 5,
          nivel_energia: 4,
          nivel_ansiedade: 2,
          interacao_social: true,
          nota: 'Ótimo dia de acompanhamento',
        }),
      });
      const data: any = await res.json();
      if (res.status !== 201 || !data.id) throw new Error(`Status ${res.status}`);
    });

    // 10. Listar Histórico de Humor
    await testStep('GET /assessments/:patientId (Histórico)', async () => {
      const res = await fetch(`${API_BASE}/assessments/${patId}`, {
        headers: { Authorization: `Bearer ${patAuthToken}` },
      });
      const data: any = await res.json();
      if (res.status !== 200 || data.length === 0) throw new Error(`Status ${res.status}`);
    });

    // 11. Orientações Terapêuticas
    await testStep('POST /guidelines/:patientId (Cadastrar Orientação)', async () => {
      const res = await fetch(`${API_BASE}/guidelines/${patId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${proAuthToken}` },
        body: JSON.stringify({ text: 'Praticar 10 minutos de respiração diafragmática.' }),
      });
      const data: any = await res.json();
      if (res.status !== 201 || !data.id) throw new Error(`Status ${res.status}`);
    });

    // 12. Agendar Consulta
    await testStep('POST /consultations (Agendamento)', async () => {
      const res = await fetch(`${API_BASE}/consultations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${proAuthToken}` },
        body: JSON.stringify({
          patientId: patId,
          dateTime: new Date(Date.now() + 86400000).toISOString(),
          sessionPrice: '200.00',
          billingType: 'PER_SESSION',
        }),
      });
      const data: any = await res.json();
      if (res.status !== 201 || !data.id) throw new Error(`Status ${res.status}`);
      consultationId = data.id;
    });

    // 13. Confirmar Pagamento
    await testStep('PATCH /consultations/:id/payment (Confirmar PIX)', async () => {
      const res = await fetch(`${API_BASE}/consultations/${consultationId}/payment`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${proAuthToken}` },
      });
      const data: any = await res.json();
      if (res.status !== 200 || data.paymentStatus !== 'PAID') throw new Error(`Status ${res.status}`);
    });

    // 14. Chat Envio
    await testStep('POST /chat/messages (Enviar Mensagem)', async () => {
      const res = await fetch(`${API_BASE}/chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${patAuthToken}` },
        body: JSON.stringify({ receiverId: proId, messageText: 'Olá Dra, mensagem de teste.' }),
      });
      const data: any = await res.json();
      if (res.status !== 201 || !data.id) throw new Error(`Status ${res.status}`);
    });

    // 15. Chat Unread Count
    await testStep('GET /chat/messages/unread (Verificar Não Lidas)', async () => {
      const res = await fetch(`${API_BASE}/chat/messages/unread`, {
        headers: { Authorization: `Bearer ${proAuthToken}` },
      });
      const data: any = await res.json();
      if (res.status !== 200 || data.count < 1) throw new Error(`Status ${res.status}`);
    });

    // 16. Chat Sync
    await testStep('GET /chat/messages/sync (Sincronização Polling)', async () => {
      const res = await fetch(`${API_BASE}/chat/messages/sync?partnerId=${patId}`, {
        headers: { Authorization: `Bearer ${proAuthToken}` },
      });
      const data: any = await res.json();
      if (res.status !== 200 || data.length === 0) throw new Error(`Status ${res.status}`);
    });

    // 17. Relatório Carnê-Leão
    await testStep('GET /reports/export (Relatório Contábil)', async () => {
      const month = new Date().getMonth() + 1;
      const year = new Date().getFullYear();
      const res = await fetch(`${API_BASE}/reports/export?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${proAuthToken}` },
      });
      const data: any = await res.json();
      if (res.status !== 200 || !Array.isArray(data)) throw new Error(`Status ${res.status}`);
    });

    // 18. Soft-Delete LGPD
    await testStep('DELETE /users/me (Exclusão de Conta LGPD)', async () => {
      const res = await fetch(`${API_BASE}/users/me`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${patAuthToken}` },
        body: JSON.stringify({ password }),
      });
      const data: any = await res.json();
      if (res.status !== 200 || !data.deleted) throw new Error(`Status ${res.status}`);
    });

    // --- ADMIN MODULE & TELEMETRY SUITE ---
    const adminEmail = `admin-suite-${timestamp}@ojanuan.app`;
    let adminAuthToken = '';
    let demoProId = '';

    // 19. Public admin registration must be denied
    await testStep('POST /auth/register (ADMIN bloqueado)', async () => {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Administrador de Sistema',
          email: adminEmail,
          password,
          role: 'ADMIN',
        }),
      });
      if (res.status !== 403) throw new Error(`Esperado 403, recebido ${res.status}`);
    });

    // 20. Provision the test administrator outside the public HTTP surface.
    await testStep('Provisionar ADMIN para a suíte', async () => {
      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.upsert({
        where: { email: adminEmail },
        update: { role: Role.ADMIN, password: passwordHash, isDeleted: false },
        create: {
          fullName: 'Administrador de Sistema',
          email: adminEmail,
          password: passwordHash,
          role: Role.ADMIN,
        },
      });
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password }),
      });
      const data: any = await res.json();
      if (res.status !== 200 || !data.token) throw new Error(`Status ${res.status}`);
      adminAuthToken = data.token;
    });

    // 20. Admin Route Guard (Bloqueio para usuários normais)
    await testStep('GET /admin/overview (403 Forbidden para Profissional comum)', async () => {
      const res = await fetch(`${API_BASE}/admin/overview`, {
        headers: { Authorization: `Bearer ${proAuthToken}` },
      });
      if (res.status !== 403) throw new Error(`Esperado 403, recebido ${res.status}`);
    });

    // 21. Admin Overview (Acesso com Admin)
    await testStep('GET /admin/overview (Métricas e KPIs)', async () => {
      const res = await fetch(`${API_BASE}/admin/overview`, {
        headers: { Authorization: `Bearer ${adminAuthToken}` },
      });
      const data: any = await res.json();
      if (res.status !== 200 || !data.kpis || typeof data.kpis.totalUsers !== 'number') {
        throw new Error(`Status ${res.status} ou payload inválido`);
      }
    });

    // 22. Telemetria de Rotas
    await testStep('GET /admin/telemetry/routes (Observabilidade & Latência)', async () => {
      const res = await fetch(`${API_BASE}/admin/telemetry/routes`, {
        headers: { Authorization: `Bearer ${adminAuthToken}` },
      });
      const data: any = await res.json();
      if (res.status !== 200 || !Array.isArray(data.routes)) throw new Error(`Status ${res.status}`);
    });

    // 23. Sandbox Seed (Criação de Personas Demo)
    await testStep('POST /admin/sandbox/seed (Gerar Massa de Teste 1-Clique)', async () => {
      const res = await fetch(`${API_BASE}/admin/sandbox/seed`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminAuthToken}` },
      });
      const data: any = await res.json();
      if (res.status !== 201 && res.status !== 200) throw new Error(`Status ${res.status}`);
      if (!data.testUsers?.professional?.id) throw new Error('ID do profissional demo ausente');
      demoProId = data.testUsers.professional.id;
    });

    // 24. Actor Token Impersonation (RFC 8693)
    let impersonatedToken = '';
    await testStep('POST /admin/impersonate/:id (Geração de Actor Token Seguro)', async () => {
      const res = await fetch(`${API_BASE}/admin/impersonate/${demoProId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminAuthToken}` },
      });
      const data: any = await res.json();
      if (res.status !== 201 && res.status !== 200) throw new Error(`Status ${res.status}`);
      if (!data.token || !data.user.isImpersonated) throw new Error('Token de simulação inválido');
      impersonatedToken = data.token;
    });

    // 25. Impersonation Guardrail (Bloqueio de ação destrutiva na simulação)
    await testStep('DELETE /users/me (Guardrail: Bloqueio 403 durante simulação)', async () => {
      const res = await fetch(`${API_BASE}/users/me`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${impersonatedToken}` },
        body: JSON.stringify({ password: 'Demo1234!' }),
      });
      if (res.status !== 403) throw new Error(`Esperado 403 para Guardrail, recebido ${res.status}`);
    });

    // 26. Limpeza Segura da Sandbox
    await testStep('DELETE /admin/sandbox/clean (Limpeza Blindada de Testes)', async () => {
      const res = await fetch(`${API_BASE}/admin/sandbox/clean`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminAuthToken}` },
      });
      const data: any = await res.json();
      if (res.status !== 200 || typeof data.count !== 'number') throw new Error(`Status ${res.status}`);
    });

    console.log(`\n🏁 Resultado Final dos Testes E2E: ${passCount} SUCESSOS, ${failCount} FALHAS.\n`);
    if (failCount > 0) {
      throw new Error(`A suíte finalizou com ${failCount} falhas.`);
    }
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

runIntegrationSuite().catch((e) => {
  console.error('Erro fatal nos testes:', e);
  process.exit(1);
});
