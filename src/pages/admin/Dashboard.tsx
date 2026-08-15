/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AdminOverviewData, RouteTelemetry, ErrorLogEntry, ProNetworkItem } from '../../types';
import { toast } from 'sonner';
import {
  Users,
  UserCheck,
  UserPlus,
  Stethoscope,
  DollarSign,
  Activity,
  Zap,
  ShieldAlert,
  Trash2,
  Play,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Send,
  Eye,
  RefreshCw,
  Terminal,
  Layers
} from 'lucide-react';

export default function AdminDashboard() {
  const { impersonateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'network' | 'telemetry' | 'errors' | 'sandbox'>('overview');
  
  // Data states
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [routes, setRoutes] = useState<RouteTelemetry[]>([]);
  const [errors, setErrors] = useState<ErrorLogEntry[]>([]);
  const [expandedPros, setExpandedPros] = useState<Record<string, boolean>>({});

  // Sandbox & Playground states
  const [seeding, setSeeding] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [playgroundMethod, setPlaygroundMethod] = useState('GET');
  const [playgroundPath, setPlaygroundPath] = useState('/health');
  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  const [playgroundResult, setPlaygroundResult] = useState<any>(null);
  const [playgroundLatency, setPlaygroundLatency] = useState<number | null>(null);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [ovRes, telRes, errRes] = await Promise.all([
        api.get('/admin/overview'),
        api.get('/admin/telemetry/routes'),
        api.get('/admin/telemetry/errors'),
      ]);
      setOverview(ovRes.data);
      setRoutes(telRes.data.routes || []);
      setErrors(errRes.data.errors || []);
    } catch (err: any) {
      toast.error('Erro ao carregar dados administrativos: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleSeedSandbox = async () => {
    setSeeding(true);
    try {
      const res = await api.post('/admin/sandbox/seed');
      toast.success(res.data.message || 'Massa de teste gerada com sucesso!');
      await fetchAllData();
    } catch (err: any) {
      toast.error('Falha ao gerar massa de teste: ' + (err.response?.data?.message || err.message));
    } finally {
      setSeeding(false);
    }
  };

  const handleCleanSandbox = async () => {
    if (!window.confirm('Tem certeza que deseja remover todos os usuários e dados de teste (isTestUser)? Usuários reais não serão afetados.')) {
      return;
    }
    setCleaning(true);
    try {
      const res = await api.delete('/admin/sandbox/clean');
      toast.success(res.data.message || 'Dados de teste limpos com segurança!');
      await fetchAllData();
    } catch (err: any) {
      toast.error('Falha ao limpar dados de teste: ' + (err.response?.data?.message || err.message));
    } finally {
      setCleaning(false);
    }
  };

  const handleImpersonate = async (userId: string, userName: string) => {
    try {
      const res = await api.post(`/admin/impersonate/${userId}`);
      toast.info(`Iniciando simulação como ${userName}...`);
      impersonateUser(res.data.token, res.data.user);
    } catch (err: any) {
      toast.error('Erro ao simular usuário: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleExecutePlayground = async () => {
    setPlaygroundLoading(true);
    setPlaygroundResult(null);
    setPlaygroundLatency(null);
    const start = Date.now();
    try {
      let res;
      if (playgroundMethod === 'GET') {
        res = await api.get(playgroundPath);
      } else if (playgroundMethod === 'POST') {
        res = await api.post(playgroundPath, {});
      } else if (playgroundMethod === 'PUT') {
        res = await api.put(playgroundPath, {});
      } else if (playgroundMethod === 'DELETE') {
        res = await api.delete(playgroundPath);
      }
      const elapsed = Date.now() - start;
      setPlaygroundLatency(elapsed);
      setPlaygroundResult({
        status: res?.status || 200,
        statusText: res?.statusText || 'OK',
        data: res?.data,
      });
      toast.success(`Requisição concluída em ${elapsed}ms`);
    } catch (err: any) {
      const elapsed = Date.now() - start;
      setPlaygroundLatency(elapsed);
      setPlaygroundResult({
        status: err.response?.status || 500,
        statusText: err.response?.statusText || 'Error',
        data: err.response?.data || { message: err.message },
      });
      toast.error(`Falha na requisição (${err.response?.status || 500})`);
    } finally {
      setPlaygroundLoading(false);
    }
  };

  const toggleProExpand = (proId: string) => {
    setExpandedPros((prev) => ({ ...prev, [proId]: !prev[proId] }));
  };

  if (loading && !overview) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-3 border-[#7A8B76] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-[#6D736E]">Carregando Painel de Controle e Métricas...</p>
      </div>
    );
  }

  const kpis = overview?.kpis;
  const summary = overview?.telemetrySummary;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#7A8B76]/15 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-amber-400 uppercase tracking-wider">
              Beta Control Hub
            </span>
            <span className="text-xs text-[#6D736E] font-medium">• Tempo Real</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2C332D] tracking-tight mt-1">
            Painel do Administrador
          </h1>
          <p className="text-sm text-[#6D736E] mt-0.5">
            Observabilidade do ecossistema, telemetria de rotas e simulação segura (RFC 8693).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAllData}
            title="Atualizar dados"
            className="p-2.5 rounded-xl border border-[#7A8B76]/20 text-[#2C332D] hover:bg-[#F9F8F4] transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 text-xs font-bold"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Recarregar</span>
          </button>
          <button
            onClick={handleSeedSandbox}
            disabled={seeding}
            className="px-3.5 py-2.5 rounded-xl bg-[#7A8B76] text-white hover:bg-[#687764] transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 text-xs font-bold shadow-xs disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>{seeding ? 'Gerando...' : '⚡ Criar Personas Teste'}</span>
          </button>
        </div>
      </div>

      {/* Dynamic Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-[#7A8B76]/15">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-amber-400 shadow-sm'
              : 'bg-white text-[#6D736E] hover:text-[#2C332D] border border-[#7A8B76]/15'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Visão Geral & KPIs</span>
        </button>

        <button
          onClick={() => setActiveTab('network')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'network'
              ? 'bg-slate-900 text-amber-400 shadow-sm'
              : 'bg-white text-[#6D736E] hover:text-[#2C332D] border border-[#7A8B76]/15'
          }`}
        >
          <Stethoscope className="w-4 h-4" />
          <span>Rede Clínica ({overview?.professionals.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('telemetry')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'telemetry'
              ? 'bg-slate-900 text-amber-400 shadow-sm'
              : 'bg-white text-[#6D736E] hover:text-[#2C332D] border border-[#7A8B76]/15'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Telemetria de Rotas ({routes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('errors')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'errors'
              ? 'bg-slate-900 text-amber-400 shadow-sm'
              : 'bg-white text-[#6D736E] hover:text-[#2C332D] border border-[#7A8B76]/15'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Monitor de Bugs ({errors.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('sandbox')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'sandbox'
              ? 'bg-slate-900 text-amber-400 shadow-sm'
              : 'bg-white text-[#6D736E] hover:text-[#2C332D] border border-[#7A8B76]/15'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Sandbox & Playground</span>
        </button>
      </div>

      {/* --- TAB 1: VISÃO GERAL & KPIS --- */}
      {activeTab === 'overview' && kpis && (
        <div className="space-y-6 animate-fade-in">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-[#7A8B76]/15 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#6D736E] uppercase tracking-wider">Total Usuários</span>
                <div className="p-2 rounded-xl bg-[#7A8B76]/10 text-[#7A8B76]">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-3xl font-extrabold text-[#2C332D]">{kpis.totalUsers}</p>
                <div className="flex items-center gap-2 text-xs text-[#6D736E] mt-1 font-medium">
                  <span>{kpis.totalPros} Psicólogos</span>
                  <span>•</span>
                  <span>{kpis.totalPatients} Pacientes</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-[#7A8B76]/15 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#6D736E] uppercase tracking-wider">Média Pacientes/Psi</span>
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-3xl font-extrabold text-[#2C332D]">{kpis.avgPatientsPerPro}</p>
                <p className="text-xs text-[#6D736E] mt-1 font-medium">
                  Distribuição ativa por psicólogo
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-[#7A8B76]/15 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#6D736E] uppercase tracking-wider">Volume Financeiro</span>
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-3xl font-extrabold text-[#2C332D]">
                  R$ {kpis.consultations.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-[#6D736E] mt-1 font-medium">
                  Liquidações realizadas
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-[#7A8B76]/15 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#6D736E] uppercase tracking-wider">Latência Média</span>
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <Zap className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-3xl font-extrabold text-[#2C332D]">
                  {summary ? `${summary.avgLatencyMs}ms` : '0ms'}
                </p>
                <p className="text-xs text-[#6D736E] mt-1 font-medium">
                  {summary?.totalRequests || 0} requisições processadas
                </p>
              </div>
            </div>
          </div>

          {/* Activity Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Consultations Breakdown */}
            <div className="bg-white p-6 rounded-3xl border border-[#7A8B76]/15 shadow-2xs space-y-4">
              <h3 className="text-base font-bold text-[#2C332D] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#7A8B76]" />
                Status das Consultas
              </h3>
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/50 flex flex-col items-center text-center">
                  <Clock className="w-5 h-5 text-amber-600 mb-1" />
                  <span className="text-2xl font-black text-amber-900">{kpis.consultations.scheduled}</span>
                  <span className="text-xs font-bold text-amber-700 mt-0.5">Agendadas</span>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/50 flex flex-col items-center text-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mb-1" />
                  <span className="text-2xl font-black text-emerald-900">{kpis.consultations.completed}</span>
                  <span className="text-xs font-bold text-emerald-700 mt-0.5">Realizadas</span>
                </div>
                <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/50 flex flex-col items-center text-center">
                  <XCircle className="w-5 h-5 text-rose-600 mb-1" />
                  <span className="text-2xl font-black text-rose-900">{kpis.consultations.cancelled}</span>
                  <span className="text-xs font-bold text-rose-700 mt-0.5">Canceladas</span>
                </div>
              </div>
            </div>

            {/* Engagement Breakdown */}
            <div className="bg-white p-6 rounded-3xl border border-[#7A8B76]/15 shadow-2xs space-y-4">
              <h3 className="text-base font-bold text-[#2C332D] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#C16E59]" />
                Engajamento & Acolhimento
              </h3>
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#F9F8F4] border border-[#7A8B76]/10">
                  <span className="text-xs sm:text-sm font-semibold text-[#2C332D]">Autoavaliações Diárias de Bem-Estar</span>
                  <span className="text-base font-extrabold text-[#7A8B76]">{kpis.engagement.totalAssessments}</span>
                </div>
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#F9F8F4] border border-[#7A8B76]/10">
                  <span className="text-xs sm:text-sm font-semibold text-[#2C332D]">Mensagens Trocadas no Chat</span>
                  <span className="text-base font-extrabold text-[#C16E59]">{kpis.engagement.totalMessages}</span>
                </div>
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#F9F8F4] border border-[#7A8B76]/10">
                  <span className="text-xs sm:text-sm font-semibold text-[#2C332D]">Usuários de Teste Ativos (Sandbox)</span>
                  <span className="text-base font-extrabold text-amber-700">{kpis.totalTestUsers}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: REDE CLÍNICA & VÍNCULOS --- */}
      {activeTab === 'network' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-white p-6 rounded-3xl border border-[#7A8B76]/15 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="text-lg font-bold text-[#2C332D]">Relação de Psicólogos e Pacientes</h3>
                <p className="text-xs text-[#6D736E]">
                  Visualize todos os profissionais cadastrados, número de pacientes ativos e simule contas de teste.
                </p>
              </div>
            </div>

            {(!overview?.professionals || overview.professionals.length === 0) ? (
              <div className="text-center py-12 text-[#6D736E] text-sm">
                Nenhum psicólogo cadastrado no momento. Use o botão <strong>⚡ Criar Personas Teste</strong> para gerar dados mock.
              </div>
            ) : (
              <div className="space-y-3">
                {overview.professionals.map((pro) => {
                  const isExpanded = !!expandedPros[pro.id];
                  return (
                    <div
                      key={pro.id}
                      className="border border-[#7A8B76]/15 rounded-2xl p-4 bg-[#F9F8F4]/50 hover:bg-[#F9F8F4] transition-all"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggleProExpand(pro.id)}
                            className="p-1 rounded-lg hover:bg-white text-[#6D736E] cursor-pointer mt-0.5"
                          >
                            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                          </button>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-extrabold text-sm sm:text-base text-[#2C332D]">{pro.name}</h4>
                              {pro.isTestUser ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800 uppercase tracking-wide">
                                  Conta Teste
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                                  Real
                                </span>
                              )}
                              {pro.crp && (
                                <span className="text-xs text-[#6D736E] font-medium">CRP: {pro.crp}</span>
                              )}
                            </div>
                            <p className="text-xs text-[#6D736E] mt-0.5">{pro.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end md:self-center">
                          <div className="text-right">
                            <span className="text-xs font-bold text-[#2C332D]">
                              {pro.patientsCount} {pro.patientsCount === 1 ? 'Paciente' : 'Pacientes'}
                            </span>
                            <p className="text-[11px] text-[#6D736E]">{pro.totalConsultations} Consultas</p>
                          </div>

                          <button
                            onClick={() => handleImpersonate(pro.id, pro.name)}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Simular</span>
                          </button>
                        </div>
                      </div>

                      {/* Expandable Linked Patients Sub-list */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-[#7A8B76]/15 pl-4 sm:pl-8 space-y-2">
                          <p className="text-xs font-bold text-[#6D736E] uppercase tracking-wider mb-2">
                            Pacientes Vinculados ({pro.patients.length})
                          </p>
                          {pro.patients.length === 0 ? (
                            <p className="text-xs text-[#6D736E] italic">Nenhum paciente vinculado no momento.</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {pro.patients.map((pat) => (
                                <div
                                  key={pat.id}
                                  className="p-3 bg-white rounded-xl border border-[#7A8B76]/15 flex items-center justify-between gap-2 shadow-2xs"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-xs font-bold text-[#2C332D] truncate">{pat.name}</p>
                                      {pat.isTestUser && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-700">
                                          Teste
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-[#6D736E] truncate">{pat.email}</p>
                                  </div>
                                  <button
                                    onClick={() => handleImpersonate(pat.id, pat.name)}
                                    className="p-1.5 rounded-lg bg-[#F9F8F4] hover:bg-amber-100 text-slate-800 hover:text-amber-900 transition-all text-[11px] font-bold shrink-0 cursor-pointer"
                                    title="Simular este paciente"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 3: TELEMETRIA DE ROTAS & PERFORMANCE --- */}
      {activeTab === 'telemetry' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white p-6 rounded-3xl border border-[#7A8B76]/15 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="text-lg font-bold text-[#2C332D]">Métricas de Execução de Rotas</h3>
                <p className="text-xs text-[#6D736E]">
                  Contagem de acessos (hits), tempo de resposta aproximado (latência) e taxa de erro em tempo real.
                </p>
              </div>
              <button
                onClick={fetchAllData}
                className="px-3 py-1.5 rounded-xl border border-[#7A8B76]/20 text-xs font-bold text-[#2C332D] hover:bg-[#F9F8F4] cursor-pointer flex items-center gap-1 self-start sm:self-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Atualizar Métricas</span>
              </button>
            </div>

            {routes.length === 0 ? (
              <div className="text-center py-12 text-[#6D736E] text-sm">
                Nenhuma requisição monitorada ainda. Navegue pela aplicação para registrar métricas automaticamente.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-[#7A8B76]/15 text-[#6D736E] text-xs font-bold uppercase tracking-wider">
                      <th className="pb-3">Método & Rota</th>
                      <th className="pb-3 text-center">Hits</th>
                      <th className="pb-3 text-right">Latência Média</th>
                      <th className="pb-3 text-right">Mín / Máx</th>
                      <th className="pb-3 text-center">Erros</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#7A8B76]/10">
                    {routes.map((r, idx) => {
                      const getMethodColor = (m: string) => {
                        switch (m) {
                          case 'GET': return 'bg-emerald-100 text-emerald-800';
                          case 'POST': return 'bg-blue-100 text-blue-800';
                          case 'PUT': return 'bg-amber-100 text-amber-800';
                          case 'DELETE': return 'bg-rose-100 text-rose-800';
                          default: return 'bg-gray-100 text-gray-800';
                        }
                      };

                      const getLatencyColor = (ms: number) => {
                        if (ms < 100) return 'text-emerald-700 font-bold';
                        if (ms < 300) return 'text-amber-700 font-bold';
                        return 'text-rose-700 font-bold';
                      };

                      return (
                        <tr key={idx} className="hover:bg-[#F9F8F4]/60 transition-colors">
                          <td className="py-3 font-mono">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${getMethodColor(r.method)}`}>
                                {r.method}
                              </span>
                              <span className="text-[#2C332D] font-medium">{r.path}</span>
                            </div>
                          </td>
                          <td className="py-3 text-center font-bold text-[#2C332D]">
                            {r.hits}
                          </td>
                          <td className="py-3 text-right">
                            <span className={getLatencyColor(r.avgDurationMs)}>
                              {r.avgDurationMs}ms
                            </span>
                          </td>
                          <td className="py-3 text-right text-xs text-[#6D736E]">
                            {r.minDurationMs}ms / {r.maxDurationMs}ms
                          </td>
                          <td className="py-3 text-center">
                            {r.errorHits > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                                {r.errorHits} ({Math.round((r.errorHits / r.hits) * 100)}%)
                              </span>
                            ) : (
                              <span className="text-xs text-emerald-600 font-bold">0%</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 4: MONITOR DE BUGS & ERROS --- */}
      {activeTab === 'errors' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white p-6 rounded-3xl border border-[#7A8B76]/15 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="text-lg font-bold text-[#2C332D]">Feed de Bugs e Erros em Tempo Real</h3>
                <p className="text-xs text-[#6D736E]">
                  Logs capturados dos últimos erros 4xx / 5xx para diagnóstico instantâneo no Beta.
                </p>
              </div>
            </div>

            {errors.length === 0 ? (
              <div className="text-center py-12 text-emerald-700 text-sm font-semibold flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                <span>Nenhum erro registrado no momento! A aplicação está operando de forma saudável.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {errors.map((err) => (
                  <div
                    key={err.id}
                    className="p-4 rounded-2xl border border-rose-200 bg-rose-50/40 space-y-2 text-xs sm:text-sm"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 font-mono">
                        <span className="px-2 py-0.5 rounded text-[11px] font-black bg-rose-600 text-white">
                          HTTP {err.statusCode}
                        </span>
                        <span className="font-bold text-[#2C332D]">{err.method} {err.path}</span>
                      </div>
                      <span className="text-xs text-[#6D736E]">
                        {new Date(err.timestamp).toLocaleTimeString('pt-BR')} • {new Date(err.timestamp).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    <p className="text-rose-900 font-medium bg-white/80 p-2.5 rounded-xl border border-rose-200/60 font-mono text-xs">
                      {err.message}
                    </p>

                    {err.userId && (
                      <div className="flex items-center gap-2 text-[11px] text-[#6D736E]">
                        <span>Usuário ID: <code className="text-slate-800">{err.userId}</code></span>
                        {err.userRole && <span>({err.userRole})</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 5: SANDBOX & PLAYGROUND --- */}
      {activeTab === 'sandbox' && (
        <div className="space-y-6 animate-fade-in">
          {/* Quick Sandbox Controls */}
          <div className="bg-white p-6 rounded-3xl border border-[#7A8B76]/15 shadow-2xs space-y-4">
            <h3 className="text-lg font-bold text-[#2C332D] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Gestão de Massa de Testes (Sandbox)
            </h3>
            <p className="text-xs text-[#6D736E]">
              Gere dados fictícios completos para validar todas as telas ou limpe os registros de teste com 1-clique. Usuários reais ficam 100% protegidos.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={handleSeedSandbox}
                disabled={seeding}
                className="px-4 py-2.5 rounded-2xl bg-slate-900 text-amber-400 hover:bg-slate-800 font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-sm transition-all active:scale-95 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{seeding ? 'Criando Persona Demo...' : '⚡ Criar Psicólogo & Pacientes Demo'}</span>
              </button>

              <button
                onClick={handleCleanSandbox}
                disabled={cleaning}
                className="px-4 py-2.5 rounded-2xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{cleaning ? 'Limpando...' : '🧹 Limpar Todas as Contas de Teste'}</span>
              </button>
            </div>
          </div>

          {/* Live Route Playground */}
          <div className="bg-white p-6 rounded-3xl border border-[#7A8B76]/15 shadow-2xs space-y-4">
            <h3 className="text-lg font-bold text-[#2C332D] flex items-center gap-2">
              <Terminal className="w-5 h-5 text-[#7A8B76]" />
              API Playground em Tempo Real
            </h3>
            <p className="text-xs text-[#6D736E]">
              Dispare requisições internas autenticadas para testar rotas e medir o tempo de resposta instantaneamente.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2">
              <select
                value={playgroundMethod}
                onChange={(e) => setPlaygroundMethod(e.target.value)}
                className="bg-[#F9F8F4] border border-[#7A8B76]/20 rounded-xl px-3 py-2.5 text-xs font-bold text-[#2C332D] focus:outline-none"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>

              <input
                type="text"
                value={playgroundPath}
                onChange={(e) => setPlaygroundPath(e.target.value)}
                placeholder="Ex: /health ou /admin/overview"
                className="flex-1 bg-[#F9F8F4] border border-[#7A8B76]/20 rounded-xl px-4 py-2.5 text-xs font-mono text-[#2C332D] focus:outline-none focus:ring-1 focus:ring-[#7A8B76]"
              />

              <button
                onClick={handleExecutePlayground}
                disabled={playgroundLoading}
                className="px-5 py-2.5 rounded-xl bg-[#7A8B76] text-white hover:bg-[#687764] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{playgroundLoading ? 'Executando...' : 'Executar Rota'}</span>
              </button>
            </div>

            {playgroundResult && (
              <div className="mt-4 p-4 rounded-2xl bg-slate-950 text-slate-100 font-mono text-xs space-y-2 overflow-hidden shadow-inner">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded font-black text-[10px] ${
                      playgroundResult.status < 300 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                    }`}>
                      Status {playgroundResult.status} {playgroundResult.statusText}
                    </span>
                  </div>
                  {playgroundLatency !== null && (
                    <span className="text-amber-400 font-bold">⏱️ {playgroundLatency}ms</span>
                  )}
                </div>
                <pre className="overflow-x-auto max-h-60 p-2 text-slate-300 scrollbar-thin">
                  {JSON.stringify(playgroundResult.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
