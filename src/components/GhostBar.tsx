/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft, Eye } from 'lucide-react';

export const GhostBar: React.FC = () => {
  const { user, isImpersonated, exitImpersonation } = useAuth();

  if (!isImpersonated || !user) return null;

  return (
    <div className="bg-amber-500 text-slate-950 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-50 shadow-md border-b border-amber-600/30 text-xs sm:text-sm font-medium">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-1 rounded-md bg-amber-400/60 flex items-center justify-center shrink-0">
          <ShieldAlert className="w-4 h-4 text-slate-950 animate-pulse" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap truncate">
          <span className="font-extrabold uppercase tracking-wider text-[11px] bg-slate-950 text-amber-300 px-2 py-0.5 rounded">
            Ghost Mode
          </span>
          <span className="truncate">
            Simulando: <strong className="font-bold">{user.name}</strong> ({user.role === 'PROFESSIONAL' ? 'Psicólogo(a)' : 'Paciente'})
          </span>
          <span className="hidden md:inline text-amber-900 font-normal">
            • Ações auditadas (RFC 8693)
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={exitImpersonation}
          className="bg-slate-950 text-amber-400 hover:bg-slate-900 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Sair e Voltar ao Admin</span>
        </button>
      </div>
    </div>
  );
};
