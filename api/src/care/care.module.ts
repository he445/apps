import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BillingType, ConsultationStatus, InvitationStatus, PaymentStatus, Role } from '@prisma/client';
import { randomBytes } from 'crypto';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, registerDecorator, ValidationOptions } from 'class-validator';
import { CurrentUser, JwtUser } from '../common/auth';
import { APP_TIMEZONE, dayRangeInAppTimezone, isIsoWithOffset } from '../common/time';
import { PrismaService } from '../common/prisma.service';

/**
 * Exige ISO 8601 com fuso explícito. `@IsDateString()` aceitava "2026-09-02T14:00:00",
 * que o servidor (em UTC) interpretava como 14h UTC — três horas adiantado para quem
 * marcou 14h em São Paulo.
 */
function IsIsoDateTimeWithOffset(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isIsoDateTimeWithOffset',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown) => isIsoWithOffset(value),
        defaultMessage: () =>
          'Data e hora devem incluir o fuso horário (ex: 2026-09-02T14:00:00-03:00).',
      },
    });
  };
}

class CreateConsultationDto {
  @IsString() patientId!: string;
  @IsIsoDateTimeWithOffset() dateTime!: string;
  @IsString() @MinLength(1) @Matches(/^\d{1,8}(\.\d{1,2})?$/, { message: 'Valor de sessão inválido.' }) sessionPrice!: string;
  @IsEnum(BillingType) billingType!: BillingType;
}

class UpdateConsultationDto {
  @IsOptional() @IsIsoDateTimeWithOffset() dateTime?: string;
  @IsOptional() @IsString() @MinLength(1) @Matches(/^\d{1,8}(\.\d{1,2})?$/, { message: 'Valor de sessão inválido.' }) sessionPrice?: string;
  @IsOptional() @IsEnum(BillingType) billingType?: BillingType;
}

class AssessmentDto {
  @IsOptional() @IsInt() @Min(1) @Max(5) moodScore?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) anxietyScore?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) sleepScore?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) energyScore?: number;
  @IsOptional() @IsBoolean() socialInteraction?: boolean;
  @IsOptional() @IsString() @MaxLength(150) quickNote?: string;

  // Fallbacks em português
  @IsOptional() @IsInt() @Min(1) @Max(5) humor_geral?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) nivel_ansiedade?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) qualidade_sono?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) nivel_energia?: number;
  @IsOptional() @IsBoolean() interacao_social?: boolean;
  @IsOptional() @IsString() @MaxLength(150) nota?: string;
}

class GuidelineDto {
  @IsString() @MinLength(1) @MaxLength(500) text!: string;
}

class MessageDto {
  @IsString() receiverId!: string;
  @IsOptional() @IsString() @MaxLength(1000) messageText?: string;
  @IsOptional() @IsString() @MaxLength(1000) text?: string;
}

class InviteTokenDto {
  @IsString() @MinLength(6) @MaxLength(64) token!: string;
}

/** Duração padrão de sessão, usada para detectar sobreposição na agenda. */
const DEFAULT_SESSION_MINUTES = 50;

@Injectable()
class AccessService {
  constructor(private readonly prisma: PrismaService) {}
  async pair(user: JwtUser, partnerId: string) {
    const relation = user.role === Role.PROFESSIONAL
      ? { professionalId: user.sub, patientId: partnerId }
      : { professionalId: partnerId, patientId: user.sub };
    const connection = await this.prisma.professionalPatient.findFirst({ where: relation });
    if (!connection) throw new ForbiddenException('Não existe vínculo ativo entre esses perfis.');
    return connection;
  }
}

@Injectable()
class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async listProfessionalPatients(user: JwtUser) {
    if (user.role !== Role.PROFESSIONAL) throw new ForbiddenException('Apenas profissionais podem acessar esta área.');

