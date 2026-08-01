import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma.service';
import { JwtAuthGuard, Public } from './common/auth';
import { AuthModule } from './auth/auth.module';
import { InvitationsModule } from './invitations/invitations.module';
import { CareModule } from './care/care.module';
import { UsersModule } from './users/users.module';

@Controller('health')
class HealthController { @Public() @Get() health() { return { status: 'ok', service: 'ojanuan-api' }; } }

const jwtSecret = process.env.JWT_SECRET?.trim();
if (!jwtSecret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET deve ser definido em produção.');
}
if (!jwtSecret) {
  console.warn('JWT_SECRET não definido; usando fallback de desenvolvimento.');
}

@Module({
  imports: [
    PrismaModule,
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 60,
    }]),
    JwtModule.register({ global: true, secret: jwtSecret ?? 'development-only-secret', signOptions: { expiresIn: '8h' } }),
    AuthModule,
    InvitationsModule,
    CareModule,
    UsersModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
