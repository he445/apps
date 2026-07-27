/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Button, Card, Input, Skeleton } from '../../components/UI';
import { toast } from 'sonner';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  ChevronLeft, 
  AlertTriangle, 
  Send, 
  ClipboardList, 
  FileText, 
  BrainCircuit, 
  Calendar, 
  MessageSquare 
} from 'lucide-react';

interface MoodLog {
  id: string;
  date: string;
  humor_geral: number;
  qualidade_sono: number;
  nivel_energia: number;
  nivel_ansiedade: number;
  interacao_social: boolean;
  nota?: string;
  indice_bem_estar: number;
}

interface PatientDetails {
  id: string;
  name: string;
  email: string;
  cpf?: string;
}

export default function PacienteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [patient, setPatient] = useState<PatientDetails | null>(null);
  const [evaluations, setEvaluations] = useState<MoodLog[]>([]);
  const [loading, setLoading] = useState(true);

  // New orientation states
  const [orientationTitle, setOrientationTitle] = useState('');
  const [orientationContent, setOrientationContent] = useState('');
  const [sendingOrientation, setSendingOrientation] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch patient info
        const patientsRes = await api.get('/care/professional/patients');
        const currentPatient = patientsRes.data.patients.find((p: any) => p.id === id);
        
        if (!currentPatient) {
          toast.error('Paciente não encontrado ou não vinculado.');
          navigate('/pro/dashboard');
          return;
        }
        setPatient(currentPatient);

        // Fetch evaluations
        const evalsRes = await api.get(`/assessments/${id}`);
        setEvaluations(evalsRes.data);
      } catch (err: any) {
        console.error(err);
        toast.error('Erro ao buscar dados clínicos do paciente.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  const handleSendOrientation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orientationTitle || !orientationContent) {
      toast.error('Preencha o título e o conteúdo da orientação.');
      return;
    }

    setSendingOrientation(true);
    try {
      await api.post(`/guidelines/${id}`, {
        text: orientationContent,
      });

      toast.success('Orientação terapêutica enviada com sucesso!');
      setOrientationTitle('');
      setOrientationContent('');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao enviar orientação.');
    } finally {
      setSendingOrientation(false);
    }
  };

  // Check for recent critical warnings (mood <= 2 or anxiety >= 4)
  const getRecentAlerts = () => {
    return evaluations.filter(e => e.humor_geral <= 2 || e.nivel_ansiedade >= 4);
  };

  const recentAlerts = getRecentAlerts();
  const hasCriticalAlert = recentAlerts.length > 0;

  // Format Recharts date logs
  const chartData = evaluations.map((e) => ({
    Data: e.date.substring(5), // Keep only MM-DD
    Humor: e.humor_geral,
    Sono: e.qualidade_sono,
    Energia: e.nivel_energia,
    Ansiedade: e.nivel_ansiedade,
    'Índice Bem-Estar': parseFloat(e.indice_bem_estar.toFixed(2)),
  }));

  return (
    <div className="flex flex-col gap-8">
      
      {/* Header Controls */}
      <div className="flex items-center gap-3">
        <Button 
          onClick={() => navigate('/pro/dashboard')} 
          variant="outline" 
          className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-[#6D736E]"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <span className="text-xs uppercase font-bold text-[#7A8B76] tracking-wider">Acompanhamento Clínico</span>
          <h1 className="text-2xl font-bold text-[#2C332D] tracking-tight">
            {loading ? <Skeleton className="h-8 w-48" /> : patient?.name}
          </h1>
        </div>
      </div>

      {/* Alarme Crítico */}
      {hasCriticalAlert && (
        <div className="bg-[#B54B3C]/10 border border-[#B54B3C]/30 text-[#B54B3C] rounded-xl p-5 flex gap-4 items-start animate-pulse">
          <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="font-bold text-base">Alerta de Declínio Clínico</span>
            <p className="text-sm leading-relaxed text-[#B54B3C]/90">
              O paciente registrou picos de ansiedade elevada (nível ≥ 4) ou humor crítico (nível ≤ 2) em suas avaliações recentes. Recomendamos agendar uma sessão de apoio ou enviar uma orientação direcionada.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Chart & Evaluations History */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            
            {/* Recharts Multidimensional Evolution */}
            <Card className="shadow-2xs">
              <div className="flex flex-col gap-2 mb-6">
                <h3 className="text-base font-bold text-[#2C332D] flex items-center gap-2">
                  <BrainCircuit className="h-5 w-5 text-[#7A8B76]" />
                  <span>Evolução Multidimensional do Paciente</span>
                </h3>
                <p className="text-xs text-[#6D736E]">
                  Avaliação integral de 4 dimensões de saúde mental com variação de escala de 1 a 5.
                </p>
              </div>

              {chartData.length === 0 ? (
                <div className="text-center py-12 text-[#6D736E] text-sm">
                  Nenhuma avaliação registrada por este paciente nos últimos dias.
                </div>
              ) : (
                <div className="h-80 w-full pr-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#6D736E/10" />
                      <XAxis dataKey="Data" tick={{ fontSize: 11, fill: '#6D736E' }} />
                      <YAxis domain={[1, 5]} tick={{ fontSize: 11, fill: '#6D736E' }} />
                      <Tooltip />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Line 
                        type="monotone" 
                        dataKey="Humor" 
                        stroke="#C16E59" 
                        strokeWidth={2.5} 
                        activeDot={{ r: 8 }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Sono" 
                        stroke="#7A8B76" 
                        strokeWidth={2} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Energia" 
                        stroke="#E0A96D" 
                        strokeWidth={2} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Ansiedade" 
                        stroke="#B54B3C" 
                        strokeWidth={2} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* Logs List & Diary */}
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-bold text-[#2C332D] flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-[#6D736E]" />
                <span>Histórico de Registro e Diário Clínico</span>
              </h3>

              {evaluations.length === 0 ? (
                <p className="text-sm text-[#6D736E]">Nenhum registro encontrado.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {evaluations.slice().reverse().map((e) => (
                    <Card key={e.id} className="border-l-4 border-l-[#7A8B76] shadow-2xs">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-[#2C332D] flex items-center gap-1.5">
                            <Calendar className="h-4 w-4 text-[#6D736E]" />
                            {e.date}
                          </span>
                          <span className="text-xs font-bold px-2.5 py-1 rounded bg-[#7A8B76]/10 text-[#7A8B76]">
                            Bem-Estar: {e.indice_bem_estar.toFixed(2)}
                          </span>
                        </div>

                        {/* Dimensions Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F9F8F4] p-3 rounded-lg text-xs">
                          <div>
                            <p className="text-[#6D736E] font-medium">Humor geral:</p>
                            <p className="font-bold text-[#2C332D]">{e.humor_geral} / 5</p>
                          </div>
                          <div>
                            <p className="text-[#6D736E] font-medium">Qualidade sono:</p>
                            <p className="font-bold text-[#2C332D]">{e.qualidade_sono} / 5</p>
                          </div>
                          <div>
                            <p className="text-[#6D736E] font-medium">Energia física:</p>
                            <p className="font-bold text-[#2C332D]">{e.nivel_energia} / 5</p>
                          </div>
                          <div>
                            <p className="text-[#6D736E] font-medium">Ansiedade:</p>
                            <p className={`font-bold ${e.nivel_ansiedade >= 4 ? 'text-[#B54B3C]' : 'text-[#2C332D]'}`}>
                              {e.nivel_ansiedade} / 5
                            </p>
                          </div>
                        </div>

                        <div className="text-xs text-[#6D736E] flex items-center gap-2">
                          <span className="font-bold">Interação Social no dia:</span>
                          <span className={`px-2 py-0.5 rounded-full font-bold ${e.interacao_social ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            {e.interacao_social ? 'Sim' : 'Não'}
                          </span>
                        </div>

                        {e.nota && (
                          <div className="bg-[#C16E59]/5 border border-[#C16E59]/10 rounded-lg p-3 text-sm text-[#2C332D] italic">
                            "{e.nota}"
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Side columns: Send Orientations and Quick Links */}
          <div className="flex flex-col gap-6">
            
            {/* Form orientation dispatch */}
            <Card className="shadow-2xs">
              <form onSubmit={handleSendOrientation} className="flex flex-col gap-4">
                <h3 className="text-base font-bold text-[#2C332D] border-b border-[#6D736E]/10 pb-2 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#C16E59]" />
                  <span>Enviar Nova Orientação</span>
                </h3>

                <p className="text-xs text-[#6D736E] leading-relaxed">
                  Envie tarefas, técnicas de respiração ou anotações personalizadas para este paciente. Aparecerá no mural do paciente instantaneamente.
                </p>

                <Input
                  id="orientationTitle"
                  label="Título da Orientação"
                  placeholder="Ex: Exercício de Mindfullness"
                  value={orientationTitle}
                  onChange={(e) => setOrientationTitle(e.target.value)}
                  required
                />

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="orientationContent" className="text-xs font-semibold text-[#6D736E] uppercase tracking-wider">
                    Conteúdo Terapêutico
                  </label>
                  <textarea
                    id="orientationContent"
                    rows={6}
                    placeholder="Escreva os passos ou anotações recomendadas..."
                    className="w-full px-4 py-3 border border-[#6D736E]/30 rounded-lg text-sm bg-white text-[#2C332D] focus:outline-none focus:ring-2 focus:ring-[#7A8B76] focus:border-[#7A8B76]"
                    value={orientationContent}
                    onChange={(e) => setOrientationContent(e.target.value)}
                    required
                  />
                </div>

                <Button 
                  type="submit" 
                  variant="primary" 
                  className="w-full mt-2"
                  isLoading={sendingOrientation}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Disparar ao Mural
                </Button>
              </form>
            </Card>

            {/* Quick Contact Box */}
            <Card className="bg-[#7A8B76]/5 border border-[#7A8B76]/10 flex flex-col gap-4">
              <h3 className="font-bold text-sm text-[#2C332D] flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[#7A8B76]" />
                <span>Contato e Chat Clínico</span>
              </h3>
              <p className="text-xs text-[#6D736E] leading-relaxed">
                Precisa discutir alguma das anotações ou fazer um follow-up rápido com {patient?.name}? Entre no canal de chat.
              </p>
              <Button 
                onClick={() => navigate(`/paciente/chat?partnerId=${id}`)} 
                variant="outline" 
                className="w-full border-[#7A8B76] text-[#7A8B76] hover:bg-[#7A8B76]/5"
              >
                Abrir Chat Clínico
              </Button>
            </Card>

          </div>

        </div>
      )}

    </div>
  );
}
