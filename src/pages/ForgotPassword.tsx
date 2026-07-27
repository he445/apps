/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Logo } from '../components/Logo';
import { Button, Input, Card } from '../components/UI';
import { toast } from 'sonner';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Por favor, informe seu e-mail.');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSuccess(true);
      toast.success('E-mail enviado! Verifique sua caixa de entrada.');
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || 'Erro ao processar solicitação.';
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
          <h2 className="text-xl font-bold text-[#2C332D]">Recuperar Senha</h2>
          <p className="text-sm text-[#6D736E]">
            Esqueceu sua senha? Nós ajudamos você a redefini-la.
          </p>
        </div>

        {/* Form Card */}
        <Card className="shadow-md">
          {success ? (
            <div className="flex flex-col gap-5 text-center py-4">
              <div className="text-4xl">📧</div>
              <h3 className="text-lg font-bold text-[#2C332D]">Instruções enviadas!</h3>
              <p className="text-sm text-[#6D736E]">
                Enviamos um e-mail para <strong className="text-[#2C332D]">{email}</strong> com as instruções para redefinir sua senha de acesso.
              </p>
              <Link to="/login" className="mt-4">
                <Button variant="primary" className="w-full">
                  Voltar para o Login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <p className="text-xs text-[#6D736E] leading-relaxed">
                Digite seu endereço de e-mail abaixo. Se houver uma conta ativa correspondente, enviaremos um link seguro para alteração de senha.
              </p>
              
              <Input
                id="email"
                type="email"
                label="E-mail de Cadastro"
                placeholder="seuemail@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Button type="submit" variant="primary" className="w-full mt-2" isLoading={isLoading}>
                Enviar Instruções de Recuperação
              </Button>

              <div className="text-center mt-2">
                <Link to="/login" className="text-sm font-semibold text-[#6D736E] hover:text-[#2C332D] hover:underline">
                  Voltar ao Login
                </Link>
              </div>
            </form>
          )}
        </Card>

      </div>
    </div>
  );
}
