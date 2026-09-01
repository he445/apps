import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  // Sem $connect() no arranque de propósito: o Prisma conecta preguiçosamente na
  // primeira query. Forçar a conexão fazia o boot esperar o Neon sair da
  // suspensão, empilhando dois cold starts (Render + Neon) antes de a aplicação
  // conseguir responder até mesmo /health.
  async onModuleDestroy() { await this.$disconnect(); }
}

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
