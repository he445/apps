import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe, HttpStatus } from '@nestjs/common';

const PORT = 3000;
const API_BASE = `http://127.0.0.1:${PORT}/api/v1`;

async function runIntegrationSuite() {
  console.log('🚀 Executando Suíte de Testes de Integração End-to-End Ojanuan...\n');

  const app = await NestFactory.create(AppModule, { logger: false });
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

    console.log(`\n🏁 Resultado Final dos Testes E2E: ${passCount} SUCESSOS, ${failCount} FALHAS.\n`);
  } finally {
    await app.close();
  }
}

runIntegrationSuite().catch((e) => console.error('Erro fatal nos testes:', e));
