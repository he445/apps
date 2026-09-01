import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { validateEnv } from './common/env';
import { PrismaModule } from './common/prisma.service';
import { EncryptionModule } from './common/encryption.service';
import { JwtAuthGuard, Public } from './common/auth';
import { TelemetryInterceptor } from './common/telemetry.interceptor';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { AuthModule } from './auth/auth.module';
import { InvitationsModule } from './invitations/invitations.module';
import { CareModule } from './care/care.module';
import { UsersModule } from './users/users.module';
import { AdminModule } from './admin/admin.module';

@Controller('health')
class HealthController { @Public() @Get() health() { return { status: 'ok', service: 'ojanuan-api' }; } }

const jwtIssuer = 'ojanuan-api';
const jwtAudience = 'ojanuan-web';

@Module({
  imports: [
    // Carrega api/.env e valida tudo no arranque. Sem isto, process.env.JWT_SECRET
    // ficava indefinido fora de produção e o token era assinado com um segredo fixo.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'], validate: validateEnv }),
    PrismaModule,
    EncryptionModule,
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 60,
    }]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // validateEnv já garantiu presença, força e que não é um valor de exemplo público.
        secret: config.getOrThrow<string>('jwtSecret'),
        signOptions: { expiresIn: '8h', issuer: jwtIssuer, audience: jwtAudience },
      }),
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
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
