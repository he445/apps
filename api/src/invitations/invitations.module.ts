import { Body, ConflictException, Controller, ForbiddenException, Get, GoneException, Injectable, Module, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InvitationStatus, Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { CurrentUser, JwtUser, Public } from '../common/auth';
import { PrismaService } from '../common/prisma.service';

class CreateInvitationDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @IsNotEmpty() @MinLength(2) patientName!: string;
}
class AcceptInvitationDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @IsNotEmpty() @MinLength(2) fullName!: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail() @IsNotEmpty() email!: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @IsNotEmpty() @MinLength(8) password!: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional() @IsString() cpf?: string;
}

@Injectable()
class InvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async createSecureInvitation(professionalId: string, patientName: string) {
    // 256 bits de entropia e URL-safe: resistente a enumeração pública.
    const token = randomBytes(32).toString('base64url');
    return this.prisma.patientInvitation.create({
      data: {
        professionalId,
        patientName,
        token,
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      },
    });
  }

  async create(user: JwtUser, patientName: string) {
    if (user.role !== Role.PROFESSIONAL) {
      throw new ForbiddenException('Apenas profissionais podem gerar convites.');
    }
    return this.createSecureInvitation(user.sub, patientName);
  }

  async preview(token: string) {
    const normalizedToken = token.trim();
    const invitation = await this.prisma.patientInvitation.findUnique({ where: { token: normalizedToken }, include: { professional: { select: { fullName: true } } } });
    if (
      !invitation ||
      invitation.expiresAt < new Date() ||
      (invitation.token.length !== 6 && invitation.status !== InvitationStatus.PENDING)
    ) throw new GoneException('Convite inválido ou expirado.');
    return { patientName: invitation.patientName, professionalName: invitation.professional.fullName, expiresAt: invitation.expiresAt };
  }

  async accept(token: string, dto: AcceptInvitationDto) {
    const normalizedToken = token.trim();
    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.patientInvitation.findUnique({ where: { token: normalizedToken } });
      const isLegacyInvitation = invitation?.token.length === 6;
      if (
        !invitation ||
        invitation.expiresAt < new Date() ||
        (!isLegacyInvitation && invitation.status !== InvitationStatus.PENDING)
      ) throw new GoneException('Convite inválido ou expirado.');
      const existing = await tx.user.findUnique({ where: { email: dto.email.toLowerCase() } });
      if (existing) throw new ConflictException('E-mail já cadastrado.');
      if (!isLegacyInvitation) {
        const claim = await tx.patientInvitation.updateMany({
          where: { id: invitation.id, status: InvitationStatus.PENDING },
          data: { status: InvitationStatus.ACCEPTED },
        });
        if (claim.count !== 1) throw new GoneException('Convite já foi utilizado.');
      }
      const patient = await tx.user.create({ data: { fullName: dto.fullName, email: dto.email.toLowerCase(), password: await bcrypt.hash(dto.password, 12), cpf: dto.cpf, role: Role.PATIENT } });
      await tx.professionalPatient.create({ data: { professionalId: invitation.professionalId, patientId: patient.id } });
      return { id: patient.id, fullName: patient.fullName, role: patient.role };
    });
  }
}

@ApiTags('invitations')
@Controller('invitations')
class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}
  @Post() @ApiBearerAuth('JWT-auth') @ApiOperation({ summary: 'Criar convite para paciente (PROFESSIONAL)' }) create(@CurrentUser() user: JwtUser, @Body() dto: CreateInvitationDto) { return this.invitations.create(user, dto.patientName); }
  @Public() @Get(':token') @ApiOperation({ summary: 'Visualizar convite por token (público)' }) preview(@Param('token') token: string) { return this.invitations.preview(token); }
  @Public() @Post(':token/accept') @ApiOperation({ summary: 'Aceitar convite e criar conta de paciente' }) accept(@Param('token') token: string, @Body() dto: AcceptInvitationDto) { return this.invitations.accept(token, dto); }
}

@Module({ controllers: [InvitationsController], providers: [InvitationsService] })
export class InvitationsModule {}
