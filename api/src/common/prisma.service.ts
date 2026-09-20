import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  // No $connect() at boot on purpose: Prisma connects lazily on the first query.
  // Forcing it made boot wait for Neon to wake from suspend, stacking two cold starts
  // (Render + Neon) before the app could answer even /health.
  async onModuleDestroy() { await this.$disconnect(); }
}

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
