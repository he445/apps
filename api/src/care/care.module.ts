import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BillingType, ChatMessage, ConsultationStatus, InvitationStatus, PaymentStatus, Role, SelfAssessment } from '@prisma/client';
import { randomBytes } from 'crypto';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, registerDecorator, ValidationOptions } from 'class-validator';
import { CurrentUser, JwtUser } from '../common/auth';
import { APP_TIMEZONE, dayRangeInAppTimezone, isIsoWithOffset } from '../common/time';
import { PrismaService } from '../common/prisma.service';
import { EncryptionService } from '../common/encryption.service';

/**
 * Payload limits. These mirror the column widths in `schema.prisma`: validating here
 * turns what would be a database error into a 400 with a readable message.
 */
const NOTE_MAX_LENGTH = 150;
const GUIDELINE_TITLE_MAX_LENGTH = 120;
const GUIDELINE_TEXT_MAX_LENGTH = 500;
const MESSAGE_MAX_LENGTH = 1000;

/** Default session length, used to detect overlapping bookings. */
const DEFAULT_SESSION_MINUTES = 50;

/** Score used when the patient submits an assessment without answering an item. */
const NEUTRAL_SCORE = 3;

/** How many past assessments the progress charts read. */
const ASSESSMENT_HISTORY_DAYS = 90;

/**
 * Wellbeing index on a 1–5 scale. Anxiety is inverted (6 - score) so that every term
 * points the same way: higher is better. Kept here because the professional dashboard,
 * the patient dashboard and both assessment endpoints all report it.
 */
function wellbeingIndex(scores: {
  moodScore: number;
  sleepScore: number;
  energyScore: number;
  anxietyScore: number;
}): number {
  const { moodScore, sleepScore, energyScore, anxietyScore } = scores;
  return Number(((moodScore + sleepScore + energyScore + (6 - anxietyScore)) / 4).toFixed(2));
}

