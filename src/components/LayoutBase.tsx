/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Logo } from './Logo';
import { GhostBar } from './GhostBar';
import { 
  Users, 
  DollarSign, 
  User, 
  LogOut, 
  Home, 
  TrendingUp, 
  MessageSquare, 
  ShieldCheck,
  Stethoscope,
  Calendar,
  Sliders
} from 'lucide-react';

interface LayoutBaseProps {
  children: React.ReactNode;
}

export const LayoutBase: React.FC<LayoutBaseProps> = ({ children }) => {
  const { user, logout, isProfessional, isPatient, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  // Poll for unread messages (disabled for admin)
  useEffect(() => {
    if (!user || isAdmin) return;
    const checkUnread = async () => {
      try {
        const res = await api.get('/chat/messages/unread');
        setHasUnreadMessages(!!res.data?.hasUnread);
      } catch (err) {
        // Silent catch if server down or offline
      }
    };
    // Aba oculta não consulta: antes o badge seguia batendo no banco a cada 12 s
    // com a aba em segundo plano, impedindo a suspensão automática do Neon.
    const isVisible = () => document.visibilityState === 'visible';
    const tick = () => { if (isVisible()) checkUnread(); };

    if (isVisible()) checkUnread();
    const interval = setInterval(tick, 12000);
    const onVisibility = () => { if (isVisible()) checkUnread(); };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user, isAdmin, location.pathname]);

  // Public views (login, register, invite previews)
  if (!user) {
    return <div className="min-h-screen bg-[#F9F8F4]">{children}</div>;
  }

  // Navigation Items per Role
  const adminNavigation = [
    { name: 'Admin Hub', path: '/admin/dashboard', icon: Sliders, hasBadge: false },
    { name: 'Perfil', path: '/perfil', icon: User, hasBadge: false },
  ];

  const proNavigation = [
    { name: 'Pacientes', path: '/pro/dashboard', icon: Users, hasBadge: false },
    { name: 'Agenda', path: '/pro/agenda', icon: Calendar, hasBadge: false },
    { name: 'Financeiro', path: '/pro/financeiro', icon: DollarSign, hasBadge: false },
    { name: 'Perfil', path: '/perfil', icon: User, hasBadge: false },
  ];

  const patientNavigation = [
    { name: 'Início', path: '/paciente/dashboard', icon: Home, hasBadge: false },
    { name: 'Agenda', path: '/paciente/agenda', icon: Calendar, hasBadge: false },
    { name: 'Progresso', path: '/paciente/progresso', icon: TrendingUp, hasBadge: false },
    { name: 'Chat', path: '/paciente/chat', icon: MessageSquare, hasBadge: hasUnreadMessages },
    { name: 'Financeiro', path: '/paciente/financeiro', icon: DollarSign, hasBadge: false },
    { name: 'Perfil', path: '/perfil', icon: User, hasBadge: false },
  ];

  const currentNav = isAdmin ? adminNavigation : isProfessional ? proNavigation : patientNavigation;

  const handleTabClick = (path: string) => {
    navigate(path);
  };

  const getRoleBadge = () => {
    if (isAdmin) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 text-amber-400 border border-slate-700 w-fit mt-1">
          <Sliders className="h-3.5 w-3.5" />
          <span className="text-[11px] font-bold uppercase tracking-wider">Administrador</span>
        </div>
      );
    }
    if (isProfessional) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F9F8F4] border border-[#7A8B76]/15 w-fit mt-1">
          <Stethoscope className="h-3.5 w-3.5 text-[#C16E59]" />
          <span className="text-[11px] font-bold text-[#C16E59] uppercase tracking-wider">Psicólogo(a)</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F9F8F4] border border-[#7A8B76]/15 w-fit mt-1">
        <ShieldCheck className="h-3.5 w-3.5 text-[#7A8B76]" />
        <span className="text-[11px] font-bold text-[#7A8B76] uppercase tracking-wider">Paciente</span>
      </div>
    );
  };

  const getHomeRoute = () => {
    if (isAdmin) return '/admin/dashboard';
    if (isProfessional) return '/pro/dashboard';
    return '/paciente/dashboard';
  };

  return (
    <div className="min-h-screen bg-[#F9F8F4] flex flex-col antialiased">
      <GhostBar />
      <div className="flex flex-1 relative min-h-0">
        
        {/* --- DESKTOP SIDEBAR (FOR ALL ROLES ON SCREENS >= 768px) --- */}
        <aside className="hidden md:flex flex-col w-64 bg-white border-r border-[#7A8B76]/15 shrink-0 sticky top-0 h-screen p-6 justify-between shadow-2xs z-30">
          <div className="flex flex-col gap-6">
            
            {/* Logo & Role Badge */}
            <div className="flex flex-col gap-2">
              <Logo size="md" onClick={() => navigate(getHomeRoute())} className="cursor-pointer" />
              {getRoleBadge()}
            </div>

            {/* Navigation Menu */}
            <nav className="flex flex-col gap-1.5 mt-2">
              {currentNav.map((tab) => {
                const Icon = tab.icon;
                const isActive = location.pathname === tab.path || 
                  (tab.path === '/pro/dashboard' && location.pathname.startsWith('/pro/paciente/'));
                const isChatTab = tab.name === 'Chat';
                const showBadge = isChatTab && hasUnreadMessages && location.pathname !== '/paciente/chat';
                
                return (
                  <button
                    key={tab.path}
                    onClick={() => handleTabClick(tab.path)}
                    className={`flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 text-left active-press cursor-pointer ${
                      isActive 
                        ? isAdmin
                          ? 'bg-slate-900 text-amber-400 font-bold shadow-2xs'
                          : isProfessional
                            ? 'bg-[#C16E59]/10 text-[#C16E59] font-bold shadow-2xs'
                            : 'bg-[#7A8B76]/10 text-[#7A8B76] font-bold shadow-2xs'
                        : 'text-[#6D736E] hover:bg-[#F9F8F4] hover:text-[#2C332D]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.3px]' : 'stroke-[1.8px]'}`} />
                      <span>{tab.name}</span>
                    </div>

                    {showBadge && (
                      <span className="w-2.5 h-2.5 bg-[#B54B3C] rounded-full animate-pulse shadow-xs" title="Nova mensagem não lida" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* User Profile Card & Logout */}
          <div className="flex flex-col gap-3 border-t border-[#7A8B76]/15 pt-4">
            <div className="px-3 flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-[#6D736E] uppercase tracking-wider">Conta Conectada</span>
              <p className="text-sm font-bold text-[#2C332D] truncate">{user.name}</p>
              <p className="text-xs text-[#6D736E] truncate">{user.email}</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-[#B54B3C] hover:bg-red-50/60 transition-all font-bold cursor-pointer active-press"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair da Conta</span>
            </button>
          </div>
        </aside>

        {/* --- MOBILE TOP HEADER (< 768px) --- */}
        <div className="flex flex-col flex-1 min-w-0">
          
          <header className="md:hidden glass-header border-b border-[#7A8B76]/15 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
            <div className="flex items-center gap-2">
              <Logo size="sm" onClick={() => navigate(getHomeRoute())} className="cursor-pointer" />
              <span 
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  isAdmin 
                    ? 'bg-slate-900 text-amber-400' 
                    : isProfessional 
                      ? 'bg-[#C16E59]/10 text-[#C16E59]' 
                      : 'bg-[#7A8B76]/10 text-[#7A8B76]'
                }`}
              >
                {isAdmin ? 'Admin' : isProfessional ? 'Psicólogo' : 'Paciente'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right max-w-[120px] sm:max-w-none truncate">
                <p className="text-xs font-bold text-[#2C332D] truncate">{user.name}</p>
              </div>
              <button
                onClick={logout}
                title="Sair"
                className="text-[#B54B3C] p-2 hover:bg-red-50 rounded-xl min-w-[36px] min-h-[36px] flex items-center justify-center transition-colors cursor-pointer active-press"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* MAIN CONTENT CANVAS */}
          <main className="flex-1 pb-24 md:pb-6 overflow-x-hidden min-h-full">
            <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8 animate-fade-in">
              {children}
            </div>
          </main>

        </div>

        {/* --- ERGONOMIC MOBILE BOTTOM NAVIGATION BAR (< 768px) --- */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-nav border-t border-[#7A8B76]/15 h-16 flex items-center justify-around px-2 z-40 shadow-lg">
          {currentNav.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname === tab.path || 
              (tab.path === '/pro/dashboard' && location.pathname.startsWith('/pro/paciente/'));
            const isChatTab = tab.name === 'Chat';
            const showBadge = isChatTab && hasUnreadMessages && location.pathname !== '/paciente/chat';

            return (
              <button
                key={tab.path}
                onClick={() => handleTabClick(tab.path)}
                className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 px-1 transition-all text-[11px] font-semibold min-h-[44px] cursor-pointer active-press relative ${
                  isActive 
                    ? isAdmin
                      ? 'text-slate-900 font-bold scale-105'
                      : isProfessional 
                        ? 'text-[#C16E59] font-bold scale-105' 
                        : 'text-[#7A8B76] font-bold scale-105'
                    : 'text-[#6D736E] hover:text-[#2C332D]'
                }`}
              >
                <div className={`p-1 rounded-full relative ${
                  isActive ? (isAdmin ? 'bg-amber-100' : isProfessional ? 'bg-[#C16E59]/10' : 'bg-[#7A8B76]/10') : ''
                }`}>
                  <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.4px]' : 'stroke-[1.8px]'}`} />
                  {showBadge && (
                    <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#B54B3C] border-2 border-white rounded-full animate-pulse shadow-xs" />
                  )}
                </div>
                <span className="truncate">{tab.name}</span>
              </button>
            );
          })}
        </nav>

      </div>
    </div>
  );
};