    const connectionRows = await this.prisma.professionalPatient.findMany({
      where: { professionalId: user.sub, patient: { isDeleted: false } },
      include: { patient: { select: { id: true, fullName: true, email: true, cpf: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const patients = await Promise.all(connectionRows.map(async (row) => {
      const latestAssessment = await this.prisma.selfAssessment.findFirst({
        where: { patientId: row.patientId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, moodScore: true, sleepScore: true, energyScore: true, anxietyScore: true },
      });

      const pendingPaymentsCount = await this.prisma.consultation.count({
        where: { professionalId: user.sub, patientId: row.patientId, paymentStatus: { not: PaymentStatus.PAID } },
      });

      return {
        id: row.patient.id,
        name: row.patient.fullName,
        email: row.patient.email,
        cpf: row.patient.cpf || undefined,
        latestMood: latestAssessment
          ? {
              date: latestAssessment.createdAt.toISOString().slice(0, 10),
              humor_geral: latestAssessment.moodScore,
              indice_bem_estar: Number(((latestAssessment.moodScore + latestAssessment.sleepScore + latestAssessment.energyScore + (6 - latestAssessment.anxietyScore)) / 4).toFixed(2)),
            }
          : null,
        pendingPaymentsCount,
      };
    }));

    const inviteToken = await this.createInviteToken(user.sub);
    return {
      patients,
      inviteCode: inviteToken,
      inviteLink: this.buildInviteLink(inviteToken),
    };
  }

  async createInvitation(user: JwtUser) {
    if (user.role !== Role.PROFESSIONAL) throw new ForbiddenException('Apenas profissionais podem gerar convites.');
    // A ação explícita de gerar convite sempre cria um novo link seguro. O
    // convite anterior continua válido durante a transição para não quebrar
    // links já enviados a pacientes.
    const token = await this.createInviteToken(user.sub, true);
    return {
      inviteCode: token,
      code: token,
      inviteLink: this.buildInviteLink(token),
      link: this.buildInviteLink(token),
      token,
    };
  }

  async getPatientDashboard(user: JwtUser) {
    if (user.role !== Role.PATIENT) throw new ForbiddenException('Apenas pacientes podem acessar este painel.');

    const connection = await this.prisma.professionalPatient.findFirst({
      where: { patientId: user.sub },
      include: { professional: { select: { id: true, fullName: true, settings: { select: { pixKey: true } } } } },
    });

    // Janela do dia no fuso do produto, não no do servidor (que roda em UTC).
    const { start: todayStart, end: todayEnd } = dayRangeInAppTimezone();

    const todaysAssessment = await this.prisma.selfAssessment.findFirst({
      where: { patientId: user.sub, createdAt: { gte: todayStart, lte: todayEnd } },
      orderBy: { createdAt: 'desc' },
    });

    const orientations = await this.prisma.guideline.findMany({
      where: { patientId: user.sub },
      orderBy: { createdAt: 'desc' },
    });

    return {
      psychologistId: connection?.professional.id,
      professionalId: connection?.professional.id,
      psychologistName: connection?.professional.fullName ?? 'Aguardando vínculo com um profissional',
      pixKey: connection?.professional.settings?.pixKey || '',
      hasEvaluatedToday: !!todaysAssessment,
      todaysMood: todaysAssessment
        ? {
            humor_geral: todaysAssessment.moodScore,
            qualidade_sono: todaysAssessment.sleepScore,
            nivel_energia: todaysAssessment.energyScore,
            nivel_ansiedade: todaysAssessment.anxietyScore,
            interacao_social: todaysAssessment.socialInteraction,
            nota: todaysAssessment.quickNote || '',
            indice_bem_estar: Number(((todaysAssessment.moodScore + todaysAssessment.sleepScore + todaysAssessment.energyScore + (6 - todaysAssessment.anxietyScore)) / 4).toFixed(2)),
          }
        : null,
      orientations: orientations.map((orientation) => ({
        id: orientation.id,
        title: 'Orientação recebida',
        content: orientation.text,
        date: orientation.createdAt.toISOString().slice(0, 10),
      })),
    };
  }

  async connectPatientToInvitation(user: JwtUser, token: string) {
    if (user.role !== Role.PATIENT) throw new ForbiddenException('Apenas pacientes podem aceitar convites.');

    const normalizedToken = token?.trim();
    if (!normalizedToken) throw new BadRequestException('Informe o código do convite.');

    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.patientInvitation.findUnique({
        where: { token: normalizedToken },
        include: { professional: { select: { id: true, fullName: true } } },
      });

      const isLegacyInvitation = invitation?.token.length === 6;
      if (
        !invitation ||
        invitation.expiresAt < new Date() ||
        (!isLegacyInvitation && invitation.status !== InvitationStatus.PENDING)
      ) {
        throw new NotFoundException('Convite inválido ou expirado.');
      }

      if (!isLegacyInvitation) {
        const claim = await tx.patientInvitation.updateMany({
          where: { id: invitation.id, status: InvitationStatus.PENDING },
          data: { status: InvitationStatus.ACCEPTED },
        });
        if (claim.count !== 1) throw new NotFoundException('Convite já foi utilizado.');
      }

      await tx.professionalPatient.deleteMany({ where: { patientId: user.sub } });
      await tx.professionalPatient.create({
        data: { professionalId: invitation.professionalId, patientId: user.sub },
      });

      return {
        success: true,
        psychologistName: invitation.professional.fullName,
        professionalId: invitation.professionalId,
      };
    });
  }

  private async createInviteToken(professionalId: string, forceNew = false) {
    const existing = await this.prisma.patientInvitation.findFirst({
      where: { professionalId, status: InvitationStatus.PENDING, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'asc' },
    });
    if (existing && !forceNew) return existing.token;

    const token = randomBytes(32).toString('base64url');
    await this.prisma.patientInvitation.create({
      data: {
        professionalId,
        patientName: 'Paciente',
        token,
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      },
    });
    return token;
  }

  private buildInviteLink(token: string) {
    // WEB_ORIGIN é validada como URL única no arranque; origens extras de CORS
    // ficam em CORS_ORIGINS e não interferem aqui.
    const baseUrl = process.env.WEB_ORIGIN?.trim().replace(/\/$/, '') || 'http://localhost:5173';
    return `${baseUrl}/convite/${token}`;
  }
}

@Injectable()
class ConsultationsService {
  constructor(private readonly prisma: PrismaService, private readonly access: AccessService) {}
  list(user: JwtUser) {
    return this.prisma.consultation.findMany({
      where: user.role === Role.PROFESSIONAL ? { professionalId: user.sub } : { patientId: user.sub },
      include: {
        patient: { select: { id: true, fullName: true, email: true, cpf: true } },
        professional: { select: { id: true, fullName: true, settings: { select: { pixKey: true } } } },
      },
      orderBy: { dateTime: 'asc' },
    });
  }
  async create(user: JwtUser, dto: CreateConsultationDto) {
    if (user.role !== Role.PROFESSIONAL) throw new ForbiddenException('Apenas o profissional agenda consultas.');
    await this.access.pair(user, dto.patientId);
    const patient = await this.prisma.user.findUnique({ where: { id: dto.patientId } });
    if (!patient || patient.isDeleted) throw new NotFoundException('Paciente não encontrado.');

    const dateTime = new Date(dto.dateTime);
    if (dateTime.getTime() <= Date.now()) {
      throw new BadRequestException('Não é possível agendar uma consulta em data passada.');
    }
    await this.assertSlotIsFree(user.sub, dateTime);

    return this.prisma.consultation.create({
      data: {
        patientId: patient.id,
        professionalId: user.sub,
        patientNameForTax: patient.fullName,
        patientCpfForTax: patient.cpf,
        dateTime: new Date(dto.dateTime),
        sessionPrice: dto.sessionPrice,
        billingType: dto.billingType,
      },
      include: {
        patient: { select: { id: true, fullName: true, email: true, cpf: true } },
        professional: { select: { id: true, fullName: true } },
      },
    });
  }
  async update(user: JwtUser, id: string, dto: UpdateConsultationDto) {
    if (user.role !== Role.PROFESSIONAL) throw new ForbiddenException('Apenas o profissional pode editar consultas.');
    const consultation = await this.prisma.consultation.findUnique({ where: { id } });
    if (!consultation) throw new NotFoundException('Consulta não encontrada.');
    if (consultation.professionalId !== user.sub) throw new ForbiddenException('Acesso negado.');
    if (consultation.status === 'CANCELLED') throw new BadRequestException('Não é possível editar uma consulta cancelada.');

    const price = dto.sessionPrice !== undefined ? Number(dto.sessionPrice) : undefined;
    if (price !== undefined && (isNaN(price) || price < 0)) {
      throw new BadRequestException('Valor da sessão inválido.');
    }

    if (dto.dateTime !== undefined) {
      const newDateTime = new Date(dto.dateTime);
      if (newDateTime.getTime() <= Date.now()) {
        throw new BadRequestException('Não é possível remarcar uma consulta para data passada.');
      }
      await this.assertSlotIsFree(user.sub, newDateTime, id);
    }

    return this.prisma.consultation.update({
      where: { id },
      data: {
        ...(dto.dateTime !== undefined && { dateTime: new Date(dto.dateTime) }),
        ...(dto.sessionPrice !== undefined && { sessionPrice: dto.sessionPrice }),
        ...(dto.billingType !== undefined && { billingType: dto.billingType }),
      },
      include: {
        patient: { select: { id: true, fullName: true, email: true, cpf: true } },
        professional: { select: { id: true, fullName: true } },
      },
    });
  }
  /**
   * Impede dois pacientes no mesmo horário. A agenda não modelava duração de
   * sessão, então a janela usa o padrão de 50 minutos até que a duração seja
   * configurável por profissional.
   */
  private async assertSlotIsFree(professionalId: string, dateTime: Date, ignoreConsultationId?: string) {
    const windowStart = new Date(dateTime.getTime() - DEFAULT_SESSION_MINUTES * 60_000);
    const windowEnd = new Date(dateTime.getTime() + DEFAULT_SESSION_MINUTES * 60_000);
    const conflict = await this.prisma.consultation.findFirst({
      where: {
        professionalId,
        status: { notIn: [ConsultationStatus.CANCELLED, ConsultationStatus.PATIENT_NO_SHOW] },
        dateTime: { gt: windowStart, lt: windowEnd },
        ...(ignoreConsultationId ? { id: { not: ignoreConsultationId } } : {}),
      },
      select: { dateTime: true, patientNameForTax: true },
    });
    if (conflict) {
      const quando = conflict.dateTime.toLocaleString('pt-BR', { timeZone: APP_TIMEZONE });
      throw new ConflictException(
        `Conflito de agenda: já existe consulta com ${conflict.patientNameForTax} em ${quando}.`,
      );
    }
  }

  async cancel(user: JwtUser, id: string) {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id },
      include: { professional: { include: { settings: true } } },
    });
    if (!consultation) throw new NotFoundException('Consulta não encontrada.');
    if (user.sub !== consultation.patientId && user.sub !== consultation.professionalId) throw new ForbiddenException();
    const hours = (consultation.dateTime.getTime() - Date.now()) / 3_600_000;
    const tooLate = user.role === Role.PATIENT && hours < (consultation.professional.settings?.cancellationLimitHours ?? 24);
    return this.prisma.consultation.update({
      where: { id },
      data: { status: tooLate ? ConsultationStatus.PATIENT_NO_SHOW : ConsultationStatus.CANCELLED },
    });
  }
  async confirmPayment(user: JwtUser, id: string) {
    if (user.role !== Role.PROFESSIONAL) throw new ForbiddenException('Apenas o profissional pode confirmar o recebimento do pagamento.');
    const consultation = await this.prisma.consultation.findUnique({ where: { id } });
    if (!consultation) throw new NotFoundException('Consulta não encontrada.');
    if (consultation.professionalId !== user.sub) {
      throw new ForbiddenException('Acesso negado: consulta não pertence a este profissional.');
    }
    return this.prisma.consultation.update({
      where: { id },
      data: { paymentStatus: PaymentStatus.PAID, paymentConfirmedAt: new Date() },
    });
  }
}

