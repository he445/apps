import { ArgumentsHost, Catch, ConflictException, ExceptionFilter, HttpException, HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

/**
 * Traduz erros do Prisma para respostas HTTP com significado.
 *
 * Without this filter a unique-index violation (P2002) surfaced as a generic 500 —
 * including on sign-up, where the duplicate e-mail check is a findUnique followed by a
 * create and can still collide under concurrency, since PostgreSQL's default isolation
 * level is read committed.
 */
/**
 * Translates a Prisma error into the equivalent HTTP exception.
 *
 * Exportada (em vez de privada ao filtro) porque o TelemetryInterceptor precisa da
 * mesma regra: sem ela, o interceptor via o erro cru do Prisma antes do filtro atuar
 * and classified everything as 500, even when the client already got a correct 409/404.
 */
export function mapPrismaError(exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError): HttpException {
  if (!(exception instanceof Prisma.PrismaClientKnownRequestError)) {
    // Malformed query: a code defect, not user input.
    return new HttpException('Erro interno ao processar a requisição.', HttpStatus.INTERNAL_SERVER_ERROR);
  }

  switch (exception.code) {
    case 'P2002': {
      const target = exception.meta?.target;
      const campos = Array.isArray(target) ? target.join(', ') : String(target ?? 'registro');
      return new ConflictException(
        campos.includes('email') ? 'E-mail já cadastrado.' : `Já existe um registro com este valor (${campos}).`,
      );
    }
    case 'P2025':
      return new NotFoundException('Registro não encontrado.');
    case 'P2003':
      return new ConflictException('Operação bloqueada: o registro está vinculado a outros dados.');
    default:
      // Prisma's message can name tables and columns: not for the client.
      return new HttpException('Erro interno ao processar a requisição.', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const mapped = mapPrismaError(exception);

    if (mapped.getStatus() >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception.message);
    }

    response.status(mapped.getStatus()).json(mapped.getResponse());
  }
}
