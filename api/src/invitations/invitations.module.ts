import { Body, ConflictException, Controller, Get, GoneException, Injectable, Module, NotFoundException, Param, Post } from '@nestjs/common';
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
  async create(professionalId: string, patientName: string) {
    const token = randomBytes(5).toString('base64url').toUpperCase().slice(0, 6);
    return this.prisma.patientInvitation.create({ data: { professionalId, patientName, token, expiresAt: new Date(Date.now() + 7 * 86_400_000) } });
  }
  async preview(token: string) {
    const normalizedToken = token.trim().toUpperCase();
    const invitation = await this.prisma.patientInvitation.findUnique({ where: { token: normalizedToken }, include: { professional: { select: { fullName: true } } } });
    if (!invitation) throw new NotFoundException('Convite não encontrado.');
    if (invitation.status !== InvitationStatus.PENDING || invitation.expiresAt < new Date()) throw new GoneException('Convite expirado ou já utilizado.');
    return { patientName: invitation.patientName, professionalName: invitation.professional.fullName, expiresAt: invitation.expiresAt };
  }
  async accept(token: string, dto: AcceptInvitationDto) {
    const normalizedToken = token.trim().toUpperCase();
    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.patientInvitation.findUnique({ where: { token: normalizedToken } });
      if (!invitation || invitation.status !== InvitationStatus.PENDING || invitation.expiresAt < new Date()) throw new GoneException('Convite inválido ou expirado.');
      const existing = await tx.user.findUnique({ where: { email: dto.email.toLowerCase() } });
      if (existing) throw new ConflictException('E-mail já cadastrado.');
      const patient = await tx.user.create({ data: { fullName: dto.fullName, email: dto.email.toLowerCase(), password: await bcrypt.hash(dto.password, 12), cpf: dto.cpf, role: Role.PATIENT } });
      await tx.professionalPatient.create({ data: { professionalId: invitation.professionalId, patientId: patient.id } });
      await tx.patientInvitation.update({ where: { id: invitation.id }, data: { status: InvitationStatus.ACCEPTED } });
      return { id: patient.id, fullName: patient.fullName, role: patient.role };
    });
  }
}

@ApiTags('invitations')
@Controller('invitations')
class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}
  @Post() @ApiBearerAuth('JWT-auth') @ApiOperation({ summary: 'Criar convite para paciente (PROFESSIONAL)' }) create(@CurrentUser() user: JwtUser, @Body() dto: CreateInvitationDto) { return this.invitations.create(user.sub, dto.patientName); }
  @Public() @Get(':token') @ApiOperation({ summary: 'Visualizar convite por token (público)' }) preview(@Param('token') token: string) { return this.invitations.preview(token.toUpperCase()); }
  @Public() @Post(':token/accept') @ApiOperation({ summary: 'Aceitar convite e criar conta de paciente' }) accept(@Param('token') token: string, @Body() dto: AcceptInvitationDto) { return this.invitations.accept(token.toUpperCase(), dto); }
}

@Module({ controllers: [InvitationsController], providers: [InvitationsService] })
export class InvitationsModule {}