@Injectable()
class AssessmentsService {
  constructor(private readonly prisma: PrismaService, private readonly access: AccessService) {}
  async create(user: JwtUser, dto: AssessmentDto) {
    if (user.role !== Role.PATIENT) throw new ForbiddenException('A autoavaliação pertence ao paciente.');

    const moodScore = dto.moodScore ?? dto.humor_geral ?? 3;
    const anxietyScore = dto.anxietyScore ?? dto.nivel_ansiedade ?? 3;
    const sleepScore = dto.sleepScore ?? dto.qualidade_sono ?? 3;
    const energyScore = dto.energyScore ?? dto.nivel_energia ?? 3;
    const socialInteraction = dto.socialInteraction ?? dto.interacao_social ?? true;
    const quickNote = dto.quickNote ?? dto.nota;

    // Janela do dia no fuso do produto, não no do servidor (que roda em UTC).
    const { start: todayStart, end: todayEnd } = dayRangeInAppTimezone();

    const existingToday = await this.prisma.selfAssessment.findFirst({
      where: { patientId: user.sub, createdAt: { gte: todayStart, lte: todayEnd } },
      orderBy: { createdAt: 'desc' },
    });

    const record = existingToday
      ? await this.prisma.selfAssessment.update({
          where: { id: existingToday.id },
          data: { moodScore, anxietyScore, sleepScore, energyScore, socialInteraction, quickNote },
        })
      : await this.prisma.selfAssessment.create({
          data: {
            patientId: user.sub,
            moodScore,
            anxietyScore,
            sleepScore,
            energyScore,
            socialInteraction,
            quickNote,
          },
        });

    const indice_bem_estar = Number(((moodScore + sleepScore + energyScore + (6 - anxietyScore)) / 4).toFixed(2));

    return {
      ...record,
      humor_geral: record.moodScore,
      nivel_ansiedade: record.anxietyScore,
      qualidade_sono: record.sleepScore,
      nivel_energia: record.energyScore,
      interacao_social: record.socialInteraction,
      nota: record.quickNote,
      date: record.createdAt.toISOString().slice(0, 10),
      indice_bem_estar,
    };
  }

