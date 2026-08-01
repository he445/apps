/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Button, Card, Skeleton, EmptyState } from '../../components/UI';
import { toast } from 'sonner';
import { 
  UserPlus, 
  MessageSquare, 
  ChevronRight, 
  Calendar, 
  TrendingUp, 
  Copy, 
  ExternalLink,
  DollarSign
} from 'lucide-react';

interface Patient {
  id: string;
  name: string;
  email: string;
  cpf?: string;
  latestMood?: {
    date: string;
    humor_geral: number;
    indice_bem_estar: number;
  } | null;
  pendingPaymentsCount: number;
}

export default function DashboardPro() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Agenda List (mock data fetched or static since backend has sessions)
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const patientsRes = await api.get('/care/professional/patients');
        setPatients(patientsRes.data.patients);
        const code = patientsRes.data.inviteCode || '';
        setInviteCode(code);
        setInviteLink(code ? `${window.location.origin}/convite/${code}` : (patientsRes.data.inviteLink || ''));

        const financeRes = await api.get('/consultations');
        // Filter future sessions for agenda (e.g., PENDING status or future dates)
        const allSessions = financeRes.data;
        const pendingSessions = allSessions.filter((s: any) => s.status === 'PENDING');
        setSessions(pendingSessions);
      } catch (err: any) {
        console.error(err);
        toast.error('Erro ao buscar dados do dashboard.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast.success('Link de convite copiado para a área de transferência!');
  };

  const generateNewInvite = async () => {
    setIsGenerating(true);
    try {
      const res = await api.post('/care/professional/invitations');
      const code = res.data.inviteCode || res.data.code || res.data.token || '';
      setInviteCode(code);
      setInviteLink(code ? `${window.location.origin}/convite/${code}` : (res.data.inviteLink || ''));
      toast.success('Link de convite do psicólogo pronto para compartilhar.');
    } catch (err) {
      toast.error('Não foi possível obter o convite.');
    } finally {
      setIsGenerating(false);
    }
  };

  const getMoodBadgeColor = (score: number) => {
    if (score >= 4) return 'bg-emerald-100 text-emerald-800';
    if (score >= 3) return 'bg-amber-100 text-amber-800';
    return 'bg-rose-100 text-rose-800 animate-pulse border border-rose-300';
  };

  return (
    <div className="flex flex-col gap-8">
      
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2C332D] tracking-tight">Painel do Profissional</h1>
          <p className="text-sm text-[#6D736E]">
            Acompanhamento clínico de pacientes e controle operacional de consultas.
          </p>
        </div>
        <Button 
          onClick={() => setShowInviteModal(true)} 
          variant="primary" 
          className="flex items-center gap-2 shadow-sm"
        >
          <UserPlus className="h-4 w-4" />
          <span>Convidar Paciente</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Active Patients Column */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#2C332D]">Seus Pacientes Vinculados</h2>
            <span className="text-xs bg-[#7A8B76]/10 text-[#7A8B76] font-bold px-2.5 py-1 rounded-full">
              {patients.length} ativos
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : patients.length === 0 ? (
            <EmptyState
              title="Nenhum paciente conectado ainda"
              description="Compartilhe seu link de convite exclusivo para conectar pacientes e começar a acompanhar seus humores e agendamentos."
              actionLabel="Ver Link de Convite"
              onAction={() => setShowInviteModal(true)}
              icon={<UserPlus className="h-10 w-10" />}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {patients.map((p) => {
                const moodScore = p.latestMood?.indice_bem_estar || 0;
                return (
                  <Card key={p.id} className="hover:border-[#7A8B76]/30 transition-all group shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      
                      {/* Name and Info */}
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="font-bold text-[#2C332D] text-base group-hover:text-[#C16E59] transition-colors truncate">
                          {p.name}
                        </span>
                        <span className="text-xs text-[#6D736E] truncate">{p.email}</span>
                        {p.cpf && <span className="text-[11px] text-[#6D736E]">CPF: {p.cpf}</span>}
                      </div>

                      {/* Status Indices */}
                      <div className="flex flex-wrap items-center gap-3">
                        {p.latestMood ? (
                          <div className={`flex flex-col gap-0.5 px-3 py-1.5 rounded-lg ${getMoodBadgeColor(moodScore)}`}>
                            <span className="text-[10px] uppercase font-bold tracking-wider">Índice Bem-Estar</span>
                            <span className="text-xs font-bold text-center">{moodScore.toFixed(2)} / 5</span>
                          </div>
                        ) : (
                          <div className="bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg text-xs">
                            Sem avaliações hoje
                          </div>
                        )}

                        {p.pendingPaymentsCount > 0 && (
                          <div className="bg-[#B54B3C]/10 text-[#B54B3C] px-3 py-1.5 rounded-lg flex flex-col gap-0.5">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-center">Faturas</span>
                            <span className="text-xs font-bold text-center">{p.pendingPaymentsCount} pendente(s)</span>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button 
                            onClick={() => navigate(`/pro/paciente/${p.id}`)}
                            variant="outline"
                            className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-[#7A8B76]"
                          >
                            <TrendingUp className="h-4 w-4" />
                          </Button>
                          <Button 
                            onClick={() => navigate(`/paciente/chat?partnerId=${p.id}`)}
                            variant="outline"
                            title="Abrir Chat Clínico"
                            className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-[#C16E59]"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Agenda / Upcoming sessions list */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#2C332D] flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#C16E59]" />
              <span>Consultas Agendadas</span>
            </h2>
            <Button
              onClick={() => navigate('/pro/agenda')}
              variant="outline"
              className="text-xs px-3 py-1.5 border-[#7A8B76]/30 text-[#7A8B76] hover:bg-[#7A8B76]/10"
            >
              Ver Agenda Completa
            </Button>
          </div>

          <Card className="shadow-2xs">
            {loading ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-[#6D736E] text-center py-4">
                Nenhum agendamento pendente encontrado.
              </p>
            ) : (
              <div className="flex flex-col gap-3 divide-y divide-[#6D736E]/10">
                {sessions.map((s, idx) => (
                  <div key={s.id} className={`flex items-center justify-between gap-2 ${idx > 0 ? 'pt-3' : ''}`}>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-sm text-[#2C332D] truncate">{s.patientName}</span>
                      <span className="text-xs text-[#6D736E] flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        {s.date} às {s.time}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full shrink-0">
                      R$ {s.price}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Quick link to finance */}
          <Card className="bg-[#7A8B76]/5 border border-[#7A8B76]/10 flex items-center justify-between p-4 rounded-xl cursor-pointer hover:bg-[#7A8B76]/10 transition-all" onClick={() => navigate('/pro/financeiro')}>
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-[#7A8B76]" />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-[#2C332D]">Relatório Financeiro</span>
                <span className="text-xs text-[#6D736E]">Exportar recibos e imposto de renda</span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-[#6D736E]" />
          </Card>
        </div>

      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#2C332D]/40 backdrop-blur-xs" onClick={() => setShowInviteModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-[#6D736E]/15 p-6 flex flex-col gap-5 animate-fade-in">
            <div className="flex justify-between items-center border-b border-[#6D736E]/10 pb-3">
              <h3 className="text-lg font-bold text-[#2C332D]">Convidar Paciente</h3>
              <button 
                onClick={() => setShowInviteModal(false)}
                className="text-[#6D736E] hover:text-[#2C332D] p-1 rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#6D736E] leading-relaxed">
              Compartilhe o código ou o link de convite abaixo. Ao abrir o link, seu paciente será guiado para criar uma conta já vinculada automaticamente ao seu painel clínico.
            </p>

            <div className="flex flex-col gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6D736E]">Código de convite</div>
              <div className="flex gap-2 bg-[#F9F8F4] border border-[#6D736E]/20 rounded-lg p-2.5 items-center">
                <input type="text" readOnly value={inviteCode} className="bg-transparent border-none text-sm font-mono text-[#2C332D] focus:outline-none flex-1 select-all" />
                <button
                  onClick={() => navigator.clipboard.writeText(inviteCode)}
                  className="p-2 bg-white text-[#7A8B76] border border-[#7A8B76]/20 rounded-md hover:bg-[#7A8B76]/5 transition-colors"
                  title="Copiar Código"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex gap-2 bg-[#F9F8F4] border border-[#6D736E]/20 rounded-lg p-2.5 items-center">
              <input
                type="text"
                readOnly
                value={inviteLink}
                className="bg-transparent border-none text-xs text-[#2C332D] focus:outline-none flex-1 select-all"
              />
              <button
                onClick={copyInviteLink}
                className="p-2 bg-white text-[#7A8B76] border border-[#7A8B76]/20 rounded-md hover:bg-[#7A8B76]/5 transition-colors"
                title="Copiar Link"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-3 justify-end mt-2">
              <Button onClick={generateNewInvite} variant="outline" isLoading={isGenerating}>
                Gerar Novo Código
              </Button>
              <Button onClick={() => setShowInviteModal(false)} variant="outline">
                Fechar
              </Button>
              <Button onClick={copyInviteLink} variant="secondary">
                Copiar Link
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
