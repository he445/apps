import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, GoneException, HttpCode, HttpStatus, Injectable, Module, NotFoundException, Param, Post, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { InvitationStatus, Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import * as bcrypt from 'bcrypt';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { PrismaModule, PrismaService } from '../common/prisma.service';
import { Public } from '../common/auth';

class RegisterDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional() @IsString() @MinLength(2) fullName?: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail() @IsNotEmpty() email!: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @IsNotEmpty() @MinLength(8) password!: string;
  @IsEnum(Role) role!: Role;
  @IsOptional() @IsString() cpf?: string;
  @IsOptional() @IsString() crp?: string;
  @IsOptional() @IsString() inviteToken?: string;
  @IsOptional() @IsString() token?: string;
}

class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail() @IsNotEmpty() email!: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @IsNotEmpty() password!: string;
}

@Injectable()
class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  private token(user: { id: string; role: Role; email: string; tokenVersion: number }) {
    return this.jwt.sign({ sub: user.id, role: user.role, email: user.email, ver: user.tokenVersion });
  }

  async register(dto: RegisterDto) {
    // Contas administrativas são provisionadas exclusivamente por operação
    // controlada (seed/CLI); aceitar este papel na rota pública é escalada de privilégio.
    if (dto.role === Role.ADMIN) {
      throw new ForbiddenException('Contas administrativas não podem ser criadas pelo cadastro público.');
    }

    const inviteCode = dto.inviteToken || dto.token;
    const fullName = dto.fullName?.trim() || dto.name?.trim();
    if (!fullName) {
      throw new BadRequestException('Nome completo é obrigatório.');
    }

    return this.prisma.$transaction(async (tx) => {
      const exists = await tx.user.findUnique({ where: { email: dto.email.toLowerCase() } });
      if (exists) throw new ConflictException('E-mail já cadastrado.');

      let professionalId: string | null = null;
      let invitationId: string | null = null;

      if (dto.role === Role.PATIENT && inviteCode) {
        const invitation = await tx.patientInvitation.findUnique({
          where: { token: inviteCode },
        });
        // Convites novos são de uso único. Os códigos curtos já emitidos
        // permanecem aceitos até expirarem para não interromper onboarding em curso.
        const isLegacyInvitation = invitation?.token.length === 6;
        if (
          !invitation ||
          invitation.expiresAt < new Date() ||
          (!isLegacyInvitation && invitation.status !== InvitationStatus.PENDING)
        ) {
          throw new GoneException('Convite inválido ou expirado.');
        }
        professionalId = invitation.professionalId;
        invitationId = invitation.id;

        if (!isLegacyInvitation) {
          const claim = await tx.patientInvitation.updateMany({
            where: { id: invitation.id, status: InvitationStatus.PENDING },
            data: { status: InvitationStatus.ACCEPTED },
          });
          if (claim.count !== 1) throw new GoneException('Convite já foi utilizado.');
        }
      }

      const user = await tx.user.create({
        data: {
          fullName,
          email: dto.email.toLowerCase(),
          password: await bcrypt.hash(dto.password, 12),
          role: dto.role,
          cpf: dto.cpf,
          crp: dto.crp,
        },
        select: { id: true, fullName: true, email: true, role: true, cpf: true, tokenVersion: true },
      });

      if (professionalId) {
        await tx.professionalPatient.create({
          data: { professionalId, patientId: user.id },
        });
      }

      const accessToken = this.token(user);
      return {
        user: { ...user, name: user.fullName },
        accessToken,
        token: accessToken,
      };
    });
  }

  async login(dto: LoginDto) {
    const normalizedEmail = dto.email.toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, isDeleted: false },
      include: { settings: true },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    const accessToken = this.token(user);
    const userPayload = {
      id: user.id,
      fullName: user.fullName,
      name: user.fullName,
      email: user.email,
      role: user.role,
      cpf: user.cpf,
      pixKey: user.settings?.pixKey || '',
      sessionPrice: user.settings ? Number(user.settings.sessionDefaultPrice) : undefined,
      cancelLimitHours: user.settings?.cancellationLimitHours,
    };
    return {
      user: userPayload,
      accessToken,
      token: accessToken,
    };
  }

  async previewInvitation(token: string) {
    const invitation = await this.prisma.patientInvitation.findUnique({
      where: { token },
      include: { professional: { select: { fullName: true } } },
    });
    if (
      !invitation ||
      invitation.expiresAt < new Date() ||
      (invitation.token.length !== 6 && invitation.status !== InvitationStatus.PENDING)
    ) {
      throw new GoneException('Convite expirado ou inválido.');
    }
    return {
      token: invitation.token,
      patientName: invitation.patientName,
      professionalName: invitation.professional.fullName,
      expiresAt: invitation.expiresAt,
    };
  }
}

@ApiTags('auth')
@Controller('auth')
class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Cadastrar novo usuário', description: 'Registra um PROFESSIONAL ou PATIENT. Se paciente com inviteToken, vincula ao psicólogo automaticamente.' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Usuário criado. Retorna user + accessToken.' })
  @ApiResponse({ status: 409, description: 'E-mail já cadastrado.' })
  @ApiResponse({ status: 410, description: 'Convite inválido ou expirado.' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login', description: 'Autentica o usuário e retorna o JWT. Use o accessToken no botão Authorize 🔒.' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login bem-sucedido. Retorna user + accessToken.' })
  @ApiResponse({ status: 401, description: 'E-mail ou senha inválidos.' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Get('invitation/:token')
  @ApiOperation({ summary: 'Pré-visualizar convite', description: 'Retorna dados do convite (nome do psicólogo, nome do paciente, validade) sem exigir autenticação.' })
  @ApiResponse({ status: 200, description: 'Dados do convite.' })
  @ApiResponse({ status: 404, description: 'Convite não encontrado.' })
  @ApiResponse({ status: 410, description: 'Convite expirado ou já utilizado.' })
  previewInvitation(@Param('token') token: string) {
    return this.auth.previewInvitation(token);
  }

  @Public()
  @Get('invitations/:token')
  @ApiOperation({ summary: 'Pré-visualizar convite pelo caminho alternativo', description: 'Compatibilidade com a rota usada no onboarding do paciente.' })
  previewInvitationAlias(@Param('token') token: string) {
    return this.auth.previewInvitation(token);
  }
}

@Module({ imports: [PrismaModule], controllers: [AuthController], providers: [AuthService] })
export class AuthModule {}
