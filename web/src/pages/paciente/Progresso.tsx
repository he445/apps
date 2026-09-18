/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Card, Skeleton } from '../../components/UI';
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
import { TrendingUp, Smile, Calendar, Heart, ShieldCheck } from 'lucide-react';

interface MoodLog {
  id: string;
  date: string;
  humor_geral: number;
  qualidade_sono: number;
  nivel_energia: number;
  nivel_ansiedade: number;
  indice_bem_estar: number;
  nota?: string;
}

export default function ProgressoPaciente() {
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState<MoodLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get(`/assessments/${user.id}`);
        setEvaluations(response.data);
      } catch (err: any) {
        console.error(err);
        toast.error('Erro ao buscar histórico de humor.');
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
  }, [user?.id]);

  // Format Recharts data
  const chartData = evaluations.map((e) => ({
    Data: e.date.substring(5), // Keep only MM-DD
    'Humor Geral': e.humor_geral,
    'Índice de Bem-Estar': parseFloat(e.indice_bem_estar.toFixed(2)),
  }));

  // Calculations for average wellness
  const averageWellness = evaluations.length > 0 
    ? (evaluations.reduce((acc, e) => acc + e.indice_bem_estar, 0) / evaluations.length).toFixed(2)
    : '0.00';

  const totalEntries = evaluations.length;

  return (
    <div className="flex flex-col gap-8">
      
      {/* Header Info */}
      <div>
        <h1 className="text-2xl font-bold text-[#2C332D] tracking-tight">Histórico de Progresso</h1>
        <p className="text-sm text-[#6D736E]">
          Veja de forma transparente a sua evolução emocional e relatórios acumulados de bem-estar.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Card className="border-l-4 border-l-[#7A8B76] shadow-2xs">
          <div className="flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase font-bold text-[#6D736E]">Média Geral de Bem-Estar</span>
              <span className="text-2xl font-extrabold text-[#7A8B76]">{averageWellness} / 5.00</span>
            </div>
            <div className="p-3 bg-[#7A8B76]/10 text-[#7A8B76] rounded-full">
              <Heart className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="border-l-4 border-l-[#C16E59] shadow-2xs">
          <div className="flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase font-bold text-[#6D736E]">Dias Autoavaliados</span>
              <span className="text-2xl font-extrabold text-[#C16E59]">{totalEntries} registros</span>
            </div>
            <div className="p-3 bg-[#C16E59]/10 text-[#C16E59] rounded-full">
              <Smile className="h-6 w-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* Chart Container */}
      <Card className="shadow-2xs">
        <div className="flex flex-col gap-1 mb-6">
          <h2 className="text-base font-bold text-[#2C332D] flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#7A8B76]" />
            <span>Gráfico de Evolução Emocional</span>
          </h2>
          <p className="text-xs text-[#6D736E]">
            Acompanhamento simplificado mostrando a relação direta entre seu humor e seu índice agregado de bem-estar.
          </p>
        </div>

        {loading ? (
          <Skeleton className="h-80 w-full" />
        ) : chartData.length === 0 ? (
          <div className="text-center py-16 text-[#6D736E] text-sm">
            Nenhuma avaliação diária registrada ainda. Comece a responder em seu Início para visualizar gráficos!
          </div>
        ) : (
          <div className="h-80 w-full pr-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#6D736E/15" />
                <XAxis dataKey="Data" tick={{ fontSize: 11, fill: '#6D736E' }} />
                <YAxis domain={[1, 5]} tick={{ fontSize: 11, fill: '#6D736E' }} />
                <Tooltip />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Line 
                  type="monotone" 
                  dataKey="Índice de Bem-Estar" 
                  stroke="#7A8B76" 
                  strokeWidth={2.5} 
                  activeDot={{ r: 8 }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="Humor Geral" 
                  stroke="#C16E59" 
                  strokeWidth={2.5} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Shared Info Alert */}
      <div className="bg-[#7A8B76]/10 border border-[#7A8B76]/20 rounded-xl p-5 flex gap-4 items-start shadow-2xs">
        <ShieldCheck className="h-6 w-6 text-[#7A8B76] shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1 text-sm text-[#2C332D]">
          <span className="font-bold">Privacidade de Dados Assegurada</span>
          <p className="text-xs text-[#6D736E] leading-relaxed">
            Seu progresso é visualizado de forma agregada por você e de maneira multidimensional por seu profissional de saúde vinculado. O Ojanuan segue rígidos parâmetros de sigilo profissional ético, em total alinhamento com as resoluções do Conselho Federal de Psicologia (CFP).
          </p>
        </div>
      </div>

    </div>
  );
}
