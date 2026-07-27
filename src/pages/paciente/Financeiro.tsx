/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Button, Card, Skeleton } from '../../components/UI';
import { toast } from 'sonner';
import { 
  CreditCard, 
  Copy, 
  Check, 
  HelpCircle, 
  DollarSign, 
  Calendar, 
  FileCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface Session {
  id: string;
  date: string;
  time: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  price: number;
}

export default function FinanceiroPaciente() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pixKey, setPixKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [payingSessionId, setPayingSessionId] = useState<string | null>(null);

  const fetchFinanceData = async () => {
    try {
      const response = await api.get('/consultations');
      const mappedSessions = (response.data || []).map((row: any): Session => {
        const rawStatus = String(row.paymentStatus || row.status || 'PENDING').toUpperCase();
        let status: Session['status'] = 'PENDING';

        if (rawStatus === 'PAID') {
          status = 'PAID';
        } else if (rawStatus === 'CANCELLED' || rawStatus === 'PATIENT_NO_SHOW' || rawStatus === 'COMPLETED') {
          status = 'CANCELLED';
        }

        const dateTime = new Date(row.dateTime);

        return {
          id: row.id,
          date: dateTime.toLocaleDateString('pt-BR'),
          time: dateTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          status,
          price: Number(row.sessionPrice || 0),
        };
      });

      setSessions(mappedSessions);

      try {
        const dashboardRes = await api.get('/care/patient/dashboard');
        if (dashboardRes.data?.pixKey) {
          setPixKey(dashboardRes.data.pixKey);
        }
      } catch {
        // ignora se erro na chave pix
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao buscar dados financeiros.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, []);

  const copyPixKey = () => {
    if (!pixKey || !pixKey.trim()) {
      toast.error('O psicólogo ainda não cadastrou a chave PIX para pagamentos.');
      return;
    }
    navigator.clipboard.writeText(pixKey);
    toast.success('Chave PIX copiada! Use a opção "Copia e Cola" no seu app bancário.');
  };

  const handlePay = async (sessionId: string) => {
    setPayingSessionId(sessionId);
    try {
      await api.patch(`/consultations/${sessionId}/payment`);
      toast.success('Pagamento processado com sucesso! Muito obrigado.');

      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, status: 'PAID' } : s))
      );
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao simular pagamento.');
    } finally {
      setPayingSessionId(null);
    }
  };

  const pendingSessions = sessions.filter((s) => s.status === 'PENDING');
  const paidSessions = sessions.filter((s) => s.status === 'PAID');

  const totalPendingPrice = pendingSessions.reduce((acc, s) => acc + s.price, 0);

  return (
    <div className="flex flex-col gap-8">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#2C332D] tracking-tight">Painel Financeiro</h1>
        <p className="text-sm text-[#6D736E]">
          Veja seu saldo em aberto e histórico de pagamentos de consultas terapêuticas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column: Unpaid invoices and PIX simulation */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <h2 className="text-lg font-bold text-[#2C332D] flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-[#C16E59]" />
            <span>Pendências de Pagamento</span>
          </h2>

          {loading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : pendingSessions.length === 0 ? (
            <Card className="bg-[#7A8B76]/5 border border-[#7A8B76]/10 text-center p-8 rounded-xl">
              <CheckCircle2 className="h-10 w-10 text-[#7A8B76] mx-auto mb-3" />
              <p className="font-bold text-[#2C332D]">Tudo em dia!</p>
              <p className="text-xs text-[#6D736E] mt-1">Nenhum débito ou pendência financeira em aberto encontrado.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              
              {/* Debt Warning Summary Card */}
              <div className="bg-[#C16E59]/10 border border-[#C16E59]/20 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-[#C16E59] uppercase tracking-wider">Total em Aberto</span>
                  <span className="text-xl font-extrabold text-[#2C332D]">R$ {totalPendingPrice.toFixed(2)}</span>
                  <span className="text-[10px] text-[#6D736E]">Correspondente a {pendingSessions.length} sessões</span>
                </div>
                <Button onClick={copyPixKey} variant="primary" className="flex items-center gap-2">
                  <Copy className="h-4 w-4" />
                  <span>Copiar Chave PIX</span>
                </Button>
              </div>

              {/* List of outstanding invoices */}
              <div className="flex flex-col gap-3">
                {pendingSessions.map((s) => (
                  <Card key={s.id} className="border-l-4 border-l-[#C16E59] shadow-2xs p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-sm text-[#2C332D] flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-[#6D736E]" />
                          Consulta de {s.date}
                        </span>
                        <span className="text-xs text-[#6D736E]">Horário: {s.time}</span>
                        <span className="text-xs font-semibold text-[#C16E59] mt-0.5">Status: Pendente de Pagamento</span>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="font-extrabold text-base text-[#2C332D]">R$ {s.price.toFixed(2)}</span>
                        <Button 
                          onClick={() => handlePay(s.id)}
                          isLoading={payingSessionId === s.id}
                          variant="secondary"
                          className="min-h-[44px]"
                        >
                          Simular PIX
                        </Button>
                      </div>

                    </div>
                  </Card>
                ))}
              </div>

            </div>
          )}
        </div>

        {/* Right column: Copiable PIX Info & Paid session logs */}
        <div className="flex flex-col gap-6">
          
          {/* Pix detail instructions card */}
          <Card className="shadow-2xs border-[#7A8B76]/20">
            <h3 className="font-bold text-sm text-[#2C332D] border-b border-[#6D736E]/10 pb-2 flex items-center gap-2">
              <Check className="h-5 w-5 text-[#7A8B76]" />
              <span>Chave PIX do Psicólogo</span>
            </h3>

            <p className="text-xs text-[#6D736E] leading-relaxed mt-3">
              Efetue o pagamento de suas sessões via PIX de forma instantânea. Após transferir, você pode clicar no botão <strong>"Simular PIX"</strong> para marcar a consulta correspondente como paga.
            </p>

            {!pixKey || !pixKey.trim() ? (
              <div className="mt-4 p-3.5 bg-[#F9F8F4] border border-[#7A8B76]/20 rounded-xl flex items-center gap-3 text-xs text-[#6D736E]">
                <AlertCircle className="h-5 w-5 text-[#C16E59] shrink-0" />
                <span>O psicólogo ainda não cadastrou a chave PIX para pagamentos.</span>
              </div>
            ) : (
              <div className="mt-4 p-3 bg-[#F9F8F4] border border-[#6D736E]/10 rounded-lg flex items-center justify-between gap-2">
                <span className="text-xs font-mono font-bold text-[#2C332D] truncate">{pixKey}</span>
                <button 
                  onClick={copyPixKey}
                  className="text-[#7A8B76] hover:text-[#C16E59] p-1.5 hover:bg-[#7A8B76]/10 rounded-md transition-colors cursor-pointer"
                  title="Copiar Chave PIX"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            )}
          </Card>

          {/* Paid session logs */}
          <div className="flex flex-col gap-3">
            <h3 className="font-bold text-sm text-[#2C332D] flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-[#7A8B76]" />
              <span>Sessões Quitadas ({paidSessions.length})</span>
            </h3>

            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : paidSessions.length === 0 ? (
              <span className="text-xs text-[#6D736E]">Nenhuma consulta quitada registrada.</span>
            ) : (
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                {paidSessions.map((s) => (
                  <div key={s.id} className="bg-white border border-[#6D736E]/5 rounded-lg p-3 flex justify-between items-center text-xs">
                    <div className="flex flex-col">
                      <span className="font-bold text-[#2C332D]">{s.date} às {s.time}</span>
                      <span className="text-[10px] text-emerald-700 font-bold uppercase mt-0.5">Pago</span>
                    </div>
                    <span className="font-bold text-[#2C332D]">R$ {s.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
