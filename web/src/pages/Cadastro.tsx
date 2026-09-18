/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { Button, Input, Card } from '../components/UI';
import { toast } from 'sonner';

export default function Cadastro() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // If there's an invite token in the URL query, pre-select Patient
  const urlInviteToken = searchParams.get('token') || '';

  const [role, setRole] = useState<'PROFESSIONAL' | 'PATIENT'>(urlInviteToken ? 'PATIENT' : 'PROFESSIONAL');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cpf, setCpf] = useState('');
  const [inviteToken, setInviteToken] = useState(urlInviteToken);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    if (role === 'PATIENT' && !cpf) {
      toast.error('CPF é obrigatório para fins contábeis de emissão de recibos.');
      return;
    }

    setIsLoading(true);
    try {
      await register({
        fullName: name,
        email,
        password,
        role,
        cpf: role === 'PATIENT' ? cpf : undefined,
        inviteToken: role === 'PATIENT' && inviteToken ? inviteToken : undefined,
        token: role === 'PATIENT' && inviteToken ? inviteToken : undefined,
      });

      toast.success('Cadastro realizado com sucesso!');
      
      if (role === 'PROFESSIONAL') {
        navigate('/pro/dashboard');
      } else {
        navigate('/paciente/dashboard');
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || 'Erro ao realizar cadastro. Verifique os dados.';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9F8F4] px-4 py-12">
      <div className="w-full max-w-md flex flex-col gap-8 animate-fade-in">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <Logo size="lg" />
          <h2 className="text-xl font-bold text-[#2C332D]">Criar Nova Conta</h2>
          <p className="text-sm text-[#6D736E]">
            Selecione seu perfil de acesso e preencha os dados abaixo.
          </p>
        </div>

        {/* Form Container */}
        <Card className="shadow-md">
          {/* Role Selector Tabs (Only show if not signed through a forced URL invite) */}
          {!urlInviteToken && (
            <div className="grid grid-cols-2 bg-[#F9F8F4] p-1.5 rounded-2xl border border-[#7A8B76]/15 mb-6">
              <button
                type="button"
                onClick={() => setRole('PROFESSIONAL')}
                className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  role === 'PROFESSIONAL'
                    ? 'bg-[#C16E59] text-white shadow-sm'
                    : 'text-[#6D736E] hover:text-[#2C332D]'
                }`}
              >
                Sou Psicólogo(a)
              </button>
              <button
                type="button"
                onClick={() => setRole('PATIENT')}
                className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  role === 'PATIENT'
                    ? 'bg-[#7A8B76] text-white shadow-sm'
                    : 'text-[#6D736E] hover:text-[#2C332D]'
                }`}
              >
                Sou Paciente
              </button>
            </div>
          )}

          {urlInviteToken && (
            <div className="bg-[#7A8B76]/10 border border-[#7A8B76]/30 text-[#7A8B76] text-xs font-bold rounded-2xl p-3 text-center mb-6">
              Cadastro de Paciente Convidado ativo
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              id="name"
              label="Nome Completo"
              placeholder="Digite seu nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <Input
              id="email"
              type="email"
              label="E-mail"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              id="password"
              type="password"
              label="Crie uma Senha"
              placeholder="No mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />

            {role === 'PATIENT' && (
              <>
                <Input
                  id="cpf"
                  label="CPF"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  required
                />

                <Input
                  id="inviteToken"
                  label="Código de Convite do Psicólogo (Opcional)"
                  placeholder="Ex: ABC123"
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  disabled={!!urlInviteToken}
                />
              </>
            )}

            <Button
              type="submit"
              variant={role === 'PROFESSIONAL' ? 'primary' : 'secondary'}
              className="w-full mt-2"
              isLoading={isLoading}
            >
              Criar Conta e Entrar
            </Button>
          </form>

          <div className="relative flex py-4 items-center">
            <div className="flex-grow border-t border-[#7A8B76]/15"></div>
          </div>

          <div className="text-center">
            <p className="text-sm text-[#2C332D]">
              Já tem uma conta?{' '}
              <Link to="/login" className="font-bold text-[#C16E59] hover:underline">
                Faça login
              </Link>
            </p>
          </div>
        </Card>

      </div>
    </div>
  );
}
