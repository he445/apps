import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BillingType, ConsultationStatus, PaymentStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { CurrentUser, JwtUser, Roles, RolesGuard } from '../common/auth';
import { EncryptionModule, EncryptionService } from '../common/encryption.service';
import { PrismaModule, PrismaService } from '../common/prisma.service';
import { TelemetryService } from '../common/telemetry.interceptor';

/** How long persisted errors are kept. Pruned when an admin opens the panel. */
const ERROR_LOG_RETENTION_DAYS = 30;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly crypto: EncryptionService,
  ) {}

  async getOverview() {
    const [
      totalUsers,
      totalPros,
      totalPatients,
      totalAdmins,
      totalTestUsers,
      consultationStats,
      totalAssessments,
      totalMessages,
      professionalsWithPatients,
    ] = await Promise.all([
      this.prisma.user.count({ where: { isDeleted: false } }),
      this.prisma.user.count({ where: { role: Role.PROFESSIONAL, isDeleted: false } }),
      this.prisma.user.count({ where: { role: Role.PATIENT, isDeleted: false } }),
      this.prisma.user.count({ where: { role: Role.ADMIN, isDeleted: false } }),
      this.prisma.user.count({ where: { isTestUser: true, isDeleted: false } }),
      this.prisma.consultation.groupBy({
        by: ['status', 'paymentStatus'],
        _count: { id: true },
        _sum: { sessionPrice: true },
      }),
      this.prisma.selfAssessment.count(),
      this.prisma.chatMessage.count(),
      this.prisma.user.findMany({
        where: { role: Role.PROFESSIONAL, isDeleted: false },
        select: {
          id: true,
          fullName: true,
          email: true,
          crp: true,
          isTestUser: true,
          createdAt: true,
          settings: {
            select: { sessionDefaultPrice: true, pixKey: true },
          },
          connectionsAsProf: {
            select: {
              patient: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  isTestUser: true,
                  createdAt: true,
                },
              },
            },
          },
          invitations: {
            where: { status: 'PENDING' },
            select: { id: true, patientName: true, token: true, expiresAt: true },
          },
          _count: {
            select: {
              consultationsAsProf: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formattedPros = professionalsWithPatients.map((pro) => ({
      id: pro.id,
      name: pro.fullName,
      email: pro.email,
      crp: pro.crp,
      isTestUser: pro.isTestUser,
      createdAt: pro.createdAt,
      pixKey: pro.settings?.pixKey || '',
      sessionPrice: pro.settings ? Number(pro.settings.sessionDefaultPrice) : 0,
      totalConsultations: pro._count.consultationsAsProf,
      pendingInvitationsCount: pro.invitations.length,
      patientsCount: pro.connectionsAsProf.length,
      patients: pro.connectionsAsProf.map((c) => ({
        id: c.patient.id,
        name: c.patient.fullName,
        email: c.patient.email,
        isTestUser: c.patient.isTestUser,
        joinedAt: c.patient.createdAt,
      })),
    }));

    const avgPatientsPerPro =
      totalPros > 0
        ? Math.round((totalPatients / totalPros) * 10) / 10
        : 0;

    let totalRevenue = 0;
    let scheduledConsultations = 0;
    let completedConsultations = 0;
    let cancelledConsultations = 0;

    for (const stat of consultationStats) {
      if (stat.status === ConsultationStatus.SCHEDULED) {
        scheduledConsultations += stat._count.id;
      } else if (stat.status === ConsultationStatus.COMPLETED) {
        completedConsultations += stat._count.id;
      } else if (stat.status === ConsultationStatus.CANCELLED) {
        cancelledConsultations += stat._count.id;
      }
      if (stat.paymentStatus === PaymentStatus.PAID && stat._sum.sessionPrice) {
        totalRevenue += Number(stat._sum.sessionPrice);
      }
    }

    return {
      kpis: {
        totalUsers,
        totalPros,
        totalPatients,
        totalAdmins,
        totalTestUsers,
        avgPatientsPerPro,
        consultations: {
          scheduled: scheduledConsultations,
          completed: completedConsultations,
          cancelled: cancelledConsultations,
          totalRevenue,
        },
        engagement: {
          totalAssessments,
          totalMessages,
        },
      },
      professionals: formattedPros,
      telemetrySummary: TelemetryService.getSummary(),
    };
  }

  async getTelemetryRoutes() {
    return {
      summary: TelemetryService.getSummary(),
      routes: TelemetryService.getRouteStats(),
    };
  }

  /**
   * Reads the persisted errors rather than the in-memory ring, which a restart wipes.
   *
   * Pruning rides along on this call instead of a scheduler: the cost lands on an
   * administrator opening the panel, never on a request being served.
   */
  async getTelemetryErrors() {
    const cutoff = new Date(Date.now() - ERROR_LOG_RETENTION_DAYS * 86_400_000);
    await this.prisma.errorLog.deleteMany({ where: { createdAt: { lt: cutoff } } });

    const rows = await this.prisma.errorLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      errors: rows.map((row) => ({
        id: row.id,
        timestamp: row.createdAt,
        method: row.method,
        path: row.path,
        statusCode: row.statusCode,
        message: row.message,
        userId: row.userId ?? undefined,
        userRole: row.userRole ?? undefined,
        ip: row.ipAddress ?? undefined,
      })),
    };
  }

  async impersonateUser(admin: JwtUser, targetUserId: string) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { settings: true },
    });

    if (!targetUser || targetUser.isDeleted) {
      throw new NotFoundException('Usuário não encontrado ou inativo.');
    }
    if (!targetUser.isTestUser) {
      throw new ForbiddenException('A simulação é permitida somente para contas de teste.');
    }

    // Register immutable audit trail
    await this.prisma.auditLog.create({
      data: {
        actorId: admin.sub,
        targetId: targetUser.id,
        action: 'IMPERSONATION_START',
        details: `Admin ${admin.email} iniciou simulação do usuário ${targetUser.email} (${targetUser.role})`,
      },
    });

    // Generate RFC 8693 Actor Token with short 2h expiry
    const token = this.jwt.sign(
      {
        sub: targetUser.id,
        role: targetUser.role,
        email: targetUser.email,
        act: {
          sub: admin.sub,
          role: 'ADMIN',
          email: admin.email,
          ver: admin.ver,
        },
        isImpersonated: true,
        ver: targetUser.tokenVersion,
      },
      { expiresIn: '2h' }
    );

    return {
      token,
      accessToken: token,
      user: {
        id: targetUser.id,
        fullName: targetUser.fullName,
        name: targetUser.fullName,
        email: targetUser.email,
        role: targetUser.role,
        cpf: targetUser.cpf,
        crp: targetUser.crp,
        isTestUser: targetUser.isTestUser,
        pixKey: targetUser.settings?.pixKey || '',
        sessionPrice: targetUser.settings ? Number(targetUser.settings.sessionDefaultPrice) : undefined,
        cancelLimitHours: targetUser.settings?.cancellationLimitHours,
        isImpersonated: true,
      },
    };
  }

  /**
   * Issues a temporary password for a user who cannot get back in.
   *
   * There is no self-service reset: the product has no e-mail provider, so the only
   * recovery path is an administrator doing it deliberately and telling the person
   * out of band. The password is returned once in the response and stored nowhere —
   * only its hash reaches the database.
   */
  async resetUserPassword(admin: JwtUser, targetUserId: string) {
    if (admin.isImpersonated) {
      throw new ForbiddenException('Ações destrutivas são bloqueadas no modo simulação.');
    }

    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target || target.isDeleted) {
      throw new NotFoundException('Usuário não encontrado ou inativo.');
    }

    // base64url over 9 bytes gives 12 characters with no ambiguous separators to
    // garble when the admin copies it into a message.
    const temporaryPassword = randomBytes(9).toString('base64url');

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: target.id },
        data: {
          password: await bcrypt.hash(temporaryPassword, 12),
          // Same mechanism as UsersService.updateProfile: bumping the version makes
          // JwtAuthGuard reject every token already issued to this account.
          tokenVersion: { increment: 1 },
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: admin.sub,
          targetId: target.id,
          action: 'PASSWORD_RESET',
          details: `Admin ${admin.email} redefiniu a senha de ${target.email} (${target.role}).`,
        },
      }),
    ]);

    return {
      message: 'Senha temporária gerada. Ela não será exibida novamente.',
      email: target.email,
      temporaryPassword,
    };
  }

  /**
   * Seeding/clearing demo data and impersonating test accounts (below) are gated by
   * @Roles(Role.ADMIN) on the controller alone — the same level of trust as every
   * other capability in this panel (overview, telemetry). They never touch a real
   * user: they only create or delete rows with isTestUser: true, and each call records
   * the actor in AuditLog. An extra environment variable guarding just these two
   * routes was considered and dropped on purpose: an authenticated admin is already
   * the system's trust boundary, and a second lock here and nowhere else in the panel
   * was inconsistent rather than safer.
   */
  async seedSandbox(admin: JwtUser) {
    const timestamp = Date.now();
    const demoPasswordHash = await bcrypt.hash('Demo1234!', 12);

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Demo Psychologist
      const pro = await tx.user.create({
        data: {
          fullName: 'Dr. Leonardo Demo (Psi)',
          email: `psi.demo.${timestamp}@ojanuan.test`,
          password: demoPasswordHash,
          role: Role.PROFESSIONAL,
          crp: '06/98765-TEST',
          isTestUser: true,
          settings: {
            create: {
              pixKey: 'psi.demo@pix.test',
              sessionDefaultPrice: 160.0,
              cancellationLimitHours: 24,
            },
          },
        },
      });

      // 2. Create 2 Demo Patients
      const pat1 = await tx.user.create({
        data: {
          fullName: 'Ana Clara Silveira (Paciente Demo)',
          email: `paciente1.${timestamp}@ojanuan.test`,
          password: demoPasswordHash,
          role: Role.PATIENT,
          cpf: '111.222.333-44',
          isTestUser: true,
        },
      });

      const pat2 = await tx.user.create({
        data: {
          fullName: 'Bruno Henrique Ramos (Paciente Demo)',
          email: `paciente2.${timestamp}@ojanuan.test`,
          password: demoPasswordHash,
          role: Role.PATIENT,
          cpf: '555.666.777-88',
          isTestUser: true,
        },
      });

      // 3. Link Patients to Psychologist
      await tx.professionalPatient.createMany({
        data: [
          { professionalId: pro.id, patientId: pat1.id },
          { professionalId: pro.id, patientId: pat2.id },
        ],
      });

      // 4. Create Sample Consultations
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(14, 0, 0, 0);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 2);
      yesterday.setHours(10, 0, 0, 0);

      await tx.consultation.createMany({
        data: [
          {
            professionalId: pro.id,
            patientId: pat1.id,
            patientNameForTax: pat1.fullName,
            patientCpfForTax: pat1.cpf,
            dateTime: tomorrow,
            sessionPrice: 160.0,
            status: ConsultationStatus.SCHEDULED,
            billingType: BillingType.PER_SESSION,
            paymentStatus: PaymentStatus.PENDING,
          },
          {
            professionalId: pro.id,
            patientId: pat1.id,
            patientNameForTax: pat1.fullName,
            patientCpfForTax: pat1.cpf,
            dateTime: yesterday,
            sessionPrice: 160.0,
            status: ConsultationStatus.COMPLETED,
            billingType: BillingType.PER_SESSION,
            paymentStatus: PaymentStatus.PAID,
            paymentConfirmedAt: yesterday,
          },
          {
            professionalId: pro.id,
            patientId: pat2.id,
            patientNameForTax: pat2.fullName,
            patientCpfForTax: pat2.cpf,
            dateTime: tomorrow,
            sessionPrice: 160.0,
            status: ConsultationStatus.SCHEDULED,
            billingType: BillingType.PER_SESSION,
            paymentStatus: PaymentStatus.PENDING,
          },
        ],
      });

      // 5. Create Sample Self Assessments
      await tx.selfAssessment.createMany({
        data: [
          {
            patientId: pat1.id,
            moodScore: 4,
            anxietyScore: 2,
            sleepScore: 4,
            energyScore: 4,
            socialInteraction: true,
            quickNote: 'Dia produtivo e tranquilo.',
            encryptedNote: this.crypto.encrypt('Dia produtivo e tranquilo.'),
            noteKeyVersion: this.crypto.activeVersion,
          },
          {
            patientId: pat2.id,
            moodScore: 2,
            anxietyScore: 4,
            sleepScore: 2,
            energyScore: 2,
            socialInteraction: false,
            quickNote: 'Semana bastante sobrecarregada.',
            encryptedNote: this.crypto.encrypt('Semana bastante sobrecarregada.'),
            noteKeyVersion: this.crypto.activeVersion,
          },
        ],
      });

      // 6. Create Guidelines
      // Writes the way the real routes write, so the demo data has the same
      // shape as production data (plaintext and ciphertext coexist until Release B).
      const orientacao = 'Praticar o exercício de respiração diafragmática 5 minutos antes de dormir.';
      await tx.guideline.create({
        data: {
          professionalId: pro.id,
          patientId: pat1.id,
          text: orientacao,
          encryptedText: this.crypto.encrypt(orientacao),
          textKeyVersion: this.crypto.activeVersion,
          encryptedTitle: this.crypto.encrypt('Respiração antes de dormir'),
          titleKeyVersion: this.crypto.activeVersion,
        },
      });

      // 7. Audit log
      await tx.auditLog.create({
        data: {
          actorId: admin.sub,
          action: 'SANDBOX_SEED',
          details: `Admin ${admin.email} gerou persona demo: ${pro.email}`,
        },
      });

      return {
        message: 'Ambiente Sandbox e Personas de Teste geradas com sucesso!',
        testUsers: {
          professional: {
            id: pro.id,
            name: pro.fullName,
            email: pro.email,
            password: 'Demo1234!',
            role: 'PROFESSIONAL',
          },
          patients: [
            {
              id: pat1.id,
              name: pat1.fullName,
              email: pat1.email,
              password: 'Demo1234!',
              role: 'PATIENT',
            },
            {
              id: pat2.id,
              name: pat2.fullName,
              email: pat2.email,
              password: 'Demo1234!',
              role: 'PATIENT',
            },
          ],
        },
      };
    });
  }

  async cleanSandbox(admin: JwtUser) {
    const testUsers = await this.prisma.user.findMany({
      where: { isTestUser: true },
      select: { id: true },
    });

    const testUserIds = testUsers.map((u) => u.id);
    if (testUserIds.length === 0) {
      return { message: 'Nenhum usuário de teste para limpar.', count: 0 };
    }

    await this.prisma.$transaction([
      this.prisma.chatMessage.deleteMany({
        where: { OR: [{ senderId: { in: testUserIds } }, { receiverId: { in: testUserIds } }] },
      }),
      this.prisma.selfAssessment.deleteMany({ where: { patientId: { in: testUserIds } } }),
      this.prisma.guideline.deleteMany({
        where: { OR: [{ patientId: { in: testUserIds } }, { professionalId: { in: testUserIds } }] },
      }),
      this.prisma.consultation.deleteMany({
        where: { OR: [{ patientId: { in: testUserIds } }, { professionalId: { in: testUserIds } }] },
      }),
      this.prisma.professionalPatient.deleteMany({
        where: { OR: [{ patientId: { in: testUserIds } }, { professionalId: { in: testUserIds } }] },
      }),
      this.prisma.patientInvitation.deleteMany({ where: { professionalId: { in: testUserIds } } }),
      this.prisma.professionalSettings.deleteMany({ where: { professionalId: { in: testUserIds } } }),
      this.prisma.user.deleteMany({ where: { isTestUser: true } }),
      this.prisma.auditLog.create({
        data: {
          actorId: admin.sub,
          action: 'SANDBOX_CLEAN',
          details: `Admin ${admin.email} removeu ${testUserIds.length} usuários de teste.`,
        },
      }),
    ]);

    return {
      message: `${testUserIds.length} contas de teste foram removidas com total segurança.`,
      count: testUserIds.length,
    };
  }
}

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Métricas gerais e distribuição de psicólogos/pacientes' })
  getOverview() {
    return this.admin.getOverview();
  }

  @Get('telemetry/routes')
  @ApiOperation({ summary: 'Telemetria de rotas, hits e tempos de resposta médios' })
  getTelemetryRoutes() {
    return this.admin.getTelemetryRoutes();
  }

  @Get('telemetry/errors')
  @ApiOperation({ summary: 'Feed de bugs e erros 4xx/5xx em tempo real' })
  getTelemetryErrors() {
    return this.admin.getTelemetryErrors();
  }

  @Post('impersonate/:userId')
  @ApiOperation({ summary: 'Gerar Actor Token (RFC 8693) para testar conta de teste em tempo real' })
  impersonate(@CurrentUser() admin: JwtUser, @Param('userId') userId: string) {
    return this.admin.impersonateUser(admin, userId);
  }

  @Post('users/:userId/reset-password')
  @ApiOperation({ summary: 'Issue a temporary password for a user who lost access' })
  resetPassword(@CurrentUser() admin: JwtUser, @Param('userId') userId: string) {
    return this.admin.resetUserPassword(admin, userId);
  }

  @Post('sandbox/seed')
  @ApiOperation({ summary: 'Criar persona de psicólogo e pacientes demo com histórico de consultas' })
  seedSandbox(@CurrentUser() admin: JwtUser) {
    return this.admin.seedSandbox(admin);
  }

  @Delete('sandbox/clean')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Limpar todas as contas e dados de teste (isTestUser: true)' })
  cleanSandbox(@CurrentUser() admin: JwtUser) {
    return this.admin.cleanSandbox(admin);
  }
}

@Module({
  imports: [PrismaModule, EncryptionModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
