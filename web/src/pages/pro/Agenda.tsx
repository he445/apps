import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Button, Card, Skeleton } from '../../components/UI';
import { ModalAgendamento } from '../../components/ModalAgendamento';
import { toast } from 'sonner';
import {
  Calendar as CalendarIcon,
  Clock,
  DollarSign,
  User,
  Plus,
  Filter,
  CheckCircle,
  XCircle,
  Edit,
  AlertCircle,
  Tag,
  Search,
} from 'lucide-react';

interface Patient {
  id: string;
  name: string;
  email: string;
}

interface Consultation {
  id: string;
  patientId: string;
  patientNameForTax: string;
  patientCpfForTax?: string;
  dateTime: string;
  sessionPrice: string | number;
  billingType: 'PER_SESSION' | 'MONTHLY_CONSOLIDATED';
  status: 'SCHEDULED' | 'COMPLETED' | 'PATIENT_NO_SHOW' | 'CANCELLED';
  paymentStatus: 'PENDING' | 'ADDED_TO_TAB' | 'PAID';
  patient?: {
    id: string;
    fullName: string;
    email: string;
  };
}

export default function AgendaPro() {
  const [loading, setLoading] = useState(true);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);

  // Filters
  const [selectedPatientId, setSelectedPatientId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConsultation, setEditingConsultation] = useState<any>(null);

  const fetchConsultations = async () => {
    setLoading(true);
    try {
      const [consultationsRes, patientsRes] = await Promise.all([
        api.get('/consultations'),
        api.get('/care/professional/patients'),
      ]);
      setConsultations(consultationsRes.data || []);
      setPatients(patientsRes.data?.patients || []);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar agenda de consultas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsultations();
  }, []);

  // Filter consultations
  const filteredConsultations = consultations.filter((c) => {
    const pName = c.patient?.fullName || c.patientNameForTax || '';
    const matchesSearch = pName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPatient =
      selectedPatientId === 'ALL' || c.patientId === selectedPatientId;

    const matchesStatus =
      statusFilter === 'ALL' || c.status === statusFilter;

    return matchesSearch && matchesPatient && matchesStatus;
  });

  // Calculate statistics
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const totalThisMonth = consultations.filter((c) => {
    const dt = new Date(c.dateTime);
    return dt.getMonth() === currentMonth && dt.getFullYear() === currentYear && c.status !== 'CANCELLED';
  }).length;

  const pendingPaymentsCount = consultations.filter(
    (c) => c.paymentStatus === 'PENDING' && c.status !== 'CANCELLED'
  ).length;

  const upcomingCount = consultations.filter(
    (c) => new Date(c.dateTime) >= now && c.status === 'SCHEDULED'
  ).length;

  // Actions
  const handleConfirmPayment = async (id: string) => {
    try {
      await api.patch(`/consultations/${id}/payment`);
      toast.success('Pagamento PIX confirmado!');
      fetchConsultations();
    } catch (err) {
      toast.error('Erro ao confirmar pagamento.');
    }
  };

  const handleCancelConsultation = async (id: string) => {
    if (!window.confirm('Tem certeza de que deseja cancelar este agendamento?')) return;
    try {
      await api.patch(`/consultations/${id}/cancel`);
      toast.success('Consulta cancelada.');
      fetchConsultations();
    } catch (err) {
      toast.error('Erro ao cancelar consulta.');
    }
  };

  const handleOpenCreateModal = () => {
    setEditingConsultation(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (c: Consultation) => {
    setEditingConsultation({
      id: c.id,
      patientId: c.patientId,
      patientName: c.patient?.fullName || c.patientNameForTax,
      dateTime: c.dateTime,
      sessionPrice: c.sessionPrice,
      billingType: c.billingType,
    });
    setIsModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-full">
            <Clock className="h-3 w-3 text-emerald-600" />
            Agendada
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-800 bg-blue-100 border border-blue-300 px-2.5 py-1 rounded-full">
            <CheckCircle className="h-3 w-3 text-blue-600" />
            Realizada
          </span>
        );
      case 'PATIENT_NO_SHOW':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-800 bg-rose-100 border border-rose-300 px-2.5 py-1 rounded-full">
            <AlertCircle className="h-3 w-3 text-rose-600" />
            Falta do Paciente
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2C332D] tracking-tight flex items-center gap-2">
            <CalendarIcon className="h-7 w-7 text-[#7A8B76]" />
            Agenda & Atendimentos
          </h1>
          <p className="text-sm text-[#6D736E] mt-1">
            Gerencie seus horários de atendimento, consultas por paciente e cobranças.
          </p>
        </div>

        <Button
          onClick={handleOpenCreateModal}
          variant="primary"
          className="bg-[#7A8B76] hover:bg-[#687764] text-white flex items-center justify-center gap-2 shadow-xs shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Agendar Consulta</span>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex items-center gap-4 p-5 shadow-2xs border border-[#7A8B76]/15">
          <div className="bg-[#7A8B76]/10 text-[#7A8B76] p-3 rounded-xl">
            <CalendarIcon className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-bold text-[#2C332D]">{upcomingCount}</span>
            <span className="text-xs font-medium text-[#6D736E]">Próximas Agendadas</span>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5 shadow-2xs border border-[#7A8B76]/15">
          <div className="bg-amber-100 text-amber-700 p-3 rounded-xl">
            <DollarSign className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-bold text-[#2C332D]">{pendingPaymentsCount}</span>
            <span className="text-xs font-medium text-[#6D736E]">Pagamentos Pendentes</span>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5 shadow-2xs border border-[#7A8B76]/15">
          <div className="bg-blue-100 text-blue-700 p-3 rounded-xl">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-bold text-[#2C332D]">{totalThisMonth}</span>
            <span className="text-xs font-medium text-[#6D736E]">Consultas no Mês</span>
          </div>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card className="p-5 shadow-2xs border border-[#6D736E]/15 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          {/* Patient Filter */}
          <div className="flex items-center gap-2 bg-[#F9F8F4] px-3.5 py-2 rounded-xl border border-[#6D736E]/20 flex-1">
            <User className="h-4 w-4 text-[#7A8B76] shrink-0" />
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[#2C332D] focus:outline-none w-full cursor-pointer"
            >
              <option value="ALL">Todos os Pacientes ({patients.length})</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 bg-[#F9F8F4] px-3.5 py-2 rounded-xl border border-[#6D736E]/20">
            <Filter className="h-4 w-4 text-[#7A8B76] shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[#2C332D] focus:outline-none cursor-pointer"
            >
              <option value="ALL">Todos os Status</option>
              <option value="SCHEDULED">Agendadas</option>
              <option value="COMPLETED">Realizadas</option>
              <option value="PATIENT_NO_SHOW">Faltas</option>
              <option value="CANCELLED">Canceladas</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative min-w-[200px]">
          <Search className="h-4 w-4 text-[#6D736E] absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por paciente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#F9F8F4] border border-[#6D736E]/20 rounded-xl text-xs text-[#2C332D] focus:outline-none focus:border-[#7A8B76]"
          />
        </div>
      </Card>

      {/* Consultations List */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-[#2C332D]">
          Lista de Atendimentos ({filteredConsultations.length})
        </h2>

        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : filteredConsultations.length === 0 ? (
          <Card className="p-8 text-center flex flex-col items-center gap-3">
            <CalendarIcon className="h-10 w-10 text-[#6D736E]/40" />
            <p className="text-sm text-[#6D736E]">
              Nenhuma consulta encontrada para os filtros selecionados.
            </p>
            <Button onClick={handleOpenCreateModal} variant="outline" className="mt-2">
              Agendar Nova Consulta
            </Button>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredConsultations.map((c) => {
              const dt = new Date(c.dateTime);
              const dateFormatted = dt.toLocaleDateString('pt-BR', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              });
              const timeFormatted = dt.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const patientName = c.patient?.fullName || c.patientNameForTax || 'Paciente';

              return (
                <Card
                  key={c.id}
                  className="p-5 shadow-2xs border border-[#6D736E]/15 hover:border-[#7A8B76]/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl"
                >
                  {/* Left info */}
                  <div className="flex items-start gap-4">
                    <div className="bg-[#7A8B76]/10 text-[#7A8B76] p-3 rounded-2xl shrink-0 mt-1 md:mt-0">
                      <User className="h-6 w-6" />
                    </div>

                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base text-[#2C332D]">
                          {patientName}
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

                  {/* Right Price & Actions */}
                  <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-[#6D736E]/10">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-extrabold text-[#2C332D]">
                        R$ {Number(c.sessionPrice).toFixed(2)}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md mt-0.5 ${
                          c.paymentStatus === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {c.paymentStatus === 'PAID' ? 'PIX Pago' : 'Pagamento Pendente'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Edit Button */}
                      {c.status === 'SCHEDULED' && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(c)}
                          title="Editar Agendamento"
                          className="p-2 rounded-xl text-[#7A8B76] hover:bg-[#7A8B76]/10 border border-[#7A8B76]/20 transition-all"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}

                      {/* Confirm PIX Button */}
                      {c.paymentStatus !== 'PAID' && c.status !== 'CANCELLED' && (
                        <button
                          type="button"
                          onClick={() => handleConfirmPayment(c.id)}
                          title="Confirmar Pagamento PIX"
                          className="p-2 rounded-xl text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}

                      {/* Cancel Button */}
                      {c.status === 'SCHEDULED' && (
                        <button
                          type="button"
                          onClick={() => handleCancelConsultation(c.id)}
                          title="Cancelar Consulta"
                          className="p-2 rounded-xl text-rose-700 hover:bg-rose-50 border border-rose-200 transition-all"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Agendamento */}
      <ModalAgendamento
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchConsultations}
        editingConsultation={editingConsultation}
      />
    </div>
  );
}
