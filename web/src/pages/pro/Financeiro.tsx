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

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
// A validação do backend recusa competência anterior a 2020.
const ANOS = Array.from({ length: new Date().getFullYear() - 2019 }, (_, i) => 2020 + i).reverse();

interface CarneLeaoRow {
  paciente: string;
  cpf: string | null;
  dates: string[];
  total: number;
}

export default function FinanceiroPro() {
  const [sessions, setSessions] = useState<SessionFinance[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const agora = new Date();
  const [competencia, setCompetencia] = useState({ month: agora.getMonth() + 1, year: agora.getFullYear() });

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

  /**
   * O CSV anterior era montado a partir de TODAS as consultas: incluía pendentes e
   * canceladas, usava a data da consulta e não agrupava por pagador. O Carnê-Leão é
   * regime de caixa — apura pelo valor efetivamente recebido, na competência do
   * recebimento, por pagador. O backend já implementa isso em GET /reports/export;
   * a tela só não o chamava.
   */
  const exportToCSV = async () => {
    setExporting(true);
    try {
      const { data } = await api.get('/reports/export', {
        params: { month: competencia.month, year: competencia.year },
      });

      const linhas: CarneLeaoRow[] = Array.isArray(data) ? data : [];
      if (linhas.length === 0) {
        toast.error('Nenhum recebimento registrado nesta competência.');
        return;
      }

      const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const headers = ['Pagador', 'CPF', 'Datas dos atendimentos', 'Qtd. sessoes', 'Total recebido (R$)'];
      const rows = linhas.map((r) => [
        esc(r.paciente),
        esc(r.cpf || 'Nao informado'),
        esc(r.dates.map((d) => d.split('-').reverse().join('/')).join(' | ')),
        String(r.dates.length),
        r.total.toFixed(2).replace('.', ','),
      ]);
      const totalGeral = linhas.reduce((acc, r) => acc + r.total, 0);
      rows.push(['"TOTAL"', '""', '""', '', totalGeral.toFixed(2).replace('.', ',')]);

      // Separador ';' e BOM para o Excel em português abrir sem passo de importação.
      const csv = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ojanuan_carne_leao_${competencia.year}-${String(competencia.month).padStart(2, '0')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Carnê-Leão de ${String(competencia.month).padStart(2, '0')}/${competencia.year} exportado.`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Não foi possível gerar o relatório.');
    } finally {
      setExporting(false);
    }
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
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="competencia-mes" className="text-[11px] font-bold text-[#6D736E] uppercase tracking-wider">
                Mês
              </label>
              <select
                id="competencia-mes"
                value={competencia.month}
                onChange={(e) => setCompetencia((c) => ({ ...c, month: Number(e.target.value) }))}
                className="px-3 py-2.5 rounded-xl border border-[#7A8B76]/25 bg-white text-sm text-[#2C332D] focus:outline-none focus:ring-2 focus:ring-[#7A8B76]/30"
              >
                {MESES.map((nome, i) => (
                  <option key={nome} value={i + 1}>{nome}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="competencia-ano" className="text-[11px] font-bold text-[#6D736E] uppercase tracking-wider">
                Ano
              </label>
              <select
                id="competencia-ano"
                value={competencia.year}
                onChange={(e) => setCompetencia((c) => ({ ...c, year: Number(e.target.value) }))}
                className="px-3 py-2.5 rounded-xl border border-[#7A8B76]/25 bg-white text-sm text-[#2C332D] focus:outline-none focus:ring-2 focus:ring-[#7A8B76]/30"
              >
                {ANOS.map((ano) => (
                  <option key={ano} value={ano}>{ano}</option>
                ))}
              </select>
            </div>
          </div>
          <Button
            onClick={exportToCSV}
            variant="secondary"
            isLoading={exporting}
            className="flex items-center gap-2 shadow-sm"
          >
            <Download className="h-4 w-4" />
            <span>Exportar Carnê-Leão</span>
          </Button>
        </div>
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
