import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { validateEnv } from './common/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // ConfigModule already loaded .env while creating the app; validateEnv is pure
  // e devolve os mesmos valores validados, agora tipados, para uso no bootstrap.
  const env = validateEnv();
  const requestedPort = env.port;
  const isProd = env.isProd;

  // Render sends SIGTERM when hibernating or redeploying. Without this Nest never
  // listens for the signal, onModuleDestroy never runs, and database connections hang
  // until Postgres times them out — a real cost on Neon's free tier.
  app.enableShutdownHooks();

  app.getHttpAdapter().getInstance().set('trust proxy', isProd ? 1 : false);
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
  }));
  app.setGlobalPrefix('api/v1');

  // Strict CORS allowlist. Production origins come only from WEB_ORIGIN (canonical)
  // and CORS_ORIGINS (extras); development ones are added outside production only.
  // No wildcard: a new preview is added to WEB_ORIGIN rather than allowed by domain
  // pattern — anyone can publish to *.vercel.app.
  const devOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];
  const allowedOrigins = new Set([...env.corsOrigins, ...(env.isProd ? [] : devOrigins)]);

  app.enableCors({
    origin: (origin, callback) => {
      // Non-browser clients (health checks, server-to-server, mobile) send no Origin
      if (!origin) return callback(null, true);

      return callback(null, allowedOrigins.has(origin.replace(/\/$/, '')));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Authorization'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: false }, stopAtFirstError: true, errorHttpStatusCode: HttpStatus.BAD_REQUEST }));

  // ─── Swagger / OpenAPI (Apenas em ambiente de dev/staging) ────────────────
  if (!isProd) {
    const config = new DocumentBuilder()
      .setTitle('Ojanuan API')
      .setDescription(
        '**API REST** do sistema de gestão terapêutica Ojanuan.\n\n' +
        'Para testar endpoints protegidos:\n' +
        '1. Use `POST /api/v1/auth/login` para obter um `accessToken`.\n' +
        '2. Clique no botão **Authorize 🔒** e insira: `Bearer SEU_TOKEN`.\n' +
        '3. Todos os endpoints autenticados ficarão disponíveis.'
      )
      .setVersion('1.0')
      .setContact('Ojanuan', '', 'contato@ojanuan.app')
      .setLicense('Privado', '')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'JWT-auth',
      )
      .addServer(`http://localhost:${process.env.PORT ?? 3000}`, 'Desenvolvimento local')
      .addTag('auth', 'Registro, login e visualização de convites')
      .addTag('invitations', 'Criação e gestão de convites de pacientes')
      .addTag('consultations', 'Agendamento e histórico de consultas')
      .addTag('assessments', 'Autoavaliações de bem-estar dos pacientes')
      .addTag('guidelines', 'Orientações do psicólogo para o paciente')
      .addTag('chat', 'Mensagens do canal terapêutico')
      .addTag('reports', 'Relatórios financeiros e Carnê-Leão')
      .addTag('users', 'Gestão de perfil e conta')
      .addTag('health', 'Health check da API')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
        filter: true,
        showRequestDuration: true,
        tryItOutEnabled: true,
      },
      customSiteTitle: 'Ojanuan API Docs',
      customCss: `
        .swagger-ui .topbar { background: #C16E59; }
        .swagger-ui .topbar-wrapper .link { display: none; }
        .swagger-ui .topbar-wrapper::before {
          content: '🌿 Ojanuan API';
          color: white;
          font-size: 1.4rem;
          font-weight: bold;
          padding: 0 1rem;
        }
      `,
    });
  }
  // ─────────────────────────────────────────────────────────────────────────

  const candidatePorts = [requestedPort, requestedPort + 1, requestedPort + 2, requestedPort + 3, requestedPort + 4, requestedPort + 5];

  for (const port of candidatePorts) {
    try {
      await app.listen(port);
      console.log(`\n🚀 API rodando em:    http://localhost:${port}`);
      console.log(`📖 Swagger Docs em:   http://localhost:${port}/docs\n`);
      return;
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EADDRINUSE')) {
        throw error;
      }
      if (port !== candidatePorts[candidatePorts.length - 1]) {
        console.warn(`⚠️ Porta ${port} ocupada. Tentando usar ${port + 1}...`);
      }
    }
  }

  throw new Error(`Não foi possível iniciar a API: nenhuma porta disponível entre ${candidatePorts[0]} e ${candidatePorts[candidatePorts.length - 1]}.`);
}
// Without these handlers an unhandled rejection killed the process leaving no trace
// in Render's log, turning a diagnosable failure into a silent restart.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason instanceof Error ? reason.stack : reason);
});
process.on('uncaughtException', (error) => {
  console.error('[uncaughtException]', error.stack ?? error);
  // Process state is undefined after an uncaught exception: exiting lets the
  // Render reiniciar num estado limpo, em vez de seguir servindo de forma incerta.
  process.exit(1);
});

bootstrap().catch((error) => {
  console.error('[bootstrap] Falha ao iniciar a API:', error instanceof Error ? error.message : error);
  process.exit(1);
});
