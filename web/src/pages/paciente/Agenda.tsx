import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Button, Card, Skeleton } from '../../components/UI';
import { toast } from 'sonner';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  XCircle,
  AlertCircle,
  CheckCircle,
  ShieldCheck,
  Tag,
  DollarSign,
} from 'lucide-react';

interface Consultation {
  id: string;
  dateTime: string;
  sessionPrice: string | number;
  billingType: 'PER_SESSION' | 'MONTHLY_CONSOLIDATED';
  status: 'SCHEDULED' | 'COMPLETED' | 'PATIENT_NO_SHOW' | 'CANCELLED';
  paymentStatus: 'PENDING' | 'ADDED_TO_TAB' | 'PAID';
  professional?: {
    fullName: string;
  };
}

export default function AgendaPaciente() {
  const [loading, setLoading] = useState(true);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [psychologistName, setPsychologistName] = useState<string>('');

  const fetchConsultations = async () => {
    setLoading(true);
    try {
      const [consultationsRes, dashboardRes] = await Promise.all([
        api.get('/consultations'),
        api.get('/care/patient/dashboard'),
      ]);
      setConsultations(consultationsRes.data || []);
      setPsychologistName(dashboardRes.data?.psychologistName || 'Seu Psicólogo');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar agenda.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsultations();
  }, []);

  const handleCancel = async (id: string) => {
    if (!window.confirm('Deseja solicitar o cancelamento desta consulta?')) return;
    try {
      await api.patch(`/consultations/${id}/cancel`);
      toast.success('Solicitação de cancelamento enviada.');
      fetchConsultations();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Não foi possível cancelar a consulta.';
      toast.error(msg);
    }
  };

  const upcomingConsultations = consultations.filter(
    (c) => c.status === 'SCHEDULED'
  );

  const pastConsultations = consultations.filter(
    (c) => c.status !== 'SCHEDULED'
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-full">
            <Clock className="h-3 w-3 text-emerald-600" />
            Confirmada
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-800 bg-blue-100 border border-blue-300 px-2.5 py-1 rounded-full">
            <CheckCircle className="h-3 w-3 text-blue-600" />
            Concluída
          </span>
        );
      case 'PATIENT_NO_SHOW':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-800 bg-rose-100 border border-rose-300 px-2.5 py-1 rounded-full">
            <AlertCircle className="h-3 w-3 text-rose-600" />
            Ausente
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300 px-2.5 py-1 rounded-full">
            <XCircle className="h-3 w-3 text-gray-500" />
            Cancelada
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Header Banner */}
      <div>
        <h1 className="text-2xl font-bold text-[#2C332D] tracking-tight flex items-center gap-2">
          <CalendarIcon className="h-7 w-7 text-[#7A8B76]" />
          Minhas Consultas
        </h1>
        <p className="text-sm text-[#6D736E] mt-1">
          Acompanhe os horários de sessões agendadas com seu profissional.
        </p>
      </div>

      {/* Info Card */}
      <Card className="bg-[#7A8B76]/10 border border-[#7A8B76]/20 p-5 rounded-2xl flex items-center gap-4">
        <div className="bg-[#7A8B76] text-white p-3 rounded-xl shrink-0">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-[#2C332D]">
            Atendimento com {psychologistName}
          </span>
          <span className="text-xs text-[#6D736E] leading-relaxed">
            Seus agendamentos são gerenciados diretamente pelo seu psicólogo. Em caso de dúvidas sobre reagendamento, entre em contato via Chat.
          </span>
        </div>
      </Card>

      {/* Upcoming Consultations */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-[#2C332D]">
          Próximas Sessões ({upcomingConsultations.length})
        </h2>

        {loading ? (
          <Skeleton className="h-24 w-full rounded-2xl" />
        ) : upcomingConsultations.length === 0 ? (
          <Card className="p-8 text-center flex flex-col items-center gap-2">
            <CalendarIcon className="h-10 w-10 text-[#6D736E]/40" />
            <p className="text-sm text-[#6D736E]">
              Você não possui consultas agendadas no momento.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {upcomingConsultations.map((c) => {
              const dt = new Date(c.dateTime);
              const dateFormatted = dt.toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              });
              const timeFormatted = dt.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <Card
                  key={c.id}
                  className="p-5 shadow-2xs border border-[#7A8B76]/20 bg-white rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="bg-[#7A8B76]/10 text-[#7A8B76] p-3 rounded-2xl shrink-0">
                      <User className="h-6 w-6" />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base text-[#2C332D]">
                          Sessão com {c.professional?.fullName || psychologistName}
                        </span>
                        {getStatusBadge(c.status)}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-[#6D736E] flex-wrap mt-1">
                        <span className="flex items-center gap-1 font-semibold text-[#2C332D]">
                          <CalendarIcon className="h-3.5 w-3.5 text-[#7A8B76]" />
                          {dateFormatted} às {timeFormatted}
                        </span>

                        <span className="flex items-center gap-1">
                          <Tag className="h-3.5 w-3.5 text-[#7A8B76]" />
                          {c.billingType === 'MONTHLY_CONSOLIDATED'
                            ? 'Mensalidade'
                            : 'Por Sessão'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-[#6D736E]/10">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-bold text-[#2C332D]">
                        R$ {Number(c.sessionPrice).toFixed(2)}
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleCancel(c.id)}
                      className="text-rose-600 hover:bg-rose-50 border-rose-200 text-xs px-3 py-1.5"
                    >
                      Cancelar Consulta
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Past / Cancelled Consultations */}
      {pastConsultations.length > 0 && (
        <div className="flex flex-col gap-4 mt-4">
          <h2 className="text-lg font-bold text-[#2C332D]">Histórico de Sessões</h2>

          <div className="flex flex-col gap-3">
            {pastConsultations.map((c) => {
              const dt = new Date(c.dateTime);
              const dateFormatted = dt.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              });
              const timeFormatted = dt.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <Card
                  key={c.id}
                  className="p-4 bg-gray-50/70 border border-gray-200 rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="h-4 w-4 text-[#6D736E]" />
                    <div className="flex flex-col">
                      <span className="font-semibold text-[#2C332D]">
                        {dateFormatted} às {timeFormatted}
                      </span>
                      <span className="text-[#6D736E]">
                        Sessão de Acompanhamento
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {getStatusBadge(c.status)}
                    <span className="font-bold text-[#2C332D]">
                      R$ {Number(c.sessionPrice).toFixed(2)}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
