/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'PROFESSIONAL' | 'PATIENT' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isDeleted: boolean;
  isTestUser?: boolean;
  isImpersonated?: boolean;
  cpf?: string;
  crp?: string;
  pixKey?: string;
  sessionPrice?: number;
  cancelLimitHours?: number;
}

export interface MoodEntry {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  humor_geral: number; // 1-5
  qualidade_sono: number; // 1-5
  nivel_energia: number; // 1-5
  nivel_ansiedade: number; // 1-5
  interacao_social: boolean;
  nota?: string;
  indice_bem_estar: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: number;
}

export interface Orientation {
  id: string;
  patientId: string;
  title: string;
  content: string;
  date: string;
}

export interface Session {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  time: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  price: number;
}

export interface InviteInfo {
  token: string;
  psychologistId: string;
  psychologistName: string;
}

// --- ADMIN & TELEMETRY TYPES ---

export interface RouteTelemetry {
  method: string;
  path: string;
  hits: number;
  totalDurationMs: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  errorHits: number;
  lastCalledAt: string;
}

export interface TelemetrySummary {
  totalRequests: number;
  avgLatencyMs: number;
  totalErrors: number;
  errorRatePercent: number;
  activeRoutesCount: number;
}

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  message: string;
  userId?: string;
  userRole?: string;
  ip?: string;
}

export interface ProNetworkItem {
  id: string;
  name: string;
  email: string;
  crp?: string;
  isTestUser: boolean;
  createdAt: string;
  pixKey: string;
  sessionPrice: number;
  totalConsultations: number;
  pendingInvitationsCount: number;
  patientsCount: number;
  patients: {
    id: string;
    name: string;
    email: string;
    isTestUser: boolean;
    joinedAt: string;
  }[];
}

export interface AdminOverviewData {
  kpis: {
    totalUsers: number;
    totalPros: number;
    totalPatients: number;
    totalAdmins: number;
    totalTestUsers: number;
    avgPatientsPerPro: number;
    consultations: {
      scheduled: number;
      completed: number;
      cancelled: number;
      totalRevenue: number;
    };
    engagement: {
      totalAssessments: number;
      totalMessages: number;
    };
  };
  professionals: ProNetworkItem[];
  telemetrySummary: TelemetrySummary;
}

