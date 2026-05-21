import React from 'react';

export default function Button({ children, variant = 'primary', className = '', ...props }) {
  const base = 'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ease-out active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian';

  // Unified button style: dark background with light text for all variants
  const unified = 'bg-[rgba(15,23,42,0.96)] text-ink border border-white/8 shadow-sm hover:bg-[rgba(23,31,50,0.96)]';
  const variants = {
    primary: unified,
    secondary: unified,
    ghost: unified,
    danger: unified,
  };


  return (
    <button className={`${base} ${variants[variant] || variants.primary} ${className}`} {...props}>
      {children}
    </button>
  );
}
