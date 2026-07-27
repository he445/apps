/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { Button, Input, Card } from '../components/UI';
import { toast } from 'sonner';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Preencha todos os campos.');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      toast.success('Login realizado com sucesso!');
      
      // Determine destination based on restored role
      const storedUserStr = window.sessionStorage.getItem('ojanuan_user');
      if (storedUserStr) {
        const storedUser = JSON.parse(storedUserStr);
        if (storedUser.role === 'PROFESSIONAL') {
          navigate('/pro/dashboard');
        } else {
          navigate('/paciente/dashboard');
        }
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || 'E-mail ou senha incorretos.';
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
          <Logo size="xl" />
          <h2 className="text-xl font-bold text-[#2C332D] mt-2">Acolhimento & Vínculo Terapêutico</h2>
          <p className="text-sm text-[#6D736E] max-w-xs">
            Gestão operacional e acompanhamento diário integrados entre profissional e paciente.
          </p>
        </div>

        {/* Login Form */}
        <Card className="shadow-md">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              id="email"
              name="email"
              type="email"
              label="E-mail"
              placeholder="Digite seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="pl-3"
            />

            <div className="flex flex-col gap-1">
              <Input
                id="password"
                name="password"
                type="password"
                label="Senha"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div className="text-right">
                <Link 
                  to="/esqueci-minha-senha" 
                  className="text-xs font-semibold text-[#C16E59] hover:underline"
                >
                  Esqueceu sua senha?
                </Link>
              </div>
            </div>

            <Button type="submit" variant="primary" className="w-full mt-2" isLoading={isLoading}>
              Entrar na Conta
            </Button>
          </form>

          {/* Spacer */}
          <div className="relative flex py-5 items-center">
            <div className="flex-grow border-t border-[#7A8B76]/15"></div>
            <span className="flex-shrink mx-4 text-xs font-semibold uppercase text-[#6D736E]/50 tracking-wider">Ou</span>
            <div className="flex-grow border-t border-[#7A8B76]/15"></div>
          </div>

          <div className="text-center">
            <p className="text-sm text-[#2C332D]">
              Não tem uma conta?{' '}
              <Link to="/cadastro" className="font-bold text-[#7A8B76] hover:underline">
                Cadastre-se aqui
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
