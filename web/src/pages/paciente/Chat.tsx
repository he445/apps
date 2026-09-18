/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useChatPolling } from '../../hooks/useChatPolling';
import { api } from '../../services/api';
import { Card, Button, Skeleton } from '../../components/UI';
import { toast } from 'sonner';
import { Send, MessageCircle, RefreshCw, User } from 'lucide-react';

interface ChatPartner {
  id: string;
  name: string;
  role: string;
}

export default function Chat() {
  const { user, isProfessional, isPatient } = useAuth();
  const [searchParams] = useSearchParams();
  const queryPartnerId = searchParams.get('partnerId');
  
  // States
  const [partners, setPartners] = useState<ChatPartner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [selectedPartnerName, setSelectedPartnerName] = useState('');
  const [text, setText] = useState('');
  const [partnersLoading, setPartnersLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch partners on load
  useEffect(() => {
    const fetchPartners = async () => {
      try {
        if (isProfessional) {
          const response = await api.get('/care/professional/patients');
          const activePatients = response.data.patients ?? [];
          setPartners(activePatients);
          if (activePatients.length > 0) {
            const requested = queryPartnerId ? activePatients.find((p: any) => p.id === queryPartnerId) : null;
            const target = requested || activePatients[0];
            setSelectedPartnerId(target.id);
            setSelectedPartnerName(target.name);
          }
        } else {
          const response = await api.get('/care/patient/dashboard');
          const psychologistId = response.data.psychologistId || response.data.professionalId;
          if (psychologistId) {
            const partner: ChatPartner = {
              id: psychologistId,
              name: response.data.psychologistName,
              role: 'PROFESSIONAL',
            };
            setPartners([partner]);
            setSelectedPartnerId(partner.id);
            setSelectedPartnerName(partner.name);
          }
        }
      } catch (err: any) {
        console.error(err);
        toast.error('Erro ao inicializar contatos do chat.');
      } finally {
        setPartnersLoading(false);
      }
    };

    fetchPartners();
  }, [isProfessional, isPatient, queryPartnerId]);

  // Connect to the short-polling custom hook
  const { messages, loading: messagesLoading, sendMessage, isPollingActive } = useChatPolling(selectedPartnerId);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const msgText = text;
    setText(''); // Clear input immediately
    await sendMessage(msgText);
  };

  const handleSelectPartner = (id: string, name: string) => {
    setSelectedPartnerId(id);
    setSelectedPartnerName(name);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!user) return null;

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-14rem)] md:h-[calc(100vh-10rem)] border border-[#6D736E]/10 rounded-xl overflow-hidden bg-white shadow-xs">
      
      {/* 1. SIDEBAR (Only visible or useful for Psychologist, listing multiple patients) */}
      {isProfessional && (
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[#6D736E]/10 bg-[#F9F8F4]/30 flex flex-col shrink-0">
          <div className="p-4 border-b border-[#6D736E]/10 bg-white">
            <h3 className="font-bold text-xs text-[#6D736E] uppercase tracking-wider">Conversas Clínicas</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-2 flex flex-row md:flex-col gap-1.5 scrollbar-thin">
            {partnersLoading ? (
              <div className="flex flex-col gap-2 p-2 w-full">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : partners.length === 0 ? (
              <span className="text-xs text-[#6D736E] p-4 text-center w-full">Nenhum paciente ativo para conversar.</span>
            ) : (
              partners.map((p) => {
                const isSelected = selectedPartnerId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPartner(p.id, p.name)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg text-left text-xs sm:text-sm font-semibold transition-all shrink-0 md:shrink ${
                      isSelected 
                        ? 'bg-[#C16E59]/10 text-[#C16E59]' 
                        : 'text-[#6D736E] hover:bg-gray-100'
                    }`}
                  >
                    <div className={`p-1.5 rounded-full ${isSelected ? 'bg-[#C16E59]/10 text-[#C16E59]' : 'bg-gray-100 text-[#6D736E]'}`}>
                      <User className="h-4 w-4" />
                    </div>
                    <span className="truncate max-w-[120px] md:max-w-none">{p.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 2. CHAT THREAD BOX */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        
        {/* Chat Thread Header */}
        <div className="px-5 py-4 border-b border-[#6D736E]/10 flex items-center justify-between bg-[#F9F8F4]/20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-[#7A8B76]/10 text-[#7A8B76] rounded-full hidden sm:block">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm sm:text-base text-[#2C332D] truncate">
                {selectedPartnerId ? selectedPartnerName : 'Carregando chat...'}
              </span>
              <span className="text-[10px] text-[#6D736E] flex items-center gap-1">
                <span className={`inline-block w-2 h-2 rounded-full ${isPollingActive ? 'bg-emerald-500 animate-ping' : 'bg-red-500'}`} />
                {isPollingActive ? 'Sincronizado via Polling' : 'Falha na sincronização'}
              </span>
            </div>
          </div>
        </div>

        {/* Message Feed Canvas */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#F9F8F4]/10 scrollbar-thin">
          {messagesLoading ? (
            <div className="flex flex-col gap-3 py-6">
              <Skeleton className="h-10 w-2/3 rounded-xl" />
              <Skeleton className="h-12 w-1/2 rounded-xl self-end" />
              <Skeleton className="h-8 w-1/3 rounded-xl" />
            </div>
          ) : !selectedPartnerId ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-4">
              <div className="p-3 bg-[#7A8B76]/10 text-[#7A8B76] rounded-full">
                <User className="h-8 w-8" />
              </div>
              <div className="flex flex-col gap-1 max-w-sm">
                <p className="text-sm font-bold text-[#2C332D]">Sem profissional vinculado</p>
                <p className="text-xs text-[#6D736E] leading-relaxed">
                  Para ativar o chat terapêutico, você precisa estar vinculado a um psicólogo. Insira o código de convite recebido no seu painel principal.
                </p>
              </div>
              <Button onClick={() => window.location.assign('/paciente/dashboard')} variant="secondary" className="text-xs px-4 py-2">
                Ir para o Início / Vincular Convite
              </Button>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-3">
              <MessageCircle className="h-12 w-12 text-[#6D736E]/20" />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-bold text-[#2C332D]">Nenhuma mensagem enviada</p>
                <p className="text-xs text-[#6D736E]">Use o formulário abaixo para enviar as primeiras mensagens.</p>
              </div>
            </div>
          ) : (
            messages.map((m) => {
              const isMe = m.senderId === user.id;
              return (
                <div
                  key={m.id}
                  className={`flex flex-col max-w-[85%] sm:max-w-[70%] gap-1 ${
                    isMe ? 'ml-auto items-end' : 'mr-auto items-start'
                  }`}
                >
                  <div
                    className={`px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs ${
                      isMe
                        ? isProfessional ? 'bg-[#C16E59] text-white rounded-tr-none' : 'bg-[#7A8B76] text-white rounded-tr-none'
                        : 'bg-[#F9F8F4] border border-[#6D736E]/10 text-[#2C332D] rounded-tl-none'
                    }`}
                  >
                    {m.text}
                  </div>
                  <span className="text-[9px] text-[#6D736E] px-1 font-medium">
                    {formatTime(m.timestamp)}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <div className="p-4 border-t border-[#6D736E]/10 bg-white">
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              placeholder="Digite sua mensagem de apoio ou dúvida terapêutica..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!selectedPartnerId || !isPollingActive}
              className="flex-1 px-4 py-3 border border-[#6D736E]/20 rounded-lg text-sm bg-white text-[#2C332D] focus:outline-none focus:ring-2 focus:ring-[#7A8B76] focus:border-[#7A8B76] disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <Button
              type="submit"
              variant={isProfessional ? 'primary' : 'secondary'}
              disabled={!selectedPartnerId || !text.trim() || !isPollingActive}
              className="px-5 shrink-0 min-h-[44px] flex items-center justify-center"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>

      </div>

    </div>
  );
}
