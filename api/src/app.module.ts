import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma.service';
import { JwtAuthGuard, Public } from './common/auth';
import { TelemetryInterceptor } from './common/telemetry.interceptor';
import { AuthModule } from './auth/auth.module';
import { InvitationsModule } from './invitations/invitations.module';
import { CareModule } from './care/care.module';
import { UsersModule } from './users/users.module';
import { AdminModule } from './admin/admin.module';

@Controller('health')
class HealthController { @Public() @Get() health() { return { status: 'ok', service: 'ojanuan-api' }; } }

const jwtSecret = process.env.JWT_SECRET?.trim();
if (!jwtSecret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET deve ser definido em produção.');
}
if (!jwtSecret) {
  console.warn('JWT_SECRET não definido; usando fallback de desenvolvimento.');
} else if (jwtSecret.length < 32) {
  // Mantém compatibilidade com a chave já provisionada. A rotação para 32+ caracteres
  // é obrigatória no próximo ciclo operacional e está documentada no checklist.
  console.warn('JWT_SECRET tem menos de 32 caracteres; agende a rotação para uma chave mais longa.');
}

const jwtIssuer = 'ojanuan-api';
const jwtAudience = 'ojanuan-web';

@Module({
  imports: [
    PrismaModule,
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 60,
    }]),
    JwtModule.register({
      global: true,
      secret: jwtSecret ?? 'development-only-secret',
      signOptions: { expiresIn: '8h', issuer: jwtIssuer, audience: jwtAudience },
    }),
    AuthModule,
    InvitationsModule,
    CareModule,
    UsersModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: TelemetryInterceptor },
  ],
})
export class AppModule {}
