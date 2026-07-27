/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

// --- BUTTON COMPONENT ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyle = 'inline-flex items-center justify-center font-bold rounded-full transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm min-h-[44px] px-6 py-2.5 shadow-sm';
  
  const variants = {
    primary: 'bg-[#C16E59] text-white hover:bg-[#b05e49] hover:shadow-md hover:shadow-[#C16E59]/25 focus:ring-2 focus:ring-[#C16E59] focus:ring-offset-2',
    secondary: 'bg-[#7A8B76] text-white hover:bg-[#6b7c67] hover:shadow-md hover:shadow-[#7A8B76]/25 focus:ring-2 focus:ring-[#7A8B76] focus:ring-offset-2',
    outline: 'border border-[#7A8B76]/30 text-[#2C332D] hover:bg-[#7A8B76]/5 focus:ring-2 focus:ring-[#7A8B76] focus:ring-offset-2',
    ghost: 'text-[#2C332D] hover:bg-[#7A8B76]/5 focus:ring-transparent',
    danger: 'bg-[#B54B3C] text-white hover:bg-[#a13f31] focus:ring-2 focus:ring-[#B54B3C] focus:ring-offset-2',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyle} ${variants[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="animate-spin mr-2 h-4 w-4" />
          Carregando...
        </>
      ) : (
        children
      )}
    </button>
  );
};

// --- INPUT COMPONENT ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="text-xs font-bold text-[#6D736E] tracking-wider uppercase">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-5 py-3 rounded-2xl border bg-white text-[#2C332D] transition-all duration-150 focus:outline-none focus:ring-2 ${
          error
            ? 'border-[#B54B3C] focus:ring-[#B54B3C]'
            : 'border-[#7A8B76]/20 focus:ring-[#7A8B76]/30 focus:border-[#7A8B76]'
        } ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-[#B54B3C] font-semibold">{error}</span>}
    </div>
  );
};

// --- CARD COMPONENT ---
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={`bg-white border border-[#7A8B76]/10 rounded-[24px] p-6 shadow-xs ${className}`} {...props}>
      {children}
    </div>
  );
};

// --- SKELETON COMPONENT ---
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return <div className={`animate-pulse bg-[#7A8B76]/10 rounded-2xl ${className}`} />;
};

// --- MODAL COMPONENT ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#2C332D]/40 backdrop-blur-xs" onClick={onClose} />
      
      {/* Modal Container */}
      <div className="relative bg-white rounded-[24px] shadow-xl w-full max-w-lg overflow-hidden border border-[#7A8B76]/15 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-[#7A8B76]/10">
          <h3 className="text-lg font-bold text-[#2C332D]">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="text-[#6D736E] hover:text-[#2C332D] transition-colors p-1 rounded-md hover:bg-[#F9F8F4] min-w-[32px] min-h-[32px] flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};

// --- EMPTY STATE ---
interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 bg-[#F9F8F4] border border-dashed border-[#7A8B76]/35 rounded-[24px] gap-4">
      {icon && <div className="text-[#7A8B76]/80">{icon}</div>}
      <div className="flex flex-col gap-1 max-w-md">
        <h4 className="text-base font-bold text-[#2C332D]">{title}</h4>
        <p className="text-sm text-[#6D736E]">{description}</p>
      </div>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="secondary">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
