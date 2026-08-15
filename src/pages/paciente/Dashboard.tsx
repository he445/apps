/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Button, Card, Input, Skeleton } from '../../components/UI';
import { toast } from 'sonner';
import { 
  Heart, 
  Smile, 
  BedDouble, 
  Zap, 
  AlertTriangle, 
  Users, 
  MessageSquare,
  Sparkles,
  BookOpen,
  CalendarCheck
} from 'lucide-react';

interface Orientation {
  id: string;
  title: string;
  content: string;
  date: string;
}

export default function DashboardPaciente() {
  const navigate = useNavigate();
  const [orientations, setOrientations] = useState<Orientation[]>([]);
  const [hasEvaluatedToday, setHasEvaluatedToday] = useState(false);
  const [psychologistName, setPsychologistName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [switchingPsychologist, setSwitchingPsychologist] = useState(false);

  // Form values
  const [humor, setHumor] = useState<number>(3);
  const [sono, setSono] = useState<number>(3);
  const [energia, setEnergia] = useState<number>(3);
  const [ansiedade, setAnsiedade] = useState<number>(3);
  const [social, setSocial] = useState<boolean>(true);
  const [nota, setNota] = useState('');
  const [savingLog, setSavingLog] = useState(false);

  // Calculated Index
  const [wellBeingIndex, setWellBeingIndex] = useState<number | null>(null);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/care/patient/dashboard');
      setOrientations(response.data.orientations);
      setPsychologistName(response.data.psychologistName);
      setHasEvaluatedToday(response.data.hasEvaluatedToday);

      const todaysMood = response.data.todaysMood;
      if (todaysMood) {
        setHumor(todaysMood.humor_geral);
        setSono(todaysMood.qualidade_sono);
        setEnergia(todaysMood.nivel_energia);
        setAnsiedade(todaysMood.nivel_ansiedade);
        setSocial(todaysMood.interacao_social);
        setNota(todaysMood.nota || '');
        setWellBeingIndex(todaysMood.indice_bem_estar);
      } else {
        setWellBeingIndex(null);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao carregar dados do seu painel.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLog(true);

    try {
      const response = await api.post('/assessments', {
        humor_geral: humor,
        qualidade_sono: sono,
        nivel_energia: energia,
        nivel_ansiedade: ansiedade,
        interacao_social: social,
        nota: nota || undefined,
      });

      toast.success(hasEvaluatedToday ? 'Autoavaliação diária atualizada!' : 'Autoavaliação diária registrada!');
      setHasEvaluatedToday(true);
      setWellBeingIndex(response.data.indice_bem_estar);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao enviar avaliação.');
    } finally {
      setSavingLog(false);
    }
  };

  const handleUseInviteCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      toast.error('Informe o código de convite.');
      return;
    }

    setSwitchingPsychologist(true);
    try {
      const response = await api.post('/care/patient/invitations/accept', { token: inviteCode.trim() });
      setPsychologistName(response.data.psychologistName || 'Psicólogo vinculado');
      toast.success(`Vínculo atualizado com ${response.data.psychologistName || 'o profissional selecionado'}.`);
      setInviteCode('');
    } catch (err: any) {
      const message = err.response?.data?.message || 'Não foi possível aplicar o convite.';
      toast.error(message);
    } finally {
      setSwitchingPsychologist(false);
    }
  };

  // Render a nice row of star/numeric bubbles for selection
  const renderOptionSelector = (
    label: string, 
    value: number, 
    setValue: (val: number) => void, 
    minLabel: string, 
    maxLabel: string,
    icon: React.ReactNode
  ) => {
    return (
      <div className="flex flex-col gap-2 bg-white border border-[#6D736E]/10 rounded-xl p-4">
        <div className="flex items-center gap-2 font-bold text-sm text-[#2C332D]">
          {icon}
          <span>{label}</span>
        </div>
        <div className="flex items-center justify-between gap-1 mt-1">
          {[1, 2, 3, 4, 5].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => setValue(num)}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full font-bold text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#7A8B76] active-press cursor-pointer ${
                value === num
                  ? 'bg-[#7A8B76] text-white scale-110 shadow-sm'
                  : 'bg-[#F9F8F4] text-[#6D736E] hover:bg-[#7A8B76]/10 hover:text-[#2C332D]'
              }`}
            >
              {num}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-[#6D736E] mt-1">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      
      {/* Welcome Banner */}
      <div className="bg-[#7A8B76]/10 border border-[#7A8B76]/20 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-[#7A8B76] uppercase tracking-wider">Acolhimento Diário</span>
          <h1 className="text-xl md:text-2xl font-bold text-[#2C332D] tracking-tight">
            Olá! Que bom ter você aqui hoje.
          </h1>
          <p className="text-sm text-[#6D736E]">
            Seu acompanhamento é feito em parceria com <strong className="text-[#2C332D]">{loading ? '...' : psychologistName}</strong>.
          </p>
        </div>

        {/* Well-being Index Top visual indicator */}
        {wellBeingIndex !== null && (
          <div className="bg-white border border-[#7A8B76]/30 px-5 py-3 rounded-xl flex flex-col items-center gap-0.5 shadow-2xs self-start md:self-auto shrink-0">
            <span className="text-[10px] uppercase font-bold text-[#6D736E] tracking-wider">Índice Bem-Estar</span>
            <span className="text-2xl font-extrabold text-[#7A8B76]">{wellBeingIndex.toFixed(2)}</span>
            <span className="text-[9px] text-[#6D736E] font-medium">Autoavaliação de Hoje</span>
          </div>
        )}
      </div>

      <Card className="border border-[#7A8B76]/20 bg-[#F9F8F4] p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-bold text-[#2C332D]">Trocar ou vincular profissional</h2>
          <p className="text-xs text-[#6D736E]">Use o código de convite do seu psicólogo para atualizar o vínculo ou entrar em outra equipe.</p>
        </div>
        <form onSubmit={handleUseInviteCode} className="flex flex-col gap-3">
          <Input
            id="inviteCode"
            label="Código de convite"
            placeholder="Ex: ABC123"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
          />
          <Button type="submit" variant="secondary" isLoading={switchingPsychologist} className="w-full sm:w-auto">
            Aplicar convite
          </Button>
        </form>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Questionnaire Form Column */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#2C332D] flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-[#C16E59]" />
              <span>{hasEvaluatedToday ? 'Sua Autoavaliação de Hoje (Salva)' : 'Autoavaliação Diária de Saúde'}</span>
            </h2>
            {hasEvaluatedToday && (
              <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-3 py-1 rounded-full">
                Respondido hoje
              </span>
            )}
          </div>

          <Card className="shadow-2xs">
            {loading ? (
              <div className="flex flex-col gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : (
              <form onSubmit={handleSubmitEvaluation} className="flex flex-col gap-6">
                
                <p className="text-xs text-[#6D736E] leading-relaxed">
                  Avalie como você se sente no dia de hoje em relação a cada um dos eixos abaixo. Você pode reescrever suas respostas a qualquer momento do dia. Suas respostas auxiliam seu psicólogo na preparação de suas sessões.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderOptionSelector(
                    'Humor Geral', 
                    humor, 
                    setHumor, 
                    'Péssimo', 
                    'Excelente', 
                    <Smile className="h-4 w-4 text-[#C16E59]" />
                  )}

                  {renderOptionSelector(
                    'Qualidade do Sono', 
                    sono, 
                    setSono, 
                    'Péssima noite', 
                    'Dormi muito bem', 
                    <BedDouble className="h-4 w-4 text-[#7A8B76]" />
                  )}

                  {renderOptionSelector(
                    'Nível de Energia Física', 
                    energia, 
                    setEnergia, 
                    'Esgotado(a)', 
                    'Muito disposto(a)', 
                    <Zap className="h-4 w-4 text-amber-500" />
                  )}

                  {renderOptionSelector(
                    'Nível de Ansiedade', 
                    ansiedade, 
                    setAnsiedade, 
                    'Super calmo(a)', 
                    'Altamente ansioso(a)', 
                    <AlertTriangle className="h-4 w-4 text-[#B54B3C]" />
                  )}
                </div>

                {/* Social Interaction Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#F9F8F4] border border-[#6D736E]/10 rounded-xl p-5 mt-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg text-[#7A8B76]">
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-[#2C332D]">Interação Social Saudável</span>
                      <span className="text-xs text-[#6D736E]">Conectou-se com familiares, amigos ou colegas hoje?</span>
                    </div>
                  </div>
                  <div className="flex bg-white p-1 rounded-lg border border-gray-200">
                    <button
                      type="button"
                      onClick={() => setSocial(true)}
                      className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                        social ? 'bg-[#7A8B76] text-white' : 'text-[#6D736E] hover:text-[#2C332D]'
                      }`}
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      onClick={() => setSocial(false)}
                      className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                        !social ? 'bg-[#B54B3C] text-white' : 'text-[#6D736E] hover:text-[#2C332D]'
                      }`}
                    >
                      Não
                    </button>
                  </div>
                </div>

                {/* Optional textual notes */}
                <div className="flex flex-col gap-1.5 mt-2">
                  <label htmlFor="nota" className="text-xs font-semibold text-[#6D736E] uppercase tracking-wider">
                    Nota ou Diário Emocional (Opcional e Confidencial)
                  </label>
                  <textarea
                    id="nota"
                    rows={4}
                    placeholder="Escreva algo sobre o seu dia, sentimentos, pensamentos ou acontecimentos importantes..."
                    className="w-full px-4 py-3 border border-[#6D736E]/30 rounded-lg text-sm bg-white text-[#2C332D] focus:outline-none focus:ring-2 focus:ring-[#7A8B76] focus:border-[#7A8B76]"
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                  />
                </div>

                <div className="flex justify-end mt-2 border-t border-[#6D736E]/10 pt-4">
                  <Button 
                    type="submit" 
                    variant="secondary" 
                    isLoading={savingLog}
                    className="w-full sm:w-auto"
                  >
                    {hasEvaluatedToday ? 'Atualizar Respostas' : 'Registrar Autoavaliação de Hoje'}
                  </Button>
                </div>

              </form>
            )}
          </Card>
        </div>

        {/* Right column: Agenda & Orientations Mural */}
        <div className="flex flex-col gap-6">
          {/* Quick Agenda Link Card */}
          <Card 
            className="bg-[#7A8B76]/10 border border-[#7A8B76]/20 p-5 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-[#7A8B76]/15 transition-all shadow-2xs"
            onClick={() => navigate('/paciente/agenda')}
          >
            <div className="flex items-center gap-3.5">
              <div className="bg-[#7A8B76] text-white p-3 rounded-xl">
                <CalendarCheck className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-[#2C332D]">Minhas Consultas Agendadas</span>
                <span className="text-xs text-[#6D736E]">Confira próximos horários e solicitações</span>
              </div>
            </div>
            <Button variant="outline" className="text-xs bg-white text-[#7A8B76] border-[#7A8B76]/30">
              Ver Agenda
            </Button>
          </Card>

          <h2 className="text-lg font-bold text-[#2C332D] flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#7A8B76]" />
            <span>Mural de Orientações Clínicas</span>
          </h2>

          {loading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : orientations.length === 0 ? (
            <Card className="bg-[#7A8B76]/5 border border-[#7A8B76]/10 text-center p-6 text-[#6D736E] text-sm rounded-xl">
              <Sparkles className="h-8 w-8 text-[#7A8B76]/50 mx-auto mb-2" />
              <p className="font-bold text-[#2C332D]">Seu mural está vazio</p>
              <p className="text-xs mt-1">Seu profissional ainda não cadastrou nenhuma orientação personalizada para você.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3 max-h-[80vh] overflow-y-auto pr-1">
              {orientations.map((o) => (
                <Card key={o.id} className="border-l-4 border-l-[#C16E59] shadow-2xs p-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[#2C332D]">{o.title}</span>
                      <span className="text-[10px] text-[#6D736E]">{o.date}</span>
                    </div>
                    <p className="text-xs text-[#6D736E] whitespace-pre-wrap leading-relaxed">
                      {o.content}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
