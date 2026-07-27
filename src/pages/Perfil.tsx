/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Card, Modal } from '../components/UI';
import { toast } from 'sonner';
import { ShieldAlert, Trash2, Key, UserCheck, AlertTriangle } from 'lucide-react';

export default function Perfil() {
  const { user, updateProfile, deleteAccount, isProfessional } = useAuth();
  
  // Profile Form States
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [cpf, setCpf] = useState(user?.cpf || '');
  const [pixKey, setPixKey] = useState(user?.pixKey || '');
  const [sessionPrice, setSessionPrice] = useState(user?.sessionPrice?.toString() || '');
  const [cancelLimitHours, setCancelLimitHours] = useState(user?.cancelLimitHours?.toString() || '');
  
  // Security States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Soft Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      toast.error('Nome e E-mail são obrigatórios.');
      return;
    }

    // Security check: if email is modified or password is typed, current password is required
    const emailChanged = email !== user?.email;
    const pwdChanged = !!newPassword;
    if ((emailChanged || pwdChanged) && !currentPassword) {
      toast.error('Insira sua Senha Atual para reautenticação e segurança.');
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        name,
        email,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
        cpf: !isProfessional ? cpf : undefined,
        pixKey: isProfessional ? pixKey : undefined,
        sessionPrice: isProfessional && sessionPrice !== '' ? Number(sessionPrice) : undefined,
        cancelLimitHours: isProfessional && cancelLimitHours !== '' ? Number(cancelLimitHours) : undefined,
      });

      toast.success('Perfil atualizado com sucesso!');
      
      // Reset security fields
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || 'Erro ao atualizar perfil.';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePassword) {
      toast.error('Senha é obrigatória para excluir a conta.');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAccount(deletePassword);
      toast.success('Sua conta foi excluída com sucesso.');
      setDeleteModalOpen(false);
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || 'Senha incorreta.';
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col gap-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#2C332D] tracking-tight">Configurações de Perfil</h1>
        <p className="text-sm text-[#6D736E]">
          Mantenha seus dados atualizados e gerencie os parâmetros de atendimento.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        
        {/* Core Profile Form Card */}
        <Card className="shadow-xs">
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-6">
            <h3 className="text-base font-bold text-[#2C332D] border-b border-[#7A8B76]/15 pb-2 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-[#7A8B76]" />
              <span>Dados Pessoais</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                id="name"
                label="Nome Completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                id="email"
                type="email"
                label="Endereço de E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Role specific forms */}
            {!isProfessional ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  id="cpf"
                  label="CPF (Exigido para fins contábeis)"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  required
                />
              </div>
            ) : (
              <>
                <h3 className="text-base font-bold text-[#2C332D] border-b border-[#7A8B76]/15 pb-2 flex items-center gap-2 mt-4">
                  <ShieldAlert className="h-5 w-5 text-[#C16E59]" />
                  <span>Configurações Operacionais de Consultório</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    id="pixKey"
                    label="Chave PIX para Pagamento"
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                  />
                  <Input
                    id="sessionPrice"
                    type="number"
                    label="Valor Padrão da Sessão (R$)"
                    value={sessionPrice}
                    onChange={(e) => setSessionPrice(e.target.value)}
                  />
                  <Input
                    id="cancelLimitHours"
                    type="number"
                    label="Prazo Limite Cancelamento (Horas)"
                    value={cancelLimitHours}
                    onChange={(e) => setCancelLimitHours(e.target.value)}
                  />
                </div>
              </>
            )}

            <h3 className="text-base font-bold text-[#2C332D] border-b border-[#7A8B76]/15 pb-2 flex items-center gap-2 mt-4">
              <Key className="h-5 w-5 text-[#6D736E]" />
              <span>Segurança e Redefinição de Senha</span>
            </h3>

            <div className="bg-[#F9F8F4] p-4 rounded-2xl border border-[#7A8B76]/10 text-xs text-[#6D736E]">
              Deixe o campo <strong>"Nova Senha"</strong> em branco caso não queira modificá-la. Alterações de senha ou de e-mail exigem a confirmação da sua <strong>"Senha Atual"</strong>.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                id="newPassword"
                type="password"
                label="Nova Senha"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
              />
              <Input
                id="currentPassword"
                type="password"
                label="Senha Atual (para validar alterações)"
                placeholder="Digite para autorizar alterações"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div className="flex justify-end mt-4">
              <Button type="submit" variant={isProfessional ? 'primary' : 'secondary'} isLoading={isSaving}>
                Salvar Alterações
              </Button>
            </div>
          </form>
        </Card>

        {/* Danger Area / Account Deletion */}
        <Card className="border-[#B54B3C]/20 shadow-xs">
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-bold text-[#B54B3C] border-b border-[#B54B3C]/10 pb-2 flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-[#B54B3C]" />
              <span>Zona de Perigo</span>
            </h3>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col gap-1 max-w-xl">
                <h4 className="text-sm font-bold text-[#2C332D]">Excluir Minha Conta</h4>
                <p className="text-xs text-[#6D736E] leading-relaxed">
                  Apaga de forma definitiva seu perfil, histórico de conversas e autoavaliações de humor. Dados financeiros de atendimentos serão desassociados do seu nome e arquivados para fins de obrigações tributárias.
                </p>
              </div>
              <Button
                type="button"
                variant="danger"
                className="shrink-0"
                onClick={() => setDeleteModalOpen(true)}
              >
                Excluir Minha Conta
              </Button>
            </div>
          </div>
        </Card>

      </div>

      {/* Exclusão de Conta Confirmação Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirmar Exclusão de Conta"
      >
        <form onSubmit={handleDeleteAccountSubmit} className="flex flex-col gap-5">
          <div className="bg-red-50 border border-[#B54B3C]/25 text-[#B54B3C] rounded-2xl p-4 flex gap-3">
            <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="font-bold text-sm">Ação Irreversível</span>
              <p className="text-xs leading-relaxed text-[#B54B3C]">
                Atenção: seu histórico de conversas e de autoavaliações de humor será apagado permanentemente. Seus dados de pagamento serão mantidos sem seu nome associado, apenas para cumprimento de obrigações fiscais do profissional. Esta ação não pode ser desfeita.
              </p>
            </div>
          </div>

          <p className="text-xs text-[#6D736E]">
            Para confirmar que deseja excluir sua conta permanentemente, por favor digite sua senha de acesso atual:
          </p>

          <Input
            id="deletePassword"
            type="password"
            label="Senha Atual"
            placeholder="Digite sua senha"
            value={deletePassword}
            required
            onChange={(e) => setDeletePassword(e.target.value)}
          />

          <div className="flex justify-end gap-3 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteModalOpen(false);
                setDeletePassword('');
              }}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="danger"
              isLoading={isDeleting}
            >
              Sim, Excluir Conta
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
