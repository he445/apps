import { Body, Controller, Delete, HttpCode, HttpStatus, Injectable, Module, Post, Put, UnauthorizedException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CurrentUser, JwtUser } from '../common/auth';
import { PrismaService } from '../common/prisma.service';
import { CURRENT_PRIVACY_POLICY_VERSION } from '../auth/auth.module';

class DeleteAccountDto {
  @IsString()
  @IsNotEmpty()
  password!: string;
}

class UpdateProfileDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() currentPassword?: string;
  // Matches sign-up (8): it used to be possible to weaken your own password after login.
  @IsOptional() @IsString() @MinLength(8) newPassword?: string;
  @IsOptional() @IsString() cpf?: string;
  @IsOptional() @IsString() crp?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() pixKey?: string;
  @IsOptional() @IsNumber() sessionDefaultPrice?: number;
  @IsOptional() @IsNumber() cancellationLimitHours?: number;
  @IsOptional() @IsNumber() sessionPrice?: number;
  @IsOptional() @IsNumber() cancelLimitHours?: number;
}

@Injectable()
class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async eraseActiveData(user: JwtUser, passwordCheck: string) {
    if (user.isImpersonated) {
      throw new ForbiddenException('Ações destrutivas (exclusão de conta) são bloqueadas no modo simulação.');
    }
    if (!passwordCheck) throw new BadRequestException('Informe sua senha para confirmar a exclusão da conta.');
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.sub } });
    if (!dbUser) throw new NotFoundException('Usuário não encontrado.');

    const valid = await bcrypt.compare(passwordCheck, dbUser.password);
    if (!valid) throw new UnauthorizedException('Senha incorreta.');

    await this.prisma.$transaction([
      this.prisma.chatMessage.deleteMany({ where: { OR: [{ senderId: user.sub }, { receiverId: user.sub }] } }),
      this.prisma.selfAssessment.deleteMany({ where: { patientId: user.sub } }),
      this.prisma.guideline.deleteMany({ where: { OR: [{ patientId: user.sub }, { professionalId: user.sub }] } }),
      this.prisma.professionalPatient.deleteMany({ where: { OR: [{ patientId: user.sub }, { professionalId: user.sub }] } }),
      this.prisma.patientInvitation.deleteMany({ where: { professionalId: user.sub } }),
      this.prisma.professionalSettings.deleteMany({ where: { professionalId: user.sub } }),
      this.prisma.user.update({
        where: { id: user.sub },
        data: {
          isDeleted: true,
          fullName: 'Titular excluído',
          password: '',
          email: `deleted-${user.sub}@anonymized.invalid`,
          // Keeps CPF, CRP, address and ID intact, as the tax retention rule requires.
        },
      }),
    ]);
    return { deleted: true };
  }

  /**
   * Records consent for an account created before the privacy policy existed — or
   * before the version now in force. Sign-up records it inline; this is the catch-up
   * path, asked for on the next visit.
   */
  async acceptPrivacyPolicy(user: JwtUser) {
    if (user.isImpersonated) {
      throw new ForbiddenException('O consentimento é pessoal e não pode ser dado em modo simulação.');
    }
    const updated = await this.prisma.user.update({
      where: { id: user.sub },
      data: { consentedAt: new Date(), consentVersion: CURRENT_PRIVACY_POLICY_VERSION },
      select: { consentedAt: true, consentVersion: true },
    });
    return updated;
  }

  async updateProfile(user: JwtUser, dto: UpdateProfileDto) {
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.sub } });
    if (!dbUser) throw new NotFoundException('Usuário não encontrado.');

    const nameToUpdate = dto.fullName || dto.name;
    const newEmail = dto.email ? dto.email.toLowerCase() : undefined;
    const isChangingEmail = newEmail && newEmail !== dbUser.email;
    const isChangingPassword = !!dto.newPassword;
    const credentialsChanged = Boolean(isChangingEmail || isChangingPassword);

    if ((isChangingEmail || isChangingPassword) && user.isImpersonated) {
      throw new ForbiddenException('A alteração de credenciais (e-mail ou senha) é bloqueada no modo simulação.');
    }

    if (credentialsChanged) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Informe sua senha atual para reautenticação e segurança.');
      }
      const validPassword = await bcrypt.compare(dto.currentPassword, dbUser.password);
      if (!validPassword) {
        throw new UnauthorizedException('Senha atual incorreta.');
      }
    }

    if (isChangingEmail) {
      const existing = await this.prisma.user.findUnique({ where: { email: newEmail } });
      if (existing && existing.id !== user.sub) {
        throw new BadRequestException('Este e-mail já está em uso.');
      }
    }

    const newPasswordHash = isChangingPassword ? await bcrypt.hash(dto.newPassword!, 12) : undefined;

    const updatedUser = await this.prisma.user.update({
      where: { id: user.sub },
      data: {
        ...(nameToUpdate && { fullName: nameToUpdate }),
        ...(newEmail && { email: newEmail }),
        ...(newPasswordHash && { password: newPasswordHash }),
        // New tokens carry this version; older ones, issued before the migration,
        // stay valid until their normal 8-hour expiry.
        ...(credentialsChanged && { tokenVersion: { increment: 1 } }),
        ...(dto.cpf !== undefined && { cpf: dto.cpf }),
        ...(dto.crp !== undefined && { crp: dto.crp }),
        ...(dto.address !== undefined && { address: dto.address }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        cpf: true,
        crp: true,
        address: true,
        tokenVersion: true,
      },
    });

    const effectiveSessionPrice = dto.sessionPrice ?? dto.sessionDefaultPrice;
    const effectiveCancelLimitHours = dto.cancelLimitHours ?? dto.cancellationLimitHours;

    const { pixKey } = dto;
    if (user.role === 'PROFESSIONAL' && (pixKey !== undefined || effectiveSessionPrice !== undefined || effectiveCancelLimitHours !== undefined)) {
      await this.prisma.professionalSettings.upsert({
        where: { professionalId: user.sub },
        create: {
          professionalId: user.sub,
          pixKey: pixKey || '',
          sessionDefaultPrice: effectiveSessionPrice ?? 150,
          cancellationLimitHours: effectiveCancelLimitHours ?? 24,
        },
        update: {
          ...(pixKey !== undefined && { pixKey }),
          ...(effectiveSessionPrice !== undefined && { sessionDefaultPrice: effectiveSessionPrice }),
          ...(effectiveCancelLimitHours !== undefined && { cancellationLimitHours: effectiveCancelLimitHours }),
        },
      });
    }

    const settings = user.role === 'PROFESSIONAL' 
      ? await this.prisma.professionalSettings.findUnique({ where: { professionalId: user.sub } })
      : null;

    const refreshedToken = credentialsChanged
      ? this.jwt.sign({
          sub: updatedUser.id,
          role: updatedUser.role,
          email: updatedUser.email,
          ver: updatedUser.tokenVersion,
        })
      : undefined;

    return {
      user: {
        ...updatedUser,
        name: updatedUser.fullName,
        pixKey: settings?.pixKey || '',
        sessionPrice: settings ? Number(settings.sessionDefaultPrice) : undefined,
        cancelLimitHours: settings?.cancellationLimitHours,
      },
      ...(refreshedToken && { token: refreshedToken, accessToken: refreshedToken }),
    };
  }
}

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
class UsersController {
  constructor(private readonly users: UsersService) {}

  @Delete('me')
  @ApiOperation({ summary: 'Excluir conta (LGPD Soft Delete)' })
  deleteMyAccount(@CurrentUser() user: JwtUser, @Body() dto: DeleteAccountDto) {
    return this.users.eraseActiveData(user, dto.password);
  }

  @Post('me/consent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record consent to the privacy policy in force' })
  acceptPrivacyPolicy(@CurrentUser() user: JwtUser) {
    return this.users.acceptPrivacyPolicy(user);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Atualizar perfil (nome, CPF, CRP, endereço, PIX, senha)' })
  updateProfile(@CurrentUser() user: JwtUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user, dto);
  }
}

@Module({ controllers: [UsersController], providers: [UsersService] })
export class UsersModule {}
