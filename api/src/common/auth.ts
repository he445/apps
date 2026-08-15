import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { PrismaService } from './prisma.service';

export type JwtUser = {
  sub: string;
  role: Role | 'PATIENT' | 'PROFESSIONAL' | 'ADMIN';
  email: string;
  ver?: number;
  act?: { sub: string; role: Role | 'ADMIN'; email: string; ver?: number };
  isImpersonated?: boolean;
};

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): JwtUser => context.switchToHttp().getRequest().user);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: JwtUser }>();
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException('Token ausente.');
    try {
      // Não exige issuer/audience aqui para preservar sessões emitidas antes do
      // reforço. Tokens novos já recebem esses claims ao serem assinados.
      const payload = await this.jwt.verifyAsync<JwtUser>(token);
      if (!payload.sub || !payload.email) {
        throw new UnauthorizedException('Token inválido.');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { role: true, email: true, isDeleted: true, isTestUser: true, tokenVersion: true },
      });
      if (
        !user ||
        user.isDeleted ||
        user.role !== payload.role ||
        user.email !== payload.email ||
        (payload.ver !== undefined && user.tokenVersion !== payload.ver)
      ) {
        throw new UnauthorizedException('Sessão não é mais válida.');
      }

      if (payload.isImpersonated) {
        if (!payload.act || !user.isTestUser) {
          throw new UnauthorizedException('Token de simulação inválido.');
        }
        const actor = await this.prisma.user.findUnique({
          where: { id: payload.act.sub },
          select: { role: true, email: true, isDeleted: true, tokenVersion: true },
        });
        if (
          !actor ||
          actor.isDeleted ||
          actor.role !== Role.ADMIN ||
          actor.email !== payload.act.email ||
          (payload.act.ver !== undefined && actor.tokenVersion !== payload.act.ver)
        ) {
          throw new UnauthorizedException('Sessão de simulação não é mais válida.');
        }
      } else if (payload.act) {
        throw new UnauthorizedException('Token inválido.');
      }

      request.user = payload;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Token inválido ou expirado.');
    }
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    const user = request.user;
    if (!user || !requiredRoles.includes(user.role as Role)) {
      throw new ForbiddenException('Acesso não autorizado para o seu perfil.');
    }
    return true;
  }
}
