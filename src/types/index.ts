/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'PROFESSIONAL' | 'PATIENT';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isDeleted: boolean;
  cpf?: string;
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
