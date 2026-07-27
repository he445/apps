/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md', onClick }) => {
  const sizeClasses = {
    sm: 'text-3xl',
    md: 'text-4xl',
    lg: 'text-5xl',
    xl: 'text-6xl',
  };

  return (
    <div 
      onClick={onClick}
      className={`select-none text-[#C16E59] tracking-normal font-logo inline-flex items-center ${sizeClasses[size]} ${className}`}
      style={{ 
        fontFamily: "'Caveat', 'Sacramento', cursive",
        lineHeight: 1.1
      }}
    >
      Oja
      <span 
        className="inline-block transform rotate-[-8deg] font-bold text-[#C16E59] mx-[1px]"
        style={{ textShadow: '0 1px 2px rgba(193, 110, 89, 0.2)' }}
      >
        n
      </span>
      uan
    </div>
  );
};
