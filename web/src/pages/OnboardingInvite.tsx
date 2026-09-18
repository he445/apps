/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Logo } from '../components/Logo';
import { Button, Card, Skeleton } from '../components/UI';
import { toast } from 'sonner';
import { UserCheck, AlertTriangle } from 'lucide-react';

export default function OnboardingInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [psychologistName, setPsychologistName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError('Token de convite inválido.');
        setLoading(false);
        return;
      }

      try {
        const response = await api.get(`/auth/invitations/${encodeURIComponent(token)}`);
        setPsychologistName(response.data.professionalName || response.data.psychologistName);
      } catch (err: any) {
        console.error(err);
        const errMsg = err.response?.data?.message || 'Código de convite inválido ou já expirado.';
        setError(errMsg);
        toast.error(errMsg);
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleAccept = () => {
    // Redirect to register, passing the token in the URL query params
    navigate(`/cadastro?token=${token}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9F8F4] px-4 py-12">
      <div className="w-full max-w-md flex flex-col gap-8 animate-fade-in">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <Logo size="lg" />
          <h2 className="text-xl font-bold text-[#2C332D]">Convite Terapêutico</h2>
        </div>

        {/* Invite Status Card */}
        <Card className="shadow-md">
          {loading ? (
            <div className="flex flex-col gap-4 py-6">
              <Skeleton className="h-8 w-3/4 mx-auto" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-12 w-full mt-4" />
            </div>
          ) : error ? (
            <div className="text-center flex flex-col gap-5 py-4">
              <div className="mx-auto bg-red-100 text-[#B54B3C] p-3 rounded-full w-fit">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-[#2C332D]">Ops! Convite Inválido</h3>
              <p className="text-sm text-[#6D736E]">
                {error}
              </p>
              <Button onClick={() => navigate('/login')} variant="outline" className="w-full mt-2">
                Ir para o Login
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-6 text-center py-4">
              <div className="mx-auto bg-[#7A8B76]/10 text-[#7A8B76] p-3 rounded-full w-fit">
                <UserCheck className="h-8 w-8" />
              </div>
              
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-bold text-[#2C332D]">Você foi convidado(a)!</h3>
                <p className="text-sm text-[#6D736E]">
                  O profissional <strong className="text-[#2C332D]">{psychologistName}</strong> convidou você para vincular sua conta ao consultório no Ojanuan.
                </p>
              </div>

              <div className="bg-[#7A8B76]/5 border border-[#7A8B76]/10 p-4 rounded-lg text-xs text-left text-[#6D736E] leading-relaxed">
                Ao aceitar o convite, suas autoavaliações diárias de humor e sono serão compartilhadas diretamente com seu psicólogo de forma segura e confidencial.
              </div>

              <div className="flex flex-col gap-3">
                <Button onClick={handleAccept} variant="secondary" className="w-full">
                  Aceitar Convite e Cadastrar-se
                </Button>
                
                <Button onClick={() => navigate('/login')} variant="outline" className="w-full">
                  Fazer Login em Conta Existente
                </Button>
              </div>
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}