/**
 * Requires ISO 8601 with an explicit offset. `@IsDateString()` accepted
 * "2026-09-02T14:00:00", which the server (running in UTC) read as 14:00 UTC —
 * three hours ahead of whoever booked 14:00 in São Paulo.
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
  @IsOptional() @IsString() @MaxLength(NOTE_MAX_LENGTH) note?: string;
}

class GuidelineDto {
  // Optional: the API ships separately from the web app, and a cached older bundle
  // still posts `text` alone. Without a title the board falls back to a generic label.
  @IsOptional() @IsString() @MinLength(1) @MaxLength(GUIDELINE_TITLE_MAX_LENGTH) title?: string;
  @IsString() @MinLength(1) @MaxLength(GUIDELINE_TEXT_MAX_LENGTH) text!: string;
}

class MessageDto {
  @IsString() receiverId!: string;
  @IsString() @MinLength(1) @MaxLength(MESSAGE_MAX_LENGTH) text!: string;
}

class InviteTokenDto {
  @IsString() @MinLength(6) @MaxLength(64) token!: string;
}

/** Resolves and enforces the professional–patient link behind every clinical route. */
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
  constructor(private readonly prisma: PrismaService, private readonly crypto: EncryptionService) {}

  async listProfessionalPatients(user: JwtUser) {
    if (user.role !== Role.PROFESSIONAL) throw new ForbiddenException('Apenas profissionais podem acessar esta área.');

    const connectionRows = await this.prisma.professionalPatient.findMany({
      where: { professionalId: user.sub, patient: { isDeleted: false } },
      include: { patient: { select: { id: true, fullName: true, email: true, cpf: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Was 2 queries per patient inside a Promise.all (findFirst + count): 40 patients
    // meant 80 round trips on every dashboard load. Now 3 fixed queries regardless of
    // N, joined in memory through a Map.
    const patientIds = connectionRows.map((row) => row.patientId);

    const latestPerPatient = patientIds.length === 0 ? [] : await this.prisma.selfAssessment.groupBy({
      by: ['patientId'],
      where: { patientId: { in: patientIds } },
      _max: { createdAt: true },
    });
    const latestDateByPatient = new Map(
      latestPerPatient
        .filter((row): row is typeof row & { _max: { createdAt: Date } } => row._max.createdAt !== null)
        .map((row) => [row.patientId, row._max.createdAt]),
    );

    const latestRows = latestDateByPatient.size === 0 ? [] : await this.prisma.selfAssessment.findMany({
      where: {
        OR: [...latestDateByPatient.entries()].map(([patientId, createdAt]) => ({ patientId, createdAt })),
      },
      select: { patientId: true, createdAt: true, moodScore: true, sleepScore: true, energyScore: true, anxietyScore: true },
    });
    const latestByPatient = new Map(latestRows.map((row) => [row.patientId, row]));

    const pendingCounts = patientIds.length === 0 ? [] : await this.prisma.consultation.groupBy({
      by: ['patientId'],
      where: { professionalId: user.sub, patientId: { in: patientIds }, paymentStatus: { not: PaymentStatus.PAID } },
      _count: true,
    });
    const pendingByPatient = new Map(pendingCounts.map((row) => [row.patientId, row._count]));

    const patients = connectionRows.map((row) => {
      const latestAssessment = latestByPatient.get(row.patientId);
      return {
        id: row.patient.id,
        name: row.patient.fullName,
        email: row.patient.email,
        cpf: row.patient.cpf || undefined,
        latestMood: latestAssessment
          ? {
              date: latestAssessment.createdAt.toISOString().slice(0, 10),
              moodScore: latestAssessment.moodScore,
              wellbeingIndex: wellbeingIndex(latestAssessment),
            }
          : null,
        pendingPaymentsCount: pendingByPatient.get(row.patientId) ?? 0,
      };
    });

    const inviteToken = await this.createInviteToken(user.sub);
    return {
      patients,
      inviteCode: inviteToken,
      inviteLink: this.buildInviteLink(inviteToken),
    };
  }

  async createInvitation(user: JwtUser) {
    if (user.role !== Role.PROFESSIONAL) throw new ForbiddenException('Apenas profissionais podem gerar convites.');
    // Asking for an invitation always mints a fresh link. The previous one stays valid
    // so that links already sent to patients keep working.
    const token = await this.createInviteToken(user.sub, true);
    return { inviteCode: token, inviteLink: this.buildInviteLink(token) };
  }

  async getPatientDashboard(user: JwtUser) {
    if (user.role !== Role.PATIENT) throw new ForbiddenException('Apenas pacientes podem acessar este painel.');

    const connection = await this.prisma.professionalPatient.findFirst({
      where: { patientId: user.sub },
      include: { professional: { select: { id: true, fullName: true, settings: { select: { pixKey: true } } } } },
    });

    // Day window in the product's timezone, not the server's (which runs in UTC).
    const { start: todayStart, end: todayEnd } = dayRangeInAppTimezone();

    const todaysAssessment = await this.prisma.selfAssessment.findFirst({
      where: { patientId: user.sub, createdAt: { gte: todayStart, lte: todayEnd } },
      orderBy: { createdAt: 'desc' },
    });

    const guidelines = await this.prisma.guideline.findMany({
      where: { patientId: user.sub },
      orderBy: { createdAt: 'desc' },
    });

    return {
      professionalId: connection?.professional.id,
      professionalName: connection?.professional.fullName ?? 'Aguardando vínculo com um profissional',
      pixKey: connection?.professional.settings?.pixKey || '',
      hasEvaluatedToday: !!todaysAssessment,
      todaysMood: todaysAssessment
        ? {
            moodScore: todaysAssessment.moodScore,
            sleepScore: todaysAssessment.sleepScore,
            energyScore: todaysAssessment.energyScore,
            anxietyScore: todaysAssessment.anxietyScore,
            socialInteraction: todaysAssessment.socialInteraction,
            note: this.crypto.read(todaysAssessment.encryptedNote, todaysAssessment.noteKeyVersion, todaysAssessment.quickNote),
            wellbeingIndex: wellbeingIndex(todaysAssessment),
          }
        : null,
      guidelines: guidelines.map((guideline) => ({
        id: guideline.id,
        // Guidelines written before the title column existed keep a generic label.
        title: this.crypto.readOptional(guideline.encryptedTitle, guideline.titleKeyVersion, null) ?? 'Orientação recebida',
        content: this.crypto.read(guideline.encryptedText, guideline.textKeyVersion, guideline.text),
        date: guideline.createdAt.toISOString().slice(0, 10),
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

      // Switching is destructive from the patient's point of view: the clinical rows
      // stay in the database, but every read goes through AccessService.pair, so chat,
      // assessments and guidelines with the previous professional become unreachable
      // for both sides. It used to happen silently and leave no trace.
      const previous = await tx.professionalPatient.findUnique({ where: { patientId: user.sub } });
      if (previous && previous.professionalId !== invitation.professionalId) {
        await tx.auditLog.create({
          data: {
            actorId: user.sub,
            targetId: previous.professionalId,
            action: 'PROFESSIONAL_SWITCHED',
            details: `Paciente ${user.email} trocou do profissional ${previous.professionalId} para ${invitation.professionalId}.`,
          },
        });
      }

      await tx.professionalPatient.deleteMany({ where: { patientId: user.sub } });
      await tx.professionalPatient.create({
        data: { professionalId: invitation.professionalId, patientId: user.sub },
      });

      return {
        success: true,
        professionalId: invitation.professionalId,
        professionalName: invitation.professional.fullName,
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
    // WEB_ORIGIN is validated as a single URL at boot; extra CORS origins live in
    // CORS_ORIGINS and do not take part here.
    const baseUrl = process.env.WEB_ORIGIN?.trim().replace(/\/$/, '') || 'http://localhost:5173';
    return `${baseUrl}/invite/${token}`;
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
   * Blocks double-booking the same slot. The schedule does not model session length
   * yet, so the window uses the default until it becomes configurable per professional.
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
      const when = conflict.dateTime.toLocaleString('pt-BR', { timeZone: APP_TIMEZONE });
      throw new ConflictException(
        `Conflito de agenda: já existe consulta com ${conflict.patientNameForTax} em ${when}.`,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly crypto: EncryptionService,
  ) {}
  async create(user: JwtUser, dto: AssessmentDto) {
    if (user.role !== Role.PATIENT) throw new ForbiddenException('A autoavaliação pertence ao paciente.');

    const moodScore = dto.moodScore ?? NEUTRAL_SCORE;
    const anxietyScore = dto.anxietyScore ?? NEUTRAL_SCORE;
    const sleepScore = dto.sleepScore ?? NEUTRAL_SCORE;
    const energyScore = dto.energyScore ?? NEUTRAL_SCORE;
    const socialInteraction = dto.socialInteraction ?? true;
    const note = dto.note;

    // Day window in the product's timezone, not the server's (which runs in UTC).
    const { start: todayStart, end: todayEnd } = dayRangeInAppTimezone();

    const existingToday = await this.prisma.selfAssessment.findFirst({
      where: { patientId: user.sub, createdAt: { gte: todayStart, lte: todayEnd } },
      orderBy: { createdAt: 'desc' },
    });

    const noteColumns = {
      // Dual write during the migration: the plaintext column goes away in Release B,
      // once the backfill confirms everything is encrypted.
      quickNote: note,
      encryptedNote: note ? this.crypto.encrypt(note) : null,
      noteKeyVersion: note ? this.crypto.activeVersion : null,
    };
    const scores = { moodScore, anxietyScore, sleepScore, energyScore, socialInteraction };

    const record = existingToday
      ? await this.prisma.selfAssessment.update({
          where: { id: existingToday.id },
          data: { ...scores, ...noteColumns },
        })
      : await this.prisma.selfAssessment.create({
          data: { patientId: user.sub, ...scores, ...noteColumns },
        });

    return this.toResponse(record);
  }

  async list(user: JwtUser, patientId: string) {
    if (user.sub !== patientId) await this.access.pair(user, patientId);
    const assessments = await this.prisma.selfAssessment.findMany({
      where: { patientId },
      orderBy: { createdAt: 'asc' },
      take: ASSESSMENT_HISTORY_DAYS,
    });
    return assessments.map((assessment) => this.toResponse(assessment));
  }

  /**
   * Explicit shape on purpose: spreading the Prisma row leaked `encryptedNote` (the
   * ciphertext) and the duplicated plaintext `quickNote` to the client, and would break
   * the day the plaintext column is dropped.
   */
  private toResponse(row: SelfAssessment) {
    return {
      id: row.id,
      patientId: row.patientId,
      moodScore: row.moodScore,
      anxietyScore: row.anxietyScore,
      sleepScore: row.sleepScore,
      energyScore: row.energyScore,
      socialInteraction: row.socialInteraction,
      note: this.crypto.readOptional(row.encryptedNote, row.noteKeyVersion, row.quickNote),
      wellbeingIndex: wellbeingIndex(row),
      date: row.createdAt.toISOString().slice(0, 10),
      createdAt: row.createdAt,
    };
  }

}

/** Therapeutic guidelines the professional posts to the patient's board. */
@Injectable()
class GuidelinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly crypto: EncryptionService,
  ) {}

  async add(user: JwtUser, patientId: string, dto: GuidelineDto) {
    if (user.role !== Role.PROFESSIONAL) throw new ForbiddenException('Apenas o profissional envia orientações.');
    await this.access.pair(user, patientId);

    const title = dto.title?.trim() || null;
    const created = await this.prisma.guideline.create({
      data: {
        professionalId: user.sub,
        patientId,
        // Dual write during the migration, as with chat messages and notes.
        text: dto.text,
        encryptedText: this.crypto.encrypt(dto.text),
        textKeyVersion: this.crypto.activeVersion,
        // The title has no plaintext column: it was added after encryption landed.
        encryptedTitle: title ? this.crypto.encrypt(title) : null,
        titleKeyVersion: title ? this.crypto.activeVersion : null,
      },
    });

    return {
      id: created.id,
      patientId: created.patientId,
      professionalId: created.professionalId,
      title,
      text: dto.text,
      createdAt: created.createdAt,
    };
  }

  async list(user: JwtUser, patientId: string) {
    if (user.sub !== patientId) await this.access.pair(user, patientId);
    const rows = await this.prisma.guideline.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } });
    // Explicit shape: spreading the row would hand the ciphertext to the client and
    // break once the plaintext column is dropped.
    return rows.map((row) => ({
      id: row.id,
      patientId: row.patientId,
      professionalId: row.professionalId,
      title: this.crypto.readOptional(row.encryptedTitle, row.titleKeyVersion, null),
      text: this.crypto.read(row.encryptedText, row.textKeyVersion, row.text),
      createdAt: row.createdAt,
    }));
  }
}

@Injectable()
class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly crypto: EncryptionService,
  ) {}

  async send(user: JwtUser, dto: MessageDto) {
    const text = dto.text.trim();
    if (!text) throw new BadRequestException('A mensagem não pode ser vazia.');

    await this.access.pair(user, dto.receiverId);
    const message = await this.prisma.chatMessage.create({
      data: {
        senderId: user.sub,
        receiverId: dto.receiverId,
        // Dual write during the migration: the plaintext column goes away in Release B,
        // once the backfill confirms everything is encrypted.
        messageText: text,
        encryptedText: this.crypto.encrypt(text),
        textKeyVersion: this.crypto.activeVersion,
      },
    });

    return this.toResponse(message, text);
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

    // Only worth writing if the batch actually brought something unread from the
    // partner. This used to run unconditionally: with 3-second polling that was ~20
    // UPDATEs per minute per open tab even with no new message, which kept the
    // database permanently awake and blocked Neon's auto-suspend — the single largest
    // consumer of the free tier.
    const hasUnreadFromPartner = messages.some((m) => m.senderId === partnerId && !m.isRead);
    if (hasUnreadFromPartner) {
      await this.prisma.chatMessage.updateMany({
        where: { senderId: partnerId, receiverId: user.sub, isRead: false },
        data: { isRead: true },
      });
    }

    return messages.map((message) =>
      this.toResponse(message, this.crypto.read(message.encryptedText, message.textKeyVersion, message.messageText)),
    );
  }

  async unreadCount(user: JwtUser) {
    const count = await this.prisma.chatMessage.count({
      where: { receiverId: user.sub, isRead: false },
    });
    return { count, hasUnread: count > 0 };
  }

  /** `text` comes in already decrypted so this never touches the ciphertext columns. */
  private toResponse(row: ChatMessage, text: string) {
    return {
      id: row.id,
      senderId: row.senderId,
      receiverId: row.receiverId,
      text,
      isRead: row.isRead,
      createdAt: row.createdAt,
    };
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
    // Carnê-Leão is declared per payer, not per session: group by the tax identity
    // recorded on the consultation, which survives the patient deleting their account.
    const grouped = new Map<string, { patientName: string; cpf: string | null; dates: string[]; total: number }>();
    for (const row of rows) {
      const key = `${row.patientNameForTax}|${row.patientCpfForTax ?? ''}`;
      const item = grouped.get(key) ?? { patientName: row.patientNameForTax, cpf: row.patientCpfForTax, dates: [], total: 0 };
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

  @Get('professional/patients') @ApiOperation({ summary: 'List linked patients and issue an invitation' }) listProfessionalPatients(@CurrentUser() user: JwtUser) { return this.dashboard.listProfessionalPatients(user); }
  @Post('professional/invitations') @ApiOperation({ summary: 'Create a new patient invitation' }) createInvitation(@CurrentUser() user: JwtUser) { return this.dashboard.createInvitation(user); }
  @Get('patient/dashboard') @ApiOperation({ summary: 'Load the patient dashboard' }) getPatientDashboard(@CurrentUser() user: JwtUser) { return this.dashboard.getPatientDashboard(user); }
  @Post('patient/invitations/accept') @ApiOperation({ summary: 'Accept an invitation and switch professional' }) acceptInvite(@CurrentUser() user: JwtUser, @Body() body: InviteTokenDto) { return this.dashboard.connectPatientToInvitation(user, body.token); }
}

@ApiTags('consultations')
@ApiBearerAuth('JWT-auth')
@Controller('consultations')
class ConsultationsController {
  constructor(private readonly service: ConsultationsService) {}
  @Get() @ApiOperation({ summary: 'List consultations' }) list(@CurrentUser() user: JwtUser) { return this.service.list(user); }
  @Post() @ApiOperation({ summary: 'Book a consultation (PROFESSIONAL)' }) create(@CurrentUser() user: JwtUser, @Body() dto: CreateConsultationDto) { return this.service.create(user, dto); }
  @Patch(':id') @ApiOperation({ summary: 'Edit a consultation (PROFESSIONAL)' }) update(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateConsultationDto) { return this.service.update(user, id, dto); }
  @Patch(':id/cancel') @ApiOperation({ summary: 'Cancel a consultation' }) cancel(@CurrentUser() user: JwtUser, @Param('id') id: string) { return this.service.cancel(user, id); }
  @Patch(':id/payment') @ApiOperation({ summary: 'Confirm a PIX payment' }) confirm(@CurrentUser() user: JwtUser, @Param('id') id: string) { return this.service.confirmPayment(user, id); }
}


@ApiTags('assessments')
@ApiBearerAuth('JWT-auth')
@Controller('assessments')
class AssessmentsController {
  constructor(private readonly service: AssessmentsService) {}
  @Post() @ApiOperation({ summary: 'Record the daily self-assessment (PATIENT)' }) create(@CurrentUser() user: JwtUser, @Body() dto: AssessmentDto) { return this.service.create(user, dto); }
  @Get(':patientId') @ApiOperation({ summary: 'List a patient self-assessment history' }) list(@CurrentUser() user: JwtUser, @Param('patientId') patientId: string) { return this.service.list(user, patientId); }
}

@ApiTags('guidelines')
@ApiBearerAuth('JWT-auth')
@Controller('guidelines')
class GuidelinesController {
  constructor(private readonly service: GuidelinesService) {}
  @Get(':patientId') @ApiOperation({ summary: 'List the guidelines sent to a patient' }) list(@CurrentUser() user: JwtUser, @Param('patientId') patientId: string) { return this.service.list(user, patientId); }
  @Post(':patientId') @ApiOperation({ summary: 'Send a guideline to a patient (PROFESSIONAL)' }) add(@CurrentUser() user: JwtUser, @Param('patientId') patientId: string, @Body() dto: GuidelineDto) { return this.service.add(user, patientId, dto); }
}

@ApiTags('chat')
@ApiBearerAuth('JWT-auth')
@Controller('chat/messages')
class ChatController {
  constructor(private readonly service: ChatService) {}
  @Post() @ApiOperation({ summary: 'Send a message' }) send(@CurrentUser() user: JwtUser, @Body() dto: MessageDto) { return this.service.send(user, dto); }
  @Get('sync')
  @ApiOperation({ summary: 'Sync messages (polling)' })
  sync(
    @CurrentUser() user: JwtUser,
    @Query('partnerId') partnerId: string,
    @Query('since') since?: string,
  ) {
    if (!partnerId) throw new BadRequestException('O parâmetro partnerId é obrigatório.');
    return this.service.sync(user, partnerId, since);
  }

  @Get('unread')
  @ApiOperation({ summary: 'Check for unread messages' })
  unread(@CurrentUser() user: JwtUser) {
    return this.service.unreadCount(user);
  }
}

@ApiTags('reports')
@ApiBearerAuth('JWT-auth')
@Controller('reports')
class ReportsController {
  constructor(private readonly service: ReportsService) {}
  @Get('export') @ApiOperation({ summary: 'Export the Carnê-Leão ledger for a month (PROFESSIONAL)' }) export(@CurrentUser() user: JwtUser, @Query('month') month: string, @Query('year') year: string) { return this.service.export(user, Number(month), Number(year)); }
}

@Module({
  controllers: [CareController, ConsultationsController, AssessmentsController, GuidelinesController, ChatController, ReportsController],
  providers: [AccessService, DashboardService, ConsultationsService, AssessmentsService, GuidelinesService, ChatService, ReportsService],
})
export class CareModule {}