  async list(user: JwtUser, patientId: string) {
    if (user.sub !== patientId) await this.access.pair(user, patientId);
    const assessments = await this.prisma.selfAssessment.findMany({
      where: { patientId },
      orderBy: { createdAt: 'asc' },
      take: 90,
    });
    return assessments.map((a) => ({
      ...a,
      humor_geral: a.moodScore,
      nivel_ansiedade: a.anxietyScore,
      qualidade_sono: a.sleepScore,
      nivel_energia: a.energyScore,
      interacao_social: a.socialInteraction,
      nota: a.quickNote,
      date: a.createdAt.toISOString().slice(0, 10),
      indice_bem_estar: Number(((a.moodScore + a.sleepScore + a.energyScore + (6 - a.anxietyScore)) / 4).toFixed(2)),
    }));
  }

  async addGuideline(user: JwtUser, patientId: string, dto: GuidelineDto) {
    if (user.role !== Role.PROFESSIONAL) throw new ForbiddenException();
    await this.access.pair(user, patientId);
    return this.prisma.guideline.create({ data: { professionalId: user.sub, patientId, text: dto.text } });
  }

  async guidelines(user: JwtUser, patientId: string) {
    if (user.sub !== patientId) await this.access.pair(user, patientId);
    return this.prisma.guideline.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } });
  }
}

