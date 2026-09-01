import { ArgumentsHost, Catch, ConflictException, ExceptionFilter, HttpException, HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

/**
 * Traduz erros do Prisma para respostas HTTP com significado.
 *
 * Sem este filtro, uma violação de índice único (P2002) subia como 500 genérico —
 * inclusive no cadastro, onde a checagem de e-mail duplicado é feita com
 * findUnique seguido de create e ainda pode colidir sob concorrência, já que o
 * nível de isolamento padrão do PostgreSQL é read committed.
 */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const mapped = this.toHttpException(exception);

    if (mapped.getStatus() >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception.message);
    }

    response.status(mapped.getStatus()).json(mapped.getResponse());
  }

  private toHttpException(exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError): HttpException {
    if (!(exception instanceof Prisma.PrismaClientKnownRequestError)) {
      // Erro de forma da query: é defeito de código, não entrada do usuário.
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
        // Mensagem do Prisma pode conter nome de tabela e coluna: não é para o cliente.
        return new HttpException('Erro interno ao processar a requisição.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
