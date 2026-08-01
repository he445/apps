import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Button, Card, Input } from './UI';
import { toast } from 'sonner';
import { Calendar, Clock, DollarSign, User, X, Tag } from 'lucide-react';

interface Patient {
  id: string;
  name: string;
  email: string;
}

interface ModalAgendamentoProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialPatientId?: string;
  editingConsultation?: {
    id: string;
    patientId?: string;
    patientName?: string;
    dateTime: string;
    sessionPrice: string | number;
    billingType: 'PER_SESSION' | 'MONTHLY_CONSOLIDATED';
  } | null;
}

const TIME_PRESETS = [
  '08:00', '09:00', '10:00', '11:00',
  '14:00', '15:00', '16:00', '17:00', '18:00',
];

export const ModalAgendamento: React.FC<ModalAgendamentoProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialPatientId,
  editingConsultation,
}) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [saving, setSaving] = useState(false);

  const [patientId, setPatientId] = useState(initialPatientId || '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('14:00');
  const [price, setPrice] = useState('150.00');
  const [billingType, setBillingType] = useState<'PER_SESSION' | 'MONTHLY_CONSOLIDATED'>('PER_SESSION');

  useEffect(() => {
    if (!isOpen) return;

    const fetchPatients = async () => {
      setLoadingPatients(true);
      try {
        const res = await api.get('/care/professional/patients');
        setPatients(res.data.patients || []);
        if (!patientId && res.data.patients?.length > 0) {
          setPatientId(res.data.patients[0].id);
        }
      } catch (err) {
        console.error('Erro ao buscar pacientes para agendamento:', err);
      } finally {
        setLoadingPatients(false);
      }
    };

    fetchPatients();

    if (editingConsultation) {
      const dt = new Date(editingConsultation.dateTime);
      // Use local date parts to avoid UTC→local day shift (e.g. 2026-08-10T03:00Z → 2026-08-09 in UTC-3)
      const year = dt.getFullYear();
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      const hours = String(dt.getHours()).padStart(2, '0');
      const mins = String(dt.getMinutes()).padStart(2, '0');

      setDate(`${year}-${month}-${day}`);
      setTime(`${hours}:${mins}`);
      setPrice(String(editingConsultation.sessionPrice || '150.00'));
      setBillingType(editingConsultation.billingType || 'PER_SESSION');
      if (editingConsultation.patientId) {
        setPatientId(editingConsultation.patientId);
      }
    } else {
      // Default date: tomorrow (local)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      setDate(`${year}-${month}-${day}`);
      if (initialPatientId) {
        setPatientId(initialPatientId);
      }
    }
  }, [isOpen, editingConsultation, initialPatientId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingConsultation && !patientId) {
      toast.error('Selecione um paciente para o agendamento.');
      return;
    }

    if (!date || !time) {
      toast.error('Selecione a data e o horário da consulta.');
      return;
    }

    // Compose ISO Date String without 'Z' suffix to avoid UTC drift.
    // The server interprets naive ISO strings as local time; using 'Z' would
    // shift a 14:00 São Paulo time to 17:00 UTC stored in the DB.
    const dateTimeStr = `${date}T${time}:00`;

    setSaving(true);
    try {
      if (editingConsultation) {
        await api.patch(`/consultations/${editingConsultation.id}`, {
          dateTime: dateTimeStr,
          sessionPrice: String(price),
          billingType,
        });
        toast.success('Consulta atualizada com sucesso!');
      } else {
        await api.post('/consultations', {
          patientId,
          dateTime: dateTimeStr,
          sessionPrice: String(price),
          billingType,
        });
        toast.success('Consulta agendada com sucesso!');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao salvar agendamento.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#2C332D]/40 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Card */}
      <Card className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-[#6D736E]/15 p-6 flex flex-col gap-6 animate-scale-in z-10">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-[#6D736E]/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#7A8B76]/10 text-[#7A8B76] p-2 rounded-xl">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#2C332D]">
                {editingConsultation ? 'Editar Consulta' : 'Agendar Nova Consulta'}
              </h3>
              <p className="text-xs text-[#6D736E]">
                {editingConsultation 
                  ? 'Altere a data, horário ou valor da sessão' 
                  : 'Defina a data, horário e valores para o atendimento'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#6D736E] hover:text-[#2C332D] p-1.5 rounded-lg hover:bg-[#6D736E]/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Patient Select (Disabled in Edit or if initialPatientId is provided) */}
          {!editingConsultation ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#2C332D] flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-[#7A8B76]" />
                Paciente
              </label>
              {loadingPatients ? (
                <div className="h-10 bg-gray-100 animate-pulse rounded-lg" />
              ) : (
                <select
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  className="w-full h-11 px-3.5 bg-[#F9F8F4] border border-[#6D736E]/20 rounded-xl text-sm font-medium text-[#2C332D] focus:outline-none focus:border-[#7A8B76] focus:ring-1 focus:ring-[#7A8B76] transition-all"
                  required
                >
                  {patients.length === 0 ? (
                    <option value="">Nenhum paciente cadastrado</option>
                  ) : (
                    patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.email})
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>
          ) : (
            <div className="bg-[#7A8B76]/10 p-3.5 rounded-xl border border-[#7A8B76]/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-[#7A8B76]" />
                <span className="text-xs font-medium text-[#6D736E]">Paciente:</span>
              </div>
              <span className="text-sm font-bold text-[#2C332D]">
                {editingConsultation.patientName || 'Paciente'}
              </span>
            </div>
          )}

          {/* Date Picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#2C332D] flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#7A8B76]" />
              Data da Consulta
            </label>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-11 px-3.5 bg-[#F9F8F4] border border-[#6D736E]/20 rounded-xl text-sm font-medium text-[#2C332D] focus:outline-none focus:border-[#7A8B76] focus:ring-1 focus:ring-[#7A8B76] transition-all"
              required
            />
          </div>

          {/* Time Selector */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[#2C332D] flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#7A8B76]" />
              Horário da Consulta
            </label>
            <div className="flex flex-wrap gap-2">
              {TIME_PRESETS.map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setTime(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    time === t
                      ? 'bg-[#7A8B76] text-white shadow-xs'
                      : 'bg-[#F9F8F4] text-[#6D736E] border border-[#6D736E]/15 hover:bg-[#6D736E]/10'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-[#6D736E]">Ou digite outro horário:</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-8 px-2 bg-[#F9F8F4] border border-[#6D736E]/20 rounded-lg text-xs font-semibold text-[#2C332D]"
                required
              />
            </div>
          </div>

          {/* Price and Billing Type Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#2C332D] flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-[#7A8B76]" />
                Valor da Sessão (R$)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="150.00"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#2C332D] flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-[#7A8B76]" />
                Forma de Cobrança
              </label>
              <select
                value={billingType}
                onChange={(e) => setBillingType(e.target.value as any)}
                className="w-full h-11 px-3 bg-[#F9F8F4] border border-[#6D736E]/20 rounded-xl text-xs font-medium text-[#2C332D] focus:outline-none focus:border-[#7A8B76]"
              >
                <option value="PER_SESSION">Por Sessão (Avulso)</option>
                <option value="MONTHLY_CONSOLIDATED">Mensalidade (Pacote)</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-[#6D736E]/10 pt-4 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={saving}
              className="bg-[#7A8B76] hover:bg-[#687764] text-white font-semibold"
            >
              {saving
                ? 'Salvando...'
                : editingConsultation
                ? 'Atualizar Agendamento'
                : 'Confirmar Agendamento'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