@Injectable()
class ChatService {
  constructor(private readonly prisma: PrismaService, private readonly access: AccessService) {}

  async send(user: JwtUser, dto: MessageDto) {
    const textContent = (dto.messageText || dto.text || '').trim();
    if (!textContent) throw new BadRequestException('A mensagem não pode ser vazia.');

    await this.access.pair(user, dto.receiverId);
    const msg = await this.prisma.chatMessage.create({
      data: {
        senderId: user.sub,
        receiverId: dto.receiverId,
        messageText: textContent,
      },
    });

    return {
      id: msg.id,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      messageText: msg.messageText,
      text: msg.messageText,
      isRead: msg.isRead,
      createdAt: msg.createdAt,
      timestamp: msg.createdAt.getTime(),
    };
  }

  async sync(user: JwtUser, partnerId: string, since?: string | number) {
    if (!partnerId || typeof partnerId !== 'string' || partnerId.trim() === '') {
      throw new BadRequestException('O parâmetro partnerId é obrigatório.');
    }
    await this.access.pair(user, partnerId.trim());

    let cursorDate = new Date(0);
    if (since !== undefined && since !== null && since !== '') {
      const num = Number(since);
      if (!isNaN(num) && num > 0) {
        cursorDate = new Date(num);
      } else {
        const parsed = new Date(String(since));
        if (!isNaN(parsed.getTime())) cursorDate = parsed;
      }
    }

    const messages = await this.prisma.chatMessage.findMany({
      where: {
        createdAt: { gt: cursorDate },
        OR: [
          { senderId: user.sub, receiverId: partnerId },
          { senderId: partnerId, receiverId: user.sub },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    await this.prisma.chatMessage.updateMany({
      where: { senderId: partnerId, receiverId: user.sub, isRead: false },
      data: { isRead: true },
    });

    return messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      receiverId: m.receiverId,
      messageText: m.messageText,
      text: m.messageText,
      isRead: m.isRead,
      createdAt: m.createdAt,
      timestamp: m.createdAt.getTime(),
    }));
  }

  async unreadCount(user: JwtUser) {
    const count = await this.prisma.chatMessage.count({
      where: { receiverId: user.sub, isRead: false },
    });
    return { count, hasUnread: count > 0 };
  }
}

@Injectable()
class ReportsService {
  constructor(private readonly prisma: PrismaService) {}
  async export(user: JwtUser, month: number, year: number) {
    if (user.role !== Role.PROFESSIONAL) throw new ForbiddenException();
    const safeMonth = Number(month);
    const safeYear = Number(year);
    if (isNaN(safeMonth) || safeMonth < 1 || safeMonth > 12 || isNaN(safeYear) || safeYear < 2020) {
      throw new BadRequestException('Competência inválida.');
    }
    const from = new Date(Date.UTC(safeYear, safeMonth - 1, 1));
    const to = new Date(Date.UTC(safeYear, safeMonth, 1));
    const rows = await this.prisma.consultation.findMany({
      where: {
        professionalId: user.sub,
        paymentStatus: PaymentStatus.PAID,
        paymentConfirmedAt: { gte: from, lt: to },
      },
      orderBy: { dateTime: 'asc' },
    });
    const grouped = new Map<string, { paciente: string; cpf: string | null; dates: string[]; total: number }>();
    for (const row of rows) {
      const key = `${row.patientNameForTax}|${row.patientCpfForTax ?? ''}`;
      const item = grouped.get(key) ?? { paciente: row.patientNameForTax, cpf: row.patientCpfForTax, dates: [], total: 0 };
      item.dates.push(row.dateTime.toISOString().slice(0, 10));
      item.total += Number(row.sessionPrice);
      grouped.set(key, item);
    }
    return [...grouped.values()].map((item) => ({ ...item, total: Number(item.total.toFixed(2)) }));
  }
}


@ApiTags('care')
@ApiBearerAuth('JWT-auth')
@Controller('care')
class CareController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('professional/patients') @ApiOperation({ summary: 'Listar pacientes vinculados e gerar convite' }) listProfessionalPatients(@CurrentUser() user: JwtUser) { return this.dashboard.listProfessionalPatients(user); }
  @Post('professional/invitations') @ApiOperation({ summary: 'Criar um novo convite para paciente' }) createInvitation(@CurrentUser() user: JwtUser) { return this.dashboard.createInvitation(user); }
  @Get('patient/dashboard') @ApiOperation({ summary: 'Buscar dados do dashboard do paciente' }) getPatientDashboard(@CurrentUser() user: JwtUser) { return this.dashboard.getPatientDashboard(user); }
  @Post('patient/invitations/accept') @ApiOperation({ summary: 'Aceitar um convite e trocar de profissional' }) acceptInvite(@CurrentUser() user: JwtUser, @Body() body: InviteTokenDto) { return this.dashboard.connectPatientToInvitation(user, body.token); }
}

