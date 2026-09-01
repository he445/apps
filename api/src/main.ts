import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { validateEnv } from './common/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // O ConfigModule já carregou o .env durante a criação do app; validateEnv é puro
  // e devolve os mesmos valores validados, agora tipados, para uso no bootstrap.
  const env = validateEnv();
  const requestedPort = env.port;
  const isProd = env.isProd;

  app.getHttpAdapter().getInstance().set('trust proxy', isProd ? 1 : false);
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
  }));
  app.setGlobalPrefix('api/v1');

  // CORS por lista branca estrita. As origens de produção vêm exclusivamente de
  // WEB_ORIGIN (canônica) e CORS_ORIGINS (extras); as de desenvolvimento só entram fora de
  // produção. Não há coringa: um preview novo é adicionado ao WEB_ORIGIN, não
  // liberado por padrão de domínio — qualquer pessoa pode publicar em *.vercel.app.
  const devOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];
  const allowedOrigins = new Set([...env.corsOrigins, ...(env.isProd ? [] : devOrigins)]);

  app.enableCors({
    origin: (origin, callback) => {
      // Clientes não-browser (health checks, server-to-server, mobile) não enviam Origin
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
void bootstrap();
