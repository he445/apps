/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Button, Card, Skeleton } from '../../components/UI';
import { toast } from 'sonner';
import { 
  Download, 
  DollarSign, 
  Calendar, 
  FileSpreadsheet, 
  AlertCircle,
  TrendingUp,
  CreditCard
} from 'lucide-react';

interface SessionFinance {
  id: string;
  patientId: string;
  patientName: string;
  patientCpf: string;
  date: string;
  time: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  price: number;
}

export default function FinanceiroPro() {
  const [sessions, setSessions] = useState<SessionFinance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFinance = async () => {
      try {
        const response = await api.get('/consultations');
        const mappedSessions = (response.data || []).map((row: any): SessionFinance => ({
          id: row.id,
          patientId: row.patientId,
          patientName: row.patient?.fullName || row.patientNameForTax || 'Paciente Excluído',
          patientCpf: row.patientCpfForTax || '',
          date: new Date(row.dateTime).toLocaleDateString('pt-BR'),
          time: new Date(row.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          status: row.paymentStatus === 'PAID' ? 'PAID' : row.status === 'CANCELLED' || row.status === 'PATIENT_NO_SHOW' ? 'CANCELLED' : 'PENDING',
          price: Number(row.sessionPrice || 0),
        }));
        setSessions(mappedSessions);
      } catch (err: any) {
        console.error(err);
        toast.error('Erro ao buscar relatórios financeiros.');
      } finally {
        setLoading(false);
      }
    };

    fetchFinance();
  }, []);

  // Financial Metrics calculations (including deleted patient sessions!)
  const totalReceived = sessions
    .filter((s) => s.status === 'PAID')
    .reduce((acc, s) => acc + s.price, 0);

  const totalPending = sessions
    .filter((s) => s.status === 'PENDING')
    .reduce((acc, s) => acc + s.price, 0);

  const totalSessionsCount = sessions.length;

  const exportToCSV = () => {
    if (sessions.length === 0) {
      toast.error('Nenhum dado disponível para exportação.');
      return;
    }

    // Prepare CSV header and lines
    // Enforcing semi-colon separator for Brazilian Excel compatibilities
    const headers = ['ID da Consulta', 'Paciente', 'CPF do Paciente', 'Data', 'Horario', 'Status de Pagamento', 'Valor Cobrado (R$)'];
    const rows = sessions.map((s) => [
      s.id,
      `"${s.patientName.replace(/"/g, '""')}"`,
      `"${(s.patientCpf || 'Nao informado').replace(/"/g, '""')}"`,
      s.date,
      s.time,
      s.status === 'PAID' ? 'PAGO' : s.status === 'PENDING' ? 'PENDENTE' : 'CANCELADO',
      s.price.toString(),
    ]);

    const csvContent = 
      'data:text/csv;charset=utf-8,\uFEFF' + 
      [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    
    const todayStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `ojanuan_carne_leao_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Relatório Carnê-Leão (CSV) exportado com sucesso!');
  };

  const getStatusColor = (status: string) => {
    if (status === 'PAID') return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    if (status === 'PENDING') return 'bg-amber-100 text-amber-800 border border-amber-200';
    return 'bg-gray-100 text-gray-800 border border-gray-200';
  };

  return (
    <div className="flex flex-col gap-8">
      
      {/* Top action block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2C332D] tracking-tight">Gestão Financeira & Impostos</h1>
          <p className="text-sm text-[#6D736E]">
            Controle de honorários e emissão de dados para consolidação do Carnê-Leão.
          </p>
        </div>
        <Button 
          onClick={exportToCSV} 
          variant="secondary" 
          disabled={loading || sessions.length === 0}
          className="flex items-center gap-2 shadow-sm"
        >
          <Download className="h-4 w-4" />
          <span>Exportar Carnê-Leão (CSV)</span>
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Total Recebido */}
        <Card className="border-l-4 border-l-[#7A8B76] shadow-2xs">
          <div className="flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase font-bold text-[#6D736E] tracking-wider">Total Recebido (PAGO)</span>
              <span className="text-2xl font-extrabold text-[#2C332D]">R$ {totalReceived.toFixed(2)}</span>
            </div>
            <div className="p-3 bg-[#7A8B76]/10 text-[#7A8B76] rounded-full">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </Card>

        {/* Faturamento Pendente */}
        <Card className="border-l-4 border-l-[#C16E59] shadow-2xs">
          <div className="flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase font-bold text-[#6D736E] tracking-wider">Faturamento Pendente</span>
              <span className="text-2xl font-extrabold text-[#2C332D]">R$ {totalPending.toFixed(2)}</span>
            </div>
            <div className="p-3 bg-[#C16E59]/10 text-[#C16E59] rounded-full">
              <CreditCard className="h-6 w-6" />
            </div>
          </div>
        </Card>

        {/* Total Consultas */}
        <Card className="border-l-4 border-l-[#6D736E] shadow-2xs">
          <div className="flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase font-bold text-[#6D736E] tracking-wider">Total de Consultas</span>
              <span className="text-2xl font-extrabold text-[#2C332D]">{totalSessionsCount}</span>
            </div>
            <div className="p-3 bg-gray-100 text-gray-500 rounded-full">
              <Calendar className="h-6 w-6" />
            </div>
          </div>
        </Card>

      </div>

      {/* Imposto Informative Card */}
      <Card className="bg-[#7A8B76]/5 border border-[#7A8B76]/15 rounded-xl shadow-2xs p-5 flex gap-4 items-start">
        <AlertCircle className="h-6 w-6 text-[#7A8B76] shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1 text-sm leading-relaxed text-[#2C332D]">
          <span className="font-bold">Regras e Conformidades de Contabilidade do Ojanuan</span>
          <p className="text-xs text-[#6D736E] leading-relaxed">
            De acordo com as normas da Receita Federal para profissionais autônomos, todos os atendimentos prestados devem registrar o CPF do paciente pagador para escrituração do livro-caixa digital do Carnê-Leão. 
            <br />
            <strong>Atenção ao Soft-Delete:</strong> Mesmo se um paciente excluir a conta no Ojanuan, seus dados fiscais (CPF, valor da consulta e data) são preservados anonimizados sob o nome de <strong className="text-[#2C332D]">"Paciente Excluído"</strong> para garantir a exatidão da sua declaração fiscal de Imposto de Renda.
          </p>
        </div>
      </Card>

      {/* Transactions Table */}
      <Card className="shadow-2xs overflow-hidden p-0 border border-[#6D736E]/10">
        <div className="px-6 py-5 border-b border-[#6D736E]/10 bg-white flex items-center justify-between">
          <h3 className="text-base font-bold text-[#2C332D] flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-[#6D736E]" />
            <span>Registro Detalhado de Consultas</span>
          </h3>
        </div>

        {loading ? (
          <div className="p-6 flex flex-col gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 text-[#6D736E] text-sm">
            Nenhuma transação ou consulta agendada encontrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9F8F4] text-[#6D736E] font-bold text-xs uppercase tracking-wider border-b border-[#6D736E]/10">
                  <th className="px-6 py-4">Paciente</th>
                  <th className="px-6 py-4">CPF do Paciente</th>
                  <th className="px-6 py-4">Data / Hora</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#6D736E]/10 text-sm">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-[#F9F8F4]/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-[#2C332D]">
                      {s.patientName === 'Paciente Excluído' ? (
                        <span className="text-[#B54B3C] italic font-normal">Paciente Excluído</span>
                      ) : (
                        s.patientName
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-[#6D736E]">
                      {s.patientCpf || '---'}
                    </td>
                    <td className="px-6 py-4 text-[#2C332D]">
                      <span className="font-semibold">{s.date}</span> às {s.time}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold ${getStatusColor(s.status)}`}>
                        {s.status === 'PAID' ? 'PAGO' : s.status === 'PENDING' ? 'PENDENTE' : 'CANCELADO'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-extrabold text-[#2C332D]">
                      R$ {s.price.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>
  );
}