@ApiTags('consultations')
@ApiBearerAuth('JWT-auth')
@Controller('consultations')
class ConsultationsController {
  constructor(private readonly service: ConsultationsService) {}
  @Get() @ApiOperation({ summary: 'Listar consultas' }) list(@CurrentUser() user: JwtUser) { return this.service.list(user); }
  @Post() @ApiOperation({ summary: 'Agendar consulta (PROFESSIONAL)' }) create(@CurrentUser() user: JwtUser, @Body() dto: CreateConsultationDto) { return this.service.create(user, dto); }
  @Patch(':id') @ApiOperation({ summary: 'Editar consulta (PROFESSIONAL)' }) update(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateConsultationDto) { return this.service.update(user, id, dto); }
  @Patch(':id/cancel') @ApiOperation({ summary: 'Cancelar consulta' }) cancel(@CurrentUser() user: JwtUser, @Param('id') id: string) { return this.service.cancel(user, id); }
  @Patch(':id/payment') @ApiOperation({ summary: 'Confirmar pagamento PIX' }) confirm(@CurrentUser() user: JwtUser, @Param('id') id: string) { return this.service.confirmPayment(user, id); }
}


@ApiTags('assessments')
@ApiBearerAuth('JWT-auth')
@Controller('assessments')
class AssessmentsController {
  constructor(private readonly service: AssessmentsService) {}
  @Post() @ApiOperation({ summary: 'Registrar autoavaliação (PATIENT)' }) create(@CurrentUser() user: JwtUser, @Body() dto: AssessmentDto) { return this.service.create(user, dto); }
  @Get(':patientId') @ApiOperation({ summary: 'Listar avaliações de um paciente' }) list(@CurrentUser() user: JwtUser, @Param('patientId') patientId: string) { return this.service.list(user, patientId); }
}

@ApiTags('guidelines')
@ApiBearerAuth('JWT-auth')
@Controller('guidelines')
class GuidelinesController {
  constructor(private readonly service: AssessmentsService) {}
  @Get(':patientId') @ApiOperation({ summary: 'Listar orientações de um paciente' }) list(@CurrentUser() user: JwtUser, @Param('patientId') patientId: string) { return this.service.guidelines(user, patientId); }
  @Post(':patientId') @ApiOperation({ summary: 'Adicionar orientação (PROFESSIONAL)' }) add(@CurrentUser() user: JwtUser, @Param('patientId') patientId: string, @Body() dto: GuidelineDto) { return this.service.addGuideline(user, patientId, dto); }
}

@ApiTags('chat')
@ApiBearerAuth('JWT-auth')
@Controller('chat/messages')
class ChatController {
  constructor(private readonly service: ChatService) {}
  @Post() @ApiOperation({ summary: 'Enviar mensagem' }) send(@CurrentUser() user: JwtUser, @Body() dto: MessageDto) { return this.service.send(user, dto); }
  @Get('sync')
  @ApiOperation({ summary: 'Sincronizar mensagens (polling)' })
  sync(
    @CurrentUser() user: JwtUser,
    @Query('partnerId') partnerId: string,
    @Query('since') since?: string,
  ) {
    if (!partnerId) throw new BadRequestException('O parâmetro partnerId é obrigatório.');
    return this.service.sync(user, partnerId, since);
  }

  @Get('unread')
  @ApiOperation({ summary: 'Verificar se existem mensagens não lidas' })
  unread(@CurrentUser() user: JwtUser) {
    return this.service.unreadCount(user);
  }
}

@ApiTags('reports')
@ApiBearerAuth('JWT-auth')
@Controller('reports')
class ReportsController {
  constructor(private readonly service: ReportsService) {}
  @Get('export') @ApiOperation({ summary: 'Exportar Carnê-Leão por competência (PROFESSIONAL)' }) export(@CurrentUser() user: JwtUser, @Query('month') month: string, @Query('year') year: string) { return this.service.export(user, Number(month), Number(year)); }
}

@Module({
  controllers: [CareController, ConsultationsController, AssessmentsController, GuidelinesController, ChatController, ReportsController],
  providers: [AccessService, DashboardService, ConsultationsService, AssessmentsService, ChatService, ReportsService],
})
export class CareModule {}
